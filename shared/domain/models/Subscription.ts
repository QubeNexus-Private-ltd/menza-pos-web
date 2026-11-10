export type MenzaApplicationKey =
  | 'mobilePos'
  | 'webPos'
  | 'waiterApp'
  | 'kdsApp'
  | 'orderWeb';

export type MenzaFeatureKey =
  | 'posBilling'
  | 'tableConfiguration'
  | 'dynamicTableQr'
  | 'advanceReservation'
  | 'kitchenRouting'
  | 'staffPinLock'
  | 'reports'
  | 'delivery'
  | 'selfPickup';

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
  isTableOrder?: boolean;
  allowCounterOrdering?: boolean;
  allowSelfPickup?: boolean;
  allowDelivery?: boolean;
  allowKds?: boolean;
  allowOnlinePayment?: boolean;
  allowSmsNotifications?: boolean;
  isActive?: boolean;
  features?: string[] | Record<string, boolean>;
  applications?: Record<string, boolean>;
  entitlements?: SubscriptionPlanEntitlementItem[];
  isMobilePosEnabled?: boolean;
  isPosWebEnabled?: boolean;
  isWaiterAppEnabled?: boolean;
  isKdsAppEnabled?: boolean;
  isPosOrderWebEnabled?: boolean;
  isPosTerminalEnabled?: boolean;
  isTableConfigurationEnabled?: boolean;
  isReservationEnabled?: boolean;
  isMenuOrderingEnabled?: boolean;
  isStaffPinLockEnabled?: boolean;
  isReportsEnabled?: boolean;
}

export type SubscriptionLifecycleState =
  | 'ACTIVE'
  | 'GRACE_PERIOD'
  | 'EXPIRED'
  | 'INACTIVE'
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
  isActive?: boolean;
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
  isTableOrder?: boolean;
  allowTableOrdering?: boolean;
  applications?: Record<string, boolean>;
  features?: Record<string, boolean>;
  isMobilePosEnabled?: boolean;
  isPosWebEnabled?: boolean;
  isWaiterAppEnabled?: boolean;
  isKdsAppEnabled?: boolean;
  isPosOrderWebEnabled?: boolean;
  isPosTerminalEnabled?: boolean;
  isTableConfigurationEnabled?: boolean;
  isReservationEnabled?: boolean;
  isMenuOrderingEnabled?: boolean;
  isStaffPinLockEnabled?: boolean;
  isReportsEnabled?: boolean;
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

/**
 * Safely parses any truthy representation of a flag from database / JSON (boolean true, number 1, 'true', '1', 'yes').
 */
export const isTruthyFlag = (val: any): boolean => {
  if (val === true || val === 1) return true;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 't';
  }
  return false;
};

export const isExplicitlyFalseFlag = (val: any): boolean => {
  if (val === false || val === 0) return true;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s === 'false' || s === '0' || s === 'no' || s === 'f';
  }
  return false;
};

/**
 * Searches an object (and its nested configuration / plan / entitlements) for any table order flag across naming conventions.
 */
export const extractTableOrderFlag = (obj: any): boolean | undefined => {
  if (!obj || typeof obj !== 'object') return undefined;

  const directCandidates = [
    obj.isTableOrder,
    obj.IsTableOrder,
    obj.istableorder,
    obj.is_table_order,
    obj.allowTableOrdering,
    obj.AllowTableOrdering,
    obj.allow_table_ordering,
    obj.isTableOrderingEnabled,
    obj.IsTableOrderingEnabled,
    obj.is_table_ordering_enabled,
    obj.isTableOrderingActive,
    obj.IsTableOrderingActive,
    obj.is_table_ordering_active,
    obj.isTableOrdering,
    obj.IsTableOrdering,
    obj.tableOrdering,
    obj.TableOrdering,
    obj.tableOrder,
    obj.TableOrder,
    obj.canTableOrder,
    obj.CanTableOrder,
  ];

  for (const c of directCandidates) {
    if (isTruthyFlag(c)) return true;
    if (isExplicitlyFalseFlag(c)) return false;
  }

  // Check nested plan, configuration, or subscription objects
  const nested =
    obj.plan ||
    obj.Plan ||
    obj.configuration ||
    obj.Configuration ||
    obj.subscriptionConfiguration ||
    obj.SubscriptionConfiguration ||
    obj.subscriptionPlan ||
    obj.SubscriptionPlan ||
    obj.activePlan ||
    obj.ActivePlan;

  if (nested && typeof nested === 'object' && nested !== obj) {
    const nestedRes = extractTableOrderFlag(nested);
    if (nestedRes !== undefined) return nestedRes;
  }

  // Check entitlements array if present
  const entitlements = obj.entitlements || obj.Entitlements || [];
  if (Array.isArray(entitlements) && entitlements.length > 0) {
    for (const e of entitlements) {
      const k = (e.configKey || e.ConfigKey || e.key || e.Key || '').toLowerCase().replace(/[^a-z]/g, '');
      if (
        k.includes('tableorder') ||
        k.includes('tableordering') ||
        k === 'istableorder' ||
        k === 'istableorderingenabled' ||
        k === 'allowtableordering'
      ) {
        const val = e.isAllowed ?? e.IsAllowed ?? e.value ?? e.Value;
        if (isTruthyFlag(val)) return true;
        if (isExplicitlyFalseFlag(val)) return false;
      }
    }
  }

  return undefined;
};

/**
 * Resolves whether a specific functional feature is enabled in a subscription status or plan.
 * Checks features dictionary, convenience boolean flags, and entitlements array with smart fallbacks.
 */
export const extractFeatureFlag = (obj: any, featureKey: string): boolean => {
  if (!obj || typeof obj !== 'object') return false;

  const k = featureKey.toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Direct dictionary check
  const feats = obj.features || obj.Features;
  if (feats && typeof feats === 'object') {
    for (const [key, val] of Object.entries(feats)) {
      if (key.toLowerCase().replace(/[^a-z0-9]/g, '') === k) {
        if (isTruthyFlag(val)) return true;
        if (isExplicitlyFalseFlag(val)) return false;
      }
    }
  }

  // 2. Direct property name checks
  const candidates: any[] = [
    obj[featureKey],
    obj[featureKey.charAt(0).toUpperCase() + featureKey.slice(1)],
    obj[`is${featureKey.charAt(0).toUpperCase() + featureKey.slice(1)}Enabled`],
    obj[`Is${featureKey.charAt(0).toUpperCase() + featureKey.slice(1)}Enabled`]
  ];

  for (const c of candidates) {
    if (isTruthyFlag(c)) return true;
    if (isExplicitlyFalseFlag(c)) return false;
  }

  // 3. Entitlements list check
  const entitlements = obj.entitlements || obj.Entitlements || [];
  if (Array.isArray(entitlements) && entitlements.length > 0) {
    for (const e of entitlements) {
      const eKey = (e.configKey || e.ConfigKey || e.key || e.Key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (eKey === k || eKey === `is${k}enabled` || eKey.includes(k)) {
        const val = e.isAllowed ?? e.IsAllowed ?? e.value ?? e.Value;
        if (isTruthyFlag(val)) return true;
        if (isExplicitlyFalseFlag(val)) return false;
      }
    }
  }

  // Safe defaults for core features if unconfigured
  if (k === 'posbilling' || k === 'posterminal') return true;
  if (k === 'tableconfiguration') return true;
  if (k === 'reports') return true;
  if (k === 'staffpinlock') return true;
  return false;
};

/**
 * Resolves whether an application client is licensed for the active subscription.
 */
export const extractApplicationFlag = (obj: any, appKey: string): boolean => {
  if (!obj || typeof obj !== 'object') return false;

  const k = appKey.toLowerCase().replace(/[^a-z0-9]/g, '');

  const apps = obj.applications || obj.Applications;
  if (apps && typeof apps === 'object') {
    for (const [key, val] of Object.entries(apps)) {
      if (key.toLowerCase().replace(/[^a-z0-9]/g, '') === k) {
        if (isTruthyFlag(val)) return true;
        if (isExplicitlyFalseFlag(val)) return false;
      }
    }
  }

  const candidates: any[] = [
    obj[appKey],
    obj[appKey.charAt(0).toUpperCase() + appKey.slice(1)],
    obj[`is${appKey.charAt(0).toUpperCase() + appKey.slice(1)}Enabled`],
    obj[`Is${appKey.charAt(0).toUpperCase() + appKey.slice(1)}Enabled`]
  ];

  for (const c of candidates) {
    if (isTruthyFlag(c)) return true;
    if (isExplicitlyFalseFlag(c)) return false;
  }

  // Default: mobilePos and webPos are allowed unless explicitly restricted
  if (k === 'mobilepos' || k === 'webpos' || k === 'orderweb') return true;
  return false;
};
