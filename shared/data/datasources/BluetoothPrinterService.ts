import { NativeModules, Platform, PermissionsAndroid, Linking } from 'react-native';
import { EscPosBuilder, ReceiptData, PaperWidth } from '../../core/printer/EscPosBuilder';
import { logger } from '../../core/logging';
import { useAuthStore } from '../../presentation/state/useAuthStore';
import { RestaurantConfigRemoteDataSource } from './RestaurantConfigRemoteDataSource';

export interface BluetoothDevice {
  name: string;
  address: string;
  isPaired?: boolean;
  type?: number;
  isConnected?: boolean;
}

const { BluetoothPrinter } = NativeModules;

export class BluetoothPrinterService {
  private static instance: BluetoothPrinterService;

  static getInstance(): BluetoothPrinterService {
    if (!BluetoothPrinterService.instance) {
      BluetoothPrinterService.instance = new BluetoothPrinterService();
    }
    return BluetoothPrinterService.instance;
  }

  /** Check if native module is linked */
  isNativeModuleAvailable(): boolean {
    return Platform.OS === 'android' && !!BluetoothPrinter;
  }

  /** Check & Request Bluetooth runtime permissions for Android */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);

      if (apiLevel >= 31) {
        // Android 12+ (API 31+) permissions
        const scanGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
        const connectGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);

        if (scanGranted && connectGranted) {
          return true;
        }

        const statuses = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);

        return (
          statuses[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
          statuses[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        // Android 6 - 11 permissions (Location needed for Bluetooth discovery)
        const locationGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        if (locationGranted) return true;

        const status = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Bluetooth Printer Permission',
            message: 'Menza requires Location access to discover nearby Bluetooth thermal printers.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          }
        );
        return status === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (err: any) {
      logger.error('PRINTER', 'PERMISSIONS_ERROR', err);
      return false;
    }
  }

  /** Check if Bluetooth permissions are already granted on Android */
  async hasPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
      const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
      if (apiLevel >= 31) {
        const scanGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
        const connectGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
        return scanGranted && connectGranted;
      } else {
        return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      }
    } catch {
      return false;
    }
  }

  /** Check if device has Bluetooth hardware */
  async isBluetoothAvailable(): Promise<boolean> {
    if (!this.isNativeModuleAvailable()) return false;
    try {
      return await BluetoothPrinter.isBluetoothAvailable();
    } catch {
      return false;
    }
  }

  /** Check if Bluetooth is currently turned on */
  async isBluetoothEnabled(): Promise<boolean> {
    if (!this.isNativeModuleAvailable()) return false;
    try {
      return await BluetoothPrinter.isBluetoothEnabled();
    } catch {
      return false;
    }
  }

  /** Prompt user to turn on Bluetooth or open Bluetooth settings */
  async enableBluetooth(): Promise<boolean> {
    if (Platform.OS === 'android') {
      if (this.isNativeModuleAvailable() && BluetoothPrinter.enableBluetooth) {
        try {
          return await BluetoothPrinter.enableBluetooth();
        } catch {}
      }
      try {
        await Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS');
        return true;
      } catch {
        try {
          await Linking.openSettings();
          return true;
        } catch {
          return false;
        }
      }
    }
    return false;
  }

  /** Open phone Bluetooth settings */
  async openBluetoothSettings(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        if (this.isNativeModuleAvailable() && BluetoothPrinter.openBluetoothSettings) {
          try {
            return await BluetoothPrinter.openBluetoothSettings();
          } catch {}
        }
        await Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS');
        return true;
      } else {
        await Linking.openSettings();
        return true;
      }
    } catch {
      try {
        await Linking.openSettings();
        return true;
      } catch {
        return false;
      }
    }
  }

  /** Check if a printer is actively connected */
  async isConnected(): Promise<boolean> {
    if (!this.isNativeModuleAvailable()) return false;
    try {
      return await BluetoothPrinter.isConnected();
    } catch {
      return false;
    }
  }

  /** Get details of current connected printer */
  async getConnectedDevice(): Promise<BluetoothDevice | null> {
    if (!this.isNativeModuleAvailable()) return null;
    try {
      return await BluetoothPrinter.getConnectedDevice();
    } catch {
      return null;
    }
  }

  /** Get paired/bonded Bluetooth devices */
  async getPairedDevices(): Promise<BluetoothDevice[]> {
    if (!this.isNativeModuleAvailable()) return [];
    try {
      const isEnabled = await this.isBluetoothEnabled();
      if (!isEnabled) {
        return [];
      }
      const hasPerm = await this.requestPermissions();
      if (!hasPerm) {
        throw new Error('Bluetooth permissions not granted.');
      }
      const devices = await BluetoothPrinter.getPairedDevices();
      return Array.isArray(devices) ? devices : [];
    } catch (err: any) {
      logger.error('PRINTER', 'PAIRED_DEVICES_ERROR', err);
      return [];
    }
  }

  /** Scan for nearby Bluetooth devices */
  async scanDevices(): Promise<BluetoothDevice[]> {
    if (!this.isNativeModuleAvailable()) {
      throw new Error('Bluetooth printer service is not available on this device.');
    }

    const isEnabled = await this.isBluetoothEnabled();
    if (!isEnabled) {
      throw new Error('Bluetooth is turned off. Please turn on your Bluetooth first.');
    }

    const hasPerm = await this.requestPermissions();
    if (!hasPerm) {
      throw new Error('Bluetooth permissions are required to scan for printers.');
    }

    try {
      const devices = await BluetoothPrinter.scanDevices();
      return Array.isArray(devices) ? devices : [];
    } catch (err: any) {
      logger.error('PRINTER', 'SCAN_DEVICES_ERROR', err);
      // Fallback: If hardware discovery throws an error (e.g. system radio busy), return paired devices
      try {
        const paired = await this.getPairedDevices();
        if (paired && paired.length > 0) {
          return paired;
        }
      } catch {}
      throw err;
    }
  }

  /** Pair an unbonded Bluetooth device */
  async pairDevice(address: string): Promise<boolean> {
    if (!this.isNativeModuleAvailable()) return false;
    try {
      return await BluetoothPrinter.pairDevice(address);
    } catch (err: any) {
      logger.error('PRINTER', 'PAIR_DEVICE_ERROR', err);
      return false;
    }
  }

  /** Connect to a printer by MAC Address */
  async connect(address: string): Promise<{ success: boolean; name?: string; address?: string }> {
    if (!this.isNativeModuleAvailable()) {
      throw new Error('Bluetooth printer service is not available on this device.');
    }

    const isEnabled = await this.isBluetoothEnabled();
    if (!isEnabled) {
      throw new Error('Bluetooth is turned off. Please turn on your Bluetooth first.');
    }

    const hasPerm = await this.requestPermissions();
    if (!hasPerm) {
      throw new Error('Bluetooth permissions are required to connect.');
    }

    try {
      const result = await BluetoothPrinter.connect(address);
      return result || { success: true, address };
    } catch (err: any) {
      logger.error('PRINTER', 'CONNECT_ERROR', err);
      const rawMsg = err?.message || '';
      if (rawMsg.includes('read failed') || rawMsg.includes('socket might closed') || rawMsg.includes('timeout')) {
        throw new Error(
          'Printer rejected connection. Please check:\n' +
          '1. If another phone is connected, disconnect or turn off Bluetooth on that phone.\n' +
          '2. Pair this printer first in Phone Settings → Bluetooth (PIN: 0000 or 1234).\n' +
          '3. Restart printer power (turn off & on) and try again.'
        );
      }
      throw err;
    }
  }

  /** Disconnect active printer */
  async disconnect(): Promise<boolean> {
    if (!this.isNativeModuleAvailable()) return true;
    try {
      return await BluetoothPrinter.disconnect();
    } catch (err: any) {
      logger.error('PRINTER', 'DISCONNECT_ERROR', err);
      return true;
    }
  }

  /** Print raw ESC/POS byte array directly to Bluetooth printer */
  async printBytes(bytes: number[]): Promise<boolean> {
    if (!this.isNativeModuleAvailable()) {
      throw new Error('Bluetooth printer service is not available on this device.');
    }

    const isEnabled = await this.isBluetoothEnabled();
    if (!isEnabled) {
      throw new Error('Bluetooth is turned off. Please turn on Bluetooth.');
    }

    try {
      const isConn = await this.isConnected();
      if (!isConn) {
        throw new Error('No Bluetooth printer connected. Please connect a printer in Settings.');
      }

      return await BluetoothPrinter.printBytes(bytes);
    } catch (err: any) {
      logger.error('PRINTER', 'PRINT_BYTES_ERROR', err);
      throw err;
    }
  }

  /** Print plain text string to printer */
  async printText(text: string): Promise<boolean> {
    if (!this.isNativeModuleAvailable()) {
      throw new Error('Bluetooth printer service is not available on this device.');
    }

    const isEnabled = await this.isBluetoothEnabled();
    if (!isEnabled) {
      throw new Error('Bluetooth is turned off. Please turn on Bluetooth.');
    }

    try {
      const isConn = await this.isConnected();
      if (!isConn) {
        throw new Error('No Bluetooth printer connected.');
      }
      return await BluetoothPrinter.printText(text);
    } catch (err: any) {
      logger.error('PRINTER', 'PRINT_TEXT_ERROR', err);
      throw err;
    }
  }

  private static logoCache = new Map<string, { widthBytes: number; heightDots: number; bytes: number[] }>();
  private static cachedConfig: any = null;

  /**
   * Centralized ReceiptData enrichment pipeline.
   * Automatically fills missing restaurantName, address, contactPhone, logoUrl,
   * upiId, upiPayeeName, showUpiQr, and gstNumber from Zustand stores
   * or cached RestaurantConfig so individual screens never fail to print logos or QR codes.
   */
  async enrichReceiptData(data: ReceiptData): Promise<ReceiptData> {
    const authState = useAuthStore.getState();
    const activeRest = (authState.activeRestaurant || authState.restaurants?.[0]) as any;

    let logoUrl = (
      data.logoUrl ||
      activeRest?.logoUrl ||
      activeRest?.imageUrl ||
      BluetoothPrinterService.cachedConfig?.logoUrl ||
      ''
    ).trim();

    let upiId = (
      data.upiId ||
      activeRest?.bankerUpiId ||
      activeRest?.upiId ||
      BluetoothPrinterService.cachedConfig?.bankerUpiId ||
      ''
    ).trim();

    let upiPayeeName =
      data.upiPayeeName ||
      activeRest?.bankerAccountHolderName ||
      activeRest?.restaurantName ||
      BluetoothPrinterService.cachedConfig?.bankerAccountHolderName ||
      BluetoothPrinterService.cachedConfig?.restaurantName ||
      'Menza Restaurant';

    let showUpiQr =
      data.showUpiQr !== undefined
        ? data.showUpiQr
        : (activeRest?.printUpiQrOnReceipts !== false &&
           BluetoothPrinterService.cachedConfig?.printUpiQrOnReceipts !== false);

    let gstNumber =
      data.gstNumber ||
      activeRest?.gstNumber ||
      activeRest?.gstin ||
      BluetoothPrinterService.cachedConfig?.gstNumber ||
      undefined;

    const restId = Number(activeRest?.restaurantId || (globalThis as any).__MENZA_ACTIVE_REST_ID__ || 0);

    // Quick remote fetch if logo or UPI is not yet known
    if ((!logoUrl || !upiId) && restId > 0 && !BluetoothPrinterService.cachedConfig) {
      try {
        const ds = new RestaurantConfigRemoteDataSource();
        const cfg = await Promise.race([
          ds.getConfig(restId),
          new Promise<null>((res) => setTimeout(() => res(null), 1500)),
        ]);
        if (cfg) {
          BluetoothPrinterService.cachedConfig = cfg;
          if (!logoUrl && cfg.logoUrl) logoUrl = cfg.logoUrl.trim();
          if (!upiId && cfg.bankerUpiId) upiId = cfg.bankerUpiId.trim();
          if (!upiPayeeName && (cfg.bankerAccountHolderName || cfg.restaurantName)) {
            upiPayeeName = cfg.bankerAccountHolderName || cfg.restaurantName;
          }
          if (data.showUpiQr === undefined && cfg.printUpiQrOnReceipts !== undefined) {
            showUpiQr = cfg.printUpiQrOnReceipts !== false;
          }
          if (!gstNumber && cfg.gstNumber) gstNumber = cfg.gstNumber;
        }
      } catch {
        // Silently proceed
      }
    }

    return {
      ...data,
      restaurantName: data.restaurantName || activeRest?.restaurantName || 'Menza Restaurant',
      address: data.address || activeRest?.address || undefined,
      city: data.city || activeRest?.city || undefined,
      state: data.state || activeRest?.state || undefined,
      contactPhone: data.contactPhone || activeRest?.contactNumber || activeRest?.ownerMobile || undefined,
      logoUrl: logoUrl || undefined,
      upiId: upiId || undefined,
      upiPayeeName,
      showUpiQr,
      gstNumber,
    };
  }

  /** Rasterize store logo from URL to ESC/POS monochrome bitmap */
  async rasterizeStoreLogo(logoUrl: string, maxWidthDots: number = 384): Promise<{ widthBytes: number; heightDots: number; bytes: number[] } | null> {
    if (!logoUrl || !logoUrl.trim()) return null;
    const cleanUrl = logoUrl.trim();
    if (BluetoothPrinterService.logoCache.has(cleanUrl)) {
      return BluetoothPrinterService.logoCache.get(cleanUrl)!;
    }

    if (!this.isNativeModuleAvailable()) return null;

    try {
      const result = await BluetoothPrinter.rasterizeImage(cleanUrl, maxWidthDots);
      if (result && result.bytes && result.bytes.length > 0) {
        const logoData: { widthBytes: number; heightDots: number; bytes: number[] } = {
          widthBytes: Number(result.widthBytes),
          heightDots: Number(result.heightDots),
          bytes: (result.bytes as number[]).map((b: any) => Number(b)),
        };
        BluetoothPrinterService.logoCache.set(cleanUrl, logoData);
        return logoData;
      }
    } catch (err: any) {
      logger.warn('PRINTER', 'RASTERIZE_STORE_LOGO_FAILED', err?.message);
    }
    return null;
  }

  /** Print formatted customer tax receipt */
  async printReceipt(data: ReceiptData, paperWidth: PaperWidth = '58mm'): Promise<boolean> {
    const enriched = await this.enrichReceiptData(data);
    let receiptData = { ...enriched };
    if (!receiptData.logoBitmap && receiptData.logoUrl) {
      try {
        const maxDots = paperWidth === '80mm' ? 480 : 320;
        const rasterized = await this.rasterizeStoreLogo(receiptData.logoUrl, maxDots);
        if (rasterized) {
          receiptData.logoBitmap = rasterized;
        }
      } catch (err: any) {
        logger.warn('PRINTER', 'ATTACH_STORE_LOGO_FAILED', err?.message);
      }
    }

    const bytes = EscPosBuilder.buildReceipt(receiptData, paperWidth);
    return await this.printBytes(bytes);
  }

  /** Print formatted kitchen order ticket (KOT) */
  async printKot(data: ReceiptData, paperWidth: PaperWidth = '58mm'): Promise<boolean> {
    const bytes = EscPosBuilder.buildKot(data, paperWidth);
    return await this.printBytes(bytes);
  }

  /**
   * Prints both the Customer Tax Invoice and Kitchen KOT according to enabled settings, with auto-cut bifurcation.
   */
  async printBifurcatedOrder(
    data: ReceiptData,
    paperWidth: PaperWidth = '58mm',
    printReceiptEnabled: boolean = true,
    printKotEnabled: boolean = true
  ): Promise<{ receiptPrinted: boolean; kotPrinted: boolean }> {
    let receiptPrinted = false;
    let kotPrinted = false;

    // 1. Print Customer Tax Invoice if enabled (with cut at the end)
    if (printReceiptEnabled) {
      try {
        const enriched = await this.enrichReceiptData(data);
        let receiptData = { ...enriched };
        if (!receiptData.logoBitmap && receiptData.logoUrl) {
          const maxDots = paperWidth === '80mm' ? 480 : 320;
          const rasterized = await this.rasterizeStoreLogo(receiptData.logoUrl, maxDots);
          if (rasterized) {
            receiptData.logoBitmap = rasterized;
          }
        }
        const receiptBytes = EscPosBuilder.buildReceipt(receiptData, paperWidth);
        receiptPrinted = await this.printBytes(receiptBytes);
      } catch (receiptErr: any) {
        logger.error('PRINTER', 'BIFURCATED_RECEIPT_ERROR', receiptErr);
      }
    }

    // 2. Hardware motor guard pause (allows physical cutter blade to cycle and return)
    if (printReceiptEnabled && printKotEnabled && receiptPrinted) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // 3. Print Kitchen Order Ticket (KOT) if enabled (with cut at the end)
    if (printKotEnabled) {
      try {
        const kotBytes = EscPosBuilder.buildKot(data, paperWidth);
        kotPrinted = await this.printBytes(kotBytes);
      } catch (kotErr: any) {
        logger.error('PRINTER', 'BIFURCATED_KOT_ERROR', kotErr);
      }
    }

    return { receiptPrinted, kotPrinted };
  }

  /** Print a standard test receipt */
  async printTestReceipt(restaurantName?: string, paperWidth: PaperWidth = '58mm'): Promise<boolean> {
    const authState = useAuthStore.getState();
    const activeRest = (authState.activeRestaurant || authState.restaurants?.[0]) as any;

    const rawTestData: ReceiptData = {
      orderId: '101',
      orderNumber: '101',
      restaurantName: restaurantName || activeRest?.restaurantName || 'Menza Bistro',
      address: activeRest?.address || 'Menza POS Thermal Printer',
      contactPhone: activeRest?.contactNumber || activeRest?.ownerMobile,
      logoUrl: activeRest?.logoUrl || activeRest?.imageUrl,
      customerName: 'Guest Tester',
      tableName: 'Table 1',
      orderType: 'Dine In',
      items: [
        { itemName: 'Paneer Butter Masala', quantity: 2, unitPrice: 280, totalPrice: 560 },
        { itemName: 'Butter Naan', quantity: 4, unitPrice: 40, totalPrice: 160 },
        { itemName: 'Fresh Lime Soda', quantity: 1, unitPrice: 60, totalPrice: 60 },
      ],
      subtotal: 780,
      cgstAmount: 19.5,
      sgstAmount: 19.5,
      taxAmount: 39,
      grandTotal: 819,
      paymentMode: 'UPI',
      paymentStatus: 'PAID',
      date: new Date(),
      upiId: (activeRest?.bankerUpiId || activeRest?.upiId || 'menzahospitality@icici').trim(),
      upiPayeeName: activeRest?.bankerAccountHolderName || activeRest?.restaurantName || 'Menza Restaurant',
      showUpiQr: true,
      footerMessage: 'Thank you for dining with us! Please visit again.',
    };

    return await this.printReceipt(rawTestData, paperWidth);
  }

  /** Print a standard test KOT ticket */
  async printTestKot(restaurantName?: string, paperWidth: PaperWidth = '58mm'): Promise<boolean> {
    const bytes = EscPosBuilder.buildTestKot(restaurantName, paperWidth);
    return await this.printBytes(bytes);
  }

  /** Print a standalone Table QR Sticker to 58mm/80mm thermal roll */
  async printTableQrSticker(
    params: {
      restaurantName?: string;
      tableNumber: string | number;
      sectionName?: string;
      qrUrl: string;
      isRolling?: boolean;
      logoUrl?: string;
    },
    paperWidth: PaperWidth = '58mm'
  ): Promise<boolean> {
    const authState = useAuthStore.getState();
    const activeRest = (authState.activeRestaurant || authState.restaurants?.[0]) as any;

    const resolvedRestaurantName =
      params.restaurantName ||
      activeRest?.restaurantName ||
      BluetoothPrinterService.cachedConfig?.restaurantName ||
      'Menza Restaurant';

    const resolvedLogoUrl = (
      params.logoUrl ||
      activeRest?.logoUrl ||
      activeRest?.imageUrl ||
      BluetoothPrinterService.cachedConfig?.logoUrl ||
      ''
    ).trim();

    let logoBitmap: { widthBytes: number; heightDots: number; bytes: number[] } | undefined;
    if (resolvedLogoUrl) {
      try {
        const maxDots = paperWidth === '80mm' ? 420 : 280;
        const rasterized = await this.rasterizeStoreLogo(resolvedLogoUrl, maxDots);
        if (rasterized) logoBitmap = rasterized;
      } catch (err: any) {
        logger.warn('PRINTER', 'STICKER_LOGO_RASTER_FAILED', err?.message);
      }
    }

    const bytes = EscPosBuilder.buildTableQrSticker(
      {
        restaurantName: resolvedRestaurantName,
        tableNumber: params.tableNumber,
        sectionName: params.sectionName,
        qrUrl: params.qrUrl,
        isRolling: params.isRolling,
        logoBitmap,
      },
      paperWidth
    );

    return await this.printBytes(bytes);
  }
}
