'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Crown,
  Plus,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  X,
  Sparkles,
  RefreshCw,
  Layers,
  Percent,
  Coins,
  Gift,
  Sliders,
  ShieldCheck,
  Info,
  Calculator,
  UtensilsCrossed,
  Truck,
  CreditCard,
  ChevronRight,
  ReceiptIndianRupee as Receipt,
  ChefHat,
  Smartphone,
  Laptop,
  QrCode,
  Store,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { SubscriptionRemoteDataSource } from '@shared/data/datasources/SubscriptionRemoteDataSource';
import { MasterDataRemoteDataSource } from '@shared/data/datasources/MasterDataRemoteDataSource';
import { SubscriptionPlan } from '@shared/domain/models/Subscription';

const subscriptionDataSource = new SubscriptionRemoteDataSource();
const masterDataSource = new MasterDataRemoteDataSource();

type CommissionType = 'PERCENTAGE' | 'FLAT_PER_ORDER' | 'FEATURE_DRIVEN';

interface DynamicEntitlementState {
  orderConfigId: number;
  configKey: string;
  configName: string;
  category: string;
  description: string;
  isAllowed: boolean;
  featureCommissionPercentage: string;
  featureFlatFeePerOrder: string;
}


interface MenzaAppConfig {
  appKey: string;
  name: string;
  platformBadge: string;
  category: string;
  desc: string;
  iconName: 'ChefHat' | 'Smartphone' | 'Laptop' | 'UtensilsCrossed' | 'QrCode';
  autoEnablesFeatureKey?: string;
  autoEnablesFeatureLabel?: string;
}

const MENZA_ECOSYSTEM_APPS: MenzaAppConfig[] = [
  {
    appKey: 'app_captain_menza',
    name: 'CaptainMenza App',
    platformBadge: 'Kitchen Tablet',
    category: 'Kitchen Display',
    desc: 'Paperless Kitchen Display System (KDS) for chef stations, prep timers & order bumping',
    iconName: 'ChefHat',
    autoEnablesFeatureKey: 'IsKdsEnabled',
    autoEnablesFeatureLabel: 'Kitchen Display System (KDS)',
  },
  {
    appKey: 'app_menza_pos_terminal',
    name: 'Menza POS Terminal App',
    platformBadge: 'Android Hardware',
    category: 'Counter POS',
    desc: 'Native POS terminal hardware app (Sunmi, Elo, iMin) with physical thermal receipt printing',
    iconName: 'Smartphone',
    autoEnablesFeatureKey: 'IsCounterOrderingEnabled',
    autoEnablesFeatureLabel: 'Express Counter POS',
  },
  {
    appKey: 'app_menza_pos_web',
    name: 'Menza POS Web',
    platformBadge: 'Web Browser',
    category: 'Desktop Suite',
    desc: 'Browser-based POS terminal for PC, Mac, laptops, and iPads with cloud & offline billing',
    iconName: 'Laptop',
    autoEnablesFeatureKey: 'IsCounterOrderingEnabled',
    autoEnablesFeatureLabel: 'Express Counter POS',
  },
  {
    appKey: 'app_menza_serve',
    name: 'MenzaServe App',
    platformBadge: 'Waiter Mobile',
    category: 'Floor Service',
    desc: 'Floor captain & steward app for table-side ordering, food runner alerts & service calls',
    iconName: 'UtensilsCrossed',
    autoEnablesFeatureKey: 'IsTableOrderingEnabled',
    autoEnablesFeatureLabel: 'Dine-In Table Management',
  },
  {
    appKey: 'app_menza_order',
    name: 'MenzaOrderApp',
    platformBadge: 'Customer QR & Web',
    category: 'Customer Ordering',
    desc: 'Customer contactless QR table menu, self-checkout, takeaway & live food tracking',
    iconName: 'QrCode',
    autoEnablesFeatureKey: 'IsTableOrderingEnabled',
    autoEnablesFeatureLabel: 'Table QR Ordering',
  },
];

const CANONICAL_TOGGLE_ORDER: Record<string, number> = {
  IsTableOrderingEnabled: 1,
  IsCounterOrderingEnabled: 2,
  IsSelfPickupEnabled: 3,
  IsDeliveryEnabled: 4,
  IsKdsEnabled: 5,
  IsSmsNotificationsEnabled: 6,
  AllowOnlinePayment: 7,
  AllowPayAtTable: 8,
  AllowCashOnDelivery: 9,
  AutoAcceptOrders: 10,
  IsPaymentRequiredForTableOrder: 11,
  IsPaymentRequiredForPickupOrder: 12,
  IsPaymentRequiredForDeliveryOrder: 13,
};

// Utility to remove any accidental drive paths or file system references like (F:\Menza) or F:\MenzaServe
const sanitizeDescription = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\s*\([A-Z]:\\[^)]*\)/gi, '')
    .replace(/[A-Z]:\\[\w\-.]+/gi, '')
    .trim();
};

const FRIENDLY_FEATURE_NAMES: Record<string, { name: string; category: string; desc: string }> = {
  IsTableOrderingEnabled: {
    name: 'Table QR Ordering',
    category: 'Ordering Channels',
    desc: 'Dine-in customer ordering via interactive QR table scans',
  },
  IsCounterOrderingEnabled: {
    name: 'Express Counter POS',
    category: 'Ordering Channels',
    desc: 'Walk-in cash counter & express terminal billing',
  },
  IsSelfPickupEnabled: {
    name: 'Self-Pickup / Takeaway',
    category: 'Ordering Channels',
    desc: 'Customer takeaway & parcel order management',
  },
  IsDeliveryEnabled: {
    name: 'Direct Home Delivery',
    category: 'Ordering Channels',
    desc: 'Direct delivery dispatch & rider address tracking',
  },
  IsKdsEnabled: {
    name: 'Kitchen Display System (KDS)',
    category: 'Operations',
    desc: 'Live paperless kitchen tickets and chef order screens',
  },
  IsSmsNotificationsEnabled: {
    name: 'SMS & WhatsApp Notifications',
    category: 'Notifications',
    desc: 'Automated order confirmation, live tracking link & settled bills via WhatsApp & SMS',
  },
  AllowOnlinePayment: {
    name: 'Online Payment Gateway',
    category: 'Payments',
    desc: 'Accept UPI, credit/debit cards, and netbanking payments',
  },
  // Application licenses mapped to clean official product names
  IsMobilePosEnabled: {
    name: 'Menza POS Terminal App',
    category: 'Applications',
    desc: 'Native Android POS terminal hardware app (Sunmi, Elo, iMin) with physical thermal receipt printing',
  },
  IsPosWebEnabled: {
    name: 'Menza POS Web',
    category: 'Applications',
    desc: 'Browser-based POS terminal for PC, Mac, laptops, and iPads with cloud & offline billing',
  },
  IsWaiterAppEnabled: {
    name: 'MenzaServe App',
    category: 'Applications',
    desc: 'Floor captain & steward app for table-side ordering, food runner alerts & service calls',
  },
  IsKdsAppEnabled: {
    name: 'CaptainMenza App',
    category: 'Applications',
    desc: 'Paperless Kitchen Display System (KDS) for chef stations, prep timers & order bumping',
  },
  IsPosOrderWebEnabled: {
    name: 'MenzaOrderApp',
    category: 'Applications',
    desc: 'Customer contactless QR table menu, self-checkout, takeaway & live food tracking',
  },
};

const DEFAULT_ENTITLEMENTS: DynamicEntitlementState[] = [
  {
    orderConfigId: 1,
    configKey: 'IsTableOrderingEnabled',
    configName: 'Table QR Ordering',
    category: 'Ordering Channels',
    description: 'Dine-in customer ordering via interactive QR table scans',
    isAllowed: true,
    featureCommissionPercentage: '0',
    featureFlatFeePerOrder: '0',
  },
  {
    orderConfigId: 2,
    configKey: 'IsCounterOrderingEnabled',
    configName: 'Express Counter POS',
    category: 'Ordering Channels',
    description: 'Walk-in cash counter & express terminal billing',
    isAllowed: true,
    featureCommissionPercentage: '0',
    featureFlatFeePerOrder: '0',
  },
  {
    orderConfigId: 3,
    configKey: 'IsSelfPickupEnabled',
    configName: 'Self-Pickup / Takeaway',
    category: 'Ordering Channels',
    description: 'Customer takeaway & parcel order management',
    isAllowed: true,
    featureCommissionPercentage: '0',
    featureFlatFeePerOrder: '0',
  },
  {
    orderConfigId: 4,
    configKey: 'IsDeliveryEnabled',
    configName: 'Direct Home Delivery',
    category: 'Ordering Channels',
    description: 'Direct delivery dispatch & rider address tracking',
    isAllowed: true,
    featureCommissionPercentage: '0',
    featureFlatFeePerOrder: '0',
  },
  {
    orderConfigId: 5,
    configKey: 'IsKdsEnabled',
    configName: 'Kitchen Display System (KDS)',
    category: 'Operations',
    description: 'Live paperless kitchen tickets and chef order screens',
    isAllowed: true,
    featureCommissionPercentage: '0',
    featureFlatFeePerOrder: '0',
  },
  {
    orderConfigId: 13,
    configKey: 'IsSmsNotificationsEnabled',
    configName: 'SMS & WhatsApp Notifications',
    category: 'Notifications',
    description: 'Automated order confirmation, live tracking link & settled bills via WhatsApp & SMS',
    isAllowed: true,
    featureCommissionPercentage: '0',
    featureFlatFeePerOrder: '0',
  },
  {
    orderConfigId: 6,
    configKey: 'AllowOnlinePayment',
    configName: 'Online Payment Gateway',
    category: 'Payments',
    description: 'Accept UPI, credit/debit cards, and netbanking payments',
    isAllowed: true,
    featureCommissionPercentage: '0',
    featureFlatFeePerOrder: '0',
  },
];

const COMMISSION_TYPE_OPTIONS: {
  type: CommissionType;
  title: string;
  badge: string;
  desc: string;
  example: string;
}[] = [
  {
    type: 'PERCENTAGE',
    title: 'Percentage Take-Rate',
    badge: 'GMV Take',
    desc: 'Deduct a variable percentage fee based on the gross order checkout value.',
    example: 'E.g., 2.0% on a ₹1,000 order = ₹20.00 platform fee deduction',
  },
  {
    type: 'FLAT_PER_ORDER',
    title: 'Fixed Rupee per Order',
    badge: 'Fixed Fee',
    desc: 'Fixed rupee charge deducted on every completed transaction regardless of order total.',
    example: 'E.g., ₹5.00 platform fee per order regardless of cart size',
  },
  {
    type: 'FEATURE_DRIVEN',
    title: 'Channel & Feature Accrual',
    badge: 'Dynamic Add-ons',
    desc: 'Platform fee determined dynamically by activated ordering channels & feature surcharges.',
    example: 'E.g., Base 1% + 1% QR Dine-In + ₹2 Delivery fee per order',
  },
];

export default function SuperAdminPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Plan Modal & Wizard State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Basic Profile & Pricing
  const [planCode, setPlanCode] = useState('');
  const [planName, setPlanName] = useState('');
  const [description, setDescription] = useState('');
  const [billingCycle, setBillingCycle] = useState('MONTHLY');
  const [durationInDays, setDurationInDays] = useState('30');
  const [price, setPrice] = useState('');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [includedWalletCredit, setIncludedWalletCredit] = useState('0');

  // Step 2: Platform Fee & Commission Rules
  const [commissionType, setCommissionType] = useState<CommissionType>('PERCENTAGE');
  const [baseCommissionPercentage, setBaseCommissionPercentage] = useState('0');
  const [baseFlatCommissionPerOrder, setBaseFlatCommissionPerOrder] = useState('0');
  const [minCommissionFloorPerOrder, setMinCommissionFloorPerOrder] = useState('0');
  const [maxCommissionCapPerOrder, setMaxCommissionCapPerOrder] = useState('0');
  const [simOrderAmount, setSimOrderAmount] = useState('1000');

  // Step 3: Entitlements
  const [dynamicEntitlements, setDynamicEntitlements] = useState<DynamicEntitlementState[]>(DEFAULT_ENTITLEMENTS);
  const [selectedApps, setSelectedApps] = useState<Record<string, boolean>>({
    app_captain_menza: true,
    app_menza_pos_terminal: true,
    app_menza_pos_web: true,
    app_menza_serve: true,
    app_menza_order: true,
  });

  const [savingPlan, setSavingPlan] = useState(false);

  // Load plans
  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      const list = await subscriptionDataSource.getPlans();
      setPlans(list);
    } catch (err) {
      console.warn('Plans fetch error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load master order config details for dynamic features
  const loadMasterData = useCallback(async () => {
    try {
      const masterList = await masterDataSource.getMasterOrderConfigs();
      if (Array.isArray(masterList) && masterList.length > 0) {
        const featuresMap = new Map<string, DynamicEntitlementState>();

        // Pre-populate with defaults so nothing is ever missing
        DEFAULT_ENTITLEMENTS.forEach((def) => {
          featuresMap.set(def.configKey.toLowerCase(), { ...def });
        });

        masterList.forEach((master: any) => {
          const masterCode = (master.configCode || master.ConfigCode || '').toUpperCase();
          // Application channels are directly managed via Pillars 1, 2, 3, and 4
          if (masterCode === 'APPLICATION_CHANNELS') {
            return;
          }

          const detailsList = master.details || master.Details || [];
          if (Array.isArray(detailsList) && detailsList.length > 0) {
            detailsList.forEach((detail: any) => {
              const key = detail.configKey || detail.ConfigKey || '';
              if (!key) return;

              // Skip application license keys from dynamic operational list to prevent duplication
              if (
                key === 'IsMobilePosEnabled' ||
                key === 'IsPosWebEnabled' ||
                key === 'IsWaiterAppEnabled' ||
                key === 'IsKdsAppEnabled' ||
                key === 'IsPosOrderWebEnabled' ||
                key.toLowerCase().includes('appenabled')
              ) {
                return;
              }

              const meta = FRIENDLY_FEATURE_NAMES[key];
              const rawDesc = detail.description || detail.Description || '';
              const cleanDesc = sanitizeDescription(meta?.desc || rawDesc);
              const cleanName = sanitizeDescription(meta?.name || rawDesc || key || 'Feature');

              featuresMap.set(key.toLowerCase(), {
                orderConfigId: detail.id || detail.Id || 0,
                configKey: key,
                configName: cleanName,
                category: meta?.category || detail.category || detail.Category || master.configName || 'Ordering Channels',
                description: cleanDesc,
                isAllowed: true,
                featureCommissionPercentage: '0',
                featureFlatFeePerOrder: '0',
              });
            });
          }
        });

        const sortedFeatures = Array.from(featuresMap.values()).sort((a, b) => {
          const orderA = CANONICAL_TOGGLE_ORDER[a.configKey] ?? 99;
          const orderB = CANONICAL_TOGGLE_ORDER[b.configKey] ?? 99;
          return orderA - orderB;
        });

        if (sortedFeatures.length > 0) {
          setDynamicEntitlements(sortedFeatures);
        }
      }
    } catch {
      // Keep DEFAULT_ENTITLEMENTS on error
    }
  }, []);

  useEffect(() => {
    loadPlans();
    loadMasterData();
  }, [loadPlans, loadMasterData]);

  const handleTogglePlan = async (plan: SubscriptionPlan) => {
    try {
      const res = await subscriptionDataSource.togglePlanStatus(plan.id, !plan.isActive);
      if (res.success) {
        setPlans((prev) =>
          prev.map((p) => (p.id === plan.id ? { ...p, isActive: !p.isActive } : p))
        );
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to toggle plan status');
    }
  };

  // Billing cycle sync with default durations
  const handleCycleChange = (cycle: string) => {
    setBillingCycle(cycle);
    if (cycle === 'MONTHLY') setDurationInDays('30');
    else if (cycle === 'QUARTERLY') setDurationInDays('90');
    else if (cycle === 'HALFYEARLY') setDurationInDays('180');
    else if (cycle === 'ANNUALLY') setDurationInDays('365');
  };

  // Calculations
  const parsedPrice = parseFloat(price) || 0;
  const parsedDiscount = parseFloat(discountAmount) || 0;
  const netPayablePrice = Math.max(0, parsedPrice - parsedDiscount);

  const parsedBaseCommissionPct = parseFloat(baseCommissionPercentage) || 0;
  const parsedBaseFlatFee = parseFloat(baseFlatCommissionPerOrder) || 0;
  const parsedMinFloor = parseFloat(minCommissionFloorPerOrder) || 0;
  const parsedMaxCap = parseFloat(maxCommissionCapPerOrder) || 0;
  const parsedWalletCredit = parseFloat(includedWalletCredit) || 0;

  const aggregatedCommissionPct = useMemo(() => {
    return dynamicEntitlements.reduce((acc, item) => {
      return item.isAllowed ? acc + (parseFloat(item.featureCommissionPercentage) || 0) : acc;
    }, parsedBaseCommissionPct);
  }, [dynamicEntitlements, parsedBaseCommissionPct]);

  const aggregatedFlatFee = useMemo(() => {
    return dynamicEntitlements.reduce((acc, item) => {
      return item.isAllowed ? acc + (parseFloat(item.featureFlatFeePerOrder) || 0) : acc;
    }, parsedBaseFlatFee);
  }, [dynamicEntitlements, parsedBaseFlatFee]);

  const calculateSimulatedFee = useCallback(
    (orderAmount: number) => {
      if (orderAmount <= 0) return 0;
      let calculated = 0;
      if (commissionType === 'FLAT_PER_ORDER') {
        calculated = aggregatedFlatFee;
      } else {
        calculated = orderAmount * (aggregatedCommissionPct / 100) + aggregatedFlatFee;
      }

      if (parsedMinFloor > 0) {
        calculated = Math.max(parsedMinFloor, calculated);
      }
      if (parsedMaxCap > 0) {
        calculated = Math.min(parsedMaxCap, calculated);
      }

      return Math.min(orderAmount, Math.max(0, calculated));
    },
    [commissionType, aggregatedCommissionPct, aggregatedFlatFee, parsedMinFloor, parsedMaxCap]
  );

  // =========================================================================
  // PILLAR-BASED SYNCHRONIZED TOGGLE HANDLERS (SOLUTION B)
  // =========================================================================

  // Pillar 1: Kitchen Operations (CaptainMenza App & KDS Engine)
  const handleToggleKitchenKds = () => {
    const nextSelected = !selectedApps.app_captain_menza;
    setSelectedApps((prev) => ({ ...prev, app_captain_menza: nextSelected }));
    // Strict 2-way sync: CaptainMenza App = IsKdsEnabled (both true or both false)
    setDynamicEntitlements((prev) =>
      prev.map((item) =>
        item.configKey === 'IsKdsEnabled' ? { ...item, isAllowed: nextSelected } : item
      )
    );
  };

  // Pillar 2: Counter & Express POS Billing
  const handleToggleCounterApp = (appKey: 'app_menza_pos_terminal' | 'app_menza_pos_web') => {
    const nextSelected = !selectedApps[appKey];
    const otherAppKey =
      appKey === 'app_menza_pos_terminal' ? 'app_menza_pos_web' : 'app_menza_pos_terminal';
    const isEitherActive = nextSelected || selectedApps[otherAppKey];

    setSelectedApps((prev) => ({ ...prev, [appKey]: nextSelected }));
    setDynamicEntitlements((prev) =>
      prev.map((item) =>
        item.configKey === 'IsCounterOrderingEnabled'
          ? { ...item, isAllowed: isEitherActive }
          : item
      )
    );
  };

  const handleToggleCounterChannel = () => {
    const currentCounter =
      dynamicEntitlements.find((e) => e.configKey === 'IsCounterOrderingEnabled')?.isAllowed ?? true;
    const nextVal = !currentCounter;

    setDynamicEntitlements((prev) =>
      prev.map((item) =>
        item.configKey === 'IsCounterOrderingEnabled' ? { ...item, isAllowed: nextVal } : item
      )
    );
    setSelectedApps((prev) => ({
      ...prev,
      app_menza_pos_terminal: nextVal,
      app_menza_pos_web: nextVal,
    }));
  };

  // Pillar 3: Floor Service (MenzaServe App)
  const handleToggleFloorService = () => {
    const nextSelected = !selectedApps.app_menza_serve;
    setSelectedApps((prev) => ({ ...prev, app_menza_serve: nextSelected }));
  };

  // Pillar 4: Customer Channels (MenzaOrderApp & Delivery & Pickup)
  const handleToggleTableQrOrder = () => {
    const nextSelected = !selectedApps.app_menza_order;
    setSelectedApps((prev) => ({ ...prev, app_menza_order: nextSelected }));
    // Strict 2-way sync: MenzaOrderApp = IsTableOrderingEnabled
    setDynamicEntitlements((prev) =>
      prev.map((item) =>
        item.configKey === 'IsTableOrderingEnabled' ? { ...item, isAllowed: nextSelected } : item
      )
    );
  };

  // Backward compatibility router
  const handleToggleApp = (appKey: string) => {
    if (appKey === 'app_captain_menza') {
      handleToggleKitchenKds();
    } else if (appKey === 'app_menza_pos_terminal' || appKey === 'app_menza_pos_web') {
      handleToggleCounterApp(appKey as any);
    } else if (appKey === 'app_menza_serve') {
      handleToggleFloorService();
    } else if (appKey === 'app_menza_order') {
      handleToggleTableQrOrder();
    }
  };

  // Generic toggle for entitlements with bidirectional safety guards
  const handleToggleEntitlement = (configKey: string) => {
    setDynamicEntitlements((prev) =>
      prev.map((item) => {
        if (item.configKey === configKey) {
          const nextAllowed = !item.isAllowed;

          // Strict 2-way sync guards in BOTH directions:
          if (configKey === 'IsKdsEnabled') {
            setSelectedApps((apps) => ({ ...apps, app_captain_menza: nextAllowed }));
          }
          if (configKey === 'IsTableOrderingEnabled') {
            setSelectedApps((apps) => ({ ...apps, app_menza_order: nextAllowed }));
          }
          if (configKey === 'IsCounterOrderingEnabled') {
            setSelectedApps((apps) => ({
              ...apps,
              app_menza_pos_terminal: nextAllowed,
              app_menza_pos_web: nextAllowed,
            }));
          }

          return { ...item, isAllowed: nextAllowed };
        }
        return item;
      })
    );
  };

  const renderAppIcon = (iconName: string) => {
    switch (iconName) {
      case 'ChefHat':
        return <ChefHat className="h-4 w-4" />;
      case 'Smartphone':
        return <Smartphone className="h-4 w-4" />;
      case 'Laptop':
        return <Laptop className="h-4 w-4" />;
      case 'UtensilsCrossed':
        return <UtensilsCrossed className="h-4 w-4" />;
      case 'QrCode':
        return <QrCode className="h-4 w-4" />;
      default:
        return <Store className="h-4 w-4" />;
    }
  };

  const renderEntitlementCard = (
    item: DynamicEntitlementState,
    customBadge?: string,
    customAction?: () => void
  ) => {
    return (
      <div
        key={item.configKey}
        className={`rounded-2xl border p-3.5 transition-all ${
          item.isAllowed
            ? 'border-[#DE8626]/40 bg-white dark:bg-[#1B2127] shadow-xs'
            : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/60 dark:bg-[#151A20]/60 opacity-60'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-xs text-[#1E2930] dark:text-[#F3F4F6]">
                {item.configName}
              </span>
              <span className="rounded bg-stone-100 dark:bg-[#252C34] px-1.5 py-0.5 text-[9px] font-medium text-[#667085] dark:text-[#94A3B8]">
                {customBadge || item.category}
              </span>
            </div>
            {item.description && (
              <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] mt-0.5">
                {item.description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={customAction || (() => handleToggleEntitlement(item.configKey))}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              item.isAllowed ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-700'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                item.isAllowed ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {commissionType === 'FEATURE_DRIVEN' && item.isAllowed && (
          <div className="mt-3 pt-3 border-t border-[#E7E1DA] dark:border-[#2B3540] grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-[#667085] uppercase mb-1">
                Add-on Fee Rate (%)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.featureCommissionPercentage}
                onChange={(e) =>
                  handleUpdateEntitlementFee(
                    item.configKey,
                    'featureCommissionPercentage',
                    e.target.value
                  )
                }
                placeholder="0.0"
                className="w-full rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-2.5 py-1.5 text-xs outline-none focus:border-[#DE8626]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#667085] uppercase mb-1">
                Add-on Flat Fee (₹)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={item.featureFlatFeePerOrder}
                onChange={(e) =>
                  handleUpdateEntitlementFee(
                    item.configKey,
                    'featureFlatFeePerOrder',
                    e.target.value
                  )
                }
                placeholder="0.00"
                className="w-full rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-2.5 py-1.5 text-xs outline-none focus:border-[#DE8626]"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleUpdateEntitlementFee = (
    configKey: string,
    field: 'featureCommissionPercentage' | 'featureFlatFeePerOrder',
    val: string
  ) => {
    setDynamicEntitlements((prev) =>
      prev.map((item) => (item.configKey === configKey ? { ...item, [field]: val } : item))
    );
  };

  const resetModalState = () => {
    setCreateModalOpen(false);
    setCurrentStep(1);
    setPlanCode('');
    setPlanName('');
    setDescription('');
    setBillingCycle('MONTHLY');
    setDurationInDays('30');
    setPrice('');
    setDiscountAmount('0');
    setIncludedWalletCredit('0');
    setCommissionType('PERCENTAGE');
    setBaseCommissionPercentage('0');
    setBaseFlatCommissionPerOrder('0');
    setMinCommissionFloorPerOrder('0');
    setMaxCommissionCapPerOrder('0');
    setSimOrderAmount('1000');
    setDynamicEntitlements(DEFAULT_ENTITLEMENTS);
    setSelectedApps({
      app_captain_menza: true,
      app_menza_pos_terminal: true,
      app_menza_pos_web: true,
      app_menza_serve: true,
      app_menza_order: true,
    });
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!planCode.trim()) {
        alert('Please enter a unique Plan Code.');
        return;
      }
      if (!planName.trim()) {
        alert('Please enter a Plan Display Name.');
        return;
      }
      if (!price || parsedPrice < 0) {
        alert('Please specify a valid Price.');
        return;
      }
    } else if (currentStep === 2) {
      if (parsedBaseCommissionPct < 0 || parsedBaseCommissionPct > 100) {
        alert('Base Commission % must be between 0 and 100.');
        return;
      }
      if (parsedBaseFlatFee < 0) {
        alert('Base Flat Fee cannot be negative.');
        return;
      }
      if (parsedMaxCap > 0 && parsedMinFloor > parsedMaxCap) {
        alert('Minimum Floor cannot be greater than Maximum Cap.');
        return;
      }
    }
    setCurrentStep((prev) => Math.min(4, (prev + 1) as any) as any);
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planCode.trim() || !planName.trim() || !price) {
      alert('Please fill in code, name, and price.');
      return;
    }

    if (parsedMaxCap > 0 && parsedMinFloor > parsedMaxCap) {
      alert('Minimum Floor cannot be greater than Maximum Cap.');
      return;
    }

    try {
      setSavingPlan(true);
      const res = await subscriptionDataSource.createPlan({
        subscriptionCode: planCode.trim(),
        subscriptionName: planName.trim(),
        planName: planName.trim(),
        description: description.trim(),
        billingCycle,
        durationInDays: parseInt(durationInDays, 10) || 30,
        durationDays: parseInt(durationInDays, 10) || 30,
        price: parsedPrice,
        discountAmount: parsedDiscount,
        finalPrice: netPayablePrice,
        commissionType,
        baseCommissionPercentage: parsedBaseCommissionPct,
        baseFlatCommissionPerOrder: parsedBaseFlatFee,
        minCommissionFloorPerOrder: parsedMinFloor,
        maxCommissionCapPerOrder: parsedMaxCap,
        includedWalletCredit: parsedWalletCredit,
        allowTableOrdering: dynamicEntitlements.find((d) => d.configKey.includes('Table'))?.isAllowed ?? true,
        allowCounterOrdering: dynamicEntitlements.find((d) => d.configKey.includes('Counter'))?.isAllowed ?? true,
        allowSelfPickup: dynamicEntitlements.find((d) => d.configKey.includes('Pickup'))?.isAllowed ?? true,
        allowDelivery: dynamicEntitlements.find((d) => d.configKey.includes('Delivery'))?.isAllowed ?? true,
        allowKds: !!selectedApps.app_captain_menza,
        allowOnlinePayment: dynamicEntitlements.find((d) => d.configKey.includes('Payment'))?.isAllowed ?? true,
        allowSmsNotifications: dynamicEntitlements.find((d) => d.configKey.toLowerCase().includes('sms'))?.isAllowed ?? true,
        isActive: true,
        entitlements: [
          ...dynamicEntitlements.map((item) => ({
            orderConfigId: item.orderConfigId,
            configKey: item.configKey,
            isAllowed:
              item.configKey === 'IsKdsEnabled'
                ? !!selectedApps.app_captain_menza
                : item.configKey === 'IsTableOrderingEnabled'
                ? !!selectedApps.app_menza_order
                : item.isAllowed,
            featureCommissionPercentage: parseFloat(item.featureCommissionPercentage) || 0,
            featureFlatFeePerOrder: parseFloat(item.featureFlatFeePerOrder) || 0,
          })),
          {
            orderConfigId: 101,
            configKey: 'IsCaptainMenzaAppEnabled',
            isAllowed: !!selectedApps.app_captain_menza,
            featureCommissionPercentage: 0,
            featureFlatFeePerOrder: 0,
          },
          {
            orderConfigId: 102,
            configKey: 'IsMenzaPosTerminalAppEnabled',
            isAllowed: !!selectedApps.app_menza_pos_terminal,
            featureCommissionPercentage: 0,
            featureFlatFeePerOrder: 0,
          },
          {
            orderConfigId: 103,
            configKey: 'IsMenzaPosWebAppEnabled',
            isAllowed: !!selectedApps.app_menza_pos_web,
            featureCommissionPercentage: 0,
            featureFlatFeePerOrder: 0,
          },
          {
            orderConfigId: 104,
            configKey: 'IsMenzaServeAppEnabled',
            isAllowed: !!selectedApps.app_menza_serve,
            featureCommissionPercentage: 0,
            featureFlatFeePerOrder: 0,
          },
          {
            orderConfigId: 105,
            configKey: 'IsMenzaOrderAppEnabled',
            isAllowed: !!selectedApps.app_menza_order,
            featureCommissionPercentage: 0,
            featureFlatFeePerOrder: 0,
          },
          // Legacy Tier 1 database keys for backward compatibility
          {
            orderConfigId: 19,
            configKey: 'IsMobilePosEnabled',
            isAllowed: !!selectedApps.app_menza_pos_terminal,
            featureCommissionPercentage: 0,
            featureFlatFeePerOrder: 0,
          },
          {
            orderConfigId: 20,
            configKey: 'IsPosWebEnabled',
            isAllowed: !!selectedApps.app_menza_pos_web,
            featureCommissionPercentage: 0,
            featureFlatFeePerOrder: 0,
          },
          {
            orderConfigId: 21,
            configKey: 'IsWaiterAppEnabled',
            isAllowed: !!selectedApps.app_menza_serve,
            featureCommissionPercentage: 0,
            featureFlatFeePerOrder: 0,
          },
          {
            orderConfigId: 22,
            configKey: 'IsKdsAppEnabled',
            isAllowed: !!selectedApps.app_captain_menza,
            featureCommissionPercentage: 0,
            featureFlatFeePerOrder: 0,
          },
          {
            orderConfigId: 23,
            configKey: 'IsPosOrderWebEnabled',
            isAllowed: !!selectedApps.app_menza_order,
            featureCommissionPercentage: 0,
            featureFlatFeePerOrder: 0,
          },
        ],
      });

      if (res.success) {
        await loadPlans();
        resetModalState();
      } else {
        alert(res.message || 'Failed to create plan');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to create plan');
    } finally {
      setSavingPlan(false);
    }
  };

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                  Subscription Plans & Tier Pricing
                </h1>
                <span className="rounded-full bg-amber-500/10 px-3 py-0.5 text-xs font-bold text-[#DE8626]">
                  {plans.length} Tiers
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-[#667085] dark:text-[#94A3B8]">
                Configure billing tiers, duration periods, platform fee take-rates, floor caps, and channel entitlements for restaurants
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadPlans}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3.5 py-2 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5 transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Sync</span>
              </button>

              <button
                onClick={() => setCreateModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-[#DE8626] px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-[#C4721C] transition-all transform active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>Create Plan Tier</span>
              </button>
            </div>
          </div>

          {/* Plans Table */}
          <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-20 text-center text-xs text-[#667085]">Loading plans...</div>
            ) : plans.length === 0 ? (
              <div className="py-20 text-center text-xs text-[#667085]">
                No subscription plans configured. Click "Create Plan Tier" to configure a new plan with commission rules.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#667085] dark:text-[#94A3B8]">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold">Plan Code</th>
                      <th className="py-3.5 px-4 font-semibold">Plan Profile</th>
                      <th className="py-3.5 px-4 font-semibold">Pricing & Wallet</th>
                      <th className="py-3.5 px-4 font-semibold">Platform Fee & Splits</th>
                      <th className="py-3.5 px-4 font-semibold">Ordering Channels</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60">
                    {plans.map((p) => {
                      const baseFee = p.baseCommissionPercentage ?? 0;
                      const flatFee = p.baseFlatCommissionPerOrder ?? 0;
                      const floor = p.minCommissionFloorPerOrder ?? 0;
                      const cap = p.maxCommissionCapPerOrder ?? 0;
                      const walletCredit = p.includedWalletCredit ?? 0;

                      return (
                        <tr key={p.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-[#DE8626] align-top">
                            {p.subscriptionCode}
                          </td>
                          <td className="py-3.5 px-4 align-top">
                            <p className="font-bold text-sm text-[#1E2930] dark:text-[#F3F4F6]">
                              {p.subscriptionName || p.planName}
                            </p>
                            {p.description && (
                              <p className="text-[10px] text-[#667085] dark:text-[#94A3B8] line-clamp-1 mt-0.5">
                                {p.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="rounded-md bg-stone-100 dark:bg-[#252C34] px-1.5 py-0.5 text-[9px] font-semibold text-[#667085] dark:text-[#94A3B8]">
                                {p.billingCycle || 'Monthly'}
                              </span>
                              <span className="text-[10px] text-[#8C7A6B]">
                                {p.durationInDays || 30} Days
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 align-top">
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-extrabold text-sm text-[#1E2930] dark:text-[#F3F4F6]">
                                ₹{(p.finalPrice ?? p.price).toLocaleString('en-IN')}
                              </span>
                              {p.discountAmount && p.discountAmount > 0 ? (
                                <span className="text-[10px] text-[#8C7A6B] line-through">
                                  ₹{p.price.toLocaleString('en-IN')}
                                </span>
                              ) : null}
                            </div>
                            {walletCredit > 0 && (
                              <div className="inline-flex items-center gap-1 mt-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                <Gift className="h-2.5 w-2.5" />
                                <span>₹{walletCredit.toLocaleString('en-IN')} Free Credit</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 align-top">
                            <div className="space-y-1">
                              <div className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-[#DE8626]">
                                <Percent className="h-3 w-3" />
                                <span>
                                  {baseFee}% + ₹{flatFee}/order
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[#667085] dark:text-[#94A3B8]">
                                {floor > 0 && (
                                  <span className="rounded bg-stone-100 dark:bg-[#252C34] px-1.5 py-0.5 font-medium">
                                    Floor: ₹{floor}
                                  </span>
                                )}
                                {cap > 0 && (
                                  <span className="rounded bg-stone-100 dark:bg-[#252C34] px-1.5 py-0.5 font-medium">
                                    Cap: ₹{cap}
                                  </span>
                                )}
                                <span className="font-mono text-[9px] text-[#8C7A6B]">
                                  [{p.commissionType || 'PERCENTAGE'}]
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 align-top">
                            <div className="flex flex-wrap gap-1 max-w-[220px]">
                              {p.allowTableOrdering && (
                                <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-500/10 text-emerald-600">
                                  QR Dine-In
                                </span>
                              )}
                              {p.allowCounterOrdering && (
                                <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold bg-blue-500/10 text-blue-600">
                                  Counter POS
                                </span>
                              )}
                              {p.allowDelivery && (
                                <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold bg-purple-500/10 text-purple-600">
                                  Delivery
                                </span>
                              )}
                              {p.allowSelfPickup && (
                                <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold bg-indigo-500/10 text-indigo-600">
                                  Takeaway
                                </span>
                              )}
                              {p.allowKds && (
                                <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold bg-orange-500/10 text-orange-600">
                                  KDS
                                </span>
                              )}
                              {p.allowOnlinePayment && (
                                <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold bg-amber-500/10 text-amber-600">
                                  PG
                                </span>
                              )}
                              {p.allowSmsNotifications && (
                                <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold bg-sky-500/10 text-sky-600">
                                  SMS / WhatsApp
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right align-top">
                            <button
                              onClick={() => handleTogglePlan(p)}
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold transition-transform active:scale-95 ${
                                p.isActive
                                  ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                                  : 'bg-red-500/10 text-red-600 hover:bg-red-500/20'
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  p.isActive ? 'bg-emerald-500' : 'bg-red-500'
                                }`}
                              />
                              <span>{p.isActive ? 'Active' : 'Inactive'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COMPREHENSIVE 4-STEP CREATE PLAN WIZARD MODAL */}
        {/* ========================================================================= */}
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="w-full max-w-3xl my-8 rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20]">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl bg-[#DE8626]/10 p-2 text-[#DE8626]">
                    <Crown className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                      Create Subscription Plan Tier
                    </h3>
                    <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                      Step {currentStep} of 4: {currentStep === 1 && 'Plan Profile & Pricing'}
                      {currentStep === 2 && 'Commission & Platform Fee'}
                      {currentStep === 3 && 'Ordering Channels & Entitlements'}
                      {currentStep === 4 && 'Review & Publish'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={resetModalState}
                  className="rounded-xl p-1.5 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Stepper Progress Bar */}
              <div className="grid grid-cols-4 border-b border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-xs">
                {[
                  { step: 1, label: '1. Profile & Price' },
                  { step: 2, label: '2. Commission' },
                  { step: 3, label: '3. Channels' },
                  { step: 4, label: '4. Review' },
                ].map((s) => (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => {
                      if (s.step < currentStep) setCurrentStep(s.step as any);
                    }}
                    className={`py-2.5 px-3 text-center font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                      currentStep === s.step
                        ? 'border-[#DE8626] text-[#DE8626] bg-[#DE8626]/5'
                        : currentStep > s.step
                        ? 'border-emerald-500 text-emerald-600 bg-emerald-500/5'
                        : 'border-transparent text-[#667085] opacity-60'
                    }`}
                  >
                    {currentStep > s.step ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : null}
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>

              {/* Wizard Content Body */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                {/* ------------------------------------------------------------- */}
                {/* STEP 1: BASIC PROFILE & PRICING */}
                {/* ------------------------------------------------------------- */}
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                          Plan Code *
                        </label>
                        <input
                          type="text"
                          required
                          value={planCode}
                          onChange={(e) => setPlanCode(e.target.value.toUpperCase())}
                          placeholder="e.g. MENZA_GOLD_PRO"
                          className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                        />
                        <p className="text-[10px] text-[#8C7A6B] mt-1">Unique uppercase SKU identifier.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                          Plan Display Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={planName}
                          onChange={(e) => setPlanName(e.target.value)}
                          placeholder="e.g. Gold POS & QR Suite"
                          className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                        />
                        <p className="text-[10px] text-[#8C7A6B] mt-1">Customer-facing plan title.</p>
                      </div>
                    </div>

                    {/* Billing Cycle Selector */}
                    <div>
                      <label className="block text-xs font-semibold text-[#667085] uppercase mb-1.5">
                        Billing Cycle & Duration Period *
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { cycle: 'MONTHLY', label: 'Monthly', days: '30' },
                          { cycle: 'QUARTERLY', label: 'Quarterly', days: '90' },
                          { cycle: 'HALFYEARLY', label: 'Half-Yearly', days: '180' },
                          { cycle: 'ANNUALLY', label: 'Annually', days: '365' },
                        ].map((c) => (
                          <button
                            key={c.cycle}
                            type="button"
                            onClick={() => handleCycleChange(c.cycle)}
                            className={`p-2.5 rounded-xl border text-center transition-all ${
                              billingCycle === c.cycle
                                ? 'border-[#DE8626] bg-[#DE8626]/10 text-[#DE8626] font-bold shadow-sm'
                                : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#667085] font-medium hover:border-[#DE8626]/50'
                            }`}
                          >
                            <p className="text-xs">{c.label}</p>
                            <p className="text-[10px] text-[#8C7A6B] mt-0.5">{c.days} Days</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Price, Discount, Duration */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                          Base Price (₹) *
                        </label>
                        <input
                          type="number"
                          required
                          min="0"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          placeholder="1499"
                          className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                          Discount (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={discountAmount}
                          onChange={(e) => setDiscountAmount(e.target.value)}
                          placeholder="0"
                          className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                          Duration (Days)
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={durationInDays}
                          onChange={(e) => setDurationInDays(e.target.value)}
                          placeholder="30"
                          className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                        />
                      </div>
                    </div>

                    {/* Net Price & Bundled Wallet Credit */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-3 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-[#667085]">Net Payable Price</p>
                          <p className="text-lg font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                            ₹{netPayablePrice.toLocaleString('en-IN')}
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-600">
                          {parsedDiscount > 0 ? `Save ₹${parsedDiscount}` : 'Full Price'}
                        </span>
                      </div>

                      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Gift className="h-4 w-4 text-emerald-600" />
                          <label className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                            Bundled Free Wallet Credit (₹)
                          </label>
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={includedWalletCredit}
                          onChange={(e) => setIncludedWalletCredit(e.target.value)}
                          placeholder="e.g. 300"
                          className="w-full rounded-xl border border-emerald-500/30 bg-white dark:bg-[#1B2127] px-3 py-1.5 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-emerald-600"
                        />
                        <p className="text-[9px] text-emerald-700 dark:text-emerald-400 mt-1">
                          Complimentary wallet balance granted upon activating this tier.
                        </p>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                        Plan Description
                      </label>
                      <textarea
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Comprehensive POS system with QR dining, KOT thermal printing, and delivery support."
                        className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                      />
                    </div>
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* STEP 2: COMMISSION & PLATFORM FEE RULES */}
                {/* ------------------------------------------------------------- */}
                {currentStep === 2 && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5 flex items-start gap-3">
                      <Percent className="h-5 w-5 text-[#DE8626] shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-[#DE8626]">Platform Fee & Commission Model</h4>
                        <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                          Select the fee structure deducted from the restaurant's prepaid wallet for every completed order.
                        </p>
                      </div>
                    </div>

                    {/* Model Radio Cards */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-[#667085] uppercase">
                        Select Platform Fee Model *
                      </label>
                      <div className="grid grid-cols-1 gap-2.5">
                        {COMMISSION_TYPE_OPTIONS.map((opt) => {
                          const isSelected = commissionType === opt.type;
                          return (
                            <button
                              key={opt.type}
                              type="button"
                              onClick={() => setCommissionType(opt.type)}
                              className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col gap-1.5 ${
                                isSelected
                                  ? 'border-[#DE8626] bg-[#DE8626]/5 shadow-sm'
                                  : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] hover:border-[#DE8626]/40'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-[#1E2930] dark:text-[#F3F4F6]">
                                    {opt.title}
                                  </span>
                                  <span className="rounded-md bg-stone-200 dark:bg-[#252C34] px-1.5 py-0.5 text-[9px] font-bold text-[#667085] dark:text-[#94A3B8]">
                                    {opt.badge}
                                  </span>
                                </div>
                                {isSelected ? (
                                  <CheckCircle2 className="h-4 w-4 text-[#DE8626]" />
                                ) : (
                                  <div className="h-4 w-4 rounded-full border border-stone-300 dark:border-stone-600" />
                                )}
                              </div>
                              <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">{opt.desc}</p>
                              <div className="rounded-lg bg-black/5 dark:bg-white/5 px-2.5 py-1 text-[10px] font-mono text-[#DE8626]">
                                {opt.example}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Rates Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                          Base Commission Rate (%) *
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={baseCommissionPercentage}
                            onChange={(e) => setBaseCommissionPercentage(e.target.value)}
                            placeholder="2.0"
                            className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] pl-3.5 pr-8 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-[#8C7A6B] font-bold">%</span>
                        </div>
                        <p className="text-[10px] text-[#8C7A6B] mt-1">Percentage deducted from gross order total.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                          Flat Fee per Order (₹) *
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={baseFlatCommissionPerOrder}
                            onChange={(e) => setBaseFlatCommissionPerOrder(e.target.value)}
                            placeholder="3.00"
                            className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] pl-3.5 pr-8 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-[#8C7A6B] font-bold">₹</span>
                        </div>
                        <p className="text-[10px] text-[#8C7A6B] mt-1">Fixed rupee deduction per transaction.</p>
                      </div>
                    </div>

                    {/* Min Floor & Max Cap Boundary Guards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                          Min Floor / Order (₹) (0 = None)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={minCommissionFloorPerOrder}
                          onChange={(e) => setMinCommissionFloorPerOrder(e.target.value)}
                          placeholder="2.00"
                          className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                        />
                        <p className="text-[10px] text-[#8C7A6B] mt-1">
                          Guarantees minimum platform fee on small or micro orders.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                          Max Cap / Order (₹) (0 = Unlimited)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={maxCommissionCapPerOrder}
                          onChange={(e) => setMaxCommissionCapPerOrder(e.target.value)}
                          placeholder="10.00"
                          className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                        />
                        <p className="text-[10px] text-[#8C7A6B] mt-1">
                          Ceiling cap protecting restaurants on high-value banquet bills.
                        </p>
                      </div>
                    </div>

                    {/* Interactive Real-Time Simulation Box */}
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calculator className="h-4 w-4 text-emerald-600" />
                          <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            Live Fee Calculation Telemetry
                          </h4>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                          Effective: {aggregatedCommissionPct.toFixed(2)}% + ₹{aggregatedFlatFee.toFixed(2)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                        <div className="rounded-xl bg-white dark:bg-[#1B2127] p-2.5 border border-emerald-500/20">
                          <p className="text-[10px] text-[#8C7A6B]">₹1,000 Standard Order</p>
                          <p className="text-sm font-extrabold text-emerald-600 mt-0.5">
                            ₹{calculateSimulatedFee(1000).toFixed(2)}
                          </p>
                        </div>

                        <div className="rounded-xl bg-white dark:bg-[#1B2127] p-2.5 border border-emerald-500/20">
                          <p className="text-[10px] text-[#8C7A6B]">₹15 Micro Order</p>
                          <p className="text-sm font-extrabold text-emerald-600 mt-0.5">
                            ₹{calculateSimulatedFee(15).toFixed(2)}
                          </p>
                        </div>

                        <div className="col-span-2 sm:col-span-1 rounded-xl bg-white dark:bg-[#1B2127] p-2.5 border border-emerald-500/20">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-[#8C7A6B]">Custom Test (₹)</p>
                            <input
                              type="number"
                              min="1"
                              value={simOrderAmount}
                              onChange={(e) => setSimOrderAmount(e.target.value)}
                              className="w-16 rounded border border-emerald-500/30 px-1 py-0.5 text-[10px] font-bold text-right"
                            />
                          </div>
                          <p className="text-sm font-extrabold text-emerald-600 mt-0.5">
                            ₹{calculateSimulatedFee(parseFloat(simOrderAmount) || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <p className="text-[10px] text-emerald-700 dark:text-emerald-400/90 font-medium">
                        💡 Formula: Fee = Min(Cap, Max(Floor, (Order × {aggregatedCommissionPct.toFixed(2)}%) + ₹{aggregatedFlatFee.toFixed(2)}))
                      </p>
                    </div>
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* STEP 3: DEPARTMENT-BASED OPERATIONAL PILLARS (SOLUTION B) */}
                {/* ------------------------------------------------------------- */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    {/* Header Banner */}
                    <div className="rounded-2xl border border-stone-200 dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 flex items-start gap-3">
                      <Sliders className="h-5 w-5 text-[#DE8626] shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                          Department-Based Plan Entitlements (5 Pillars)
                        </h4>
                        <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                          Configure kitchen stations, POS billing counters, waiter floor steward apps, customer channels, and platform add-ons.
                        </p>
                      </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* PILLAR 1: KITCHEN OPERATIONS (CAPTAINMENZA KDS) */}
                    {/* ========================================================================= */}
                    <div className="rounded-2xl border border-[#DE8626]/30 bg-gradient-to-br from-amber-500/10 via-[#DE8626]/5 to-transparent p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-[#DE8626] text-white shadow-xs">
                            <ChefHat className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-black uppercase text-[#1E2930] dark:text-[#F3F4F6] tracking-wider">
                                1. Kitchen Operations
                              </h4>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                                  selectedApps.app_captain_menza
                                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                    : 'bg-stone-200 dark:bg-stone-800 text-[#667085]'
                                }`}
                              >
                                {selectedApps.app_captain_menza ? 'Active' : 'Disabled'}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                              Paperless chef displays, kitchen bump bar & live station ticket routing.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Unified CaptainMenza KDS Card */}
                      {(() => {
                        const kdsEntitlement = dynamicEntitlements.find(
                          (e) => e.configKey === 'IsKdsEnabled'
                        );
                        const isKdsActive = !!selectedApps.app_captain_menza;
                        return (
                          <div
                            className={`p-4 rounded-2xl border transition-all ${
                              isKdsActive
                                ? 'border-[#DE8626] bg-white dark:bg-[#1B2127] shadow-sm'
                                : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/60 dark:bg-[#151A20]/60 opacity-60'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div
                                  className={`p-2.5 rounded-xl text-white shadow-xs shrink-0 ${
                                    isKdsActive
                                      ? 'bg-gradient-to-br from-[#DE8626] to-amber-600'
                                      : 'bg-stone-400'
                                  }`}
                                >
                                  <ChefHat className="h-5 w-5" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-extrabold text-sm text-[#1E2930] dark:text-[#F3F4F6]">
                                      CaptainMenza App
                                    </span>
                                    <span className="rounded bg-amber-500/10 text-[#DE8626] border border-[#DE8626]/20 px-2 py-0.5 text-[9px] font-bold">
                                      Kitchen Display System (KDS)
                                    </span>
                                    <span className="rounded bg-stone-100 dark:bg-[#252C34] px-1.5 py-0.5 text-[9px] font-bold text-[#667085] dark:text-[#94A3B8]">
                                      Android Tablet
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] mt-1 leading-relaxed">
                                    Dedicated paperless kitchen order ticketing, real-time preparation timers, multi-station order routing (Grill, Fryer, Tandoor, Pantry), and order course bumping.
                                  </p>
                                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                                    <Sparkles className="h-3 w-3 text-[#DE8626]" />
                                    <span>
                                      Enabling CaptainMenza App automatically unlocks full KDS routing across all POS channels.
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Master Switch */}
                              <button
                                type="button"
                                onClick={handleToggleKitchenKds}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  isKdsActive ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-700'
                                }`}
                              >
                                <span
                                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                    isKdsActive ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>

                            {/* Feature-Driven Fee Inputs */}
                            {commissionType === 'FEATURE_DRIVEN' && isKdsActive && kdsEntitlement && (
                              <div className="mt-3 pt-3 border-t border-[#E7E1DA] dark:border-[#2B3540] grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[10px] font-bold text-[#667085] uppercase mb-1">
                                    KDS Add-on Fee Rate (%)
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={kdsEntitlement.featureCommissionPercentage}
                                    onChange={(e) =>
                                      handleUpdateEntitlementFee(
                                        'IsKdsEnabled',
                                        'featureCommissionPercentage',
                                        e.target.value
                                      )
                                    }
                                    placeholder="0.0"
                                    className="w-full rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-2.5 py-1.5 text-xs outline-none focus:border-[#DE8626]"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-[#667085] uppercase mb-1">
                                    KDS Flat Fee / Order (₹)
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    value={kdsEntitlement.featureFlatFeePerOrder}
                                    onChange={(e) =>
                                      handleUpdateEntitlementFee(
                                        'IsKdsEnabled',
                                        'featureFlatFeePerOrder',
                                        e.target.value
                                      )
                                    }
                                    placeholder="0.00"
                                    className="w-full rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-2.5 py-1.5 text-xs outline-none focus:border-[#DE8626]"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* ========================================================================= */}
                    {/* PILLAR 2: COUNTER & EXPRESS POS BILLING */}
                    {/* ========================================================================= */}
                    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
                            <Store className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-black uppercase text-[#1E2930] dark:text-[#F3F4F6] tracking-wider">
                                2. Counter & Express POS Billing
                              </h4>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                                  dynamicEntitlements.find((e) => e.configKey === 'IsCounterOrderingEnabled')
                                    ?.isAllowed
                                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                    : 'bg-stone-200 dark:bg-stone-800 text-[#667085]'
                                }`}
                              >
                                {dynamicEntitlements.find((e) => e.configKey === 'IsCounterOrderingEnabled')
                                  ?.isAllowed
                                  ? 'Active'
                                  : 'Disabled'}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                              Cash desk counters, express takeaways, thermal receipt printing & offline billing.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Master Channel: Express Counter POS */}
                      {(() => {
                        const counterEntitlement = dynamicEntitlements.find(
                          (e) => e.configKey === 'IsCounterOrderingEnabled'
                        );
                        if (!counterEntitlement) return null;
                        return renderEntitlementCard(
                          counterEntitlement,
                          'Express Counter POS Channel',
                          handleToggleCounterChannel
                        );
                      })()}

                      {/* Client Applications for Counter POS */}
                      <div className="pt-2">
                        <p className="text-[10px] font-bold text-[#667085] dark:text-[#94A3B8] uppercase mb-2">
                          Bundled POS Client Software:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {/* Menza POS Terminal App */}
                          <div
                            onClick={() => handleToggleCounterApp('app_menza_pos_terminal')}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-2.5 ${
                              selectedApps.app_menza_pos_terminal
                                ? 'border-blue-500/40 bg-white dark:bg-[#1B2127] shadow-xs'
                                : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/60 dark:bg-[#151A20]/60 opacity-60'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <div
                                className={`p-1.5 rounded-lg text-white shrink-0 ${
                                  selectedApps.app_menza_pos_terminal ? 'bg-blue-600' : 'bg-stone-400'
                                }`}
                              >
                                <Smartphone className="h-4 w-4" />
                              </div>
                              <div>
                                <span className="font-bold text-xs text-[#1E2930] dark:text-[#F3F4F6] block">
                                  Menza POS Terminal App
                                </span>
                                <span className="text-[10px] text-[#667085] dark:text-[#94A3B8] leading-tight block mt-0.5">
                                  Android POS hardware (Sunmi, Elo, iMin) with built-in thermal printing.
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleCounterApp('app_menza_pos_terminal');
                              }}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                                selectedApps.app_menza_pos_terminal ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-700'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                  selectedApps.app_menza_pos_terminal ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>

                          {/* Menza POS Web */}
                          <div
                            onClick={() => handleToggleCounterApp('app_menza_pos_web')}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-2.5 ${
                              selectedApps.app_menza_pos_web
                                ? 'border-blue-500/40 bg-white dark:bg-[#1B2127] shadow-xs'
                                : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/60 dark:bg-[#151A20]/60 opacity-60'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <div
                                className={`p-1.5 rounded-lg text-white shrink-0 ${
                                  selectedApps.app_menza_pos_web ? 'bg-blue-600' : 'bg-stone-400'
                                }`}
                              >
                                <Laptop className="h-4 w-4" />
                              </div>
                              <div>
                                <span className="font-bold text-xs text-[#1E2930] dark:text-[#F3F4F6] block">
                                  Menza POS Web
                                </span>
                                <span className="text-[10px] text-[#667085] dark:text-[#94A3B8] leading-tight block mt-0.5">
                                  Web browser POS for laptops, PCs & iPads with cloud & offline billing outbox.
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleCounterApp('app_menza_pos_web');
                              }}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                                selectedApps.app_menza_pos_web ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-700'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                  selectedApps.app_menza_pos_web ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* PILLAR 3: FLOOR SERVICE & STEWARD OPERATIONS */}
                    {/* ========================================================================= */}
                    <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-purple-600 text-white shadow-xs">
                            <UtensilsCrossed className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-black uppercase text-[#1E2930] dark:text-[#F3F4F6] tracking-wider">
                                3. Floor Service & Waiter Stewards
                              </h4>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                                  selectedApps.app_menza_serve
                                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                    : 'bg-stone-200 dark:bg-stone-800 text-[#667085]'
                                }`}
                              >
                                {selectedApps.app_menza_serve ? 'Active' : 'Disabled'}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                              Table-side ordering for captains, food runner alerts & service bell calls.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* MenzaServe App Card */}
                      <div
                        className={`p-4 rounded-2xl border transition-all ${
                          selectedApps.app_menza_serve
                            ? 'border-purple-500/40 bg-white dark:bg-[#1B2127] shadow-sm'
                            : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/60 dark:bg-[#151A20]/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div
                              className={`p-2.5 rounded-xl text-white shadow-xs shrink-0 ${
                                selectedApps.app_menza_serve
                                  ? 'bg-gradient-to-br from-purple-600 to-indigo-600'
                                  : 'bg-stone-400'
                              }`}
                            >
                              <UtensilsCrossed className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-sm text-[#1E2930] dark:text-[#F3F4F6]">
                                  MenzaServe App
                                </span>
                                <span className="rounded bg-purple-500/10 text-purple-600 border border-purple-500/20 px-2 py-0.5 text-[9px] font-bold">
                                  Waiter Mobile Suite
                                </span>
                                <span className="rounded bg-stone-100 dark:bg-[#252C34] px-1.5 py-0.5 text-[9px] font-bold text-[#667085] dark:text-[#94A3B8]">
                                  Android & iOS
                                </span>
                              </div>
                              <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] mt-1 leading-relaxed">
                                Floor captain and steward mobile terminal for live table occupancy layouts, rapid table-side order taking, instant KDS punch-in, and guest bill settlement requests.
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={handleToggleFloorService}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              selectedApps.app_menza_serve
                                ? 'bg-emerald-500'
                                : 'bg-stone-300 dark:bg-stone-700'
                            }`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                selectedApps.app_menza_serve ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* PILLAR 4: CUSTOMER ORDERING CHANNELS */}
                    {/* ========================================================================= */}
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
                            <QrCode className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-black uppercase text-[#1E2930] dark:text-[#F3F4F6] tracking-wider">
                              4. Customer Ordering Channels
                            </h4>
                            <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                              Guest self-ordering touchpoints: contactless QR table scan, takeaway parcel, and direct home delivery.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        {/* MenzaOrderApp (Table QR Ordering) */}
                        {(() => {
                          const tableEntitlement = dynamicEntitlements.find(
                            (e) => e.configKey === 'IsTableOrderingEnabled'
                          );
                          const isTableActive = !!selectedApps.app_menza_order;
                          return (
                            <div
                              className={`p-3.5 rounded-2xl border transition-all ${
                                isTableActive
                                  ? 'border-emerald-500/40 bg-white dark:bg-[#1B2127] shadow-xs'
                                  : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/60 dark:bg-[#151A20]/60 opacity-60'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2.5">
                                  <div
                                    className={`p-2 rounded-xl text-white shadow-xs shrink-0 ${
                                      isTableActive ? 'bg-emerald-600' : 'bg-stone-400'
                                    }`}
                                  >
                                    <QrCode className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-xs text-[#1E2930] dark:text-[#F3F4F6]">
                                        MenzaOrderApp (Table QR Ordering)
                                      </span>
                                      <span className="rounded bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 text-[9px] font-bold">
                                        Dine-In Channel
                                      </span>
                                      <span className="rounded bg-stone-100 dark:bg-[#252C34] px-1.5 py-0.5 text-[9px] font-bold text-[#667085] dark:text-[#94A3B8]">
                                        PWA & Web
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] mt-0.5">
                                      Interactive table sticker QR scan, rich mobile menu, contactless cart, live preparation progress & instant checkout.
                                    </p>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={handleToggleTableQrOrder}
                                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                    isTableActive ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-700'
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                      isTableActive ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                  />
                                </button>
                              </div>

                              {commissionType === 'FEATURE_DRIVEN' &&
                                isTableActive &&
                                tableEntitlement && (
                                  <div className="mt-3 pt-3 border-t border-[#E7E1DA] dark:border-[#2B3540] grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-[10px] font-bold text-[#667085] uppercase mb-1">
                                        Table QR Fee Rate (%)
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={tableEntitlement.featureCommissionPercentage}
                                        onChange={(e) =>
                                          handleUpdateEntitlementFee(
                                            'IsTableOrderingEnabled',
                                            'featureCommissionPercentage',
                                            e.target.value
                                          )
                                        }
                                        placeholder="0.0"
                                        className="w-full rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-2.5 py-1.5 text-xs outline-none focus:border-[#DE8626]"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-[#667085] uppercase mb-1">
                                        Table QR Flat Fee (₹)
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={tableEntitlement.featureFlatFeePerOrder}
                                        onChange={(e) =>
                                          handleUpdateEntitlementFee(
                                            'IsTableOrderingEnabled',
                                            'featureFlatFeePerOrder',
                                            e.target.value
                                          )
                                        }
                                        placeholder="0.00"
                                        className="w-full rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-2.5 py-1.5 text-xs outline-none focus:border-[#DE8626]"
                                      />
                                    </div>
                                  </div>
                                )}
                            </div>
                          );
                        })()}

                        {/* Direct Home Delivery */}
                        {(() => {
                          const deliveryEntitlement = dynamicEntitlements.find(
                            (e) => e.configKey === 'IsDeliveryEnabled'
                          );
                          if (!deliveryEntitlement) return null;
                          return renderEntitlementCard(
                            deliveryEntitlement,
                            'Direct Home Delivery Channel'
                          );
                        })()}

                        {/* Self-Pickup / Takeaway */}
                        {(() => {
                          const pickupEntitlement = dynamicEntitlements.find(
                            (e) => e.configKey === 'IsSelfPickupEnabled'
                          );
                          if (!pickupEntitlement) return null;
                          return renderEntitlementCard(
                            pickupEntitlement,
                            'Self-Pickup / Takeaway Channel'
                          );
                        })()}
                      </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* PILLAR 5: PLATFORM INTEGRATIONS & ADD-ONS */}
                    {/* ========================================================================= */}
                    <div className="rounded-2xl border border-stone-300 dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-amber-600 text-white shadow-xs">
                            <CreditCard className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-black uppercase text-[#1E2930] dark:text-[#F3F4F6] tracking-wider">
                              5. Platform Integrations & Add-ons
                            </h4>
                            <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                              Automated customer notifications, online payment gateway & order automation.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        {/* Dynamic entitlements excluding the ones already in Pillars 1-4 */}
                        {dynamicEntitlements
                          .filter(
                            (item) =>
                              item.configKey !== 'IsKdsEnabled' &&
                              item.configKey !== 'IsCounterOrderingEnabled' &&
                              item.configKey !== 'IsTableOrderingEnabled' &&
                              item.configKey !== 'IsDeliveryEnabled' &&
                              item.configKey !== 'IsSelfPickupEnabled'
                          )
                          .map((item) => renderEntitlementCard(item))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* STEP 4: REVIEW & CONFIRM */}
                {/* ------------------------------------------------------------- */}
                {currentStep === 4 && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono text-xs font-bold text-[#DE8626]">{planCode}</span>
                          <h4 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                            {planName}
                          </h4>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                            ₹{netPayablePrice.toLocaleString('en-IN')}
                          </p>
                          <p className="text-[10px] text-[#8C7A6B]">
                            {billingCycle} ({durationInDays} Days)
                          </p>
                        </div>
                      </div>

                      {description && (
                        <p className="text-xs text-[#667085] dark:text-[#94A3B8] italic">{description}</p>
                      )}

                      {parsedWalletCredit > 0 && (
                        <div className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          <Gift className="h-4 w-4" />
                          <span>Includes ₹{parsedWalletCredit.toLocaleString('en-IN')} Free Wallet Credit</span>
                        </div>
                      )}

                      {/* Fee Structure Summary */}
                      <div className="rounded-xl bg-white dark:bg-[#1B2127] p-3 border border-emerald-500/20 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#667085] font-medium">Platform Fee Take-Rate:</span>
                          <span className="font-extrabold text-[#DE8626]">
                            {aggregatedCommissionPct.toFixed(2)}% + ₹{aggregatedFlatFee.toFixed(2)} / order
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#667085] font-medium">Fee Model:</span>
                          <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6] font-mono">
                            {commissionType}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#667085] font-medium">Floor & Ceiling Protection:</span>
                          <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                            {parsedMinFloor > 0 ? `Min ₹${parsedMinFloor}` : 'No Floor'}
                            {' / '}
                            {parsedMaxCap > 0 ? `Max Cap ₹${parsedMaxCap}` : 'No Cap'}
                          </span>
                        </div>
                      </div>

                      {/* Enabled Menza Applications */}
                      <div>
                        <p className="text-[10px] font-bold text-[#667085] uppercase mb-1.5">
                          Enabled Menza Applications ({MENZA_ECOSYSTEM_APPS.filter((a) => selectedApps[a.appKey]).length} of 5)
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {MENZA_ECOSYSTEM_APPS
                            .filter((a) => selectedApps[a.appKey])
                            .map((a) => (
                              <span
                                key={a.appKey}
                                className="rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-[#DE8626] flex items-center gap-1"
                              >
                                <Check className="h-3 w-3 text-[#DE8626]" />
                                <span>{a.name}</span>
                              </span>
                            ))}
                        </div>
                      </div>

                      {/* Enabled Channels */}
                      <div>
                        <p className="text-[10px] font-bold text-[#667085] uppercase mb-1.5">
                          Enabled Channels ({dynamicEntitlements.filter((e) => e.isAllowed).length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {dynamicEntitlements
                            .filter((e) => e.isAllowed)
                            .map((e) => (
                              <span
                                key={e.configKey}
                                className="rounded-md bg-stone-100 dark:bg-[#252C34] px-2 py-0.5 text-[10px] font-semibold text-[#1E2930] dark:text-[#F3F4F6] flex items-center gap-1"
                              >
                                <Check className="h-3 w-3 text-emerald-500" />
                                <span>{e.configName}</span>
                              </span>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Wizard Footer Navigation */}
              <div className="px-6 py-4 border-t border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (currentStep === 1) resetModalState();
                    else setCurrentStep((prev) => Math.max(1, prev - 1) as any);
                  }}
                  className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] px-4 py-2 text-xs font-semibold text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  {currentStep === 1 ? 'Cancel' : 'Back'}
                </button>

                <div className="flex items-center gap-2">
                  {currentStep < 4 ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="flex items-center gap-1.5 rounded-xl bg-[#DE8626] px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-[#C4721C] transition-all transform active:scale-95"
                    >
                      <span>Continue</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={savingPlan}
                      onClick={handleCreatePlan}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-6 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition-all transform active:scale-95"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>{savingPlan ? 'Publishing Plan...' : 'Publish Subscription Plan'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </AppShell>
    </AuthGuard>
  );
}
