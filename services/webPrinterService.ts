import { PaperWidth, ReceiptData, EscPosBuilder } from '@shared/core/printer/EscPosBuilder';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { RestaurantConfigRemoteDataSource } from '@shared/data/datasources/RestaurantConfigRemoteDataSource';
import { usePosCatalogStore } from '@/stores/usePosCatalogStore';
import QRCode from 'qrcode';

export interface PrintOptions {
  paperWidth?: PaperWidth;
  silent?: boolean;
}

/**
 * Web Thermal Printing Service for Windows PC and Android Tablet browsers.
 * Generates standards-compliant ESC/POS-style HTML receipts for 58mm and 80mm
 * thermal roll printers, prints through isolated iframes with zero page margins,
 * and falls back cleanly for tablet browsers.
 */
export class WebPrinterService {
  private static logoDataUrlCache = new Map<string, string>();

  /**
   * Automatically enriches ReceiptData with the active restaurant's logoUrl and store metadata
   * from Zustand state (and fetches from the backend API if not yet loaded in memory).
   */
  private static async enrichReceiptData(data: ReceiptData): Promise<ReceiptData> {
    let catalogConfig = usePosCatalogStore.getState().restaurantConfig;
    const authState = useAuthStore.getState();
    const activeRest = (authState.activeRestaurant || authState.restaurants?.[0]) as any;

    let resolvedLogoUrl = (
      data.logoUrl ||
      catalogConfig?.logoUrl ||
      activeRest?.logoUrl ||
      catalogConfig?.imageUrl ||
      activeRest?.imageUrl ||
      ''
    ).trim();

    // If logoUrl is still missing in memory, fetch latest RestaurantConfig from API
    if (!resolvedLogoUrl) {
      const restId = Number(
        catalogConfig?.id ||
          activeRest?.restaurantId ||
          usePosCatalogStore.getState().restaurantId ||
          (globalThis as any).__MENZA_ACTIVE_REST_ID__ ||
          0
      );
      if (restId > 0) {
        try {
          const configDs = new RestaurantConfigRemoteDataSource();
          const fetchedCfg = await Promise.race([
            configDs.getConfig(restId),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
          ]);
          if (fetchedCfg) {
            catalogConfig = fetchedCfg;
            usePosCatalogStore.getState().updateRestaurantConfig(fetchedCfg);
            resolvedLogoUrl = (fetchedCfg.logoUrl || fetchedCfg.imageUrl || '').trim();
          }
        } catch {
          // Ignore network errors and proceed with available fields
        }
      }
    }

    return {
      ...data,
      logoUrl: resolvedLogoUrl || undefined,
      restaurantName:
        data.restaurantName ||
        catalogConfig?.restaurantName ||
        activeRest?.restaurantName ||
        'Menza Restaurant',
      address:
        data.address ||
        catalogConfig?.address ||
        activeRest?.address ||
        undefined,
      city:
        data.city ||
        catalogConfig?.city ||
        activeRest?.city ||
        undefined,
      state:
        data.state ||
        catalogConfig?.state ||
        activeRest?.state ||
        undefined,
      contactPhone:
        data.contactPhone ||
        catalogConfig?.contactNumber ||
        activeRest?.contactNumber ||
        activeRest?.ownerMobile ||
        undefined,
      gstNumber:
        data.gstNumber ??
        ((catalogConfig as any)?.isGstApplicable !== false
          ? catalogConfig?.gstNumber || activeRest?.gstNumber || activeRest?.gstin
          : undefined),
    };
  }

  /**
   * Fetches and converts any remote/local logoUrl into a self-contained `data:image/png;base64,...` Data URL
   * flattened onto a white (#FFFFFF) background so thermal printer drivers and hidden print iframes
   * render it identically to the inline UPI QR code.
   */
  public static async resolveLogoDataUrl(
    logoUrl: string,
    paperWidth: PaperWidth = '58mm'
  ): Promise<string | undefined> {
    if (typeof window === 'undefined' || !logoUrl) return undefined;
    const cleanUrl = logoUrl.trim();
    if (!cleanUrl) return undefined;

    const cacheKey = `v3__${cleanUrl}__${paperWidth}`;
    if (this.logoDataUrlCache.has(cacheKey)) {
      return this.logoDataUrlCache.get(cacheKey);
    }

    let rawDataUrl: string | undefined = cleanUrl.startsWith('data:image/') ? cleanUrl : undefined;

    // 1. Use Next.js server-side proxy route to convert remote URL -> base64 Data URL without CORS blocks
    if (!rawDataUrl && /^https?:\/\//i.test(cleanUrl)) {
      try {
        const res = await fetch(`/api/image-proxy?url=${encodeURIComponent(cleanUrl)}`);
        if (res.ok) {
          const json = await res.json();
          if (json?.dataUrl && typeof json.dataUrl === 'string') {
            rawDataUrl = json.dataUrl;
          }
        }
      } catch {
        // Fallback to direct client fetch below
      }
    }

    // 2. Fallback: direct client fetch -> Blob -> Data URL
    if (!rawDataUrl) {
      try {
        const res = await fetch(cleanUrl);
        if (res.ok) {
          const blob = await res.blob();
          rawDataUrl = await new Promise<string | undefined>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () =>
              resolve(typeof reader.result === 'string' ? reader.result : undefined);
            reader.onerror = () => resolve(undefined);
            reader.readAsDataURL(blob);
          });
        }
      } catch {
        // Ignore CORS error on direct client fetch
      }
    }

    const srcToLoad = rawDataUrl || cleanUrl;

    // 3. Smart-crop screenshot borders & whitespace, scale at high DPI, and apply thermal tone mapping
    return new Promise((resolve) => {
      const img = new Image();
      if (!srcToLoad.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
      const timer = setTimeout(() => resolve(rawDataUrl || cleanUrl), 2500);

      img.onload = () => {
        clearTimeout(timer);
        try {
          const natW = img.naturalWidth || img.width || 300;
          const natH = img.naturalHeight || img.height || 150;

          // Step A: Draw onto an inspection canvas to auto-trim screenshot border bars & whitespace margins
          const probeScale = Math.min(600 / natW, 600 / natH, 1);
          const probeW = Math.max(16, Math.round(natW * probeScale));
          const probeH = Math.max(16, Math.round(natH * probeScale));

          const probeCanvas = document.createElement('canvas');
          probeCanvas.width = probeW;
          probeCanvas.height = probeH;
          const probeCtx = probeCanvas.getContext('2d');
          if (!probeCtx) {
            resolve(srcToLoad);
            return;
          }

          probeCtx.fillStyle = '#FFFFFF';
          probeCtx.fillRect(0, 0, probeW, probeH);
          probeCtx.drawImage(img, 0, 0, probeW, probeH);

          // Ignore outer 3% border when detecting bounding box so phone screenshot edge lines are excluded
          const marginX = Math.max(2, Math.round(probeW * 0.03));
          const marginY = Math.max(2, Math.round(probeH * 0.03));

          let cropX = 0;
          let cropY = marginY;
          let cropW = probeW;
          let cropH = Math.max(16, probeH - marginY);

          try {
            const pData = probeCtx.getImageData(0, 0, probeW, probeH).data;
            let minX = probeW;
            let minY = probeH;
            let maxX = -1;
            let maxY = -1;

            for (let y = marginY; y < probeH - marginY; y++) {
              for (let x = marginX; x < probeW - marginX; x++) {
                const i = (y * probeW + x) * 4;
                const r = pData[i];
                const g = pData[i + 1];
                const b = pData[i + 2];
                const a = pData[i + 3];
                // Consider pixel part of logo if non-transparent and not off-white background (>235)
                if (a > 30 && !(r > 235 && g > 235 && b > 235)) {
                  if (x < minX) minX = x;
                  if (x > maxX) maxX = x;
                  if (y < minY) minY = y;
                  if (y > maxY) maxY = y;
                }
              }
            }

            if (maxX > minX && maxY > minY) {
              const pad = 6;
              cropX = Math.max(marginX, minX - pad);
              cropY = Math.max(marginY, minY - pad);
              cropW = Math.min(probeW - cropX, maxX - minX + 1 + pad * 2);
              cropH = Math.min(probeH - cropY, maxY - minY + 1 + pad * 2);
            }
          } catch {
            // Keep default dimensions if pixel inspection is blocked
          }

          // Step B: Scale cropped region to high-DPI thermal print dimensions (supporting 1:1 square/shield logos)
          const maxW = paperWidth === '80mm' ? 480 : 380;
          const maxH = paperWidth === '80mm' ? 460 : 360;
          const scale = Math.min(maxW / cropW, maxH / cropH);
          const targetW = Math.max(32, Math.round(cropW * scale));
          const targetH = Math.max(32, Math.round(cropH * scale));

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(srcToLoad);
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.drawImage(probeCanvas, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);

          // Step C: Thermal tone mapping — keep dark outlines/text crisp black (<55 -> 0..20),
          // lift colored interior mid-tones (gamma 0.52) so badge illustrations stay bright & clear,
          // and clean off-white backgrounds (>235) to pure #FFFFFF paper white
          try {
            const imageData = ctx.getImageData(0, 0, targetW, targetH);
            const px = imageData.data;

            for (let i = 0; i < px.length; i += 4) {
              const r = px[i];
              const g = px[i + 1];
              const b = px[i + 2];

              const lum = 0.299 * r + 0.587 * g + 0.114 * b;

              let out: number;
              if (lum > 235) {
                // Clean off-white screenshot background to pure paper white
                out = 255;
              } else if (lum < 55) {
                // Make dark outlines, shield borders, and lettering solid crisp black
                out = Math.max(0, Math.round((lum / 55) * 20));
              } else {
                // Lift mid-tones (gamma 0.52) so colored fills stay light and don't obscure dark outlines
                const norm = (lum - 55) / (235 - 55);
                const lifted = Math.pow(norm, 0.52);
                out = Math.round(35 + lifted * 215);
              }

              px[i] = out;
              px[i + 1] = out;
              px[i + 2] = out;
              px[i + 3] = 255;
            }

            ctx.putImageData(imageData, 0, 0);
          } catch {
            // Ignore if pixel manipulation is unavailable
          }

          const pngDataUrl = canvas.toDataURL('image/png');
          this.logoDataUrlCache.set(cacheKey, pngDataUrl);
          resolve(pngDataUrl);
        } catch {
          if (rawDataUrl) {
            this.logoDataUrlCache.set(cacheKey, rawDataUrl);
          }
          resolve(srcToLoad);
        }
      };

      img.onerror = () => {
        clearTimeout(timer);
        resolve(rawDataUrl || cleanUrl);
      };

      img.src = srcToLoad;
    });
  }

  /**
   * Converts an image URL into a 1-bit monochrome ESC/POS raster bitmap ({ widthBytes, heightDots, bytes })
   * using Floyd-Steinberg dithering so illustrated logos preserve full interior detail.
   */
  private static async rasterizeLogoFromUrl(
    logoUrl: string,
    paperWidth: PaperWidth = '58mm'
  ): Promise<{ widthBytes: number; heightDots: number; bytes: number[] } | undefined> {
    if (typeof window === 'undefined' || !logoUrl) return undefined;

    const safeDataUrl = await this.resolveLogoDataUrl(logoUrl, paperWidth);
    if (!safeDataUrl) return undefined;

    return new Promise((resolve) => {
      const img = new Image();
      if (!safeDataUrl.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
      const timeoutId = setTimeout(() => resolve(undefined), 2500);

      img.onload = () => {
        clearTimeout(timeoutId);
        try {
          const maxWidthPx = paperWidth === '80mm' ? 360 : 280;
          const maxHeightPx = paperWidth === '80mm' ? 320 : 260;

          const naturalW = img.naturalWidth || img.width || maxWidthPx;
          const naturalH = img.naturalHeight || img.height || maxHeightPx;
          const scale = Math.min(maxWidthPx / naturalW, maxHeightPx / naturalH, 1);

          // Width must be a multiple of 8 for ESC/POS GS v 0
          const targetW = Math.max(8, Math.floor((naturalW * scale) / 8) * 8);
          const targetH = Math.max(8, Math.round(naturalH * scale));
          const widthBytes = targetW / 8;

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(undefined);
            return;
          }

          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.drawImage(img, 0, 0, targetW, targetH);

          const imgData = ctx.getImageData(0, 0, targetW, targetH).data;
          const gray = new Float32Array(targetW * targetH);
          for (let y = 0; y < targetH; y++) {
            for (let x = 0; x < targetW; x++) {
              const idx = (y * targetW + x) * 4;
              const a = imgData[idx + 3];
              gray[y * targetW + x] =
                a < 64 ? 255 : 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
            }
          }

          // Floyd-Steinberg error-diffusion dithering
          for (let y = 0; y < targetH; y++) {
            for (let x = 0; x < targetW; x++) {
              const i = y * targetW + x;
              const oldVal = gray[i];
              const newVal = oldVal < 140 ? 0 : 255;
              gray[i] = newVal;
              const err = oldVal - newVal;
              if (x + 1 < targetW) gray[i + 1] += (err * 7) / 16;
              if (y + 1 < targetH) {
                if (x > 0) gray[i + targetW - 1] += (err * 3) / 16;
                gray[i + targetW] += (err * 5) / 16;
                if (x + 1 < targetW) gray[i + targetW + 1] += (err * 1) / 16;
              }
            }
          }

          const bytes: number[] = new Array(widthBytes * targetH).fill(0);
          for (let y = 0; y < targetH; y++) {
            for (let bx = 0; bx < widthBytes; bx++) {
              let byteVal = 0;
              for (let bit = 0; bit < 8; bit++) {
                const x = bx * 8 + bit;
                if (gray[y * targetW + x] < 128) {
                  byteVal |= 1 << (7 - bit);
                }
              }
              bytes[y * widthBytes + bx] = byteVal;
            }
          }

          resolve({ widthBytes, heightDots: targetH, bytes });
        } catch {
          resolve(undefined);
        }
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        resolve(undefined);
      };

      img.src = safeDataUrl;
    });
  }

  /**
   * Print a Customer Tax Receipt
   */
  static async printReceipt(data: ReceiptData, paperWidth: PaperWidth = '58mm'): Promise<boolean> {
    const enrichedData = await this.enrichReceiptData(data);

    if (this.isSerialConnected()) {
      try {
        if (!enrichedData.logoBitmap && enrichedData.logoUrl) {
          enrichedData.logoBitmap = await this.rasterizeLogoFromUrl(enrichedData.logoUrl, paperWidth);
        }
        const bytes = EscPosBuilder.buildReceipt(enrichedData, paperWidth);
        await this.printDirectSerial(bytes);
        return true;
      } catch (err) {
        console.warn('Direct serial print failed, falling back to print spooler:', err);
      }
    }
    const html = await this.generateReceiptHtml(enrichedData, paperWidth);
    return this.dispatchPrint(html, paperWidth, `Receipt-#${enrichedData.orderNumber || enrichedData.orderId}`);
  }

  /**
   * Print a Kitchen Order Ticket (KOT)
   */
  static async printKot(data: ReceiptData, paperWidth: PaperWidth = '58mm'): Promise<boolean> {
    if (this.isSerialConnected()) {
      try {
        const bytes = EscPosBuilder.buildKot(data, paperWidth);
        await this.printDirectSerial(bytes);
        return true;
      } catch (err) {
        console.warn('Direct serial print failed, falling back to print spooler:', err);
      }
    }
    const html = this.generateKotHtml(data, paperWidth);
    return this.dispatchPrint(html, paperWidth, `KOT-#${data.orderNumber || data.orderId}`);
  }

  /**
   * Prints both the Customer Tax Invoice and Kitchen KOT according to enabled settings
   */
  static async printBifurcatedOrder(
    data: ReceiptData,
    paperWidth: PaperWidth = '58mm',
    printReceiptEnabled: boolean = true,
    printKotEnabled: boolean = true
  ): Promise<{ receiptPrinted: boolean; kotPrinted: boolean }> {
    let receiptPrinted = false;
    let kotPrinted = false;

    if (printReceiptEnabled) {
      try {
        receiptPrinted = await this.printReceipt(data, paperWidth);
      } catch (err) {
        console.warn('Bifurcated receipt print error:', err);
      }
    }

    if (printReceiptEnabled && printKotEnabled && receiptPrinted) {
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    if (printKotEnabled) {
      try {
        kotPrinted = await this.printKot(data, paperWidth);
      } catch (err) {
        console.warn('Bifurcated KOT print error:', err);
      }
    }

    return { receiptPrinted, kotPrinted };
  }

  /**
   * Prints bifurcated KOT slips partitioned by kitchen station (e.g. GRILL, CURRY, BAR)
   */
  static async printStationKots(
    data: ReceiptData,
    paperWidth: PaperWidth = '58mm'
  ): Promise<boolean> {
    if (!data.items || data.items.length === 0) {
      return this.printKot(data, paperWidth);
    }

    // Group items by station
    const stationGroups = new Map<string, typeof data.items>();
    data.items.forEach((item) => {
      const station = (item.stationName || item.stationCode || 'Main Kitchen').trim();
      const existing = stationGroups.get(station) || [];
      existing.push(item);
      stationGroups.set(station, existing);
    });

    if (stationGroups.size <= 1) {
      return this.printKot(data, paperWidth);
    }

    let allPrinted = true;
    for (const [stationName, stationItems] of stationGroups.entries()) {
      const stationData: ReceiptData = {
        ...data,
        restaurantName: `${data.restaurantName || 'Menza'} - [${stationName.toUpperCase()}]`,
        items: stationItems,
      };
      const ok = await this.printKot(stationData, paperWidth);
      if (!ok) allPrinted = false;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return allPrinted;
  }

  /**
   * Print a Test Receipt to verify thermal printer alignment and roll width
   */
  static async printTestReceipt(restaurantName: string = 'Menza Restaurant', paperWidth: PaperWidth = '58mm'): Promise<boolean> {
    const testData: ReceiptData = {
      orderId: 'TEST-101',
      orderNumber: 'TEST-101',
      pickupToken: 'T-01',
      restaurantName,
      address: '100 Feet Road, Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      contactPhone: '9876543210',
      gstNumber: '29ABCDE1234F1Z5',
      customerName: 'Test Customer',
      customerPhone: '9876543210',
      orderType: 'DINE_IN',
      tableName: 'Table 4',
      sectionName: 'AC Dining',
      items: [
        { itemName: 'Paneer Butter Masala', quantity: 1, unitPrice: 240, totalPrice: 240 },
        { itemName: 'Butter Naan', quantity: 3, unitPrice: 40, totalPrice: 120 },
        { itemName: 'Jeera Rice', quantity: 1, unitPrice: 150, totalPrice: 150 },
      ],
      subtotal: 510,
      discountAmount: 0,
      cgstPercentage: 2.5,
      cgstAmount: 12.75,
      sgstPercentage: 2.5,
      sgstAmount: 12.75,
      taxAmount: 25.5,
      grandTotal: 535.5,
      paymentMode: 'CASH',
      tenderedAmount: 600,
      changeAmount: 64.5,
      date: new Date().toLocaleString('en-IN'),
      upiId: 'menzabistro@icici',
      upiPayeeName: restaurantName,
      showUpiQr: true,
      footerMessage: 'Hardware Verified! Thank you for using Menza.',
    };

    return this.printReceipt(testData, paperWidth);
  }

  /**
   * Print a Test KOT to verify kitchen ticket printing
   */
  static async printTestKot(restaurantName: string = 'Menza Restaurant', paperWidth: PaperWidth = '58mm'): Promise<boolean> {
    const testData: ReceiptData = {
      orderId: 'KOT-99',
      orderNumber: 'KOT-99',
      pickupToken: '42',
      restaurantName,
      orderType: 'DINE_IN',
      tableName: 'Table 12',
      sectionName: 'Outdoor Lawn',
      items: [
        { itemName: 'Crispy Corn Salt & Pepper', quantity: 2, unitPrice: 180, cookingInstruction: 'Extra Crispy, Less Salt' },
        { itemName: 'Virgin Mojito', quantity: 2, unitPrice: 120, cookingInstruction: 'No ice' },
      ],
      grandTotal: 600,
      date: new Date().toLocaleString('en-IN'),
    };

    return this.printKot(testData, paperWidth);
  }

  private static serialPort: any = null;
  private static serialWriter: any = null;

  /**
   * Check if Web Serial API is supported in the current browser
   */
  static isWebSerialSupported(): boolean {
    return typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  /**
   * Check if an active Web Serial connection to a thermal printer exists
   */
  static isSerialConnected(): boolean {
    return this.serialPort !== null && this.serialWriter !== null;
  }

  /**
   * Connects to a physical thermal printer (such as MPT-II) via Web Serial (COM port)
   */
  static async requestSerialPort(): Promise<{ success: boolean; message: string }> {
    if (!this.isWebSerialSupported()) {
      return {
        success: false,
        message: 'Web Serial is not supported in this browser. Please use Chrome or Edge on Windows.',
      };
    }

    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      this.serialPort = port;
      this.serialWriter = port.writable.getWriter();
      return {
        success: true,
        message: 'Connected directly to thermal printer COM port via Web Serial!',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Failed to open serial COM port. Check if another program is using it.',
      };
    }
  }

  /**
   * Disconnects active Web Serial session
   */
  static async disconnectSerialPort(): Promise<void> {
    try {
      if (this.serialWriter) {
        await this.serialWriter.releaseLock();
        this.serialWriter = null;
      }
      if (this.serialPort) {
        await this.serialPort.close();
        this.serialPort = null;
      }
    } catch (e) {
      console.warn('Error disconnecting serial port:', e);
    }
  }

  /**
   * Sends raw ESC/POS binary data directly to the printer via Web Serial
   */
  static async printDirectSerial(bytes: number[] | Uint8Array): Promise<boolean> {
    if (!this.serialWriter) {
      throw new Error('No thermal printer connected via Web Serial.');
    }
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    await this.serialWriter.write(data);
    return true;
  }

  /**
   * Dispatches the HTML document to the browser thermal print driver.
   * Uses an isolated full-viewport iframe with opacity 0 so Chromium computes
   * complete layout and dimensions, falling back to direct DOM print.
   */
  private static dispatchPrint(html: string, paperWidth: PaperWidth, title: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve(false);
        return;
      }

      try {
        const iframeId = '__menza_thermal_printer_frame__';
        let iframe = document.getElementById(iframeId) as HTMLIFrameElement;

        if (iframe && iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }

        iframe = document.createElement('iframe');
        iframe.id = iframeId;
        // Keep non-zero dimensions with opacity 0 so Chromium computes layout correctly
        iframe.style.position = 'fixed';
        iframe.style.top = '0';
        iframe.style.left = '0';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.opacity = '0';
        iframe.style.pointerEvents = 'none';
        iframe.style.zIndex = '-9999';
        iframe.setAttribute('aria-hidden', 'true');

        document.body.appendChild(iframe);

        const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
        if (!frameDoc) {
          throw new Error('Could not access print frame document');
        }

        frameDoc.open();
        frameDoc.write(html);
        frameDoc.close();

        let hasTriggeredPrint = false;
        const triggerFramePrint = () => {
          if (hasTriggeredPrint) return;
          hasTriggeredPrint = true;

          try {
            const images = frameDoc.querySelectorAll('img');
            const imgPromises = Array.from(images).map((img) => {
              if (img.complete && img.naturalWidth > 0) return Promise.resolve();
              return new Promise((r) => {
                const timer = setTimeout(() => r(null), 2500);
                img.onload = () => {
                  clearTimeout(timer);
                  r(null);
                };
                img.onerror = () => {
                  clearTimeout(timer);
                  r(null);
                };
              });
            });

            Promise.all(imgPromises).then(() => {
              setTimeout(() => {
                try {
                  iframe.contentWindow?.focus();
                  iframe.contentWindow?.print();
                  resolve(true);
                  setTimeout(() => {
                    try {
                      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
                    } catch {}
                  }, 3000);
                } catch {
                  this.fallbackDomPrint(html).then(resolve);
                }
              }, 120);
            });
          } catch {
            this.fallbackDomPrint(html).then(resolve);
          }
        };

        if (iframe.contentWindow?.document.readyState === 'complete') {
          setTimeout(triggerFramePrint, 100);
        } else {
          iframe.onload = () => setTimeout(triggerFramePrint, 100);
          setTimeout(triggerFramePrint, 450);
        }
      } catch {
        this.fallbackDomPrint(html).then(resolve);
      }
    });
  }

  /**
   * Fallback for tablets or browsers where iframe printing is restricted.
   * Injects the print receipt directly into DOM with print styles, calls window.print(),
   * and cleans up immediately after.
   */
  private static fallbackDomPrint(html: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const containerId = '__menza_dom_print_container__';
        const existing = document.getElementById(containerId);
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

        const container = document.createElement('div');
        container.id = containerId;
        container.innerHTML = html;
        document.body.appendChild(container);

        const cleanup = () => {
          try {
            if (container.parentNode) container.parentNode.removeChild(container);
          } catch {}
          window.removeEventListener('afterprint', cleanup);
          resolve(true);
        };

        const images = container.querySelectorAll('img');
        const imgPromises = Array.from(images).map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise((r) => {
            const timer = setTimeout(() => r(null), 2000);
            img.onload = () => {
              clearTimeout(timer);
              r(null);
            };
            img.onerror = () => {
              clearTimeout(timer);
              r(null);
            };
          });
        });

        Promise.all(imgPromises).then(() => {
          window.addEventListener('afterprint', cleanup);
          window.print();
          setTimeout(cleanup, 3500);
        });
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * Generates formatted, responsive thermal receipt HTML
   */
  static async generateReceiptHtml(rawData: ReceiptData, paperWidth: PaperWidth = '58mm'): Promise<string> {
    const data = await this.enrichReceiptData(rawData);
    const is80mm = paperWidth === '80mm';
    const printWidth = is80mm ? '72mm' : '48mm';
    const containerWidth = is80mm ? '280px' : '200px';

    const logoDataUrl = data.logoUrl
      ? await this.resolveLogoDataUrl(data.logoUrl, paperWidth)
      : undefined;

    const formattedDate = data.date
      ? typeof data.date === 'string'
        ? data.date
        : data.date.toLocaleString('en-IN')
      : new Date().toLocaleString('en-IN');

    const items = Array.isArray(data.items) ? data.items : [];
    const totalQty = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

    const subtotal = data.subtotal !== undefined ? Number(data.subtotal) : Number(data.grandTotal || 0);
    const discount = data.discountAmount ? Number(data.discountAmount) : 0;
    const cgst = data.cgstAmount ? Number(data.cgstAmount) : 0;
    const sgst = data.sgstAmount ? Number(data.sgstAmount) : 0;
    const grandTotal = Number(data.grandTotal || 0);

    let upiQrHtml = '';
    if (data.upiId && data.upiId.trim().length > 0 && data.showUpiQr !== false) {
      try {
        const cleanUpi = data.upiId.trim();
        const payee = encodeURIComponent(data.upiPayeeName || data.restaurantName || 'Menza Restaurant');
        const amount = grandTotal.toFixed(2);
        const note = encodeURIComponent(`Bill #${data.orderNumber || data.orderId}`);
        const upiUri = `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${payee}&am=${amount}&tn=${note}&cu=INR`;

        const qrDataUrl = await QRCode.toDataURL(upiUri, {
          margin: 1,
          width: is80mm ? 160 : 130,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });

        upiQrHtml = `
    <div class="divider-dashed"></div>
    <div class="center" style="margin: 6px 0;">
      <div style="font-size: ${is80mm ? '11px' : '9.5px'}; font-weight: 900; letter-spacing: 0.5px; margin-bottom: 3px;">
        SCAN &amp; PAY WITH ANY UPI APP
      </div>
      <img src="${qrDataUrl}" alt="UPI QR Code" style="width: ${is80mm ? '145px' : '120px'}; height: ${is80mm ? '145px' : '120px'}; margin: 0 auto; display: block; image-rendering: pixelated;" />
      <div style="font-size: ${is80mm ? '9.5px' : '8.5px'}; font-weight: bold; margin-top: 3px;">
        UPI ID: ${this.escape(cleanUpi)}
      </div>
      <div style="font-size: ${is80mm ? '8.5px' : '7.5px'}; opacity: 0.8; margin-top: 2px;">
        Google Pay • PhonePe • Paytm • BHIM • Cred
      </div>
    </div>`;
      } catch (qrErr) {
        console.warn('Failed to generate receipt UPI QR code:', qrErr);
      }
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt #${data.orderNumber || data.orderId}</title>
  <style>
    @page {
      size: ${paperWidth} auto;
      margin: 0mm !important;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #FFFFFF !important;
      color: #000000 !important;
      font-family: 'Courier New', Courier, monospace;
      font-size: ${is80mm ? '12px' : '11px'};
      line-height: 1.25;
      font-weight: 600;
    }
    .receipt-container {
      width: ${printWidth};
      max-width: ${containerWidth};
      margin: 0 auto;
      padding: 4px 2px;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .left { text-align: left; }
    .bold { font-weight: 900; }
    .receipt-logo {
      display: block;
      margin: 0 auto 6px auto;
      width: auto;
      height: auto;
      max-width: ${is80mm ? '200px' : '160px'};
      max-height: ${is80mm ? '180px' : '145px'};
      object-fit: contain;
    }
    .title {
      font-size: ${is80mm ? '15px' : '13px'};
      font-weight: 900;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .subtitle {
      font-size: ${is80mm ? '11px' : '10px'};
      margin-bottom: 1px;
    }
    .divider-solid {
      border-top: 1px solid #000000;
      margin: 4px 0;
    }
    .divider-dashed {
      border-top: 1px dashed #000000;
      margin: 4px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin: 1.5px 0;
    }
    .table-header {
      display: flex;
      justify-content: space-between;
      border-top: 1px dashed #000;
      border-bottom: 1px dashed #000;
      padding: 3px 0;
      margin: 3px 0;
      font-weight: bold;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      margin: 2.5px 0;
    }
    .item-name {
      flex: 1;
      padding-right: 4px;
      word-break: break-word;
    }
    .item-qty {
      width: ${is80mm ? '32px' : '26px'};
      text-align: center;
    }
    .item-total {
      width: ${is80mm ? '60px' : '48px'};
      text-align: right;
    }
    .grand-total {
      font-size: ${is80mm ? '14px' : '13px'};
      font-weight: 900;
      padding: 3px 0;
      border-top: 1px dashed #000;
      border-bottom: 1px dashed #000;
      margin: 4px 0;
    }
    .footer {
      font-size: ${is80mm ? '10px' : '9.5px'};
      margin-top: 6px;
      text-align: center;
    }
    .paper-feed {
      height: 15mm;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <!-- Header -->
    <div class="center">
      ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Store Logo" class="receipt-logo" style="max-width: ${is80mm ? '200px' : '160px'}; max-height: ${is80mm ? '180px' : '145px'}; margin: 0 auto 6px auto; display: block; object-fit: contain;" />` : ''}
      <div class="title">${this.escape(data.restaurantName || 'Menza Restaurant')}</div>
      ${data.address ? `<div class="subtitle">${this.escape(data.address)}</div>` : ''}
      ${data.city || data.state ? `<div class="subtitle">${this.escape([data.city, data.state].filter(Boolean).join(', '))}</div>` : ''}
      ${data.contactPhone ? `<div class="subtitle">Phone: ${this.escape(data.contactPhone)}</div>` : ''}
      ${data.gstNumber ? `<div class="subtitle">GSTIN: ${this.escape(data.gstNumber)}</div>` : ''}
    </div>

    <div class="divider-solid"></div>

    ${data.isProforma ? `
    <div class="center bold" style="border: 1px dashed #000; padding: 3px 0; margin: 4px 0; font-size: ${is80mm ? '12px' : '10.5px'};">
      *** PROFORMA / GUEST CHECK ***<br/><span style="font-size: ${is80mm ? '10px' : '9px'}; font-weight: normal;">(NOT A TAX INVOICE)</span>
    </div>` : data.isDuplicate ? `
    <div class="center bold" style="border: 1px dashed #000; padding: 3px 0; margin: 4px 0; font-size: ${is80mm ? '12px' : '10.5px'};">
      *** DUPLICATE RECEIPT ***
    </div>` : ''}

    <!-- Metadata -->
    <div class="row">
      <span>Order: #${this.escape(String(data.orderNumber || data.orderId))}</span>
      <span>${this.escape(formattedDate)}</span>
    </div>
    ${data.orderType ? `
    <div class="row">
      <span>Type: <span class="bold">${this.escape(data.orderType)}</span></span>
      ${data.tableName ? `<span>Table: <span class="bold">${this.escape(data.tableName)}</span></span>` : ''}
    </div>` : ''}
    ${data.customerName && data.customerName !== 'Walk-in Customer' ? `
    <div class="row">
      <span>Guest: ${this.escape(data.customerName)}</span>
      ${data.customerPhone ? `<span>${this.escape(data.customerPhone)}</span>` : ''}
    </div>` : ''}

    <!-- Items Header -->
    <div class="table-header">
      <span class="left">ITEM</span>
      <span class="item-qty">QTY</span>
      <span class="right item-total">AMT (₹)</span>
    </div>

    <!-- Line Items -->
    ${items.map((i) => `
      <div class="item-row">
        <span class="item-name">${this.escape(i.itemName)}</span>
        <span class="item-qty">x${i.quantity}</span>
        <span class="item-total">₹${Number(i.totalPrice !== undefined ? i.totalPrice : (i.unitPrice * i.quantity)).toFixed(2)}</span>
      </div>
      ${i.cookingInstruction ? `<div style="font-size: 9px; padding-left: 6px; font-style: italic;">* ${this.escape(i.cookingInstruction)}</div>` : ''}
    `).join('')}

    <div class="divider-dashed"></div>

    <!-- Totals & Taxes -->
    <div class="row">
      <span>Total Items:</span>
      <span>${totalQty} Qty</span>
    </div>
    <div class="row">
      <span>Subtotal:</span>
      <span>₹${subtotal.toFixed(2)}</span>
    </div>
    ${discount > 0 ? `
    <div class="row">
      <span>Discount:</span>
      <span>-₹${discount.toFixed(2)}</span>
    </div>` : ''}
    ${cgst > 0 ? `
    <div class="row">
      <span>CGST (${data.cgstPercentage ?? 2.5}%):</span>
      <span>₹${cgst.toFixed(2)}</span>
    </div>` : ''}
    ${sgst > 0 ? `
    <div class="row">
      <span>SGST (${data.sgstPercentage ?? 2.5}%):</span>
      <span>₹${sgst.toFixed(2)}</span>
    </div>` : ''}

    <!-- Grand Total -->
    <div class="row grand-total">
      <span>GRAND TOTAL:</span>
      <span>₹${grandTotal.toFixed(2)}</span>
    </div>

    <!-- Payment & Settlement -->
    ${data.paymentMode ? `
    <div class="row">
      <span>Payment Mode:</span>
      <span class="bold">${this.escape(data.paymentMode.toUpperCase())}</span>
    </div>` : ''}
    ${data.tenderedAmount !== undefined && data.tenderedAmount > 0 ? `
    <div class="row">
      <span>Cash Tendered:</span>
      <span>₹${Number(data.tenderedAmount).toFixed(2)}</span>
    </div>
    <div class="row bold">
      <span>Change Return:</span>
      <span>₹${Number(data.changeAmount ?? 0).toFixed(2)}</span>
    </div>` : ''}

    ${upiQrHtml}

    <div class="divider-solid"></div>

    <!-- Footer -->
    <div class="footer">
      <div>${this.escape(data.footerMessage || 'Thank you! Please visit again.')}</div>
      <div style="font-size: 8px; margin-top: 3px; opacity: 0.7;">Powered by Menza Cloud POS</div>
    </div>

    <!-- Space for physical thermal tear-off -->
    <div class="paper-feed"></div>
  </div>
</body>
</html>`;
  }

  /**
   * Generates formatted KOT (Kitchen Order Ticket) HTML
   */
  static generateKotHtml(data: ReceiptData, paperWidth: PaperWidth = '58mm'): string {
    const is80mm = paperWidth === '80mm';
    const printWidth = is80mm ? '72mm' : '48mm';
    const containerWidth = is80mm ? '280px' : '200px';

    const formattedDate = data.date
      ? typeof data.date === 'string'
        ? data.date
        : data.date.toLocaleString('en-IN')
      : new Date().toLocaleString('en-IN');

    const tokenDisplay = data.pickupToken || data.orderNumber || data.orderId;
    const items = Array.isArray(data.items) ? data.items : [];

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>KOT #${tokenDisplay}</title>
  <style>
    @page {
      size: ${paperWidth} auto;
      margin: 0mm !important;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #FFFFFF !important;
      color: #000000 !important;
      font-family: 'Courier New', Courier, monospace;
      font-size: ${is80mm ? '12px' : '11px'};
      line-height: 1.25;
      font-weight: 700;
    }
    .kot-container {
      width: ${printWidth};
      max-width: ${containerWidth};
      margin: 0 auto;
      padding: 4px 2px;
    }
    .center { text-align: center; }
    .bold { font-weight: 900; }
    .kot-badge {
      font-size: ${is80mm ? '14px' : '12px'};
      font-weight: 900;
      border: 1px dashed #000;
      padding: 2px 4px;
      margin-bottom: 3px;
    }
    .token-box {
      font-size: ${is80mm ? '24px' : '20px'};
      font-weight: 900;
      border: 2px solid #000;
      padding: 4px;
      margin: 4px 0;
      text-align: center;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin: 1.5px 0;
      font-size: ${is80mm ? '11px' : '10px'};
    }
    .table-header {
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: 2px 0;
      margin: 3px 0;
      font-weight: 900;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      margin: 3px 0;
      font-size: ${is80mm ? '13px' : '12px'};
      font-weight: 800;
    }
    .instruction {
      font-size: 10px;
      font-weight: 900;
      padding-left: 12px;
      margin-bottom: 2px;
    }
    .divider-dashed {
      border-top: 1px dashed #000;
      margin: 4px 0;
    }
    .paper-feed {
      height: 15mm;
    }
  </style>
</head>
<body>
  <div class="kot-container">
    <div class="center kot-badge">--- [ ✂ KITCHEN KOT ✂ ] ---</div>
    <div class="center" style="font-size: 11px;">${this.escape(data.restaurantName || 'RESTAURANT')} - KITCHEN</div>

    <div class="token-box">TOKEN #${this.escape(String(tokenDisplay))}</div>

    <div class="row">
      <span>Order ID: #${this.escape(String(data.orderId || data.orderNumber))}</span>
      <span>${this.escape(formattedDate)}</span>
    </div>
    ${data.orderType ? `<div class="row"><span class="bold">TYPE: ${this.escape(data.orderType.toUpperCase())}</span></div>` : ''}
    ${data.tableName ? `<div class="row"><span class="bold">TABLE: ${this.escape(data.tableName)} ${data.sectionName ? `(${this.escape(data.sectionName)})` : ''}</span></div>` : ''}

    <div class="table-header">
      <span>ITEM</span>
      <span>QTY</span>
    </div>

    ${items.map((i) => `
      <div class="item-row">
        <span>[ ] ${this.escape(i.itemName)}</span>
        <span class="bold">x${i.quantity}</span>
      </div>
      ${i.cookingInstruction ? `<div class="instruction">&gt;&gt; NOTE: ${this.escape(i.cookingInstruction)}</div>` : ''}
    `).join('')}

    <div class="divider-dashed"></div>
    <div class="center" style="font-size: 10px;">End of KOT • Dispatch Immediately</div>
    <div class="paper-feed"></div>
  </div>
</body>
</html>`;
  }

  private static escape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}