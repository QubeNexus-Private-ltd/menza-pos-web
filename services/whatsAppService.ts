import { apiClient } from '@shared/core/network/apiClient';

export interface WhatsAppReceiptData {
  restaurantName: string;
  orderId: number | string;
  customerName?: string;
  tableName?: string;
  orderType?: string;
  items: Array<{ itemName: string; quantity: number; price: number }>;
  subTotal?: number;
  cgst?: number;
  sgst?: number;
  taxAmount?: number;
  discountAmount?: number;
  grandTotal: number;
  paymentMode?: string;
  paymentStatus?: string;
  billUrl?: string;
}

export class WebWhatsAppService {
  static async sendTestMessage(mobileNumber: string, customerName?: string, message?: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.post('/WhatsApp/Test', {
        mobileNumber: mobileNumber.trim(),
        customerName: customerName || 'Customer',
        message: message || 'Greetings from Menza Restaurant Suite!',
        templateName: 'order_status_update',
        templateLanguage: 'en_US',
      });
      return {
        success: response.data?.success ?? true,
        message: response.data?.message ?? 'WhatsApp message sent successfully',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Failed to send WhatsApp message',
      };
    }
  }

  static async sendOrderStatusNotification(payload: {
    orderId: number;
    restaurantId: number;
    restaurantName?: string;
    mobileNumber: string;
    customerName?: string;
    orderStatus: string;
    orderTypeName?: string;
    tableName?: string;
    totalAmount: number;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.post('/WhatsApp/Test/OrderStatus', payload);
      return {
        success: response.data?.success ?? true,
        message: response.data?.message ?? 'WhatsApp order notification sent successfully',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Failed to dispatch WhatsApp order alert',
      };
    }
  }

  /**
   * Resolves a valid 10-digit Indian mobile number from various possible order properties or user input.
   */
  static resolveMobileNumber(phone?: string, order?: any): string {
    const candidates = [
      phone,
      order?.mobileNumber,
      order?.customerPhone,
      order?.phone,
      order?.customerMobile,
      order?.MobileNumber,
      order?.CustomerPhone,
      order?.mobile,
    ];

    for (const c of candidates) {
      if (typeof c === 'string' && !c.includes('*')) {
        const digits = c.replace(/[^0-9]/g, '');
        if (digits.length >= 10) {
          return digits.slice(-10);
        }
      }
    }
    return '';
  }

  /**
   * Formats a clean, structured tax invoice receipt text including a direct PDF view/download link.
   */
  static formatReceiptMessage(receiptData: WhatsAppReceiptData): string {
    const itemsText = (receiptData.items || [])
      .map((it) => `• ${it.quantity}x ${it.itemName} - ₹${(it.price * it.quantity).toFixed(2)}`)
      .join('\n');

    const cleanOrderId = String(receiptData.orderId || '').replace(/[^0-9]/g, '') || receiptData.orderId;
    const billUrl = receiptData.billUrl || `https://menzaorder.co.in/bill/${cleanOrderId}`;

    const lines: string[] = [
      `*${receiptData.restaurantName}*`,
      `🧾 *Tax Invoice / Bill: Order #${cleanOrderId}*`,
    ];

    if (receiptData.tableName) {
      lines.push(`📍 Table: ${receiptData.tableName}${receiptData.orderType ? ` (${receiptData.orderType})` : ''}`);
    } else if (receiptData.orderType) {
      lines.push(`📦 Type: ${receiptData.orderType}`);
    }

    if (receiptData.customerName) {
      lines.push(`👤 Customer: ${receiptData.customerName}`);
    }

    lines.push('--------------------------------');
    if (itemsText) {
      lines.push(itemsText);
      lines.push('--------------------------------');
    }

    if (receiptData.subTotal && receiptData.subTotal > 0) {
      lines.push(`Subtotal: ₹${receiptData.subTotal.toFixed(2)}`);
    }

    const tax = receiptData.taxAmount ?? ((receiptData.cgst || 0) + (receiptData.sgst || 0));
    if (tax > 0) {
      lines.push(`Taxes (CGST+SGST): ₹${tax.toFixed(2)}`);
    }

    if (receiptData.discountAmount && receiptData.discountAmount > 0) {
      lines.push(`Discount: -₹${receiptData.discountAmount.toFixed(2)}`);
    }

    const payStatus = receiptData.paymentStatus ? ` (${receiptData.paymentStatus.toUpperCase()})` : '';
    lines.push(`*Grand Total: ₹${Number(receiptData.grandTotal || 0).toFixed(2)}${payStatus}*`);

    if (receiptData.paymentMode) {
      lines.push(`Payment Mode: ${receiptData.paymentMode}`);
    }

    lines.push('--------------------------------');
    lines.push(`📄 *Download / View Official PDF Bill:*`);
    lines.push(billUrl);
    lines.push('--------------------------------');
    lines.push('Thank you for dining with us! 🙏');

    return lines.join('\n');
  }

  /**
   * Generates a direct WhatsApp web/app click-to-chat URL with prefilled receipt text
   */
  static getWhatsAppReceiptUrl(phone: string, receiptData: WhatsAppReceiptData, order?: any): string {
    let cleanPhone = this.resolveMobileNumber(phone, order);
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = this.formatReceiptMessage(receiptData);

    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
  }

  /**
   * Dispatches WhatsApp receipt without creating duplicate browser tabs or triggering session lockouts.
   * Leverages official WhatsApp Universal API links (wa.me / api.whatsapp.com) with popup-blocker resilience.
   */
  static shareWhatsAppReceipt(phone: string, receiptData: WhatsAppReceiptData, order?: any): void {
    if (typeof window === 'undefined') return;

    let cleanPhone = this.resolveMobileNumber(phone, order);

    // If phone is missing or incomplete, prompt cashier
    if (!cleanPhone || cleanPhone.length < 10) {
      const entered = window.prompt('Enter customer 10-digit WhatsApp mobile number:', cleanPhone || '');
      if (!entered) return;
      cleanPhone = (entered || '').replace(/[^0-9]/g, '').slice(-10);
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      alert('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    const fullPhone = `91${cleanPhone}`;
    const msg = this.formatReceiptMessage(receiptData);

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const encodedText = encodeURIComponent(msg);

    // Universal WhatsApp deep-link that supports both WhatsApp Web and native WhatsApp Desktop app
    const targetUrl = isMobile
      ? `https://wa.me/${fullPhone}?text=${encodedText}`
      : `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodedText}`;

    // Attempt to open WhatsApp in a dedicated window/tab
    let targetWindow: Window | null = null;
    try {
      targetWindow = window.open(targetUrl, 'menza_whatsapp_tab');
      if (targetWindow) {
        targetWindow.focus();
      }
    } catch {}

    // Fallback if popup was blocked by browser (common after window.prompt)
    if (!targetWindow || targetWindow.closed || typeof targetWindow.closed === 'undefined') {
      try {
        const link = document.createElement('a');
        link.href = targetUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch {
        window.location.href = targetUrl;
      }
    }
  }
}
