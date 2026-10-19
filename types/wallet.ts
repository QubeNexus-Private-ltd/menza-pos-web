export interface PlatformGstInfo {
  platformLegalName: string;
  platformTradeName: string;
  platformGstin: string;
  platformPan: string;
  platformStateCode: string;
  platformStateName: string;
  platformAddress: string;
  supportEmail: string;
  websiteUrl: string;
  defaultGstPercentage: number;
  cgstPercentage: number;
  sgstPercentage: number;
  walletSacCode: string;
  subscriptionSacCode: string;
}

export interface WalletTransactionDTO {
  transactionId: number;
  restaurantId: number;
  amount: number;
  transactionType: 'CREDIT' | 'DEBIT' | string;
  category: 'RECHARGE' | 'SMS_DISPATCH' | 'WHATSAPP_ALERT' | 'COMMISSION' | string;
  description: string;
  closingBalance: number;
  invoiceNumber?: string;
  baseAmount?: number;
  taxAmount?: number;
  taxPercentage?: number;
  createdAt: string;
}

export interface RestaurantWalletDTO {
  restaurantId: number;
  balance: number;
  currency: string;
  lastUpdated: string;
  restaurantName?: string;
  restaurantGstNumber?: string;
  platformGst?: PlatformGstInfo;
  recentTransactions: WalletTransactionDTO[];
}

export interface InitiateWalletRechargeRequest {
  restaurantId: number;
  amount: number;
  paymentMode?: string;
  redirectUrl?: string;
}

