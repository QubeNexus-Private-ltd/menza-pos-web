export interface WalletTransactionDTO {
  transactionId: number;
  restaurantId: number;
  amount: number;
  transactionType: 'CREDIT' | 'DEBIT' | string;
  category: 'RECHARGE' | 'SMS_DISPATCH' | 'WHATSAPP_ALERT' | 'COMMISSION' | string;
  description: string;
  closingBalance: number;
  createdAt: string;
}

export interface RestaurantWalletDTO {
  restaurantId: number;
  balance: number;
  currency: string;
  lastUpdated: string;
  recentTransactions: WalletTransactionDTO[];
}

export interface InitiateWalletRechargeRequest {
  restaurantId: number;
  amount: number;
  paymentMode?: string;
  redirectUrl?: string;
}
