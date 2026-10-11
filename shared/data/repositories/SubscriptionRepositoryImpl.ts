import { ISubscriptionRepository } from '../../domain/repositories/ISubscriptionRepository';
import { SubscriptionRemoteDataSource } from '../datasources/SubscriptionRemoteDataSource';
import { RestaurantSubscriptionHistory, SubscriptionPlan, UserSubscriptionStatus } from '../../domain/models/Subscription';

export class SubscriptionRepositoryImpl implements ISubscriptionRepository {
  constructor(private remoteDataSource: SubscriptionRemoteDataSource) {}

  async getPlans(): Promise<SubscriptionPlan[]> {
    return await this.remoteDataSource.getPlans();
  }

  async getMySubscription(): Promise<UserSubscriptionStatus | null> {
    return await this.remoteDataSource.getMySubscription();
  }

  async getRestaurantSubscription(restaurantId: number): Promise<UserSubscriptionStatus | null> {
    return await this.remoteDataSource.getRestaurantSubscription(restaurantId);
  }

  async createPaymentOrder(planId: number): Promise<{ cfOrderId: string; paymentSessionId: string }> {
    return await this.remoteDataSource.createPaymentOrder(planId);
  }

  async verifyPayment(cfOrderId: string): Promise<boolean> {
    return await this.remoteDataSource.verifyPayment(cfOrderId);
  }

  async initiateCashFreePayment(
    restaurantId: number,
    subscriptionConfigurationId: number,
    amount: number,
    mobileNumber?: string
  ): Promise<{
    success: boolean;
    orderId: string;
    paymentSessionId?: string;
    instrumentResponseUrl?: string;
    message?: string;
    gateway?: string;
    keyId?: string;
    amount?: number;
    currency?: string;
  }> {
    return await this.remoteDataSource.initiateCashFreePayment(restaurantId, subscriptionConfigurationId, amount, mobileNumber);
  }

  async verifyCashFreePayment(
    orderId: string,
    restaurantId: number,
    subscriptionConfigurationId: number,
    amountPaid: number,
    razorpayPaymentId?: string,
    razorpaySignature?: string
  ): Promise<{ success: boolean; message?: string }> {
    return await this.remoteDataSource.verifyCashFreePayment(
      orderId,
      restaurantId,
      subscriptionConfigurationId,
      amountPaid,
      razorpayPaymentId,
      razorpaySignature
    );
  }

  async getCashFreePaymentStatus(
    orderId: string
  ): Promise<{
    orderId: string;
    paymentStatus: string;
    gatewayOrderStatus?: string;
    transactionId?: string;
    amount?: number;
    failureReason?: string;
  }> {
    return await this.remoteDataSource.getCashFreePaymentStatus(orderId);
  }

  async assignSubscription(
    restaurantId: number,
    subscriptionConfigurationId: number,
    durationInDays: number = 30,
    amountPaid: number = 0
  ): Promise<{ success: boolean; message?: string }> {
    return await this.remoteDataSource.assignSubscription(restaurantId, subscriptionConfigurationId, durationInDays, amountPaid);
  }

  async deletePlan(id: number): Promise<{ success: boolean; message?: string }> {
    return await this.remoteDataSource.deletePlan(id);
  }

  async getPlanById(id: number): Promise<SubscriptionPlan | null> {
    return await this.remoteDataSource.getPlanById(id);
  }

  async getPlanByCode(code: string): Promise<SubscriptionPlan | null> {
    return await this.remoteDataSource.getPlanByCode(code);
  }

  async updateRestaurantSubscriptionStatus(id: number, status: string): Promise<boolean> {
    return await this.remoteDataSource.updateRestaurantSubscriptionStatus(id, status);
  }

  async recordSubscriptionPayment(payment: {
    restaurantSubscriptionId: number;
    transactionId: string;
    amount: number;
    paymentMode?: string;
    paymentStatus?: string;
  }): Promise<boolean> {
    return await this.remoteDataSource.recordSubscriptionPayment(payment);
  }

  async getPaymentsBySubscriptionId(restaurantSubscriptionId: number): Promise<any[]> {
    return await this.remoteDataSource.getPaymentsBySubscriptionId(restaurantSubscriptionId);
  }

  async getAllPayments(): Promise<any[]> {
    return await this.remoteDataSource.getAllPayments();
  }

  async getSubscriptionHistory(restaurantId: number): Promise<RestaurantSubscriptionHistory[]> {
    return await this.remoteDataSource.getSubscriptionHistory(restaurantId);
  }
}
