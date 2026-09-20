export interface SubscriptionPlanEntitlementItem {
  id?: number;
  subscriptionConfigurationId?: number;
  orderConfigId: number;
  configKey: string;
  isAllowed: boolean;
  featureCommissionPercentage?: number;
  featureFlatFeePerOrder?: number;
}

export interface SubscriptionPlan {
  id: number;
  subscriptionCode?: string;
  subscriptionName?: string;
  planName?: string;
  price: number;
  discountAmount?: number;
  finalPrice?: number;
  durationInDays?: number;
  durationDays?: number;
  billingCycle?: 'MONTHLY' | 'QUARTERLY' | 'HALFYEARLY' | 'ANNUALLY' | string;
  description?: string;
  commissionType?: 'PERCENTAGE' | 'FLAT_PER_ORDER' | 'HYBRID' | 'FEATURE_DRIVEN' | string;
  baseCommissionPercentage?: number;
  baseFlatCommissionPerOrder?: number;
  maxCommissionCapPerOrder?: number;
  includedWalletCredit?: number;
  allowTableOrdering?: boolean;
  allowCounterOrdering?: boolean;
  allowSelfPickup?: boolean;
  allowDelivery?: boolean;
  allowKds?: boolean;
  allowOnlinePayment?: boolean;
  isActive?: boolean;
  features?: string[];
  entitlements?: SubscriptionPlanEntitlementItem[];
}

export interface UserSubscriptionStatus {
  subscriptionId: number;
  subscriptionConfigurationId?: number;
  planName: string;
  startDate: string;
  endDate: string;
  isExpired: boolean;
  daysRemaining: number;
  status?: string;
  entitlements?: SubscriptionPlanEntitlementItem[];
}
