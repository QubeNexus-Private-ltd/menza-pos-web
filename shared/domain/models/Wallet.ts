export type WalletStatus = 'HEALTHY' | 'LOW_BALANCE' | 'EXHAUSTED';

export type WalletTransactionType =
  | 'RECHARGE'
  | 'COMMISSION_DEDUCT'
  | 'ORDER_COMMISSION'
  | 'REFUND'
  | 'ADJUSTMENT'
  | 'MANUAL_ADJUSTMENT'
  | 'BONUS_CREDIT'
  | 'BONUS'
  | string;

export interface WalletTransaction {
  id: string;
  transactionType: WalletTransactionType;
  direction?: 'CREDIT' | 'DEBIT' | string;
  amount: number;
  balanceBefore?: number;
  balanceAfter: number;
  description: string;
  orderId?: string;
  paymentReference?: string;
  createdAt: string;
}

export interface RestaurantWallet {
  restaurantId: number;
  balance: number;
  lowBalanceThreshold: number;
  totalRecharged: number;
  totalCommissionPaid: number;
  status: WalletStatus;
  currency: string;
  lastUpdated: string;
  recentTransactions?: WalletTransaction[];
}

export interface WalletRechargeRequest {
  restaurantId: number;
  amount: number;
  ownerPhone?: string;
  paymentMethod?: string;
}

export interface WalletRechargeResponse {
  success: boolean;
  orderId: string;
  paymentSessionId?: string;
  instrumentResponseUrl?: string;
  message?: string;
}
