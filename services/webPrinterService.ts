import { PaperWidth, ReceiptData, EscPosBuilder } from '@/lib/printer/escpos';

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
  /**
   * Print a Customer Tax Receipt
   */
  static async printReceipt(data: ReceiptData, paperWidth: PaperWidth = '58mm'): Promise<boolean> {
    if (this.isSerialConnected()) {
      try {
        const bytes = EscPosBuilder.buildReceipt(data, paperWidth);
        await this.printDirectSerial(bytes);
        return true;
      } catch (err) {
        console.warn('Direct serial print failed, falling back to print spooler:', err);
      }
    }
    const html = this.generateReceiptHtml(data, paperWidth);
    return this.dispatchPrint(html, paperWidth, `Receipt-#${data.orderNumber || data.orderId}`);
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

        const triggerFramePrint = () => {
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
        };

        if (iframe.contentWindow?.document.readyState === 'complete') {
          setTimeout(triggerFramePrint, 150);
        } else {
          iframe.onload = () => setTimeout(triggerFramePrint, 150);
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

        window.addEventListener('afterprint', cleanup);
        window.print();
        setTimeout(cleanup, 3500);
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * Generates formatted, responsive thermal receipt HTML
   */
  static generateReceiptHtml(data: ReceiptData, paperWidth: PaperWidth = '58mm'): string {
    const is80mm = paperWidth === '80mm';
    const printWidth = is80mm ? '72mm' : '48mm';
    const containerWidth = is80mm ? '280px' : '200px';

    const formattedDate = data.date ? String(data.date) : new Date().toLocaleString('en-IN');

    const items = Array.isArray(data.items) ? data.items : [];
    const totalQty = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

    const subtotal = data.subtotal !== undefined ? Number(data.subtotal) : Number(data.grandTotal || 0);
    const discount = data.discountAmount ? Number(data.discountAmount) : 0;
    const cgst = data.cgstAmount ? Number(data.cgstAmount) : 0;
    const sgst = data.sgstAmount ? Number(data.sgstAmount) : 0;
    const grandTotal = Number(data.grandTotal || 0);

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
      <div class="title">${this.escape(data.restaurantName || 'Menza Restaurant')}</div>
      ${data.address ? `<div class="subtitle">${this.escape(data.address)}</div>` : ''}
      ${data.city || data.state ? `<div class="subtitle">${this.escape([data.city, data.state].filter(Boolean).join(', '))}</div>` : ''}
      ${data.contactPhone ? `<div class="subtitle">Phone: ${this.escape(data.contactPhone)}</div>` : ''}
      ${data.gstNumber ? `<div class="subtitle">GSTIN: ${this.escape(data.gstNumber)}</div>` : ''}
    </div>

    <div class="divider-solid"></div>

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
        <span class="item-total">₹${Number(i.totalPrice !== undefined ? i.totalPrice : ((i.unitPrice ?? i.price ?? 0) * i.quantity)).toFixed(2)}</span>
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

    const formattedDate = data.date ? String(data.date) : new Date().toLocaleString('en-IN');

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