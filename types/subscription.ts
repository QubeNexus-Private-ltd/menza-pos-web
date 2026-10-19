import { PlatformGstInfo } from './wallet';

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
  planId?: number;
  subscriptionCode?: string;
  subscriptionName?: string;
  planName: string;
  tier?: string;
  price: number;
  discountAmount?: number;
  finalPrice?: number;
  durationInDays?: number;
  durationDays?: number;
  billingCycle?: 'MONTHLY' | 'QUARTERLY' | 'HALFYEARLY' | 'ANNUALLY' | 'ANNUAL' | string;
  description: string;
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
  allowSmsNotifications?: boolean;
  isActive: boolean;
  features?: string[];
  maxOutlets?: number;
  maxStaff?: number;
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

export interface UserSubscriptionStatus {
  subscriptionId?: number;
  restaurantId?: number;
  planId?: number;
  subscriptionConfigurationId?: number;
  planName: string;
  startDate: string;
  endDate?: string;
  expiryDate?: string;
  isExpired: boolean;
  daysRemaining: number;
  isInGracePeriod?: boolean;
  graceDaysRemaining?: number;
  lifecycleState?: SubscriptionLifecycleState;
  status: string;
  amountPaid?: number;
  baseAmount?: number;
  taxAmount?: number;
  taxPercentage?: number;
  invoiceNumber?: string;
  paymentReferenceNo?: string;
  isAutoRenew?: boolean;
  effectiveCommissionPercentage?: number;
  effectiveFlatCommissionPerOrder?: number;
  effectiveMaxCommissionCap?: number;
  effectiveMinCommissionFloor?: number;
  entitlements?: SubscriptionPlanEntitlementItem[];
  hasQueuedRenewal?: boolean;
  effectiveCoverageEndDate?: string;
  totalDaysRemaining?: number;
  currentCycleDaysRemaining?: number;
  queuedRenewalDays?: number;
  restaurantName?: string;
  restaurantGstNumber?: string;
  platformGst?: PlatformGstInfo;
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
  baseAmount?: number;
  taxAmount?: number;
  taxPercentage?: number;
  invoiceNumber?: string;
  paymentReferenceNo?: string;
  effectiveCommissionPercentage?: number;
  effectiveFlatCommissionPerOrder?: number;
  effectiveMaxCommissionCap?: number;
  supersededBySubscriptionId?: number;
  proratedRefundAmount?: number;
  walletTransactionRef?: string;
  actionSource?: string;
  actorUserId?: number;
  remarks?: string;
  restaurantName?: string;
  restaurantGstNumber?: string;
  platformGst?: PlatformGstInfo;
  createdDateUtc: string;
}
