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
        const features: DynamicEntitlementState[] = [];
        masterList.forEach((master: any) => {
          const detailsList = master.details || master.Details || [];
          if (Array.isArray(detailsList) && detailsList.length > 0) {
            detailsList.forEach((detail: any) => {
              features.push({
                orderConfigId: detail.id || detail.Id || 0,
                configKey: detail.configKey || detail.ConfigKey || '',
                configName: detail.description || detail.Description || detail.configKey || detail.ConfigKey || 'Feature',
                category: detail.category || detail.Category || master.configName || master.ConfigName || 'Ordering Channels',
                description: detail.description || detail.Description || '',
                isAllowed: true,
                featureCommissionPercentage: '0',
                featureFlatFeePerOrder: '0',
              });
            });
          }
        });
        if (features.length > 0) {
          setDynamicEntitlements(features);
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

  const handleToggleEntitlement = (configKey: string) => {
    setDynamicEntitlements((prev) =>
      prev.map((item) =>
        item.configKey === configKey ? { ...item, isAllowed: !item.isAllowed } : item
      )
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
        allowKds: dynamicEntitlements.find((d) => d.configKey.includes('Kds'))?.isAllowed ?? true,
        allowOnlinePayment: dynamicEntitlements.find((d) => d.configKey.includes('Payment'))?.isAllowed ?? true,
        isActive: true,
        entitlements: dynamicEntitlements.map((item) => ({
          orderConfigId: item.orderConfigId,
          configKey: item.configKey,
          isAllowed: item.isAllowed,
          featureCommissionPercentage: parseFloat(item.featureCommissionPercentage) || 0,
          featureFlatFeePerOrder: parseFloat(item.featureFlatFeePerOrder) || 0,
        })),
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
                {/* STEP 3: ORDERING CHANNELS & ENTITLEMENTS */}
                {/* ------------------------------------------------------------- */}
                {currentStep === 3 && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-stone-200 dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-3.5 flex items-start gap-3">
                      <Sliders className="h-5 w-5 text-[#DE8626] shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                          Ordering Channels & Feature Entitlements
                        </h4>
                        <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                          Toggle feature permissions available under this plan tier. In Feature-Driven mode, you can also attach channel-specific surcharge fees.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {dynamicEntitlements.map((item) => (
                        <div
                          key={item.configKey}
                          className={`rounded-2xl border p-3.5 transition-all ${
                            item.isAllowed
                              ? 'border-[#DE8626]/40 bg-white dark:bg-[#1B2127]'
                              : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/60 dark:bg-[#151A20]/60 opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-[#1E2930] dark:text-[#F3F4F6]">
                                  {item.configName}
                                </span>
                                <span className="rounded bg-stone-100 dark:bg-[#252C34] px-1.5 py-0.5 text-[9px] font-medium text-[#667085] dark:text-[#94A3B8]">
                                  {item.category}
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
                              onClick={() => handleToggleEntitlement(item.configKey)}
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
                      ))}
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
