import { Alert, Linking, NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { CashfreeSdkService, CashfreeEnvironment, CashfreeSDKResult } from './CashfreeSdkService';
import { logger } from '../../core/logging';
import { APP_CONSTANTS } from '../../core/constants/appConstants';

export type PaymentGatewayType = 'Cashfree' | 'Razorpay' | string;

export interface PaymentGatewayRequestParams {
  orderId: string;
  paymentSessionId?: string;
  paymentLink?: string;
  gateway?: PaymentGatewayType;
  keyId?: string;
  amount?: number;
  currency?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  orderNotes?: string;
  environment?: CashfreeEnvironment;
}

export interface PaymentGatewayResult {
  success: boolean;
  orderId: string;
  gateway: PaymentGatewayType;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  razorpaySignature?: string;
  error?: string;
  rawDetails?: any;
}

export class PaymentGatewayManager {
  private static instance: PaymentGatewayManager;

  private constructor() {}

  public static getInstance(): PaymentGatewayManager {
    if (!PaymentGatewayManager.instance) {
      PaymentGatewayManager.instance = new PaymentGatewayManager();
    }
    return PaymentGatewayManager.instance;
  }

  /**
   * Dispatches payment flow dynamically based on the gateway provided by backend ('Razorpay' or 'Cashfree').
   * If gateway is 'Razorpay', handles web script injection or native browser payment link.
   * If gateway is 'Cashfree' (or unspecified), invokes CashfreeSdkService directly.
   */
  public async startPayment(params: PaymentGatewayRequestParams): Promise<PaymentGatewayResult> {
    const isRazorpay =
      (typeof params.gateway === 'string' && params.gateway.toLowerCase() === 'razorpay') ||
      Boolean(params.keyId && params.gateway?.toLowerCase() !== 'cashfree');

    logger.payment(
      'PAYMENT_SDK_STARTED',
      `Starting payment flow via ${isRazorpay ? 'Razorpay' : 'Cashfree'} for order ${params.orderId}`,
      {
        orderId: params.orderId,
        gateway: isRazorpay ? 'Razorpay' : 'Cashfree',
        amount: params.amount,
        hasPaymentLink: Boolean(params.paymentLink),
        platform: Platform.OS,
      }
    );

    if (isRazorpay) {
      return this.startRazorpayPayment(params);
    }

    return this.startCashfreePayment(params);
  }

  /**
   * Cashfree payment flow (delegates 100% to CashfreeSdkService).
   */
  private async startCashfreePayment(params: PaymentGatewayRequestParams): Promise<PaymentGatewayResult> {
    const res: CashfreeSDKResult = await CashfreeSdkService.getInstance().startPayment({
      orderId: params.orderId,
      paymentSessionId: params.paymentSessionId || '',
      paymentLink: params.paymentLink,
      environment: params.environment || 'SANDBOX',
    });

    return {
      success: res.success,
      orderId: res.orderId,
      gateway: 'Cashfree',
      error: res.error,
      rawDetails: res.rawDetails,
    };
  }

  /**
   * Razorpay payment flow.
   * On Web: Injects and launches Razorpay Standard Checkout modal, with fallback to short_url paymentLink.
   * On Mobile / Native: Opens Razorpay Hosted Checkout URL in external browser / webview.
   */
  private async startRazorpayPayment(params: PaymentGatewayRequestParams): Promise<PaymentGatewayResult> {
    const {
      orderId,
      paymentLink,
      keyId,
      amount = 0,
      currency = 'INR',
      customerName,
      customerPhone,
      customerEmail,
      orderNotes,
    } = params;

    const resolvedLink =
      paymentLink && paymentLink.startsWith('http')
        ? paymentLink
        : paymentLink && paymentLink.trim().length > 0
        ? `${APP_CONSTANTS.API_BASE_URL.replace(/\/api\/?$/, '')}${paymentLink.startsWith('/') ? '' : '/'}${paymentLink}`
        : `${APP_CONSTANTS.API_BASE_URL}/CashFreepayment/razorpay-checkout?orderId=${orderId}`;

    // 1. Native Mobile Platform (Android / iOS): Use Native Razorpay Checkout Activity
    // This provides an authentic in-app Android bottom sheet experience (GPay, PhonePe, Cards) with NO browser URL bar.
    if (Platform.OS !== 'web' && keyId) {
      let RazorpayModule: any = null;
      try {
        RazorpayModule = require('react-native-razorpay');
        if (RazorpayModule && RazorpayModule.default) {
          RazorpayModule = RazorpayModule.default;
        }
      } catch {}

      const hasNativeModule = Boolean(
        (RazorpayModule && typeof RazorpayModule.open === 'function') ||
        (NativeModules.RNRazorpayCheckout && typeof NativeModules.RNRazorpayCheckout.open === 'function')
      );

      if (hasNativeModule) {
        logger.payment('PAYMENT_SDK_STARTED', `Opening native Android Razorpay CheckoutActivity for order ${orderId}`, {
          orderId,
          keyId: `${keyId.slice(0, 8)}...`,
          amount,
        });

        const amountInPaise = Math.round(amount * 100);
        const rzpOptions: any = {
          key: keyId,
          amount: amountInPaise,
          currency,
          name: 'Menza POS',
          description: orderNotes || `Platform Fee for Order #${orderId}`,
          order_id: orderId.startsWith('order_') ? orderId : undefined,
          prefill: {
            name: customerName || 'Restaurant Owner',
            contact: customerPhone || '9999999999',
            email: customerEmail || 'billing@menza.com',
          },
          theme: {
            color: '#DE8626',
          },
        };

        if (RazorpayModule && typeof RazorpayModule.open === 'function') {
          try {
            const data = await RazorpayModule.open(rzpOptions);
            logger.payment('PAYMENT_SDK_COMPLETED', `Native Razorpay checkout completed successfully for ${orderId}`, data);
            return {
              success: true,
              orderId,
              gateway: 'Razorpay',
              razorpayPaymentId: data?.razorpay_payment_id,
              razorpayOrderId: data?.razorpay_order_id || orderId,
              razorpaySignature: data?.razorpay_signature,
              rawDetails: data,
            };
          } catch (error: any) {
            logger.payment('PAYMENT_SDK_COMPLETED', `Native Razorpay payment cancelled or failed for ${orderId}`, error);
            return {
              success: false,
              orderId,
              gateway: 'Razorpay',
              error: error?.description || error?.error?.description || error?.message || 'Payment cancelled by user.',
              rawDetails: error,
            };
          }
        }

        // Direct NativeModules fallback
        const RNRazorpayCheckout = NativeModules.RNRazorpayCheckout;
        const emitterModule = NativeModules.RazorpayEventEmitter || RNRazorpayCheckout;
        if (RNRazorpayCheckout && typeof RNRazorpayCheckout.open === 'function') {
          return new Promise<PaymentGatewayResult>((resolve) => {
            try {
              const eventEmitter = new NativeEventEmitter(emitterModule);
              let isSettled = false;

              const cleanup = () => {
                try { successSub.remove(); } catch {}
                try { errorSub.remove(); } catch {}
              };

              const successSub = eventEmitter.addListener('Razorpay::PAYMENT_SUCCESS', (data: any) => {
                if (isSettled) return;
                isSettled = true;
                cleanup();
                logger.payment('PAYMENT_SDK_COMPLETED', `Native Razorpay checkout completed successfully for ${orderId}`, data);
                resolve({
                  success: true,
                  orderId,
                  gateway: 'Razorpay',
                  razorpayPaymentId: data?.razorpay_payment_id,
                  razorpayOrderId: data?.razorpay_order_id || orderId,
                  razorpaySignature: data?.razorpay_signature,
                  rawDetails: data,
                });
              });

              const errorSub = eventEmitter.addListener('Razorpay::PAYMENT_ERROR', (data: any) => {
                if (isSettled) return;
                isSettled = true;
                cleanup();
                logger.payment('PAYMENT_SDK_COMPLETED', `Native Razorpay payment cancelled or failed for ${orderId}`, data);
                resolve({
                  success: false,
                  orderId,
                  gateway: 'Razorpay',
                  error: data?.description || data?.error?.description || 'Payment cancelled by user.',
                  rawDetails: data,
                });
              });

              RNRazorpayCheckout.open(rzpOptions);
            } catch (bridgeErr: any) {
              logger.payment('PAYMENT_SDK_COMPLETED', `Razorpay native bridge error: ${bridgeErr?.message}`, { orderId });
              resolve({
                success: false,
                orderId,
                gateway: 'Razorpay',
                error: bridgeErr?.message || 'Native Razorpay checkout failed.',
              });
            }
          });
        }
      }
    }

    // 2. Web Platform: Standard Checkout Modal via checkout.js
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        const rzpLoaded = await this.ensureRazorpayWebScriptLoaded();
        if (rzpLoaded && (window as any).Razorpay && keyId) {
          return new Promise<PaymentGatewayResult>((resolve) => {
            const amountInPaise = Math.round(amount * 100);
            const options: any = {
              key: keyId,
              amount: amountInPaise,
              currency,
              name: 'Menza POS',
              description: orderNotes || `Platform Fee for Order #${orderId}`,
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
                logger.payment('PAYMENT_SDK_COMPLETED', `Razorpay checkout completed successfully for ${orderId}`, response);
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
                  logger.payment('PAYMENT_SDK_COMPLETED', `Razorpay checkout modal dismissed by user for ${orderId}`);
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
              logger.payment('PAYMENT_SDK_COMPLETED', `Razorpay payment failed for ${orderId}`, failRes);
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
      } catch (webErr: any) {
        logger.payment('PAYMENT_SDK_STARTED', `Failed loading Razorpay web script: ${webErr?.message}. Falling back to payment link.`);
      }

      // Web Fallback: Open payment link in new window if checkout.js failed
      if (resolvedLink) {
        try {
          window.open(resolvedLink, '_blank', 'noopener,noreferrer');
          return {
            success: true,
            orderId,
            gateway: 'Razorpay',
            rawDetails: { checkoutUrl: resolvedLink, note: 'Razorpay payment link opened in new tab.' },
          };
        } catch (openErr: any) {
          return {
            success: false,
            orderId,
            gateway: 'Razorpay',
            error: openErr?.message || 'Failed to open Razorpay payment link.',
          };
        }
      }
    }

    // 3. Fallback for unlinked development / Expo Go runtime: Open Hosted Checkout URL
    if (resolvedLink) {
      try {
        const canOpen = await Linking.canOpenURL(resolvedLink);
        if (canOpen) {
          await Linking.openURL(resolvedLink);
        } else {
          await Linking.openURL(resolvedLink);
        }

        return {
          success: true,
          orderId,
          gateway: 'Razorpay',
          rawDetails: { checkoutUrl: resolvedLink, note: 'Razorpay checkout opened via fallback link.' },
        };
      } catch (linkErr: any) {
        logger.payment('PAYMENT_SDK_COMPLETED', `Failed to open Razorpay payment link: ${linkErr?.message}`, { orderId });
        return {
          success: false,
          orderId,
          gateway: 'Razorpay',
          error: linkErr?.message || 'Unable to open Razorpay checkout.',
        };
      }
    }

    // 3. Fallback notice if neither script nor paymentLink is available
    const errorMsg = 'Razorpay checkout link is unavailable. Please verify Razorpay configuration in backend settings.';
    logger.payment('PAYMENT_SDK_COMPLETED', errorMsg, { orderId });
    Alert.alert('Razorpay Checkout', errorMsg);
    return {
      success: false,
      orderId,
      gateway: 'Razorpay',
      error: errorMsg,
    };
  }

  /**
   * Lazily injects Razorpay Checkout.js script on Web.
   */
  private ensureRazorpayWebScriptLoaded(): Promise<boolean> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return Promise.resolve(false);
    }

    if ((window as any).Razorpay) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      const existingScript = document.getElementById('razorpay-checkout-js');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(true));
        existingScript.addEventListener('error', () => resolve(false));
        return;
      }

      const script = document.createElement('script');
      script.id = 'razorpay-checkout-js';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }
}
