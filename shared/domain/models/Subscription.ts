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
  minCommissionFloorPerOrder?: number;
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

export type SubscriptionLifecycleState =
  | 'ACTIVE'
  | 'GRACE_PERIOD'
  | 'EXPIRED'
  | 'PENDING'
  | 'UPGRADED'
  | 'SUSPENDED'
  | 'NONE';

export type PlanChangeType = 'RENEW' | 'UPGRADE' | 'DOWNGRADE' | 'FRESH';

export interface UserSubscriptionStatus {
  subscriptionId: number;
  subscriptionConfigurationId?: number;
  planName: string;
  startDate: string;
  endDate: string;
  isExpired: boolean;
  daysRemaining: number;
  isInGracePeriod?: boolean;
  graceDaysRemaining?: number;
  lifecycleState?: SubscriptionLifecycleState;
  status?: string;
  amountPaid?: number;
  paymentReferenceNo?: string;
  effectiveCommissionPercentage?: number;
  effectiveFlatCommissionPerOrder?: number;
  effectiveMinCommissionFloor?: number;
  effectiveMaxCommissionCap?: number;
  entitlements?: SubscriptionPlanEntitlementItem[];
  hasQueuedRenewal?: boolean;
  effectiveCoverageEndDate?: string;
  totalDaysRemaining?: number;
  currentCycleDaysRemaining?: number;
  queuedRenewalDays?: number;
}

export interface RestaurantSubscriptionHistory {
  id: number;
  restaurantSubscriptionRelationshipId: number;
  restaurantId: number;
  subscriptionConfigurationId: number;
  subscriptionCode?: string;
  subscriptionName?: string;
  eventType: string;
  previousStatus?: string;
  newStatus: string;
  startDate: string;
  endDate: string;
  previousEndDate?: string;
  amountPaid: number;
  paymentReferenceNo?: string;
  effectiveCommissionPercentage?: number;
  effectiveFlatCommissionPerOrder?: number;
  effectiveMinCommissionFloor?: number;
  effectiveMaxCommissionCap?: number;
  supersededBySubscriptionId?: number;
  proratedRefundAmount?: number;
  walletTransactionRef?: string;
  actionSource?: string;
  actorUserId?: number;
  remarks?: string;
  createdDateUtc: string;
}
