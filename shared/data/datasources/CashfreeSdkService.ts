import { Alert, NativeModules, Platform } from 'react-native';
import {
  startCashfreePayment as startPaymentFromPayments,
  setPaymentCallbacks as setCallbacksFromPayments,
  removePaymentCallbacks as removeCallbacksFromPayments,
} from '../../../payments/cashfreeService';
import { logger } from '../../core/logging';

export type CashfreeEnvironment = 'SANDBOX' | 'PRODUCTION';

export interface CashfreeSDKPaymentParams {
  orderId: string;
  paymentSessionId: string;
  paymentLink?: string;
  environment?: CashfreeEnvironment;
}

export interface CashfreeSDKResult {
  success: boolean;
  orderId: string;
  error?: string;
  rawDetails?: any;
}

export class CashfreeSdkService {
  private static instance: CashfreeSdkService;

  private constructor() {}

  /**
   * Returns the Singleton instance of CashfreeSdkService.
   */
  public static getInstance(): CashfreeSdkService {
    if (!CashfreeSdkService.instance) {
      CashfreeSdkService.instance = new CashfreeSdkService();
    }
    return CashfreeSdkService.instance;
  }

  /**
   * Detects if running inside Expo Go or an environment where native Java SDK bindings are unlinked.
   */
  private isExpoGoRuntime(): boolean {
    if (Platform.OS === 'web') return false;

    try {
      const Constants = require('expo-constants').default || require('expo-constants');
      if (Constants && (Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'guest')) {
        return true;
      }
    } catch {
      // Ignore if expo-constants is not installed
    }

    if (typeof (globalThis as any).Expo !== 'undefined' && (globalThis as any).__expo_go__) {
      return true;
    }

    // Check if Cashfree Native Android/iOS module is linked into NativeModules
    const hasNativeBridge = !!(
      NativeModules.CFPaymentGatewayService ||
      NativeModules.CashfreePgApi ||
      NativeModules.RNCashfreePgSdk
    );

    return !hasNativeBridge;
  }

  /**
   * Triggers Cashfree Payment Flow (Web SDK on Web platform, Native Drop-in SDK on Android/iOS).
   */
  public async startPayment(params: CashfreeSDKPaymentParams): Promise<CashfreeSDKResult> {
    const { orderId, paymentSessionId, paymentLink, environment = 'SANDBOX' } = params;

    logger.payment('PAYMENT_SDK_STARTED', `Initiating CashFree payment SDK for order ${orderId}`, {
      orderId,
      environment,
      hasPaymentLink: Boolean(paymentLink),
      platform: Platform.OS,
    });

    // 1. Parameter Validation
    if (!orderId || typeof orderId !== 'string' || orderId.trim().length === 0) {
      const errorMsg = 'Invalid parameters: orderId is required.';
      logger.payment('PAYMENT_SDK_COMPLETED', `Payment failed: ${errorMsg}`, { orderId, success: false });
      return { success: false, orderId: orderId || '', error: errorMsg };
    }

    if ((!paymentSessionId || typeof paymentSessionId !== 'string' || paymentSessionId.trim().length === 0) && !paymentLink) {
      const errorMsg = 'Invalid parameters: paymentSessionId or paymentLink is required.';
      logger.payment('PAYMENT_SDK_COMPLETED', `Payment failed: ${errorMsg}`, { orderId, success: false });
      return { success: false, orderId, error: errorMsg };
    }

    // 2. Web Platform Execution via payments/cashfreeService.web.js
    if (Platform.OS === 'web') {
      try {
        const result = await startPaymentFromPayments({
          orderId,
          paymentSessionId,
          paymentLink,
          environment,
        });

        const outcome: CashfreeSDKResult = {
          success: Boolean(result?.success),
          orderId,
          error: result?.error,
          rawDetails: result,
        };

        logger.payment('PAYMENT_SDK_COMPLETED', `Web CashFree payment outcome: ${outcome.success ? 'SUCCESS' : 'FAILED'}`, {
          orderId,
          success: outcome.success,
        });

        return outcome;
      } catch (err: any) {
        logger.payment('PAYMENT_SDK_COMPLETED', `Web CashFree payment exception: ${err.message}`, {
          orderId,
          success: false,
        });
        return { success: false, orderId, error: err.message || 'Web payment exception.' };
      }
    }

    // 3. Fallback for Expo Go or Unlinked Native SDK Runtime
    if (this.isExpoGoRuntime()) {
      logger.payment('PAYMENT_SDK_STARTED', `Expo Go unlinked runtime detected for order ${orderId}. Opening browser payment link.`, {
        orderId,
        hasPaymentLink: Boolean(paymentLink),
      });

      if (paymentLink) {
        try {
          const { Linking } = require('react-native');
          Linking.openURL(paymentLink);
        } catch (linkErr: any) {
          logger.payment('PAYMENT_SDK_COMPLETED', `Failed to open payment link: ${linkErr?.message}`, { orderId, success: false });
        }
      }

      return {
        success: false,
        orderId,
        rawDetails: { note: 'Cashfree Native SDK requires a custom dev build. Payment link opened in browser.' },
      };
    }

    // 4. Native Cashfree SDK Call on Android / iOS
    return new Promise<CashfreeSDKResult>((resolve) => {
      let isResolved = false;

      const finish = (result: CashfreeSDKResult) => {
        if (!isResolved) {
          isResolved = true;
          try {
            removeCallbacksFromPayments();
          } catch {
            // Safe teardown
          }
          logger.payment('PAYMENT_SDK_COMPLETED', `Native CashFree payment result: ${result.success ? 'SUCCESS' : 'FAILED'}`, {
            orderId: result.orderId,
            success: result.success,
          });
          resolve(result);
        }
      };

      try {
        setCallbacksFromPayments(
          (data: any) => {
            finish({
              success: true,
              orderId,
              rawDetails: data,
            });
          },
          (data: any) => {
            const msg = data?.message || data?.error || 'Payment failed or cancelled by user.';
            finish({
              success: false,
              orderId,
              error: msg,
              rawDetails: data,
            });
          }
        );

        const startRes = startPaymentFromPayments({
          orderId,
          paymentSessionId,
          paymentLink,
          environment,
        });

        if (startRes && typeof (startRes as any).catch === 'function') {
          (startRes as Promise<any>).catch((startErr: any) => {
            finish({
              success: false,
              orderId,
              error: startErr?.message || 'Failed to start native payment checkout activity.',
            });
          });
        }
      } catch (err: any) {
        finish({
          success: false,
          orderId,
          error: err?.message || 'Exception establishing Cashfree payment callbacks.',
        });
      }
    });
  }
}
