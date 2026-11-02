/**
 * Web Bluetooth (BLE) Thermal Printer Service for Menza POS.
 * Connects directly to Bluetooth Low Energy thermal receipt/KOT printers from mobile browsers (Chrome on Android)
 * and desktop Chromium browsers without any third-party apps or drivers.
 */

export interface BleDeviceStatus {
  connected: boolean;
  deviceName?: string;
  deviceId?: string;
  errorMessage?: string;
}

// Well-known Bluetooth Low Energy GATT Services used by Thermal POS Printers
// (MPT-II, PT-210, Everycom, Rongta, Xprinter, Goojprt, HOIN, TVS, Zebra)
export const BLE_PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard ESC/POS BLE Service
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Rongta / Xprinter / POS-80
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent Data
  '0000ff00-0000-1000-8000-00805f9b34fb', // Everycom / Generic 58mm
  '0000fee7-0000-1000-8000-00805f9b34fb', // Standard Mobile POS
  '0000af30-0000-1000-8000-00805f9b34fb', // PT-210 / MPT-II BLE
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / Standard Serial BLE
];

const STORAGE_KEY_BLE_DEVICE_NAME = '@menza_web_ble_device_name';
const STORAGE_KEY_BLE_DEVICE_ID = '@menza_web_ble_device_id';

export interface BleConnectionStatus {
  isConnected: boolean;
  isConnecting: boolean;
  deviceName: string | null;
  hasSavedDevice: boolean;
}

export type BleStatusListener = (status: BleConnectionStatus) => void;

export class WebBluetoothPrinterService {
  private static instance: WebBluetoothPrinterService;
  private device: any = null;
  private server: any = null;
  private characteristic: any = null;
  private isConnecting = false;
  private reconnectPromise: Promise<boolean> | null = null;
  private boundOnDisconnected = this.onDisconnected.bind(this);
  private statusListeners = new Set<BleStatusListener>();

  public static getInstance(): WebBluetoothPrinterService {
    if (!WebBluetoothPrinterService.instance) {
      WebBluetoothPrinterService.instance = new WebBluetoothPrinterService();
      // Silently attempt auto-reconnect in the background if a saved device is known
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          WebBluetoothPrinterService.instance.autoReconnect(true).catch(() => {});
        }, 300);
      }
    }
    return WebBluetoothPrinterService.instance;
  }

  /**
   * Subscribe to real-time Bluetooth connection state changes
   */
  public onStatusChange(listener: BleStatusListener): () => void {
    this.statusListeners.add(listener);
    // Immediately emit current state
    listener(this.getStatus());
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const status = this.getStatus();
    this.statusListeners.forEach((listener) => {
      try {
        listener(status);
      } catch (err) {
        console.warn('[WebBluetoothPrinter] Status listener error:', err);
      }
    });
  }

  public getStatus(): BleConnectionStatus {
    return {
      isConnected: this.isConnected(),
      isConnecting: this.isConnecting,
      deviceName: this.getConnectedDeviceName(),
      hasSavedDevice: this.hasSavedDevice(),
    };
  }

  /**
   * Returns true if a device was previously paired and stored in localStorage
   */
  public hasSavedDevice(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return Boolean(
        window.localStorage.getItem(STORAGE_KEY_BLE_DEVICE_NAME) ||
        window.localStorage.getItem(STORAGE_KEY_BLE_DEVICE_ID)
      );
    } catch {
      return false;
    }
  }

  public getSavedDeviceName(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(STORAGE_KEY_BLE_DEVICE_NAME);
    } catch {
      return null;
    }
  }

  public getSavedDeviceId(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(STORAGE_KEY_BLE_DEVICE_ID);
    } catch {
      return null;
    }
  }

  /**
   * Check if Web Bluetooth API is supported by the current browser.
   * True on Chrome for Android, desktop Chrome/Edge, Opera, and Bluefy on iOS.
   */
  public isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      'bluetooth' in navigator &&
      typeof (navigator as any).bluetooth?.requestDevice === 'function'
    );
  }

  /**
   * Check if a BLE thermal printer is currently connected and writable
   */
  public isConnected(): boolean {
    return (
      this.device !== null &&
      this.server !== null &&
      this.characteristic !== null &&
      this.device.gatt?.connected === true
    );
  }

  public isConnectingBle(): boolean {
    return this.isConnecting;
  }

  /**
   * Returns the name of the currently or last connected device
   */
  public getConnectedDeviceName(): string | null {
    if (this.device?.name) {
      return this.device.name;
    }
    return this.getSavedDeviceName();
  }

  /**
   * Automatically re-establishes connection to previously paired Bluetooth printer.
   * Leverages navigator.bluetooth.getDevices() to restore connection without UI pickers.
   */
  public async autoReconnect(silent = true): Promise<boolean> {
    if (!this.isSupported()) return false;
    if (this.isConnected()) return true;

    // Deduplicate concurrent auto-reconnect attempts
    if (this.reconnectPromise) {
      return this.reconnectPromise;
    }

    this.reconnectPromise = (async () => {
      try {
        this.isConnecting = true;
        this.notifyListeners();

        const nav = navigator as any;

        // 1. If we already have a device reference in memory, try to reconnect its GATT server
        if (this.device) {
          try {
            const server = await Promise.race([
              this.device.gatt.connect(),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error('GATT connect timeout')), 4500)),
            ]);
            this.server = server;
            const char = await this.findWriteCharacteristic(server);
            if (char) {
              this.characteristic = char;
              console.log(`[WebBluetoothPrinter] Reconnected to existing device "${this.device.name}"`);
              return true;
            }
          } catch (e) {
            // Fall through to getDevices() lookup
          }
        }

        // 2. Query previously permitted devices from browser permissions storage
        if (typeof nav.bluetooth?.getDevices === 'function') {
          const devices: any[] = await nav.bluetooth.getDevices();
          if (devices && devices.length > 0) {
            const savedId = this.getSavedDeviceId();
            const savedName = this.getSavedDeviceName();

            const matched =
              devices.find((d: any) => savedId && d.id === savedId) ||
              devices.find((d: any) => savedName && d.name === savedName) ||
              (savedId || savedName ? null : devices[0]);

            if (matched) {
              this.device = matched;
              matched.removeEventListener('gattserverdisconnected', this.boundOnDisconnected);
              matched.addEventListener('gattserverdisconnected', this.boundOnDisconnected);

              try {
                const server = await Promise.race([
                  matched.gatt.connect(),
                  new Promise<never>((_, reject) => setTimeout(() => reject(new Error('GATT connect timeout')), 5000)),
                ]);
                this.server = server;
                const char = await this.findWriteCharacteristic(server);
                if (char) {
                  this.characteristic = char;
                  console.log(`[WebBluetoothPrinter] Successfully restored connection to "${matched.name}" via getDevices()`);
                  return true;
                }
              } catch (connErr) {
                if (!silent) {
                  console.warn('[WebBluetoothPrinter] GATT connect to matched device failed:', connErr);
                }
              }
            }
          }
        }

        return false;
      } catch (err: any) {
        if (!silent) {
          console.warn('[WebBluetoothPrinter] autoReconnect error:', err?.message || err);
        }
        return false;
      } finally {
        this.isConnecting = false;
        this.reconnectPromise = null;
        this.notifyListeners();
      }
    })();

    return this.reconnectPromise;
  }

  /**
   * Explicit user-triggered reconnect to the previously saved printer
   */
  public async reconnect(): Promise<{ success: boolean; deviceName?: string; message: string }> {
    const savedName = this.getSavedDeviceName() || 'Bluetooth Printer';
    const ok = await this.autoReconnect(false);
    if (ok) {
      return {
        success: true,
        deviceName: this.getConnectedDeviceName() || savedName,
        message: `Successfully reconnected to "${this.getConnectedDeviceName() || savedName}"!`,
      };
    }

    return {
      success: false,
      message: `Could not connect to "${savedName}". Please make sure the printer is turned ON and within Bluetooth range, or click Pair to select again.`,
    };
  }

  /**
   * Prompts the user to select a nearby Bluetooth thermal printer via the browser's native picker.
   */
  public async requestDevice(): Promise<{ success: boolean; deviceName?: string; message: string }> {
    if (!this.isSupported()) {
      return {
        success: false,
        message:
          'Web Bluetooth is not supported in this browser. Please use Google Chrome or Edge on Android or Desktop.',
      };
    }

    if (this.isConnecting) {
      return {
        success: false,
        message: 'Bluetooth connection already in progress...',
      };
    }

    try {
      this.isConnecting = true;

      // Many budget thermal printers do not advertise service UUIDs in their advertising packet,
      // so we use acceptAllDevices: true with optionalServices to discover and connect to all nearby printers.
      const nav = navigator as any;
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLE_PRINTER_SERVICE_UUIDS,
      });

      if (!device) {
        throw new Error('No Bluetooth device selected.');
      }

      this.device = device;
      device.removeEventListener('gattserverdisconnected', this.boundOnDisconnected);
      device.addEventListener('gattserverdisconnected', this.boundOnDisconnected);

      // Connect to GATT server
      const server = await device.gatt.connect();
      this.server = server;

      // Find writable characteristic for ESC/POS printing
      const characteristic = await this.findWriteCharacteristic(server);
      if (!characteristic) {
        await this.disconnect();
        throw new Error(
          `Connected to "${device.name || 'Bluetooth Device'}", but could not find a thermal printer write service. Ensure this device is an ESC/POS thermal printer.`
        );
      }

      this.characteristic = characteristic;

      // Persist device name in localStorage for seamless UI tracking across reloads
      const devName = device.name || 'Thermal BLE Printer';
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(STORAGE_KEY_BLE_DEVICE_NAME, devName);
          if (device.id) {
            window.localStorage.setItem(STORAGE_KEY_BLE_DEVICE_ID, device.id);
          }
        } catch {}
      }

      this.notifyListeners();

      return {
        success: true,
        deviceName: devName,
        message: `Successfully connected to Bluetooth printer "${devName}"!`,
      };
    } catch (err: any) {
      if (err?.name === 'NotFoundError' || err?.message?.includes('User cancelled')) {
        return { success: false, message: 'Printer selection was cancelled.' };
      }
      return {
        success: false,
        message: err?.message || 'Failed to connect to Bluetooth printer.',
      };
    } finally {
      this.isConnecting = false;
      this.notifyListeners();
    }
  }

  /**
   * Disconnects the active Bluetooth LE session without forgetting the paired printer
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.device?.gatt?.connected) {
        this.device.gatt.disconnect();
      }
    } catch (e) {
      console.warn('Error disconnecting BLE device:', e);
    } finally {
      this.server = null;
      this.characteristic = null;
      this.notifyListeners();
    }
  }

  /**
   * Completely forgets the paired printer and removes saved credentials from storage
   */
  public async forgetDevice(): Promise<void> {
    try {
      if (this.device?.gatt?.connected) {
        this.device.gatt.disconnect();
      }
    } catch (e) {
      console.warn('Error disconnecting BLE device on forget:', e);
    } finally {
      this.device = null;
      this.server = null;
      this.characteristic = null;
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem(STORAGE_KEY_BLE_DEVICE_NAME);
          window.localStorage.removeItem(STORAGE_KEY_BLE_DEVICE_ID);
        } catch {}
      }
      this.notifyListeners();
    }
  }

  /**
   * Sends raw ESC/POS binary data to the thermal printer in throttled chunks.
   * Automatically re-establishes connection if session dropped or refreshed.
   */
  public async print(bytes: number[] | Uint8Array): Promise<boolean> {
    if (!this.isConnected()) {
      // Seamlessly auto-reconnect before printing
      const reconnected = await this.autoReconnect(false);
      if (!reconnected) {
        const savedName = this.getSavedDeviceName();
        if (savedName) {
          throw new Error(`Bluetooth printer "${savedName}" is offline or disconnected. Please check that printer power is ON.`);
        }
        throw new Error('No Bluetooth thermal printer connected. Pair a printer first.');
      }
    }

    if (!this.characteristic) {
      throw new Error('Thermal printer write characteristic is unavailable.');
    }

    const dataArray = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

    // Thermal printers have small BLE receive buffers (usually 128 to 512 bytes).
    // Send in safe 128-byte chunks with micro delays to avoid buffer overflow.
    const CHUNK_SIZE = 128;
    for (let i = 0; i < dataArray.length; i += CHUNK_SIZE) {
      const chunk = dataArray.subarray(i, Math.min(i + CHUNK_SIZE, dataArray.length));
      try {
        if (this.characteristic.properties.writeWithoutResponse) {
          await this.characteristic.writeValueWithoutResponse(chunk);
        } else {
          await this.characteristic.writeValue(chunk);
        }
      } catch (err: any) {
        // Fallback to writeValue if writeWithoutResponse fails
        try {
          await this.characteristic.writeValue(chunk);
        } catch (subErr) {
          throw new Error(`Failed to transmit print buffer to Bluetooth printer: ${err?.message || err}`);
        }
      }

      // Small delay between packets to allow printer controller to flush FIFO buffer
      if (i + CHUNK_SIZE < dataArray.length) {
        await new Promise((resolve) => setTimeout(resolve, 18));
      }
    }

    return true;
  }

  /**
   * Helper to inspect the GATT server and find the primary write characteristic
   */
  private async findWriteCharacteristic(server: any): Promise<any> {
    // 1. Check known thermal printer service UUIDs first
    for (const serviceUuid of BLE_PRINTER_SERVICE_UUIDS) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        if (service) {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              return char;
            }
          }
        }
      } catch {
        // Try next UUID
      }
    }

    // 2. Fallback: query all primary services and look for writable characteristic
    try {
      const allServices = await server.getPrimaryServices();
      for (const service of allServices) {
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              return char;
            }
          }
        } catch {}
      }
    } catch {}

    return null;
  }

  private onDisconnected(): void {
    console.log('[WebBluetoothPrinter] Device disconnected');
    this.server = null;
    this.characteristic = null;
    this.notifyListeners();
  }
}
