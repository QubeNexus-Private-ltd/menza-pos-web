export interface StartCashfreePaymentParams {
  paymentSessionId?: string;
  orderId: string;
  environment?: 'SANDBOX' | 'PRODUCTION' | string;
  paymentLink?: string;
}

export type PaymentSuccessCallback = (orderId: string) => void;
export type PaymentFailureCallback = (error: any, orderId: string) => void;

export function startCashfreePayment(params: StartCashfreePaymentParams): Promise<{ success: boolean; orderId?: string; error?: string }> | void;
export function setPaymentCallbacks(onSuccess: PaymentSuccessCallback, onFailure: PaymentFailureCallback): void;
export function removePaymentCallbacks(): void;
