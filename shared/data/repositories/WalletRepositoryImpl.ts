import { IWalletRepository } from '../../domain/repositories/IWalletRepository';
import { RestaurantWallet, WalletTransaction, WalletRechargeResponse } from '../../domain/models/Wallet';
import { WalletRemoteDataSource } from '../datasources/WalletRemoteDataSource';

export class WalletRepositoryImpl implements IWalletRepository {
  constructor(private readonly dataSource: WalletRemoteDataSource) {}

  async getWallet(restaurantId: number): Promise<RestaurantWallet> {
    return await this.dataSource.getWallet(restaurantId);
  }

  async initiateRecharge(
    restaurantId: number,
    amount: number,
    ownerPhone?: string
  ): Promise<WalletRechargeResponse> {
    return await this.dataSource.initiateRecharge(restaurantId, amount, ownerPhone);
  }

  async verifyRecharge(
    orderId: string,
    restaurantId: number,
    amountPaid: number,
    razorpayPaymentId?: string,
    razorpaySignature?: string
  ): Promise<{ success: boolean; message?: string }> {
    return await this.dataSource.verifyRecharge(orderId, restaurantId, amountPaid, razorpayPaymentId, razorpaySignature);
  }

  async getTransactions(restaurantId: number): Promise<WalletTransaction[]> {
    return await this.dataSource.getTransactions(restaurantId);
  }

  async exportStatement(restaurantId: number, fromDate?: string, toDate?: string): Promise<string> {
    return await this.dataSource.exportStatement(restaurantId, fromDate, toDate);
  }
}
