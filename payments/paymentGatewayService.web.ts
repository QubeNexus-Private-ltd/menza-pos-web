import { APP_CONSTANTS } from '@shared/core/constants/appConstants';
import { startCashfreePayment } from './cashfreeService.web';

export interface PaymentCheckoutParams {
  orderId: string;
  amount: number;
  currency?: string;
  gateway?: string;
  keyId?: string;
  paymentSessionId?: string;
  paymentLink?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  orderNotes?: string;
  environment?: 'SANDBOX' | 'PRODUCTION';
}

export interface PaymentCheckoutResult {
  success: boolean;
  orderId: string;
  gateway: 'Razorpay' | 'Cashfree';
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  razorpaySignature?: string;
  error?: string;
  rawDetails?: any;
}

/**
 * Checks whether Razorpay is the active payment gateway.
 */
export const isRazorpayActive = (gatewayOverride?: string): boolean => {
  if (gatewayOverride) {
    return gatewayOverride.toLowerCase() === 'razorpay';
  }
  return APP_CONSTANTS.IS_RAZORPAY;
};

/**
 * Dynamically loads Razorpay checkout.js SDK into the web browser DOM.
 */
const loadRazorpayWebSdk = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }

    const scriptId = 'razorpay-checkout-script';
    const existing = document.getElementById(scriptId);
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;

    script.onload = () => resolve(Boolean((window as any).Razorpay));
    script.onerror = () => {
      console.warn('[PaymentGatewayService] Failed to load Razorpay checkout.js SDK from CDN.');
      resolve(false);
    };

    document.head.appendChild(script);
  });
};

/**
 * Unified Payment Gateway Checkout Service for Web:
 * Checks isRazorpay: if true, uses Razorpay Checkout Modal; else uses Cashfree Drop Modal.
 */
export class PaymentGatewayService {
  public static async startPayment(params: PaymentCheckoutParams): Promise<PaymentCheckoutResult> {
    const isRazorpay =
      (typeof params.gateway === 'string' && params.gateway.toLowerCase() === 'razorpay') ||
      Boolean(params.keyId && params.gateway?.toLowerCase() !== 'cashfree') ||
      APP_CONSTANTS.IS_RAZORPAY;

    console.log(
      `[PaymentGatewayService] Starting checkout for order ${params.orderId} via ${
        isRazorpay ? 'Razorpay' : 'Cashfree'
      }`
    );

    if (isRazorpay) {
      return PaymentGatewayService.startRazorpayPayment(params);
    }

    return PaymentGatewayService.startCashfreePayment(params);
  }

  private static async startRazorpayPayment(params: PaymentCheckoutParams): Promise<PaymentCheckoutResult> {
    const {
      orderId,
      amount,
      currency = 'INR',
      keyId,
      paymentLink,
      customerName,
      customerPhone,
      customerEmail,
      orderNotes,
    } = params;

    if (!keyId || keyId.trim() === '' || keyId.toLowerCase().includes('placeholder')) {
      return {
        success: false,
        orderId,
        gateway: 'Razorpay',
        error: 'Payment gateway is not configured. Razorpay Key ID is missing or invalid.',
      };
    }

    const rzpLoaded = await loadRazorpayWebSdk();

    if (rzpLoaded && typeof window !== 'undefined' && (window as any).Razorpay && keyId) {
      return new Promise<PaymentCheckoutResult>((resolve) => {
        const amountInPaise = Math.round(amount * 100);

        const options: any = {
          key: keyId,
          amount: amountInPaise,
          currency,
          name: 'Menza POS',
          description: orderNotes || `Payment for Order #${orderId}`,
          order_id: orderId.startsWith('order_') ? orderId : undefined,
          prefill: {
            name: customerName || 'Restaurant Owner',
            contact: customerPhone || '9999999999',
            email: customerEmail || 'billing@menza.com',
          },
          theme: {
            color: '#DE8626',
          },
          handler: (response: any) => {
            console.log(`[PaymentGatewayService] Razorpay payment completed for ${orderId}:`, response);
            resolve({
              success: true,
              orderId,
              gateway: 'Razorpay',
              razorpayPaymentId: response?.razorpay_payment_id,
              razorpayOrderId: response?.razorpay_order_id || orderId,
              razorpaySignature: response?.razorpay_signature,
              rawDetails: response,
            });
          },
          modal: {
            ondismiss: () => {
              console.log(`[PaymentGatewayService] Razorpay modal dismissed by user for ${orderId}`);
              resolve({
                success: false,
                orderId,
                gateway: 'Razorpay',
                error: 'Payment checkout was cancelled by user.',
              });
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);

        rzp.on('payment.failed', (failRes: any) => {
          console.error(`[PaymentGatewayService] Razorpay payment failed for ${orderId}:`, failRes);
          resolve({
            success: false,
            orderId,
            gateway: 'Razorpay',
            error: failRes?.error?.description || 'Razorpay payment failed.',
            rawDetails: failRes,
          });
        });

        rzp.open();
      });
    }

    // Fallback: If checkout.js couldn't open but paymentLink exists, redirect to payment link
    if (paymentLink && typeof window !== 'undefined') {
      window.open(paymentLink, '_blank', 'noopener,noreferrer');
      return {
        success: false,
        orderId,
        gateway: 'Razorpay',
        error: 'Payment link opened in a new tab. Please complete payment and verify status.',
        rawDetails: { paymentLink },
      };
    }

    return {
      success: false,
      orderId,
      gateway: 'Razorpay',
      error: 'Payment gateway is not configured or checkout script failed to load.',
    };
  }

  private static async startCashfreePayment(params: PaymentCheckoutParams): Promise<PaymentCheckoutResult> {
    const cfEnv = params.environment || (APP_CONSTANTS.CASHFREE_ENV as any) || 'SANDBOX';

    const res: any = await startCashfreePayment({
      paymentSessionId: params.paymentSessionId,
      orderId: params.orderId,
      environment: cfEnv,
      paymentLink: params.paymentLink,
    });

    return {
      success: Boolean(res?.success),
      orderId: params.orderId,
      gateway: 'Cashfree',
      error: res?.error,
      rawDetails: res,
    };
  }
}
