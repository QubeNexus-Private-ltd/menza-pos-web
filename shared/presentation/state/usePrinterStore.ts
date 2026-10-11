import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BluetoothPrinterService, BluetoothDevice } from '../../data/datasources/BluetoothPrinterService';
import { PaperWidth, ReceiptData, EscPosBuilder } from '../../core/printer/EscPosBuilder';
import { logger } from '../../core/logging';

const STORAGE_KEYS = {
  SAVED_DEVICE: '@menza_printer_saved_device',
  PAPER_WIDTH: '@menza_printer_paper_width',
  AUTO_PRINT_RECEIPT: '@menza_printer_auto_print_receipt',
  AUTO_PRINT_KOT: '@menza_printer_auto_print_kot',
  CUSTOM_FOOTER: '@menza_printer_custom_footer',
};

interface PrinterState {
  connectedDevice: BluetoothDevice | null;
  savedDevice: BluetoothDevice | null;
  pairedDevices: BluetoothDevice[];
  discoveredDevices: BluetoothDevice[];
  isBluetoothEnabled: boolean;
  isScanning: boolean;
  isConnecting: boolean;
  isPrinting: boolean;
  paperWidth: PaperWidth;
  autoPrintReceipt: boolean;
  autoPrintKot: boolean;
  customFooter: string;
  isInitialized: boolean;
  lastErrorMessage: string | null;

  // Actions
  init: () => Promise<void>;
  checkStatus: () => Promise<boolean>;
  enableBluetooth: () => Promise<boolean>;
  openBluetoothSettings: () => Promise<boolean>;
  scanDevices: () => Promise<void>;
  connectDevice: (device: BluetoothDevice) => Promise<boolean>;
  disconnectDevice: () => Promise<boolean>;
  setPaperWidth: (width: PaperWidth) => Promise<void>;
  setAutoPrintReceipt: (enabled: boolean) => Promise<void>;
  setAutoPrintKot: (enabled: boolean) => Promise<void>;
  setCustomFooter: (footer: string) => Promise<void>;
  ensureConnection: () => Promise<boolean>;
  printReceipt: (data: ReceiptData) => Promise<boolean>;
  printKot: (data: ReceiptData) => Promise<boolean>;
  printBifurcatedOrder: (data: ReceiptData) => Promise<{ receiptPrinted: boolean; kotPrinted: boolean }>;
  printTestReceipt: (restaurantName?: string) => Promise<boolean>;
  printTestKot: (restaurantName?: string) => Promise<boolean>;
  clearError: () => void;
}

const printerService = BluetoothPrinterService.getInstance();

export const usePrinterStore = create<PrinterState>((set, get) => ({
  connectedDevice: null,
  savedDevice: null,
  pairedDevices: [],
  discoveredDevices: [],
  isBluetoothEnabled: false,
  isScanning: false,
  isConnecting: false,
  isPrinting: false,
  paperWidth: '58mm',
  autoPrintReceipt: true,
  autoPrintKot: true,
  customFooter: 'Thank you! Please visit again.',
  isInitialized: false,
  lastErrorMessage: null,

  init: async () => {
    try {
      // 1. Load preferences from AsyncStorage
      const [savedDeviceRaw, paperWidthRaw, autoPrintRaw, autoKotRaw, footerRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SAVED_DEVICE),
        AsyncStorage.getItem(STORAGE_KEYS.PAPER_WIDTH),
        AsyncStorage.getItem(STORAGE_KEYS.AUTO_PRINT_RECEIPT),
        AsyncStorage.getItem(STORAGE_KEYS.AUTO_PRINT_KOT),
        AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_FOOTER),
      ]);

      const savedDevice = savedDeviceRaw ? JSON.parse(savedDeviceRaw) : null;
      const paperWidth = (paperWidthRaw as PaperWidth) || '58mm';
      const autoPrintReceipt = autoPrintRaw !== null ? autoPrintRaw === 'true' : true;
      const autoPrintKot = autoKotRaw !== null ? autoKotRaw === 'true' : true;
      const customFooter = footerRaw || 'Thank you! Please visit again.';

      set({
        savedDevice,
        paperWidth,
        autoPrintReceipt,
        autoPrintKot,
        customFooter,
        isInitialized: true,
      });

      // 2. Check live Bluetooth state
      const isEnabled = await printerService.isBluetoothEnabled();
      const connected = await printerService.getConnectedDevice();

      set({
        isBluetoothEnabled: isEnabled,
        connectedDevice: connected,
      });

      // 3. Auto-reconnect to saved printer if available and not yet connected
      if (!connected && savedDevice && isEnabled) {
        try {
          const res = await printerService.connect(savedDevice.address);
          if (res && res.success) {
            set({
              connectedDevice: {
                name: res.name || savedDevice.name,
                address: res.address || savedDevice.address,
                isConnected: true,
              },
            });
          }
        } catch (autoErr: any) {
          logger.warn('PRINTER', 'AUTO_RECONNECT_SKIPPED', 'Auto-reconnect skipped', { error: autoErr?.message });
        }
      }
    } catch (err: any) {
      console.warn('Failed to initialize printer store:', err);
    }
  },

  checkStatus: async () => {
    try {
      const isEnabled = await printerService.isBluetoothEnabled();
      const isConn = isEnabled ? await printerService.isConnected() : false;
      const connectedDev = isConn ? await printerService.getConnectedDevice() : null;

      set({
        isBluetoothEnabled: isEnabled,
        connectedDevice: connectedDev,
      });
      return isConn;
    } catch {
      set({ isBluetoothEnabled: false, connectedDevice: null });
      return false;
    }
  },

  enableBluetooth: async () => {
    try {
      const ok = await printerService.enableBluetooth();
      // Recheck status after enabling
      setTimeout(async () => {
        const isEnabled = await printerService.isBluetoothEnabled();
        set({ isBluetoothEnabled: isEnabled });
      }, 1000);
      return ok;
    } catch {
      return false;
    }
  },

  openBluetoothSettings: async () => {
    try {
      return await printerService.openBluetoothSettings();
    } catch {
      return false;
    }
  },

  scanDevices: async () => {
    try {
      set({ isScanning: true, lastErrorMessage: null });

      const isEnabled = await printerService.isBluetoothEnabled();
      set({ isBluetoothEnabled: isEnabled });

      if (!isEnabled) {
        set({
          isScanning: false,
          pairedDevices: [],
          discoveredDevices: [],
          lastErrorMessage: 'Bluetooth is turned off. Please turn on your Bluetooth first.',
        });
        throw new Error('Bluetooth is turned off. Please turn on your Bluetooth first.');
      }

      const paired = await printerService.getPairedDevices();
      // Instantly show paired devices in the UI list so user doesn't wait with an empty list
      set({
        pairedDevices: paired,
        discoveredDevices: paired.length > 0 ? paired : get().discoveredDevices,
      });

      const discovered = await printerService.scanDevices();
      // Merge paired and discovered devices without duplicate MAC addresses
      const deviceMap = new Map<string, BluetoothDevice>();
      for (const d of discovered) {
        if (d.address) deviceMap.set(d.address, d);
      }
      for (const p of paired) {
        if (p.address && !deviceMap.has(p.address)) {
          deviceMap.set(p.address, p);
        }
      }

      set({ discoveredDevices: Array.from(deviceMap.values()), isScanning: false });
    } catch (err: any) {
      set({
        isScanning: false,
        lastErrorMessage: err?.message || 'Failed to scan Bluetooth devices',
      });
      throw err;
    }
  },

  connectDevice: async (device: BluetoothDevice) => {
    try {
      set({ isConnecting: true, lastErrorMessage: null });
      const res = await printerService.connect(device.address);

      if (res && res.success) {
        const connectedInfo: BluetoothDevice = {
          name: res.name || device.name,
          address: res.address || device.address,
          isConnected: true,
          isPaired: true,
        };

        set({
          connectedDevice: connectedInfo,
          savedDevice: connectedInfo,
          isConnecting: false,
        });

        // Save to persistent storage for automatic 1-tap reconnection
        await AsyncStorage.setItem(
          STORAGE_KEYS.SAVED_DEVICE,
          JSON.stringify(connectedInfo)
        );

        return true;
      } else {
        set({ isConnecting: false, lastErrorMessage: 'Connection failed' });
        return false;
      }
    } catch (err: any) {
      set({
        isConnecting: false,
        lastErrorMessage: err?.message || 'Could not connect to printer',
      });
      throw err;
    }
  },

  disconnectDevice: async () => {
    try {
      await printerService.disconnect();
      set({ connectedDevice: null });
      return true;
    } catch (err: any) {
      set({ lastErrorMessage: err?.message || 'Failed to disconnect' });
      return false;
    }
  },

  setPaperWidth: async (width: PaperWidth) => {
    set({ paperWidth: width });
    await AsyncStorage.setItem(STORAGE_KEYS.PAPER_WIDTH, width);
  },

  setAutoPrintReceipt: async (enabled: boolean) => {
    set({ autoPrintReceipt: enabled });
    await AsyncStorage.setItem(STORAGE_KEYS.AUTO_PRINT_RECEIPT, String(enabled));
  },

  setAutoPrintKot: async (enabled: boolean) => {
    set({ autoPrintKot: enabled });
    await AsyncStorage.setItem(STORAGE_KEYS.AUTO_PRINT_KOT, String(enabled));
  },

  setCustomFooter: async (footer: string) => {
    set({ customFooter: footer });
    await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_FOOTER, footer);
  },

  ensureConnection: async () => {
    try {
      const isEnabled = await printerService.isBluetoothEnabled();
      set({ isBluetoothEnabled: isEnabled });
      if (!isEnabled) {
        return false;
      }

      // Check active connection
      const isConn = await printerService.isConnected();
      if (isConn) {
        const currentDev = await printerService.getConnectedDevice();
        if (currentDev) {
          set({ connectedDevice: currentDev, isBluetoothEnabled: true });
          return true;
        }
      }

      // Attempt auto-reconnect using saved device
      let saved = get().savedDevice;
      if (!saved) {
        const savedRaw = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_DEVICE);
        if (savedRaw) {
          try {
            saved = JSON.parse(savedRaw);
            set({ savedDevice: saved });
          } catch {}
        }
      }

      if (saved && saved.address) {
        set({ isConnecting: true });
        const res = await printerService.connect(saved.address);
        set({ isConnecting: false });
        if (res && res.success) {
          const dev: BluetoothDevice = {
            name: res.name || saved.name,
            address: res.address || saved.address,
            isConnected: true,
          };
          set({ connectedDevice: dev, isBluetoothEnabled: true });
          return true;
        }
      }

      return false;
    } catch (err: any) {
      set({ isConnecting: false });
      return false;
    }
  },

  printReceipt: async (data: ReceiptData) => {
    let { paperWidth, customFooter, connectedDevice } = get();
    if (!connectedDevice) {
      await get().ensureConnection();
      connectedDevice = get().connectedDevice;
    }
    if (!connectedDevice) {
      throw new Error('No Bluetooth printer connected. Please connect your printer in Printer Settings.');
    }

    try {
      set({ isPrinting: true, lastErrorMessage: null });
      const payload: ReceiptData = {
        ...data,
        footerMessage: data.footerMessage || customFooter,
      };
      const ok = await printerService.printReceipt(payload, paperWidth);
      set({ isPrinting: false });
      return ok;
    } catch (err: any) {
      set({
        isPrinting: false,
        lastErrorMessage: err?.message || 'Failed to print receipt',
      });
      throw err;
    }
  },

  printKot: async (data: ReceiptData) => {
    let { paperWidth, connectedDevice } = get();
    if (!connectedDevice) {
      await get().ensureConnection();
      connectedDevice = get().connectedDevice;
    }
    if (!connectedDevice) {
      throw new Error('No Bluetooth printer connected. Please connect your printer in Printer Settings.');
    }

    try {
      set({ isPrinting: true, lastErrorMessage: null });
      const ok = await printerService.printKot(data, paperWidth);
      set({ isPrinting: false });
      return ok;
    } catch (err: any) {
      set({
        isPrinting: false,
        lastErrorMessage: err?.message || 'Failed to print KOT',
      });
      throw err;
    }
  },

  printBifurcatedOrder: async (data: ReceiptData) => {
    let { paperWidth, customFooter, connectedDevice, autoPrintReceipt, autoPrintKot } = get();
    if (!connectedDevice) {
      await get().ensureConnection();
      connectedDevice = get().connectedDevice;
    }
    if (!connectedDevice) {
      throw new Error('No Bluetooth printer connected. Please connect your printer in Printer Settings.');
    }

    try {
      set({ isPrinting: true, lastErrorMessage: null });
      const payload: ReceiptData = {
        ...data,
        footerMessage: data.footerMessage || customFooter,
      };
      const res = await printerService.printBifurcatedOrder(payload, paperWidth, autoPrintReceipt, autoPrintKot);
      set({ isPrinting: false });
      return res;
    } catch (err: any) {
      set({
        isPrinting: false,
        lastErrorMessage: err?.message || 'Failed to print bifurcated order',
      });
      throw err;
    }
  },

  printTestReceipt: async (restaurantName?: string) => {
    const { paperWidth, connectedDevice } = get();
    if (!connectedDevice) {
      throw new Error('Please connect a Bluetooth thermal printer first.');
    }

    try {
      set({ isPrinting: true, lastErrorMessage: null });
      const ok = await printerService.printTestReceipt(restaurantName, paperWidth);
      set({ isPrinting: false });
      return ok;
    } catch (err: any) {
      set({
        isPrinting: false,
        lastErrorMessage: err?.message || 'Failed to print test receipt',
      });
      throw err;
    }
  },

  printTestKot: async (restaurantName?: string) => {
    const { paperWidth, connectedDevice } = get();
    if (!connectedDevice) {
      throw new Error('Please connect a Bluetooth thermal printer first.');
    }

    try {
      set({ isPrinting: true, lastErrorMessage: null });
      const ok = await printerService.printTestKot(restaurantName, paperWidth);
      set({ isPrinting: false });
      return ok;
    } catch (err: any) {
      set({
        isPrinting: false,
        lastErrorMessage: err?.message || 'Failed to print test KOT',
      });
      throw err;
    }
  },

  clearError: () => set({ lastErrorMessage: null }),
}));
