/**
 * RawBT Thermal Printer Service for Menza POS.
 * Enables Android mobile browsers (Chrome, Edge, Samsung Internet) to print
 * directly to any paired Bluetooth (Classic SPP / BLE), USB OTG, or Network thermal printer
 * without requiring desktop drivers or cloud setups.
 */

export class RawBtPrinterService {
  private static instance: RawBtPrinterService;
  private static readonly RAWBT_WS_PORTS = [40213];
  private isWsAvailable: boolean | null = null;

  public static getInstance(): RawBtPrinterService {
    if (!RawBtPrinterService.instance) {
      RawBtPrinterService.instance = new RawBtPrinterService();
    }
    return RawBtPrinterService.instance;
  }

  /**
   * Check if current browser is running on an Android mobile device
   */
  public isAndroid(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    return /Android/i.test(navigator.userAgent);
  }

  /**
   * Check if running on any mobile device (Android or iOS)
   */
  public isMobile(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  }

  /**
   * Convert an array of byte numbers or Uint8Array to a Base64 string
   */
  public bytesToBase64(bytes: number[] | Uint8Array): string {
    const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let binary = '';
    const len = uint8.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Attempts to send ESC/POS binary data to the RawBT local WebSocket daemon.
   * Enables silent background printing without leaving the browser tab or app.
   */
  public async printViaWebSocket(bytes: number[] | Uint8Array, timeoutMs: number = 1500): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    const dataArray = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

    return new Promise((resolve) => {
      let socket: WebSocket | null = null;
      let hasFinished = false;

      const finish = (ok: boolean) => {
        if (hasFinished) return;
        hasFinished = true;
        clearTimeout(timer);
        if (socket) {
          try {
            socket.close();
          } catch {}
          socket = null;
        }
        this.isWsAvailable = ok;
        resolve(ok);
      };

      const timer = setTimeout(() => {
        finish(false);
      }, timeoutMs);

      try {
        // Try localhost WS on RawBT standard port
        socket = new WebSocket(`ws://127.0.0.1:${RawBtPrinterService.RAWBT_WS_PORTS[0]}/`);
        socket.binaryType = 'arraybuffer';

        socket.onopen = () => {
          try {
            // Send binary ArrayBuffer directly to RawBT
            socket?.send(dataArray.buffer);
            setTimeout(() => finish(true), 150);
          } catch {
            finish(false);
          }
        };

        socket.onerror = () => {
          finish(false);
        };

        socket.onclose = () => {
          if (!hasFinished) {
            finish(false);
          }
        };
      } catch {
        finish(false);
      }
    });
  }

  /**
   * Triggers the Android Intent URL scheme to hand off the ESC/POS job to RawBT.
   * If RawBT is not installed, Google Play Store automatically opens to install it for free.
   */
  public printViaIntent(bytes: number[] | Uint8Array): void {
    if (typeof window === 'undefined') return;

    const b64 = this.bytesToBase64(bytes);

    // Standard RawBT Android Intent URL
    const intentUrl = `intent:base64,${b64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;S.browser_fallback_url=https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter;end;`;

    // Create an invisible anchor tag and trigger click to bypass popup blockers
    const link = document.createElement('a');
    link.href = intentUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      try {
        if (link.parentNode) link.parentNode.removeChild(link);
      } catch {}
    }, 1000);
  }

  /**
   * Universal print dispatcher for Android devices:
   * 1. Attempts fast silent WebSocket print to RawBT.
   * 2. If WebSocket is inactive, smoothly falls back to Android Intent URL.
   */
  public async print(
    bytes: number[] | Uint8Array
  ): Promise<{ success: boolean; method: 'websocket' | 'intent'; message: string }> {
    // 1. Try silent WebSocket first
    const wsSuccess = await this.printViaWebSocket(bytes, 1200);
    if (wsSuccess) {
      return {
        success: true,
        method: 'websocket',
        message: 'Receipt sent to Android Bluetooth printer via silent background service.',
      };
    }

    // 2. Fallback to Android Intent URL
    this.printViaIntent(bytes);
    return {
      success: true,
      method: 'intent',
      message: 'Print job dispatched via RawBT print bridge.',
    };
  }

  /**
   * Google Play Store download link for RawBT
   */
  public getRawBtPlayStoreUrl(): string {
    return 'https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter';
  }
}
