import { SubscriptionPlan, UserSubscriptionStatus, SubscriptionPlanEntitlementItem } from '../../domain/models/Subscription';

export interface CanonicalFeature {
  key: string;
  label: string;
  shortLabel: string;
  category: 'POS & Billing' | 'Dine-In & Tables' | 'Kitchen Operations' | 'Channels' | 'Security & BI';
  description: string;
  iconName: string;
  aliases: string[];
}

export const CANONICAL_FEATURES: CanonicalFeature[] = [
  {
    key: 'IsCounterOrderingEnabled',
    label: 'Counter POS & Fast Billing',
    shortLabel: 'Counter POS',
    category: 'POS & Billing',
    description: 'High-speed counter ordering, thermal receipt printing, and rapid cash/card billing.',
    iconName: 'Store',
    aliases: ['iscounterorderingenabled', 'posbilling', 'allowcounterordering', 'isposterminalenabled'],
  },
  {
    key: 'IsTableOrderingEnabled',
    label: 'Table QR & Dine-In Management',
    shortLabel: 'Table Dine-In',
    category: 'Dine-In & Tables',
    description: 'Interactive table floor map, running table tabs, and customer QR menu ordering.',
    iconName: 'Utensils',
    aliases: ['istableorderingenabled', 'istableorder', 'allowtableordering', 'tableconfiguration', 'dynamictableqr'],
  },
  {
    key: 'IsKdsEnabled',
    label: 'Live Kitchen Display System (KDS)',
    shortLabel: 'Live KDS',
    category: 'Kitchen Operations',
    description: 'Paperless kitchen order tickets, 5-stage SLA cooking timers, and multi-station routing.',
    iconName: 'ChefHat',
    aliases: ['iskdsenabled', 'allowkds', 'kitchenrouting', 'iskdsappenabled'],
  },
  {
    key: 'IsSelfPickupEnabled',
    label: 'Self-Pickup & Counter Takeaway',
    shortLabel: 'Self-Pickup',
    category: 'Channels',
    description: 'Walk-in parcel takeout, token tracking display, and ready-for-pickup alerts.',
    iconName: 'ShoppingBag',
    aliases: ['isselfpickupenabled', 'allowselfpickup', 'selfpickup'],
  },
  {
    key: 'IsDeliveryEnabled',
    label: 'Direct Home Delivery Channel',
    shortLabel: 'Direct Delivery',
    category: 'Channels',
    description: 'Direct order dispatching, rider assignment, and customer live delivery tracking.',
    iconName: 'Truck',
    aliases: ['isdeliveryenabled', 'allowdelivery', 'delivery'],
  },
  {
    key: 'IsStaffPinLockEnabled',
    label: 'Staff Roles & 4-Digit Quick PIN Lock',
    shortLabel: 'Staff PIN Lock',
    category: 'Security & BI',
    description: 'Role-based access permissions and 4-digit quick terminal lock for shift handovers.',
    iconName: 'Shield',
    aliases: ['isstaffpinlockenabled', 'staffpinlock', 'isstaffpinlock'],
  },
  {
    key: 'IsReportsEnabled',
    label: 'Business Analytics & Reports',
    shortLabel: 'Sales Reports & BI',
    category: 'Security & BI',
    description: 'Sales trends, rush hour heatmaps, best-selling dishes, and PDF financial statements.',
    iconName: 'BarChart3',
    aliases: ['isreportsenabled', 'reports', 'businessreports'],
  },
  {
    key: 'AllowOnlinePayment',
    label: 'Instant Payment Gateway (UPI/Cards)',
    shortLabel: 'Online UPI & Cards',
    category: 'POS & Billing',
    description: 'Accept instant customer UPI QR, credit/debit cards, and digital wallet settlements.',
    iconName: 'CreditCard',
    aliases: ['allowonlinepayment', 'onlinepayment', 'paymentgateway'],
  },
  {
    key: 'IsSmsEnabled',
    label: 'SMS Receipts & Live Order Alerts',
    shortLabel: 'SMS & WhatsApp Alerts',
    category: 'Channels',
    description: 'Automated order status notifications and paperless digital bills sent to customers.',
    iconName: 'MessageSquare',
    aliases: ['issmsenabled', 'allowsmsnotifications', 'issmsnotificationsenabled'],
  },
  {
    key: 'IsMobilePosEnabled',
    label: 'Android / Tablet POS App Access',
    shortLabel: 'Mobile POS App',
    category: 'POS & Billing',
    description: 'Native mobile app licensing for handheld tablets and Android POS hardware.',
    iconName: 'Smartphone',
    aliases: ['ismobileposenabled', 'mobilepos'],
  },
];

/**
 * Format any raw backend config key into a clean, human-readable title.
 */
export const formatEntitlementTitle = (rawKey: string): string => {
  if (!rawKey) return '';
  const normalized = rawKey.toLowerCase().replace(/[^a-z0-9]/g, '');
  const match = CANONICAL_FEATURES.find(
    (f) => f.key.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized || f.aliases.includes(normalized)
  );
  if (match) return match.label;

  // Fallback: format camelCase / PascalCase
  return rawKey
    .replace(/^(Is|Allow)/, '')
    .replace(/Enabled$/, '')
    .replace(/([A-Z])/g, ' $1')
    .trim();
};

/**
 * Find canonical metadata for a feature key
 */
export const getCanonicalFeature = (key: string): CanonicalFeature | null => {
  if (!key) return null;
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    CANONICAL_FEATURES.find(
      (f) => f.key.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized || f.aliases.includes(normalized)
    ) || null
  );
};

export interface FormattedFeatureItem {
  key: string;
  label: string;
  shortLabel: string;
  category: string;
  description: string;
  enabled: boolean;
  commissionBadge?: string;
}

/**
 * Extract resolved, merchant-friendly feature list for an active subscription
 */
export const getSubscriptionFeatureList = (sub: UserSubscriptionStatus | null): FormattedFeatureItem[] => {
  if (!sub) return [];
  const entitlements = sub.entitlements || [];

  return CANONICAL_FEATURES.map((feat) => {
    let enabled = false;

    // 1. Direct entitlement check
    const match = entitlements.find((e: any) => {
      const ek = (e.configKey || e.ConfigKey || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return feat.aliases.includes(ek);
    });

    if (match) {
      enabled = Boolean(match.isAllowed ?? (match as any).IsAllowed);
    } else {
      // 2. Direct property fallbacks on subscription
      const k = feat.key.toLowerCase();
      if (k.includes('table') && (sub.isTableOrder !== undefined || sub.allowTableOrdering !== undefined)) {
        enabled = Boolean(sub.isTableOrder || sub.allowTableOrdering);
      } else if (k.includes('kds') && ((sub as any).isKdsEnabled !== undefined || sub.isKdsAppEnabled !== undefined)) {
        enabled = Boolean((sub as any).isKdsEnabled || sub.isKdsAppEnabled);
      } else if (k.includes('counter')) {
        enabled = true; // Counter POS is baseline
      } else {
        enabled = true;
      }
    }

    return {
      key: feat.key,
      label: feat.label,
      shortLabel: feat.shortLabel,
      category: feat.category,
      description: feat.description,
      enabled,
    };
  });
};

/**
 * Extract resolved, merchant-friendly feature list for an available plan
 */
export const getPlanFeatureList = (plan: SubscriptionPlan): FormattedFeatureItem[] => {
  const entitlements = plan.entitlements || [];

  return CANONICAL_FEATURES.map((feat) => {
    let enabled = true;
    let commissionBadge: string | undefined;

    // Check direct entitlement
    const match = entitlements.find((e: any) => {
      const ek = (e.configKey || e.ConfigKey || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return feat.aliases.includes(ek);
    });

    if (match) {
      enabled = Boolean(match.isAllowed ?? (match as any).IsAllowed);
      const addOnPct = Number(match.featureCommissionPercentage || 0);
      const addOnFlat = Number(match.featureFlatFeePerOrder || 0);
      if (addOnPct > 0 || addOnFlat > 0) {
        commissionBadge = `+${addOnPct > 0 ? `${addOnPct}%` : ''}${addOnPct > 0 && addOnFlat > 0 ? ' ' : ''}${addOnFlat > 0 ? `₹${addOnFlat}` : ''}`;
      }
    } else {
      // Direct boolean flags on plan
      const k = feat.key.toLowerCase();
      if (k.includes('table') && (plan.isTableOrder !== undefined || plan.allowTableOrdering !== undefined)) {
        enabled = Boolean(plan.isTableOrder || plan.allowTableOrdering);
      } else if (k.includes('kds') && (plan.allowKds !== undefined || plan.isKdsAppEnabled !== undefined)) {
        enabled = Boolean(plan.allowKds || plan.isKdsAppEnabled);
      } else if (k.includes('counter') && plan.allowCounterOrdering !== undefined) {
        enabled = Boolean(plan.allowCounterOrdering);
      } else if (k.includes('pickup') && plan.allowSelfPickup !== undefined) {
        enabled = Boolean(plan.allowSelfPickup);
      } else if (k.includes('delivery') && plan.allowDelivery !== undefined) {
        enabled = Boolean(plan.allowDelivery);
      } else if (k.includes('sms') && plan.allowSmsNotifications !== undefined) {
        enabled = Boolean(plan.allowSmsNotifications);
      }
    }

    return {
      key: feat.key,
      label: feat.label,
      shortLabel: feat.shortLabel,
      category: feat.category,
      description: feat.description,
      enabled,
      commissionBadge,
    };
  });
};
