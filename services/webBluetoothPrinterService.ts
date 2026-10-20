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

export class WebBluetoothPrinterService {
  private static instance: WebBluetoothPrinterService;
  private device: any = null;
  private server: any = null;
  private characteristic: any = null;
  private isConnecting = false;

  public static getInstance(): WebBluetoothPrinterService {
    if (!WebBluetoothPrinterService.instance) {
      WebBluetoothPrinterService.instance = new WebBluetoothPrinterService();
    }
    return WebBluetoothPrinterService.instance;
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

  /**
   * Returns the name of the currently or last connected device
   */
  public getConnectedDeviceName(): string | null {
    if (this.device?.name) {
      return this.device.name;
    }
    if (typeof window !== 'undefined') {
      try {
        return window.localStorage.getItem(STORAGE_KEY_BLE_DEVICE_NAME);
      } catch {}
    }
    return null;
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
      device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));

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

      // Persist device name in localStorage for seamless UI tracking
      const devName = device.name || 'Thermal BLE Printer';
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(STORAGE_KEY_BLE_DEVICE_NAME, devName);
          if (device.id) {
            window.localStorage.setItem(STORAGE_KEY_BLE_DEVICE_ID, device.id);
          }
        } catch {}
      }

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
    }
  }

  /**
   * Disconnects the active Bluetooth LE session
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.device?.gatt?.connected) {
        this.device.gatt.disconnect();
      }
    } catch (e) {
      console.warn('Error disconnecting BLE device:', e);
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
    }
  }

  /**
   * Sends raw ESC/POS binary data to the thermal printer in throttled chunks
   */
  public async print(bytes: number[] | Uint8Array): Promise<boolean> {
    if (!this.isConnected()) {
      // Attempt auto-reconnect if device reference is present
      if (this.device && !this.device.gatt?.connected) {
        try {
          const server = await this.device.gatt.connect();
          this.server = server;
          this.characteristic = await this.findWriteCharacteristic(server);
        } catch {
          throw new Error('Bluetooth printer is disconnected. Please reconnect from settings.');
        }
      } else {
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
  }
}
