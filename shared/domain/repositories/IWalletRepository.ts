import { RestaurantWallet, WalletTransaction, WalletRechargeResponse } from '../models/Wallet';

export interface IWalletRepository {
  getWallet(restaurantId: number): Promise<RestaurantWallet>;
  initiateRecharge(restaurantId: number, amount: number, ownerPhone?: string): Promise<WalletRechargeResponse>;
  verifyRecharge(orderId: string, restaurantId: number, amountPaid: number): Promise<{ success: boolean; message?: string }>;
  getTransactions(restaurantId: number): Promise<WalletTransaction[]>;
  exportStatement(restaurantId: number, fromDate?: string, toDate?: string): Promise<string>;
}
