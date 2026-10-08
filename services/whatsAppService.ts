import { apiClient } from '@/lib/api/client';

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
   * Generates a direct WhatsApp web/app click-to-chat URL with prefilled receipt text
   */
  static getWhatsAppReceiptUrl(phone: string, receiptData: {
    restaurantName: string;
    orderId: number | string;
    customerName?: string;
    items: Array<{ itemName: string; quantity: number; price: number }>;
    grandTotal: number;
    paymentMode?: string;
  }): string {
    const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const itemsText = receiptData.items
      .map((it) => `• ${it.quantity}x ${it.itemName} - ₹${it.price * it.quantity}`)
      .join('\n');

    const msg = `*${receiptData.restaurantName}*\n🧾 Order #${receiptData.orderId}\n` +
      (receiptData.customerName ? `👤 Customer: ${receiptData.customerName}\n` : '') +
      `--------------------------------\n${itemsText}\n` +
      `--------------------------------\n*Grand Total: ₹${receiptData.grandTotal}*\n` +
      (receiptData.paymentMode ? `Payment: ${receiptData.paymentMode}\n` : '') +
      `\nThank you for dining with us! 🙏`;

    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
  }
}
