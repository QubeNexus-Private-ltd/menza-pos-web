import { RestaurantSubscriptionHistory, SubscriptionPlan, UserSubscriptionStatus } from '../models/Subscription';

export interface ISubscriptionRepository {
  getPlans(): Promise<SubscriptionPlan[]>;
  getMySubscription(): Promise<UserSubscriptionStatus | null>;
  getRestaurantSubscription(restaurantId: number): Promise<UserSubscriptionStatus | null>;
  createPaymentOrder(planId: number): Promise<{ cfOrderId: string; paymentSessionId: string }>;
  verifyPayment(cfOrderId: string): Promise<boolean>;
  initiateCashFreePayment(
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
  }>;
  verifyCashFreePayment(
    orderId: string,
    restaurantId: number,
    subscriptionConfigurationId: number,
    amountPaid: number,
    razorpayPaymentId?: string,
    razorpaySignature?: string
  ): Promise<{ success: boolean; message?: string }>;
  getCashFreePaymentStatus(
    orderId: string
  ): Promise<{
    orderId: string;
    paymentStatus: string;
    gatewayOrderStatus?: string;
    transactionId?: string;
    amount?: number;
    failureReason?: string;
  }>;
  assignSubscription(
    restaurantId: number,
    subscriptionConfigurationId: number,
    durationInDays?: number,
    amountPaid?: number
  ): Promise<{ success: boolean; message?: string }>;
  deletePlan(id: number): Promise<{ success: boolean; message?: string }>;
  getPlanById(id: number): Promise<SubscriptionPlan | null>;
  getPlanByCode(code: string): Promise<SubscriptionPlan | null>;
  updateRestaurantSubscriptionStatus(id: number, status: string): Promise<boolean>;
  recordSubscriptionPayment(payment: {
    restaurantSubscriptionId: number;
    transactionId: string;
    amount: number;
    paymentMode?: string;
    paymentStatus?: string;
  }): Promise<boolean>;
  getPaymentsBySubscriptionId(restaurantSubscriptionId: number): Promise<any[]>;
  getAllPayments(): Promise<any[]>;
  getSubscriptionHistory(restaurantId: number): Promise<RestaurantSubscriptionHistory[]>;
}
