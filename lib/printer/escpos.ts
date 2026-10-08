import { PaperWidth, ReceiptData } from '@/types/printer';

export { type PaperWidth, type ReceiptData } from '@/types/printer';

export class EscPosBuilder {
  private bytes: number[] = [];
  private readonly maxChars: number;
  private readonly paperWidth: PaperWidth;

  constructor(paperWidth: PaperWidth = '58mm') {
    this.paperWidth = paperWidth;
    this.maxChars = paperWidth === '80mm' ? 48 : 32;
    this.init();
  }

  init(): this {
    this.bytes.push(0x1b, 0x40); // ESC @
    this.bytes.push(0x1b, 0x74, 0x00); // ESC t 0
    this.bytes.push(0x1b, 0x32); // ESC 2
    this.bytes.push(0x1b, 0x21, 0x00); // ESC ! 0
    this.bytes.push(0x1b, 0x45, 0x00); // ESC E 0
    return this;
  }

  align(alignment: 'left' | 'center' | 'right'): this {
    const code = alignment === 'center' ? 1 : alignment === 'right' ? 2 : 0;
    this.bytes.push(0x1b, 0x61, code);
    return this;
  }

  alignCenter(): this {
    return this.align('center');
  }

  alignLeft(): this {
    return this.align('left');
  }

  alignRight(): this {
    return this.align('right');
  }

  bold(enable: boolean = true): this {
    this.bytes.push(0x1b, 0x45, enable ? 1 : 0);
    return this;
  }

  underline(enable: boolean = true): this {
    this.bytes.push(0x1b, 0x2d, enable ? 1 : 0);
    return this;
  }

  textSize(size: 'normal' | 'double-height' | 'double-width' | 'double-both'): this {
    let code = 0x00;
    switch (size) {
      case 'double-height':
        code = 0x01;
        break;
      case 'double-width':
        code = 0x10;
        break;
      case 'double-both':
        code = 0x11;
        break;
    }
    this.bytes.push(0x1d, 0x21, code);
    return this;
  }

  text(str: string): this {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(str);
    for (let i = 0; i < encoded.length; i++) {
      this.bytes.push(encoded[i]);
    }
    return this;
  }

  textLine(str: string = ''): this {
    this.text(str);
    this.bytes.push(0x0a);
    return this;
  }

  separator(char: string = '-'): this {
    this.textLine(char.repeat(this.maxChars));
    return this;
  }

  twoColumns(left: string, right: string, boldRight: boolean = false): this {
    const spaceCount = Math.max(1, this.maxChars - left.length - right.length);
    this.text(left + ' '.repeat(spaceCount));
    if (boldRight) this.bold(true);
    this.text(right);
    if (boldRight) this.bold(false);
    this.bytes.push(0x0a);
    return this;
  }

  feed(lines: number = 3): this {
    for (let i = 0; i < lines; i++) {
      this.bytes.push(0x0a);
    }
    return this;
  }

  cut(): this {
    this.bytes.push(0x1d, 0x56, 0x42, 0x00);
    return this;
  }

  finish(): this {
    this.feed(3);
    this.cut();
    return this;
  }

  getBytes(): number[] {
    return this.bytes;
  }

  static buildReceipt(data: ReceiptData, paperWidth: PaperWidth = '58mm'): number[] {
    const builder = new EscPosBuilder(paperWidth);

    // 1. Header
    builder.align('center');
    builder.bold(true);
    builder.textSize('double-height');
    builder.textLine(data.restaurantName || 'RESTAURANT RECEIPT');
    builder.textSize('normal');
    builder.bold(false);

    if (data.address) builder.textLine(data.address);
    if (data.phone || data.contactNumber) builder.textLine(`Tel: ${data.phone || data.contactNumber}`);
    if (data.gstNumber) builder.textLine(`GSTIN: ${data.gstNumber}`);

    builder.separator('=');

    // 2. Order Metadata
    builder.align('left');
    builder.twoColumns('Order #:', `#${data.orderNumber || data.orderId}`);
    if (data.tableName) builder.twoColumns('Table:', String(data.tableName));
    if (data.customerName) builder.twoColumns('Customer:', data.customerName);
    builder.twoColumns('Date:', data.dateTime || new Date().toLocaleString());

    builder.separator('-');

    // 3. Items Header
    builder.bold(true);
    builder.twoColumns('Item (Qty)', 'Amount');
    builder.bold(false);
    builder.separator('-');

    // 4. Items List
    data.items.forEach((item) => {
      const itemTitle = `${item.itemName} x${item.quantity}`;
      const price = item.price ?? item.unitPrice ?? 0;
      const itemAmount = `Rs ${(item.totalPrice || price * item.quantity).toFixed(2)}`;
      builder.twoColumns(itemTitle, itemAmount);
    });

    builder.separator('-');

    // 5. Totals
    if (data.subTotal !== undefined) {
      builder.twoColumns('Subtotal:', `Rs ${data.subTotal.toFixed(2)}`);
    }
    if (data.taxAmount || data.gstAmount) {
      builder.twoColumns('Taxes / GST:', `Rs ${(data.taxAmount || data.gstAmount || 0).toFixed(2)}`);
    }
    if (data.discountAmount && data.discountAmount > 0) {
      builder.twoColumns('Discount:', `-Rs ${data.discountAmount.toFixed(2)}`);
    }

    builder.separator('=');
    builder.bold(true);
    builder.textSize('double-height');
    builder.twoColumns('GRAND TOTAL:', `Rs ${data.grandTotal.toFixed(2)}`, true);
    builder.textSize('normal');
    builder.bold(false);

    if (data.paymentMode) {
      builder.twoColumns('Payment Mode:', data.paymentMode.toUpperCase());
    }

    builder.separator('-');

    // 6. Footer
    builder.align('center');
    builder.textLine(data.footerMessage || 'Thank you! Please visit again.');
    builder.feed(1);
    builder.textLine('Powered by Menza');

    builder.finish();
    return builder.getBytes();
  }

  static buildKot(data: ReceiptData, paperWidth: PaperWidth = '58mm'): number[] {
    const builder = new EscPosBuilder(paperWidth);

    builder.align('center');
    builder.bold(true);
    builder.textLine('--- [ KITCHEN ORDER TICKET (KOT) ] ---');
    if (data.restaurantName) builder.textLine(data.restaurantName);

    builder.textSize('double-both');
    builder.textLine(`#${data.orderNumber || data.orderId}`);
    builder.textSize('normal');
    builder.bold(false);

    builder.separator('=');

    builder.align('left');
    if (data.tableName) builder.bold(true).twoColumns('Table:', String(data.tableName), true).bold(false);
    if (data.orderType) builder.twoColumns('Type:', data.orderType);
    builder.twoColumns('Time:', data.dateTime || new Date().toLocaleTimeString());

    builder.separator('-');

    builder.bold(true);
    builder.twoColumns('Item', 'Qty');
    builder.bold(false);
    builder.separator('-');

    data.items.forEach((item) => {
      builder.bold(true);
      builder.twoColumns(item.itemName, `x${item.quantity}`);
      builder.bold(false);
    });

    builder.finish();
    return builder.getBytes();
  }
}
