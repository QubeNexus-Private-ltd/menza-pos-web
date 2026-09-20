/**
 * ESC/POS Thermal Receipt & KOT Builder
 * Supports 58mm (32 chars) and 80mm (48 chars) thermal printers
 * Compatible with MPT-II, POS-58, Everycom, RPP02N, PT-210, Goojprt, and standard Bluetooth thermal printers.
 */

import { MENZA_ICON_BITMAP } from './MenzaIconData';
import { formatToIstDateTime } from '../utils/formatters';

export interface ReceiptItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  cookingInstruction?: string;
  stationName?: string;
  stationCode?: string;
}

export interface ReceiptData {
  orderId: string | number;
  orderNumber?: string;
  pickupToken?: string;
  restaurantName?: string;
  address?: string;
  city?: string;
  state?: string;
  contactPhone?: string;
  logoUrl?: string;
  logoBitmap?: { widthBytes: number; heightDots: number; bytes: number[] };
  gstNumber?: string;
  customerName?: string;
  customerPhone?: string;
  source?: string;
  tableName?: string;
  sectionName?: string;
  orderType?: string;
  items: ReceiptItem[];
  subtotal?: number;
  discountAmount?: number;
  tenderedAmount?: number;
  changeAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  cgstPercentage?: number;
  sgstPercentage?: number;
  taxAmount?: number;
  taxPercentage?: number;
  grandTotal: number;
  paymentMode?: string;
  paymentStatus?: string;
  date?: string | Date;
  footerMessage?: string;
  isKot?: boolean;
}

export type PaperWidth = '58mm' | '80mm';

export class EscPosBuilder {
  private bytes: number[] = [];
  private readonly maxChars: number;
  private readonly paperWidth: PaperWidth;

  constructor(paperWidth: PaperWidth = '58mm') {
    this.paperWidth = paperWidth;
    this.maxChars = paperWidth === '80mm' ? 48 : 32;
    this.init();
  }

  /** Reset / Initialize printer with universal ESC/POS configuration */
  init(): this {
    this.bytes.push(0x1B, 0x40); // ESC @ (Initialize printer)
    this.bytes.push(0x1B, 0x74, 0x00); // ESC t 0 (Select character code page 0 / PC437)
    this.bytes.push(0x1B, 0x32); // ESC 2 (Set default line spacing)
    this.bytes.push(0x1B, 0x21, 0x00); // ESC ! 0 (Normal font size)
    this.bytes.push(0x1B, 0x45, 0x00); // ESC E 0 (Bold off)
    return this;
  }

  /** Alignment: left, center, right */
  align(alignment: 'left' | 'center' | 'right'): this {
    const code = alignment === 'center' ? 1 : alignment === 'right' ? 2 : 0;
    this.bytes.push(0x1B, 0x61, code); // ESC a n
    return this;
  }

  /** Bold text toggle */
  bold(enable: boolean = true): this {
    this.bytes.push(0x1B, 0x45, enable ? 1 : 0); // ESC E n
    return this;
  }

  /** Underline toggle */
  underline(enable: boolean = true): this {
    this.bytes.push(0x1B, 0x2D, enable ? 1 : 0); // ESC - n
    return this;
  }

  /** Text Size: normal, double-height, double-width, double-both */
  textSize(size: 'normal' | 'double-height' | 'double-width' | 'double-both'): this {
    let escExclCode = 0x00;
    if (size === 'double-height') escExclCode = 0x10;
    else if (size === 'double-width') escExclCode = 0x20;
    else if (size === 'double-both') escExclCode = 0x30;

    this.bytes.push(0x1B, 0x21, escExclCode); // ESC ! n
    return this;
  }

  /** Append raw text string with ASCII/Latin-1 conversion */
  text(str: string): this {
    const cleanStr = this.sanitizeText(str);
    for (let i = 0; i < cleanStr.length; i++) {
      const charCode = cleanStr.charCodeAt(i);
      if (charCode <= 0xFF) {
        this.bytes.push(charCode);
      } else {
        this.bytes.push(0x20); // space for unsupported unicode
      }
    }
    return this;
  }

  /** Append text with line feed (0x0A) */
  textLine(str: string = ''): this {
    this.text(str);
    this.bytes.push(0x0A); // LF (Standard ESC/POS line feed)
    return this;
  }

  /** Print text with word wrapping based on printer paper width (32 chars for 58mm, 48 chars for 80mm) */
  wrappedTextLine(text: string): this {
    const clean = this.sanitizeText(text).trim();
    if (!clean) return this;

    const words = clean.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      if (!currentLine) {
        currentLine = word;
      } else if (currentLine.length + 1 + word.length <= this.maxChars) {
        currentLine += ' ' + word;
      } else {
        this.textLine(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) {
      this.textLine(currentLine);
    }

    return this;
  }

  /** Feed lines */
  feed(lines: number = 1): this {
    for (let i = 0; i < lines; i++) {
      this.bytes.push(0x0A);
    }
    return this;
  }

  /** Print horizontal separator line */
  separator(char: string = '-'): this {
    const line = char.repeat(this.maxChars);
    return this.textLine(line);
  }

  /** Print 2-column key-value row (e.g. "Sub Total:" -> "Rs 450.00") */
  twoColumns(left: string, right: string, bold: boolean = false): this {
    const cleanLeft = this.sanitizeText(left);
    const cleanRight = this.sanitizeText(right);
    const spacesNeeded = Math.max(1, this.maxChars - cleanLeft.length - cleanRight.length);
    const line = cleanLeft + ' '.repeat(spacesNeeded) + cleanRight;

    if (bold) this.bold(true);
    this.textLine(line);
    if (bold) this.bold(false);

    return this;
  }

  /** Print item table row: [Item Name, Qty, Price] */
  itemRow(name: string, qty: number | string, total: number | string): this {
    const qtyStr = String(qty ?? 1);
    const numTotal = typeof total === 'number' ? total : parseFloat(String(total));
    const totalStr = !isNaN(numTotal) ? numTotal.toFixed(2) : String(total ?? '0.00');
    const cleanName = this.sanitizeText(String(name || 'Item'));

    if (this.paperWidth === '80mm') {
      const nameColWidth = 28;
      const qtyColWidth = 6;
      const totalColWidth = 14;

      if (cleanName.length <= nameColWidth) {
        const paddedName = cleanName.padEnd(nameColWidth);
        const paddedQty = qtyStr.padStart(qtyColWidth);
        const paddedTotal = totalStr.padStart(totalColWidth);
        this.textLine(paddedName + paddedQty + paddedTotal);
      } else {
        const line1 = cleanName.substring(0, nameColWidth).padEnd(nameColWidth);
        const line2 = cleanName.substring(nameColWidth, nameColWidth * 2);
        const paddedQty = qtyStr.padStart(qtyColWidth);
        const paddedTotal = totalStr.padStart(totalColWidth);

        this.textLine(line1 + paddedQty + paddedTotal);
        if (line2.trim().length > 0) {
          this.textLine('  ' + line2.trim());
        }
      }
    } else {
      const nameColWidth = 18;
      const qtyColWidth = 4;
      const totalColWidth = 10;

      if (cleanName.length <= nameColWidth) {
        const paddedName = cleanName.padEnd(nameColWidth);
        const paddedQty = qtyStr.padStart(qtyColWidth);
        const paddedTotal = totalStr.padStart(totalColWidth);
        this.textLine(paddedName + paddedQty + paddedTotal);
      } else {
        const line1 = cleanName.substring(0, nameColWidth).padEnd(nameColWidth);
        const line2 = cleanName.substring(nameColWidth, nameColWidth * 2);
        const paddedQty = qtyStr.padStart(qtyColWidth);
        const paddedTotal = totalStr.padStart(totalColWidth);

        this.textLine(line1 + paddedQty + paddedTotal);
        if (line2.trim().length > 0) {
          this.textLine('  ' + line2.trim());
        }
      }
    }
    return this;
  }

  /** Print custom monochrome raster bitmap (e.g. dynamic store logo) */
  printBitmap(widthBytes: number, heightDots: number, bytes: number[]): this {
    if (!bytes || bytes.length === 0 || widthBytes <= 0 || heightDots <= 0) return this;
    this.align('center');
    const xL = widthBytes % 256;
    const xH = Math.floor(widthBytes / 256);
    const yL = heightDots % 256;
    const yH = Math.floor(heightDots / 256);

    // ESC/POS GS v 0 m xL xH yL yH d1...dk (Standard Raster Bit Image)
    this.bytes.push(0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH, ...bytes);
    this.feed(1);
    return this;
  }

  /** Print crisp monochrome raster bitmap logo of Menza (compiled from assets/icon.png) */
  printMenzaLogo(): this {
    this.align('center');
    const { widthBytes, heightDots, bytes } = MENZA_ICON_BITMAP;
    const xL = widthBytes % 256;
    const xH = Math.floor(widthBytes / 256);
    const yL = heightDots % 256;
    const yH = Math.floor(heightDots / 256);

    // ESC/POS GS v 0 m xL xH yL yH d1...dk (Standard Raster Bit Image)
    this.bytes.push(0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH, ...bytes);
    this.feed(1);
    return this;
  }

  /** Send standard ESC/POS paper cut command (GS V 66 0 / GS V 65 0) */
  cut(partial: boolean = true): this {
    this.feed(3);
    this.bytes.push(0x1D, 0x56, partial ? 0x42 : 0x41, 0x00);
    return this;
  }

  /** Paper Feed at end of receipt with auto-cut support */
  finish(withCut: boolean = true): this {
    this.align('left');
    this.textSize('normal');
    this.bold(false);
    this.feed(3); // 3 feeds to clear the manual tear bar / reach cutter blade
    if (withCut) {
      this.bytes.push(0x1D, 0x56, 0x42, 0x00); // GS V 66 0 (Standard ESC/POS Feed & Cut)
    }
    return this;
  }

  /** Return bytes array */
  getBytes(): number[] {
    return [...this.bytes];
  }

  /** Sanitize text: replace Indian Rupee sign, bullet points, etc. with clean ASCII */
  private sanitizeText(str: string): string {
    if (!str) return '';
    return String(str)
      .replace(/₹/g, 'Rs ')
      .replace(/•/g, '-')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/–|—/g, '-')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
  }

  /** Format a complete standard customer tax receipt */
  static buildReceipt(data: ReceiptData, paperWidth: PaperWidth = '58mm'): number[] {
    const builder = new EscPosBuilder(paperWidth);

    // 0. Dynamic Store Logo Bitmap (prints ONLY the actual restaurant's logo)
    if (data.logoBitmap && data.logoBitmap.bytes && data.logoBitmap.bytes.length > 0) {
      builder.printBitmap(data.logoBitmap.widthBytes, data.logoBitmap.heightDots, data.logoBitmap.bytes);
    }

    // 1. Restaurant Header
    if (data.restaurantName && data.restaurantName.trim().length > 0) {
      builder.align('center');
      builder.textSize('double-both');
      builder.bold(true);
      builder.textLine(data.restaurantName.trim());
      builder.textSize('normal');
      builder.bold(false);
    }

    // Format Full Store Address (Address, City, State)
    const effectiveAddress = (() => {
      const parts: string[] = [];
      if (data.address && data.address.trim()) parts.push(data.address.trim());
      if (data.city && data.city.trim() && (!data.address || !data.address.toLowerCase().includes(data.city.trim().toLowerCase()))) {
        parts.push(data.city.trim());
      }
      if (data.state && data.state.trim() && (!data.address || !data.address.toLowerCase().includes(data.state.trim().toLowerCase()))) {
        parts.push(data.state.trim());
      }
      return parts.join(', ');
    })();

    if (effectiveAddress) {
      builder.wrappedTextLine(effectiveAddress);
    }
    if (data.contactPhone && data.contactPhone.trim()) {
      builder.textLine(`Ph: ${data.contactPhone.trim()}`);
    }
    if (data.gstNumber && data.gstNumber.trim()) {
      builder.textLine(`GSTIN: ${data.gstNumber.trim()}`);
    }

    builder.separator('=');

    // 2. Order Metadata / Pickup Token
    builder.align('center');
    builder.textSize('double-height');
    builder.bold(true);
    const tokenDisplay = data.pickupToken || data.orderNumber || data.orderId;
    const formattedToken = String(tokenDisplay).startsWith('#') ? String(tokenDisplay) : `#${tokenDisplay}`;
    builder.textLine(formattedToken);

    builder.textSize('normal');
    builder.bold(false);
    builder.align('left');

    const formattedDate = data.date
      ? typeof data.date === 'string'
        ? formatToIstDateTime(data.date)
        : formatToIstDateTime(data.date)
      : formatToIstDateTime(new Date());

    builder.twoColumns('Date:', formattedDate);

    // Delivery / Order Type Fulfillment Mode
    if (data.orderType) {
      builder.bold(true);
      builder.twoColumns('Delivery Type:', data.orderType.toUpperCase(), true);
      builder.bold(false);
    }
    if (data.tableName) {
      builder.bold(true);
      const tableFormatted = data.sectionName
        ? `${data.tableName} (${data.sectionName})`
        : data.tableName;
      builder.twoColumns('Table / Section:', tableFormatted, true);
      builder.bold(false);
    } else if (data.source) {
      builder.twoColumns('Source:', data.source);
    }
    if (data.customerName && data.customerName !== 'Walk-in Customer') {
      builder.twoColumns('Customer:', data.customerName);
    }
    if (data.customerPhone) {
      builder.twoColumns('Phone:', data.customerPhone);
    }

    builder.separator('-');

    // 3. Line Items Table Header
    builder.bold(true);
    if (paperWidth === '80mm') {
      builder.textLine('ITEM'.padEnd(28) + 'QTY'.padStart(6) + 'TOTAL'.padStart(14));
    } else {
      builder.textLine('ITEM'.padEnd(18) + 'QTY'.padStart(4) + 'TOTAL'.padStart(10));
    }
    builder.bold(false);
    builder.separator('-');

    // 4. Line Items
    let totalItemsCount = 0;
    let computedSubtotal = 0;
    const itemsList = Array.isArray(data.items) && data.items.length > 0 ? data.items : [];

    if (itemsList.length === 0) {
      const fallbackTotal = data.grandTotal || 0;
      builder.itemRow('Order Items Total', 1, fallbackTotal);
      totalItemsCount = 1;
      computedSubtotal = fallbackTotal;
    } else {
      itemsList.forEach((item: any, index: number) => {
        const rawName =
          item?.itemName ??
          item?.ItemName ??
          item?.name ??
          item?.Name ??
          item?.dishName ??
          item?.DishName ??
          item?.itemTitle ??
          item?.title ??
          item?.Title ??
          item?.itemDescription ??
          item?.item?.itemName ??
          item?.item?.name ??
          `Item ${index + 1}`;

        const name = String(rawName).trim() || `Item ${index + 1}`;
        const qty = Number(item?.quantity ?? item?.Quantity ?? item?.qty ?? item?.Qty ?? item?.count ?? 1) || 1;
        const unitPrice = Number(
          item?.unitPrice ??
          item?.UnitPrice ??
          item?.amount ??
          item?.Amount ??
          item?.price ??
          item?.Price ??
          item?.rate ??
          item?.Rate ??
          item?.itemPrice ??
          0
        ) || 0;

        let lineTotal = Number(
          item?.totalPrice ??
          item?.TotalPrice ??
          item?.totalAmount ??
          item?.TotalAmount ??
          item?.total ??
          (qty * unitPrice)
        );

        if (isNaN(lineTotal) || lineTotal <= 0) {
          lineTotal = qty * unitPrice;
        }

        builder.itemRow(name, qty, lineTotal);
        totalItemsCount += qty;
        computedSubtotal += lineTotal;

        const instruction = item?.cookingInstruction ?? item?.CookingInstruction ?? item?.instruction ?? item?.notes;
        if (instruction && String(instruction).trim()) {
          builder.textLine(` * ${String(instruction).trim()}`);
        }
      });
    }

    builder.separator('=');

    // 5. Taxes / Breakdown if GST Number exists
    const hasGst = Boolean(data.gstNumber && data.gstNumber.trim().length > 0);
    const effectiveSubtotal = data.subtotal !== undefined ? data.subtotal : computedSubtotal;

    if (hasGst) {
      builder.twoColumns('Subtotal:', `Rs ${effectiveSubtotal.toFixed(2)}`);

      const cgstRate = data.cgstPercentage ?? 2.5;
      const sgstRate = data.sgstPercentage ?? 2.5;
      const cgstAmt = data.cgstAmount !== undefined ? data.cgstAmount : (effectiveSubtotal * cgstRate) / 100;
      const sgstAmt = data.sgstAmount !== undefined ? data.sgstAmount : (effectiveSubtotal * sgstRate) / 100;

      builder.twoColumns(`CGST (${cgstRate}%):`, `Rs ${cgstAmt.toFixed(2)}`);
      builder.twoColumns(`SGST (${sgstRate}%):`, `Rs ${sgstAmt.toFixed(2)}`);
      builder.separator('-');
    }

    // 6. Grand Total (Large & Bold)
    builder.bold(true);
    builder.textSize('double-height');
    builder.twoColumns('GRAND TOTAL:', `Rs ${data.grandTotal.toFixed(2)}`, true);
    builder.textSize('normal');
    if (!hasGst) {
      builder.align('right');
      builder.textLine('(incl. of all taxes)');
    }
    builder.bold(false);

    builder.separator('=');

    // 7. Summary Details
    builder.twoColumns('Total Items:', `${totalItemsCount} Qty`);
    if (data.paymentMode) {
      builder.twoColumns('Payment Mode:', data.paymentMode.toUpperCase());
    }
    if (data.tenderedAmount !== undefined && data.tenderedAmount > 0) {
      builder.twoColumns('Cash Tendered:', `Rs ${data.tenderedAmount.toFixed(2)}`);
      if (data.changeAmount !== undefined && data.changeAmount >= 0) {
        builder.bold(true);
        builder.twoColumns('Change Returned:', `Rs ${data.changeAmount.toFixed(2)}`);
        builder.bold(false);
      }
    }

    builder.separator('-');

    // 8. Footer Greeting
    if (data.footerMessage && data.footerMessage.trim()) {
      builder.align('center');
      builder.textLine(data.footerMessage.trim());
    }

    builder.finish();
    return builder.getBytes();
  }

  /** Format a Kitchen Order Ticket (KOT) */
  static buildKot(data: ReceiptData, paperWidth: PaperWidth = '58mm'): number[] {
    const builder = new EscPosBuilder(paperWidth);

    // 1. KOT Title & Bifurcation Header
    builder.align('center');
    builder.bold(true);
    builder.textSize('normal');
    builder.textLine(paperWidth === '80mm' ? '---------- [ ✂ KITCHEN SLIP / KOT ✂ ] ----------' : '--- [ ✂ KITCHEN KOT ✂ ] ---');
    if (data.restaurantName && data.restaurantName.trim()) {
      builder.textLine(`${data.restaurantName.trim()} - KITCHEN`);
    }

    // 2. Token Number (Prominent for Kitchen Staff)
    const tokenDisplay = data.pickupToken || data.orderNumber || data.orderId;
    const formattedToken = String(tokenDisplay).startsWith('#') ? String(tokenDisplay) : `#${tokenDisplay}`;

    builder.textSize('double-both');
    builder.bold(true);
    builder.textLine(`TOKEN ${formattedToken}`);

    builder.textSize('normal');
    builder.bold(false);
    builder.separator('=');

    // 3. Metadata
    builder.align('left');

    const formattedDate = data.date
      ? typeof data.date === 'string'
        ? formatToIstDateTime(data.date)
        : formatToIstDateTime(data.date)
      : formatToIstDateTime(new Date());

    builder.twoColumns('Date/Time:', formattedDate);
    const orderIdDisplay = data.orderId || data.orderNumber;
    const formattedOrderId = String(orderIdDisplay).startsWith('#') ? String(orderIdDisplay) : `#${orderIdDisplay}`;
    builder.twoColumns('Order ID:', formattedOrderId);

    if (data.orderType) {
      builder.bold(true);
      builder.twoColumns('Delivery Type:', data.orderType.toUpperCase(), true);
      builder.bold(false);
    }
    if (data.tableName) {
      builder.bold(true);
      const tableFormatted = data.sectionName
        ? `${data.tableName} (${data.sectionName})`
        : data.tableName;
      builder.twoColumns('Table / Section:', tableFormatted, true);
      builder.bold(false);
    } else if (data.source) {
      builder.bold(true);
      builder.twoColumns('Source:', data.source, true);
      builder.bold(false);
    }
    if (data.customerName && data.customerName !== 'Walk-in Customer') {
      builder.twoColumns('Guest:', data.customerName);
    }

    builder.separator('-');

    // 4. Items Table Header
    builder.bold(true);
    if (paperWidth === '80mm') {
      builder.textLine('ITEM'.padEnd(38) + 'QTY'.padStart(10));
    } else {
      builder.textLine('ITEM'.padEnd(24) + 'QTY'.padStart(8));
    }
    builder.bold(false);
    builder.separator('-');

    // 5. Line Items with Word Wrapping
    let totalQty = 0;
    const maxItemColWidth = paperWidth === '80mm' ? 36 : 22;
    const maxQtyColWidth = paperWidth === '80mm' ? 10 : 8;
    const itemsList = Array.isArray(data.items) && data.items.length > 0 ? data.items : [];

    if (itemsList.length === 0) {
      builder.bold(true);
      builder.textLine(`[ ] Order Items`.padEnd(builder.maxChars - maxQtyColWidth) + `x1`.padStart(maxQtyColWidth));
      builder.bold(false);
      totalQty = 1;
    } else {
      itemsList.forEach((item: any, index: number) => {
        const rawName =
          item?.itemName ??
          item?.ItemName ??
          item?.name ??
          item?.Name ??
          item?.dishName ??
          item?.DishName ??
          item?.itemTitle ??
          item?.title ??
          item?.Title ??
          item?.itemDescription ??
          item?.item?.itemName ??
          item?.item?.name ??
          `Item ${index + 1}`;

        const name = String(rawName).trim() || `Item ${index + 1}`;
        const cleanName = builder.sanitizeText(name);
        const qty = Number(item?.quantity ?? item?.Quantity ?? item?.qty ?? item?.Qty ?? item?.count ?? 1) || 1;
        totalQty += qty;
        const qtyStr = `x${qty}`.padStart(maxQtyColWidth);

        builder.bold(true);
        if (cleanName.length <= maxItemColWidth) {
          const itemLine = `[ ] ${cleanName}`.padEnd(builder.maxChars - maxQtyColWidth) + qtyStr;
          builder.textLine(itemLine);
        } else {
          const line1 = cleanName.substring(0, maxItemColWidth);
          const line2 = cleanName.substring(maxItemColWidth);
          const itemLine1 = `[ ] ${line1}`.padEnd(builder.maxChars - maxQtyColWidth) + qtyStr;
          builder.textLine(itemLine1);
          if (line2.trim().length > 0) {
            builder.textLine(`    ${line2.trim()}`);
          }
        }
        builder.bold(false);

        const instruction = item?.cookingInstruction ?? item?.CookingInstruction ?? item?.instruction ?? item?.notes;
        if (instruction && String(instruction).trim()) {
          builder.textLine(`   >> NOTE: ${String(instruction).trim()}`);
        }
        const station = item?.stationName || item?.stationCode;
        if (station && String(station).trim()) {
          builder.textLine(`   [Station: ${String(station).trim()}]`);
        }
      });
    }

    builder.separator('=');
    builder.bold(true);
    builder.textSize('double-height');
    builder.twoColumns('TOTAL DISHES:', `${totalQty} items`, true);
    builder.textSize('normal');
    builder.bold(false);
    builder.separator('=');

    builder.finish();
    return builder.getBytes();
  }

  /** Format a Plain Text fallback string */
  static buildPlainTextReceipt(data: ReceiptData, paperWidth: PaperWidth = '58mm'): string {
    const maxChars = paperWidth === '80mm' ? 48 : 32;
    const sep = '='.repeat(maxChars);
    const dash = '-'.repeat(maxChars);

    const padRow = (left: string, right: string) => {
      const sp = Math.max(1, maxChars - left.length - right.length);
      return left + ' '.repeat(sp) + right;
    };

    const hasGst = Boolean(data.gstNumber && data.gstNumber.trim().length > 0);

    let out = '\n';
    if (data.restaurantName && data.restaurantName.trim().length > 0) {
      out += `${data.restaurantName.trim()}\n`;
    }
    if (data.address) out += `${data.address}\n`;
    if (data.contactPhone) out += `Ph: ${data.contactPhone}\n`;
    if (hasGst) out += `GSTIN: ${data.gstNumber!.trim()}\n`;
    out += `${sep}\n`;
    const tokenDisplay = data.pickupToken || data.orderNumber || data.orderId;
    const formattedToken = String(tokenDisplay).startsWith('#') ? String(tokenDisplay) : `#${tokenDisplay}`;
    out += `${formattedToken}\n`;
    const formattedPlainDate = data.date
      ? typeof data.date === 'string'
        ? formatToIstDateTime(data.date)
        : formatToIstDateTime(data.date)
      : formatToIstDateTime(new Date());
    out += padRow('Date:', formattedPlainDate) + '\n';
    if (data.orderType) out += padRow('Type:', data.orderType.toUpperCase()) + '\n';
    const sourceDisplay = data.source || data.tableName;
    if (sourceDisplay) out += padRow('Source:', sourceDisplay) + '\n';
    if (data.customerName && data.customerName !== 'Walk-in Customer') {
      out += padRow('Customer:', data.customerName) + '\n';
    }
    out += `${dash}\n`;
    out += padRow('ITEM', 'QTY  TOTAL') + '\n';
    out += `${dash}\n`;

    let totalQty = 0;
    let computedSubtotal = 0;
    const itemsList = Array.isArray(data.items) && data.items.length > 0 ? data.items : [];

    itemsList.forEach((it: any, index: number) => {
      const name = String(it?.itemName ?? it?.name ?? it?.dishName ?? `Item ${index + 1}`).trim();
      const qty = Number(it?.quantity ?? it?.qty ?? 1) || 1;
      const unitPrice = Number(it?.unitPrice ?? it?.price ?? it?.amount ?? 0) || 0;
      const total = Number(it?.totalPrice ?? it?.totalAmount ?? (qty * unitPrice)) || (qty * unitPrice);
      totalQty += qty;
      computedSubtotal += total;
      out += padRow(name.substring(0, 18), `${qty}  ${total.toFixed(2)}`) + '\n';
    });

    out += `${sep}\n`;

    const effectiveSubtotal = data.subtotal !== undefined ? data.subtotal : computedSubtotal;

    if (hasGst) {
      const cgstRate = data.cgstPercentage ?? 2.5;
      const sgstRate = data.sgstPercentage ?? 2.5;
      const cgstAmt = data.cgstAmount !== undefined ? data.cgstAmount : (effectiveSubtotal * cgstRate) / 100;
      const sgstAmt = data.sgstAmount !== undefined ? data.sgstAmount : (effectiveSubtotal * sgstRate) / 100;

      out += padRow('Subtotal:', `Rs ${effectiveSubtotal.toFixed(2)}`) + '\n';
      out += padRow(`CGST (${cgstRate}%):`, `Rs ${cgstAmt.toFixed(2)}`) + '\n';
      out += padRow(`SGST (${sgstRate}%):`, `Rs ${sgstAmt.toFixed(2)}`) + '\n';
      out += `${dash}\n`;
    }

    out += padRow('GRAND TOTAL:', `Rs ${data.grandTotal.toFixed(2)}`) + '\n';
    if (!hasGst) {
      out += padRow('', '(incl. of all taxes)') + '\n';
    }
    out += `${sep}\n`;
    out += padRow('Total Items:', `${totalQty} Qty`) + '\n';
    if (data.paymentMode) {
      out += padRow('Payment Mode:', data.paymentMode.toUpperCase()) + '\n';
    }
    if (data.tenderedAmount !== undefined && data.tenderedAmount > 0) {
      out += padRow('Cash Tendered:', `Rs ${data.tenderedAmount.toFixed(2)}`) + '\n';
      if (data.changeAmount !== undefined && data.changeAmount >= 0) {
        out += padRow('Change Returned:', `Rs ${data.changeAmount.toFixed(2)}`) + '\n';
      }
    }
    if (data.footerMessage) {
      out += `\n${data.footerMessage}\n`;
    }
    out += `\n\n`;

    return out;
  }

  /** Format a Plain Text fallback string for KOT */
  static buildPlainTextKot(data: ReceiptData, paperWidth: PaperWidth = '58mm'): string {
    const maxChars = paperWidth === '80mm' ? 48 : 32;
    const sep = '='.repeat(maxChars);
    const dash = '-'.repeat(maxChars);

    const padRow = (left: string, right: string) => {
      const sp = Math.max(1, maxChars - left.length - right.length);
      return left + ' '.repeat(sp) + right;
    };

    let out = '\n';
    out += `${(data.restaurantName ? `${data.restaurantName} - KITCHEN` : '*** KITCHEN ORDER TICKET ***')}\n`;
    const tokenDisplay = data.pickupToken || data.orderNumber || data.orderId;
    const formattedToken = String(tokenDisplay).startsWith('#') ? String(tokenDisplay) : `#${tokenDisplay}`;
    out += `TOKEN ${formattedToken}\n`;
    out += `${sep}\n`;
    out += padRow('Order ID:', `#${data.orderId || data.orderNumber}`) + '\n';
    out += padRow('Date/Time:', new Date().toLocaleString('en-IN')) + '\n';
    if (data.orderType) out += padRow('Type:', data.orderType.toUpperCase()) + '\n';
    const sourceDisplay = data.source || data.tableName;
    if (sourceDisplay) out += padRow('Source:', sourceDisplay) + '\n';
    if (data.customerName && data.customerName !== 'Walk-in Customer') {
      out += padRow('Guest:', data.customerName) + '\n';
    }
    out += `${dash}\n`;
    out += padRow('ITEM', 'QTY') + '\n';
    out += `${dash}\n`;

    let totalQty = 0;
    const itemsList = Array.isArray(data.items) && data.items.length > 0 ? data.items : [];
    itemsList.forEach((it: any, index: number) => {
      const name = String(it?.itemName ?? it?.name ?? it?.dishName ?? `Item ${index + 1}`).trim();
      const qty = Number(it?.quantity ?? it?.qty ?? 1) || 1;
      totalQty += qty;
      out += padRow(`[ ] ${name}`, `x${qty}`) + '\n';
      const cookingInstruction = it?.cookingInstruction ?? it?.instruction ?? it?.notes;
      if (cookingInstruction && String(cookingInstruction).trim()) {
        out += `   >> NOTE: ${String(cookingInstruction).trim()}\n`;
      }
    });

    out += `${sep}\n`;
    out += padRow('TOTAL DISHES:', `${totalQty} items`) + '\n';
    out += `${sep}\n\n\n`;

    return out;
  }

  /** Format a quick Test Receipt */
  static buildTestReceipt(restaurantName: string = 'Menza Bistro', paperWidth: PaperWidth = '58mm'): number[] {
    const testData: ReceiptData = {
      orderId: '101',
      orderNumber: '101',
      restaurantName,
      address: 'Menza POS Thermal Printer',
      contactPhone: '+91 99999 00000',
      gstNumber: '29ABCDE1234F1Z5',
      customerName: 'Walk-in Guest',
      source: 'POS_ADMIN',
      tableName: 'Table 1',
      orderType: 'Dine In',
      items: [
        { itemName: 'Paneer Butter Masala', quantity: 1, unitPrice: 280, totalPrice: 280 },
        { itemName: 'Butter Naan', quantity: 2, unitPrice: 40, totalPrice: 80 },
        { itemName: 'Fresh Lime Soda', quantity: 1, unitPrice: 60, totalPrice: 60 },
      ],
      subtotal: 420,
      taxAmount: 21,
      taxPercentage: 5,
      grandTotal: 441,
      paymentMode: 'CASH',
      paymentStatus: 'PAID',
      date: new Date(),
      footerMessage: 'Thank you for dining with us! Please visit again.',
    };

    return EscPosBuilder.buildReceipt(testData, paperWidth);
  }

  /** Format a quick Test KOT */
  static buildTestKot(restaurantName: string = 'Menza Bistro', paperWidth: PaperWidth = '58mm'): number[] {
    const testData: ReceiptData = {
      orderId: '101',
      orderNumber: '101',
      pickupToken: '101',
      restaurantName,
      source: 'POS_ADMIN',
      tableName: 'Table 1',
      orderType: 'Dine In',
      customerName: 'Guest',
      items: [
        { itemName: 'Paneer Butter Masala', quantity: 2, unitPrice: 280, cookingInstruction: 'Medium Spicy' },
        { itemName: 'Butter Naan', quantity: 4, unitPrice: 40 },
        { itemName: 'Fresh Lime Soda', quantity: 1, unitPrice: 60, cookingInstruction: 'Less Sugar' },
      ],
      grandTotal: 780,
      date: new Date(),
      isKot: true,
    };

    return EscPosBuilder.buildKot(testData, paperWidth);
  }
}
