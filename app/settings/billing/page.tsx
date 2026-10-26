'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Crown,
  ArrowLeft,
  Check,
  Zap,
  ShieldCheck,
  Calendar,
  Sparkles,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Hash,
  Percent,
  Wallet,
  History,
  Lock,
  RotateCcw,
  Layers,
  FileText,
  Download,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { SubscriptionService } from '@/services/subscriptionService';
import {
  SubscriptionPlan,
  UserSubscriptionStatus,
  RestaurantSubscriptionHistory,
} from '@/types/subscription';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { TaxInvoiceModal, TaxInvoiceItem } from '@/components/invoice/TaxInvoiceModal';

export default function SubscriptionBillingPage() {
  const router = useRouter();
  const { activeRestaurant, restaurants } = useAuthStore();
  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);


  const [loading, setLoading] = useState(true);
  const [activeSub, setActiveSub] = useState<UserSubscriptionStatus | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [history, setHistory] = useState<RestaurantSubscriptionHistory[]>([]);

  // Tax Invoice Modal State
  const [selectedInvoice, setSelectedInvoice] = useState<TaxInvoiceItem | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);

  // Clean slate upon restaurant switch
  useEffect(() => {
    setActiveSub(null);
    setHistory([]);
    setLoading(true);
  }, [currentRestId]);


  const handleOpenActiveSubInvoice = () => {
    if (!activeSub) return;
    const rawId = String(activeSub.subscriptionId || activeSub.subscriptionConfigurationId || 1);
    const seqStr = rawId.replace(/[^0-9]/g, '').slice(-5).padStart(5, '0');
    const invNumber = activeSub.invoiceNumber || `MZ/26-27/S${seqStr}`;

    const recipientGst =
      activeSub.restaurantGstNumber ||
      (activeRestaurant as any)?.gstNumber ||
      (activeRestaurant as any)?.gstin ||
      undefined;

    const pGst = activeSub.platformGst;

    const invoiceItem: TaxInvoiceItem = {
      type: 'SUBSCRIPTION',
      invoiceNumber: invNumber,
      invoiceDate: activeSub.startDate || new Date().toISOString(),
      paymentReference: activeSub.paymentReferenceNo,

      // Supplier (Menza Platform)
      supplierLegalName: pGst?.platformLegalName,
      supplierTradeName: pGst?.platformTradeName,
      supplierGstin: pGst?.platformGstin,
      supplierPan: pGst?.platformPan,
      supplierStateCode: pGst?.platformStateCode,
      supplierStateName: pGst?.platformStateName,
      supplierAddress: pGst?.platformAddress,
      supplierEmail: pGst?.supportEmail,
      supplierWebsite: pGst?.websiteUrl,

      // Restaurant (Recipient)
      restaurantName: activeSub.restaurantName || activeRestaurant?.restaurantName || 'Restaurant Partner',
      restaurantId: currentRestId,
      outletAddress: (activeRestaurant as any)?.address || (activeRestaurant as any)?.outletAddress || (activeRestaurant as any)?.restaurantAddress,
      ownerName: (activeRestaurant as any)?.ownerName,
      contactPhone: (activeRestaurant as any)?.ownerMobile || (activeRestaurant as any)?.phone,
      customerGstin: recipientGst,

      itemTitle: `Menza POS Software Subscription - ${activeSub.planName}`,
      itemDescription: 'Software as a Service (SaaS) Cloud POS, QR Table Ordering, KDS & Operating System Licensing',
      sacCode: pGst?.subscriptionSacCode || '997331',
      coverageStart: activeSub.startDate,
      coverageEnd: activeSub.endDate || activeSub.expiryDate,
      totalAmount: activeSub.amountPaid ?? 0,
      baseAmount: activeSub.baseAmount,
      taxAmount: activeSub.taxAmount,
      taxPercentage: activeSub.taxPercentage || pGst?.defaultGstPercentage || 18,
      cgstPercentage: pGst?.cgstPercentage || (activeSub.taxPercentage ? activeSub.taxPercentage / 2 : 9),
      sgstPercentage: pGst?.sgstPercentage || (activeSub.taxPercentage ? activeSub.taxPercentage / 2 : 9),
    };
    setSelectedInvoice(invoiceItem);
    setInvoiceModalOpen(true);
  };

  const handleOpenHistoryInvoice = (item: RestaurantSubscriptionHistory) => {
    const rawId = String(item.id || item.restaurantSubscriptionRelationshipId || 1);
    const seqStr = rawId.replace(/[^0-9]/g, '').slice(-5).padStart(5, '0');
    const invNumber = item.invoiceNumber || `MZ/26-27/S${seqStr}`;

    const recipientGst =
      item.restaurantGstNumber ||
      activeSub?.restaurantGstNumber ||
      (activeRestaurant as any)?.gstNumber ||
      (activeRestaurant as any)?.gstin ||
      undefined;

    const pGst = item.platformGst || activeSub?.platformGst;

    const invoiceItem: TaxInvoiceItem = {
      type: 'SUBSCRIPTION',
      invoiceNumber: invNumber,
      invoiceDate: item.createdDateUtc || item.startDate,
      paymentReference: item.paymentReferenceNo || item.walletTransactionRef,

      // Supplier (Menza Platform)
      supplierLegalName: pGst?.platformLegalName,
      supplierTradeName: pGst?.platformTradeName,
      supplierGstin: pGst?.platformGstin,
      supplierPan: pGst?.platformPan,
      supplierStateCode: pGst?.platformStateCode,
      supplierStateName: pGst?.platformStateName,
      supplierAddress: pGst?.platformAddress,
      supplierEmail: pGst?.supportEmail,
      supplierWebsite: pGst?.websiteUrl,

      // Restaurant (Recipient)
      restaurantName: item.restaurantName || activeSub?.restaurantName || activeRestaurant?.restaurantName || 'Restaurant Partner',
      restaurantId: currentRestId,
      outletAddress: (activeRestaurant as any)?.address || (activeRestaurant as any)?.outletAddress || (activeRestaurant as any)?.restaurantAddress,
      ownerName: (activeRestaurant as any)?.ownerName,
      contactPhone: (activeRestaurant as any)?.ownerMobile || (activeRestaurant as any)?.phone,
      customerGstin: recipientGst,

      itemTitle: `Menza POS Software Subscription - ${item.subscriptionName || item.subscriptionCode || 'Plan'}`,
      itemDescription: 'Software as a Service (SaaS) Cloud POS, QR Table Ordering, KDS & Operating System Licensing',
      sacCode: pGst?.subscriptionSacCode || '997331',
      coverageStart: item.startDate,
      coverageEnd: item.endDate,
      totalAmount: item.amountPaid,
      baseAmount: item.baseAmount,
      taxAmount: item.taxAmount,
      taxPercentage: item.taxPercentage || pGst?.defaultGstPercentage || 18,
      cgstPercentage: pGst?.cgstPercentage || (item.taxPercentage ? item.taxPercentage / 2 : 9),
      sgstPercentage: pGst?.sgstPercentage || (item.taxPercentage ? item.taxPercentage / 2 : 9),
    };
    setSelectedInvoice(invoiceItem);
    setInvoiceModalOpen(true);
  };

  const loadData = useCallback(async () => {
    if (!currentRestId) return;
    try {
      setLoading(true);
      const [subRes, plansRes, histRes] = await Promise.allSettled([
        SubscriptionService.getRestaurantSubscription(currentRestId),
        SubscriptionService.getPlans(),
        SubscriptionService.getSubscriptionHistory(currentRestId),
      ]);

      if (subRes.status === 'fulfilled') setActiveSub(subRes.value);
      if (plansRes.status === 'fulfilled' && Array.isArray(plansRes.value)) {
        setPlans(plansRes.value.filter((p) => p.isActive));
      }
      if (histRes.status === 'fulfilled' && Array.isArray(histRes.value)) {
        setHistory(histRes.value);
      }
    } catch (err) {
      console.warn('Subscription load error', err);
    } finally {
      setLoading(false);
    }
  }, [currentRestId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatDate = (dateStr?: string, includeTime = false) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    if (includeTime) {
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const matchedPlan =
    plans.find((p) => {
      if (!activeSub) return false;
      const subConfigId =
        activeSub.subscriptionConfigurationId || activeSub.planId || (activeSub as any)?.subscriptionPlanId;
      if (subConfigId && (p.id === subConfigId || p.planId === subConfigId)) return true;
      const planLabel = (p.subscriptionName || p.planName || '').trim().toLowerCase();
      const subLabel = (activeSub.planName || '').trim().toLowerCase();
      return Boolean(planLabel && subLabel && planLabel === subLabel);
    }) || null;

  const startFormatted = formatDate(activeSub?.startDate);
  const expiryFormatted = formatDate(activeSub?.endDate || activeSub?.expiryDate);
  const effectiveEndFormatted = formatDate(
    activeSub?.effectiveCoverageEndDate || activeSub?.endDate || activeSub?.expiryDate
  );
  const planDurationDays = Number(matchedPlan?.durationInDays || matchedPlan?.durationDays || 30);
  const currentCycleDaysLeft = Number(activeSub?.currentCycleDaysRemaining ?? activeSub?.daysRemaining ?? 0);
  const totalDaysLeft = Number(activeSub?.totalDaysRemaining ?? activeSub?.daysRemaining ?? 0);
  const queuedRenewalDays = Number(activeSub?.queuedRenewalDays ?? 0);
  const hasQueuedRenewal = Boolean(activeSub?.hasQueuedRenewal && queuedRenewalDays > 0);
  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round((Math.max(0, currentCycleDaysLeft) / Math.max(1, planDurationDays)) * 100))
  );

  const baseCommissionPct = Number(matchedPlan?.baseCommissionPercentage ?? 0);
  const baseFlatFee = Number(matchedPlan?.baseFlatCommissionPerOrder ?? 0);
  const commissionType = matchedPlan?.commissionType || 'PERCENTAGE';

  // Helper to resolve an entitlement by its configKey
  const resolveEntitlement = (configKey: string, fallbackPlanProp?: keyof SubscriptionPlan) => {
    const kLower = configKey.toLowerCase();
    const isKds = kLower === 'iskdsenabled' || kLower === 'iskdsappenabled' || kLower === 'iscaptainmenzaappenabled';

    const activeEnt = (activeSub?.entitlements || []).find((e: any) => {
      const ek = String(e.configKey || e.ConfigKey || '').toLowerCase();
      return isKds ? (ek === 'iskdsenabled' || ek === 'iskdsappenabled' || ek === 'iscaptainmenzaappenabled') : ek === kLower;
    });
    const planEnt = (matchedPlan?.entitlements || []).find((e: any) => {
      const ek = String(e.configKey || e.ConfigKey || '').toLowerCase();
      return isKds ? (ek === 'iskdsenabled' || ek === 'iskdsappenabled' || ek === 'iscaptainmenzaappenabled') : ek === kLower;
    });

    let enabled = true;
    if (activeEnt !== undefined) {
      enabled = Boolean(activeEnt.isAllowed ?? (activeEnt as any).IsAllowed);
    } else if (planEnt !== undefined) {
      enabled = Boolean(planEnt.isAllowed ?? (planEnt as any).IsAllowed);
    } else if (fallbackPlanProp && matchedPlan && matchedPlan[fallbackPlanProp] !== undefined) {
      enabled = Boolean(matchedPlan[fallbackPlanProp]);
    }

    const featureCommissionPct =
      Number(activeEnt?.featureCommissionPercentage ?? (activeEnt as any)?.FeatureCommissionPercentage ?? 0) ||
      Number(planEnt?.featureCommissionPercentage ?? (planEnt as any)?.FeatureCommissionPercentage ?? 0);

    const featureFlatFee =
      Number(activeEnt?.featureFlatFeePerOrder ?? (activeEnt as any)?.FeatureFlatFeePerOrder ?? 0) ||
      Number(planEnt?.featureFlatFeePerOrder ?? (planEnt as any)?.FeatureFlatFeePerOrder ?? 0);

    return {
      enabled,
      featureCommissionPct,
      featureFlatFee,
    };
  };

  interface FeatureConfigItem {
    key: string;
    label: string;
    category: string;
    description: string;
    fallbackPlanProp?: keyof SubscriptionPlan;
  }

  const CANONICAL_FEATURES: FeatureConfigItem[] = [
    {
      key: 'IsTableOrderingEnabled',
      label: 'Table QR & Dine-In Ordering',
      category: 'Ordering Channels',
      description: 'Customer ordering & reordering via digital QR menu table scans',
      fallbackPlanProp: 'allowTableOrdering',
    },
    {
      key: 'IsCounterOrderingEnabled',
      label: 'Express Counter POS & Instant Billing',
      category: 'Ordering Channels',
      description: 'Walk-in cash counter billing, receipt printing, and rapid checkout',
      fallbackPlanProp: 'allowCounterOrdering',
    },
    {
      key: 'IsSelfPickupEnabled',
      label: 'Self-Pickup & Takeaway Orders',
      category: 'Ordering Channels',
      description: 'Customer takeaway, parcel packing, and takeaway pickup management',
      fallbackPlanProp: 'allowSelfPickup',
    },
    {
      key: 'IsDeliveryEnabled',
      label: 'Direct Home Delivery Channel',
      category: 'Ordering Channels',
      description: 'Direct delivery dispatch, rider assignment, and customer delivery tracking',
      fallbackPlanProp: 'allowDelivery',
    },
    {
      key: 'IsKdsEnabled',
      label: 'Kitchen Display System (KDS & KOT)',
      category: 'Operations',
      description: 'Live paperless kitchen tickets, station routing, and kitchen order status',
      fallbackPlanProp: 'allowKds',
    },
    {
      key: 'IsSmsNotificationsEnabled',
      label: 'Customer SMS & WhatsApp Alerts',
      category: 'Notifications',
      description: 'Real-time order confirmation, live tracking link & settled bills via WhatsApp & SMS',
      fallbackPlanProp: 'allowSmsNotifications',
    },
    {
      key: 'AllowOnlinePayment',
      label: 'Online Gateway Payments (UPI/Cards)',
      category: 'Payments',
      description: 'Accept instant UPI, debit/credit cards, and digital wallet settlements',
      fallbackPlanProp: 'allowOnlinePayment',
    },
  ];

  // Derive all entitlements: Canonical features + dynamic features in activeSub/matchedPlan
  const rawEntitlements = (activeSub?.entitlements?.length ? activeSub.entitlements : matchedPlan?.entitlements) || [];
  const extraDynamicKeys = rawEntitlements
    .map((e) => e.configKey || (e as any).ConfigKey)
    .filter((k): k is string => Boolean(k) && !CANONICAL_FEATURES.some((c) => c.key.toLowerCase() === String(k).toLowerCase()));

  // Remove duplicates
  const uniqueExtraKeys = Array.from(new Set(extraDynamicKeys.map((k) => k.trim())));

  const dynamicFeaturesList: FeatureConfigItem[] = uniqueExtraKeys.map((key) => {
    const formatted = key
      .replace(/^(Is|Allow)/, '')
      .replace(/Enabled$/, '')
      .replace(/([A-Z])/g, ' $1')
      .trim();
    return {
      key,
      label: formatted || key,
      category: key.toLowerCase().includes('payment') ? 'Payments' : 'Operations',
      description: `Feature entitlement for ${formatted || key}`,
    };
  });

  const allFeatureConfigs: FeatureConfigItem[] = [...CANONICAL_FEATURES, ...dynamicFeaturesList];

  const entitlementItems = allFeatureConfigs.map((feature) => {
    const { enabled, featureCommissionPct, featureFlatFee } = resolveEntitlement(
      feature.key,
      feature.fallbackPlanProp
    );

    // Format commission label & badge
    let commissionBadge = '';
    let commissionDesc = '';
    let isSurcharge = false;

    if (!enabled) {
      commissionBadge = 'Not Entitled';
      commissionDesc = 'Disabled in active subscription';
    } else if (featureCommissionPct > 0 && featureFlatFee > 0) {
      const flatStr = featureFlatFee.toFixed(2).replace(/\.00$/, '');
      commissionBadge = `+${featureCommissionPct}% + ₹${flatStr}/order`;
      commissionDesc = `+${featureCommissionPct}% + ₹${flatStr}/order feature surcharge`;
      isSurcharge = true;
    } else if (featureCommissionPct > 0) {
      commissionBadge = `+${featureCommissionPct}% Take-Rate`;
      commissionDesc = `+${featureCommissionPct}% surcharge per order`;
      isSurcharge = true;
    } else if (featureFlatFee > 0) {
      const flatStr = featureFlatFee.toFixed(2).replace(/\.00$/, '');
      commissionBadge = `+₹${flatStr} / order`;
      commissionDesc = `+₹${flatStr} flat fee per order surcharge`;
      isSurcharge = true;
    } else if (commissionType === 'FEATURE_DRIVEN') {
      commissionBadge = '0% Surcharge';
      commissionDesc = 'Included in plan (0% extra surcharge)';
    } else if (baseCommissionPct > 0 && baseFlatFee > 0) {
      const flatStr = baseFlatFee.toFixed(2).replace(/\.00$/, '');
      commissionBadge = `${baseCommissionPct}% + ₹${flatStr} Base`;
      commissionDesc = `Covered under ${baseCommissionPct}% + ₹${flatStr}/order base platform fee`;
    } else if (baseCommissionPct > 0) {
      commissionBadge = `${baseCommissionPct}% Base Rate`;
      commissionDesc = `Covered under ${baseCommissionPct}% base platform fee`;
    } else if (baseFlatFee > 0) {
      const flatStr = baseFlatFee.toFixed(2).replace(/\.00$/, '');
      commissionBadge = `₹${flatStr} Base / order`;
      commissionDesc = `Covered under ₹${flatStr}/order base platform fee`;
    } else {
      commissionBadge = '0% Commission';
      commissionDesc = 'Included in plan (0% commission)';
    }

    return {
      key: feature.key,
      label: feature.label,
      category: feature.category,
      description: feature.description,
      enabled,
      featureCommissionPct,
      featureFlatFee,
      commissionBadge,
      commissionDesc,
      isSurcharge,
    };
  });

  const enabledEntitlements = entitlementItems.filter((i) => i.enabled);
  const activeSurcharges = enabledEntitlements.filter((i) => i.isSurcharge);

  const totalFeaturePct = enabledEntitlements.reduce((acc, i) => acc + i.featureCommissionPct, 0);
  const totalFeatureFlat = enabledEntitlements.reduce((acc, i) => acc + i.featureFlatFee, 0);

  const effectiveTotalPct =
    activeSub?.effectiveCommissionPercentage !== undefined
      ? activeSub.effectiveCommissionPercentage
      : baseCommissionPct + totalFeaturePct;

  const effectiveTotalFlat =
    activeSub?.effectiveFlatCommissionPerOrder !== undefined
      ? activeSub.effectiveFlatCommissionPerOrder
      : baseFlatFee + totalFeatureFlat;

  const effectiveFeeDisplay =
    effectiveTotalPct > 0 && effectiveTotalFlat > 0
      ? `${effectiveTotalPct.toFixed(2).replace(/\.00$/, '')}% + ₹${effectiveTotalFlat.toFixed(2).replace(/\.00$/, '')} / order`
      : effectiveTotalPct > 0
      ? `${effectiveTotalPct.toFixed(2).replace(/\.00$/, '')}% per order`
      : effectiveTotalFlat > 0
      ? `₹${effectiveTotalFlat.toFixed(2).replace(/\.00$/, '')} flat / order`
      : '0% Commission Plan';

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
          <button
            onClick={() => router.push('/settings')}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Settings</span>
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                Subscription Details & Licensing
              </h1>
              <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8]">
                Manage your active Menza tier, renewal dates, billing cycles, feature entitlements, and payment history
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {activeSub && (
                <button
                  type="button"
                  onClick={handleOpenActiveSubInvoice}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 px-4 py-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xs cursor-pointer"
                  title="Download / View Subscription Tax Invoice"
                >
                  <FileText className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Download Tax Invoice</span>
                  <Download className="h-3.5 w-3.5 opacity-80" />
                </button>
              )}
              <button
                type="button"
                onClick={() => useSubscriptionStore.getState().openRenewalModal(undefined, 'renew')}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-[#DE8626] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Renew Current Plan</span>
              </button>
              <button
                type="button"
                onClick={() => useSubscriptionStore.getState().openRenewalModal(undefined, 'explore')}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-[#DE8626] bg-amber-500/10 px-4 py-2.5 text-xs font-bold text-[#DE8626] hover:bg-[#DE8626] hover:text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Explore Plans</span>
              </button>
            </div>
          </div>

          {/* Active Subscription Overview & Details Card */}
          <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-[#DE8626]">
                  <Crown className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                      {activeSub?.planName || matchedPlan?.subscriptionName || 'Store Subscription License'}
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                        activeSub?.isExpired
                          ? 'bg-red-500/15 text-red-600'
                          : activeSub?.isInGracePeriod
                          ? 'bg-amber-500/15 text-amber-600'
                          : 'bg-emerald-500/15 text-emerald-600'
                      }`}
                    >
                      {activeSub?.isExpired
                        ? 'Expired'
                        : activeSub?.isInGracePeriod
                        ? 'Grace Period'
                        : hasQueuedRenewal
                        ? 'Active • Renewed'
                        : activeSub?.status || 'Active'}
                    </span>
                    {matchedPlan?.subscriptionCode && (
                      <span className="rounded-md border border-[#E7E1DA] dark:border-[#2B3540] px-2 py-0.5 text-[10px] font-bold text-[#667085]">
                        {matchedPlan.subscriptionCode}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1">
                    Outlet: <strong>{activeRestaurant?.restaurantName || 'Active Store'}</strong> •{' '}
                    {matchedPlan?.description || 'Seamless POS billing, kitchen KOT routing, and analytics'}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-[#667085] dark:text-[#94A3B8] mt-1.5">
                    <span>Menza Supplier: <strong className="font-mono text-[#DE8626]">{activeSub?.platformGst?.platformGstin || '27AABCM8821F1ZX'}</strong> ({activeSub?.platformGst?.platformLegalName || 'Menza Technologies Pvt Ltd'})</span>
                    {(activeSub?.restaurantGstNumber || (activeRestaurant as any)?.gstNumber || (activeRestaurant as any)?.gstin) ? (
                      <>
                        <span>•</span>
                        <span>Billed Store GSTIN: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{activeSub?.restaurantGstNumber || (activeRestaurant as any)?.gstNumber || (activeRestaurant as any)?.gstin}</strong></span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-[#FAF7F2] dark:bg-[#151A20] border border-[#E7E1DA] dark:border-[#2B3540] px-4 py-3 text-left sm:text-right min-w-[135px]">
                <span className="text-[11px] font-semibold text-[#667085]">Days Remaining</span>
                <p className="text-2xl font-black text-[#DE8626]">
                  {activeSub ? totalDaysLeft : 0} Days
                </p>
                <span className="text-[10px] text-[#667085]">
                  {hasQueuedRenewal ? `Includes +${queuedRenewalDays}d renewal` : `Expires ${expiryFormatted}`}
                </span>
              </div>
            </div>

            {/* Validity Progress Bar */}
            {activeSub && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6] flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-[#DE8626]" />
                    {activeSub.isExpired
                      ? 'Current subscription cycle has ended'
                      : `${currentCycleDaysLeft} days remaining in current cycle`}
                  </span>
                  <span className="text-[11px] font-semibold text-[#667085] dark:text-[#94A3B8]">
                    {startFormatted} → {expiryFormatted}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      activeSub.isExpired || currentCycleDaysLeft <= 3
                        ? 'bg-red-500'
                        : currentCycleDaysLeft <= 7
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${activeSub.isExpired ? 100 : Math.max(6, progressPercent)}%` }}
                  />
                </div>
              </div>
            )}

            {/* 6-Card Subscription Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
              <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#667085] dark:text-[#94A3B8]">
                  <Calendar className="h-4 w-4 text-[#DE8626]" />
                  <span>Activated / Start Date</span>
                </div>
                <p className="mt-1.5 text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  {startFormatted}
                </p>
                <span className="text-[11px] text-[#667085]">
                  Status: {activeSub?.status || 'Active'}
                </span>
              </div>

              <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#667085] dark:text-[#94A3B8]">
                  <Clock className="h-4 w-4 text-[#DE8626]" />
                  <span>Expiry / Renewal Date</span>
                </div>
                <p className="mt-1.5 text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  {expiryFormatted}
                </p>
                <span className="text-[11px] text-[#667085]">
                  {hasQueuedRenewal
                    ? `Queued coverage until ${effectiveEndFormatted}`
                    : `${Math.max(0, currentCycleDaysLeft)} days left`}
                </span>
              </div>

              <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-[#667085] dark:text-[#94A3B8]">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-emerald-600" />
                      <span>Amount Paid</span>
                    </div>
                    {Number(activeSub?.amountPaid || 0) > 0 && (
                      <button
                        type="button"
                        onClick={handleOpenActiveSubInvoice}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer shadow-xs"
                        title="Download / View GST Tax Invoice"
                      >
                        <FileText className="h-3 w-3 text-emerald-600" />
                        <span>Tax Invoice</span>
                        <Download className="h-2.5 w-2.5 opacity-80" />
                      </button>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                    ₹{Number(activeSub?.amountPaid ?? matchedPlan?.finalPrice ?? matchedPlan?.price ?? 0).toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="pt-1 flex items-center justify-between text-[11px] text-[#667085] dark:text-[#94A3B8]">
                  <span>Billing Cycle: {matchedPlan?.billingCycle || `${planDurationDays} Days`}</span>
                  {activeSub?.invoiceNumber && (
                    <span className="font-mono text-[10px] text-emerald-600 font-semibold">
                      {activeSub.invoiceNumber}
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#667085] dark:text-[#94A3B8]">
                  <Hash className="h-4 w-4 text-[#DE8626]" />
                  <span>Payment Reference</span>
                </div>
                <p className="mt-1.5 text-xs font-extrabold text-[#1E2930] dark:text-[#F3F4F6] truncate" title={activeSub?.paymentReferenceNo || 'N/A'}>
                  {activeSub?.paymentReferenceNo || 'Direct / Admin Assigned'}
                </p>
                <span className="text-[11px] text-[#667085]">
                  Subscription ID: #{activeSub?.subscriptionId || activeSub?.subscriptionConfigurationId || '—'}
                </span>
              </div>

              <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#667085] dark:text-[#94A3B8]">
                  <Percent className="h-4 w-4 text-[#DE8626]" />
                  <span>Platform Fee Structure</span>
                </div>
                <p className="mt-1.5 text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  {effectiveFeeDisplay}
                </p>
                <span
                  className="text-[11px] text-[#667085] truncate block"
                  title={
                    matchedPlan?.maxCommissionCapPerOrder
                      ? `Max cap: ₹${matchedPlan.maxCommissionCapPerOrder}/order • ${commissionType}`
                      : activeSurcharges.length > 0
                      ? `Base: ${baseCommissionPct}% + ₹${baseFlatFee}/order • Active Surcharges: +${totalFeaturePct}% + ₹${totalFeatureFlat}`
                      : matchedPlan?.commissionType || 'Standard SaaS License'
                  }
                >
                  {matchedPlan?.maxCommissionCapPerOrder
                    ? `Max cap: ₹${matchedPlan.maxCommissionCapPerOrder}/order • ${commissionType}`
                    : activeSurcharges.length > 0
                    ? `Includes ${activeSurcharges.length} active feature surcharge${activeSurcharges.length > 1 ? 's' : ''}`
                    : matchedPlan?.commissionType || 'Standard SaaS License'}
                </span>
              </div>

              <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#667085] dark:text-[#94A3B8]">
                  <Wallet className="h-4 w-4 text-emerald-600" />
                  <span>Included Wallet Credit</span>
                </div>
                <p className="mt-1.5 text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  ₹{Number(matchedPlan?.includedWalletCredit || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[11px] text-[#667085]">
                  Credited on plan activation/renewal
                </span>
              </div>
            </div>

            {/* Feature Entitlements & Commissions */}
            <div className="border-t border-[#E7E1DA] dark:border-[#2B3540] pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#1E2930] dark:text-[#F3F4F6]">
                      Active Plan Feature Entitlements & Commissions
                    </h4>
                    <span className="rounded-md bg-stone-100 dark:bg-[#252C34] px-2 py-0.5 text-[10px] font-bold text-[#DE8626]">
                      {effectiveFeeDisplay} Total
                    </span>
                  </div>
                  <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] mt-0.5">
                    Live channel permissions and associated transaction fees deducted per order
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{enabledEntitlements.length} / {entitlementItems.length} Enabled</span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {entitlementItems.map((item) => (
                  <div
                    key={item.key}
                    className={`relative flex flex-col justify-between rounded-2xl p-4 border transition-all ${
                      item.enabled
                        ? 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] shadow-xs hover:border-[#DE8626]/40'
                        : 'border-[#E7E1DA]/50 dark:border-[#2B3540]/50 bg-black/[0.02] dark:bg-white/[0.02] opacity-60'
                    }`}
                  >
                    <div>
                      {/* Category & Status */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="rounded-md bg-stone-100 dark:bg-[#252C34] px-2 py-0.5 text-[9px] font-bold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider">
                          {item.category}
                        </span>
                        {item.enabled ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-stone-200/80 dark:bg-stone-800 px-2 py-0.5 text-[10px] font-bold text-[#667085] dark:text-[#94A3B8]">
                            <Lock className="h-2.5 w-2.5" />
                            Locked
                          </span>
                        )}
                      </div>

                      {/* Title & Description */}
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
                            item.enabled
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-stone-100 dark:bg-stone-800 text-[#667085]'
                          }`}
                        >
                          {item.enabled ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <Lock className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5
                            className={`text-xs font-bold leading-snug ${
                              item.enabled
                                ? 'text-[#1E2930] dark:text-[#F3F4F6]'
                                : 'text-[#667085] dark:text-[#94A3B8] line-through'
                            }`}
                          >
                            {item.label}
                          </h5>
                          <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] mt-0.5 line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Commission Rate Footer */}
                    <div className="mt-3.5 pt-3 border-t border-[#E7E1DA]/70 dark:border-[#2B3540]/70 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-[#667085] dark:text-[#94A3B8]">
                        <Percent className="h-3 w-3 text-[#DE8626]" />
                        <span>Commission:</span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-extrabold ${
                          !item.enabled
                            ? 'bg-stone-100 dark:bg-stone-800 text-[#667085]'
                            : item.isSurcharge
                            ? 'bg-amber-500/15 border border-amber-500/30 text-[#DE8626] dark:text-amber-400'
                            : 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400'
                        }`}
                        title={item.commissionDesc}
                      >
                        {item.commissionBadge}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Available Subscription Tiers */}
          <div>
            <h2 className="text-sm font-bold text-[#667085] uppercase tracking-wider mb-4">
              Available Store Plans ({plans.length})
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {plans.map((plan) => {
                const isCurrent = matchedPlan?.id === plan.id;
                const price = Number(plan.finalPrice ?? plan.price ?? 0);
                const duration = plan.durationInDays || plan.durationDays || 30;
                return (
                  <div
                    key={plan.id}
                    className={`relative flex flex-col justify-between rounded-3xl border bg-white dark:bg-[#1B2127] p-6 shadow-sm transition-all ${
                      isCurrent
                        ? 'border-2 border-[#DE8626] ring-2 ring-[#DE8626]/20'
                        : 'border-[#E7E1DA] dark:border-[#2B3540] hover:border-[#DE8626] hover:shadow-md'
                    }`}
                  >
                    {isCurrent && (
                      <span className="absolute top-4 right-4 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-600 uppercase">
                        Current Plan
                      </span>
                    )}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#DE8626] uppercase tracking-wider">
                          {plan.billingCycle || 'Monthly'}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-[#1E2930] dark:text-[#F3F4F6] pr-20">
                        {plan.subscriptionName || plan.planName}
                      </h3>
                      <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1 min-h-[32px]">
                        {plan.description || 'Full POS, KOT ticketing, digital catalog, and reports.'}
                      </p>

                      <div className="my-5 flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                          ₹{price.toLocaleString('en-IN')}
                        </span>
                        <span className="text-xs text-[#667085]">
                          / {duration} days
                        </span>
                      </div>

                      <div className="space-y-2 border-t border-[#E7E1DA]/60 dark:border-[#2B3540]/60 pt-4 text-xs text-[#667085] dark:text-[#94A3B8]">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span>High-Speed Counter POS Terminal</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span>Instant Kitchen KOT Sync & Printing</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span>Live Floor Table Management</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span>
                            {plan.baseCommissionPercentage !== undefined && plan.baseCommissionPercentage > 0
                              ? `${plan.baseCommissionPercentage}% Platform Fee per Order`
                              : 'Executive Revenue & GST Reports'}
                          </span>
                        </div>
                        {plan.includedWalletCredit ? (
                          <div className="flex items-center gap-2 text-emerald-600 font-semibold">
                            <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                            <span>Includes ₹{plan.includedWalletCredit} Wallet Bonus</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        useSubscriptionStore
                          .getState()
                          .openRenewalModal(plan, isCurrent ? 'renew' : 'explore')
                      }
                      className={`mt-6 w-full rounded-2xl border py-3 text-xs font-bold transition-all shadow-sm ${
                        isCurrent
                          ? 'border-[#DE8626] bg-[#DE8626] text-white hover:bg-[#C4721C]'
                          : 'border-[#DE8626] bg-amber-500/10 text-[#DE8626] hover:bg-[#DE8626] hover:text-white'
                      }`}
                    >
                      {isCurrent ? 'Renew Current Plan' : 'Select & Activate'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Subscription & Billing History Ledger */}
          <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-[#DE8626]">
                  <History className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                    Subscription & Billing History
                  </h2>
                  <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                    Complete audit trail of plan activations, renewals, upgrades, and transaction references
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-[#FAF7F2] dark:bg-[#151A20] border border-[#E7E1DA] dark:border-[#2B3540] px-3 py-1 text-xs font-bold text-[#667085]">
                {history.length} Records
              </span>
            </div>

            {history.length === 0 && !loading ? (
              <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-6 text-center space-y-1.5">
                <FileText className="h-6 w-6 text-[#667085] mx-auto opacity-60" />
                <p className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                  No Historical Billing Events Recorded Yet
                </p>
                <p className="text-[11px] text-[#667085]">
                  Future renewals and plan changes will be logged here automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item) => {
                  const evt = (item.eventType || item.newStatus || 'ACTIVATED').toUpperCase();
                  const isPositive = evt.includes('RENEW') || evt.includes('UPGRADE') || evt.includes('ACTIVATE');
                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                              isPositive
                                ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-[#DE8626] border border-amber-500/30'
                            }`}
                          >
                            {evt}
                          </span>
                          <h4 className="text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                            {item.subscriptionName || item.subscriptionCode || activeSub?.planName || 'Subscription Plan'}
                          </h4>
                          <span className="text-[11px] text-[#667085]">
                            • {formatDate(item.createdDateUtc, true)}
                          </span>
                        </div>
                        <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                          Coverage: <strong>{formatDate(item.startDate)}</strong> → <strong>{formatDate(item.endDate)}</strong>
                          {item.paymentReferenceNo ? ` • Payment Ref: ${item.paymentReferenceNo}` : ''}
                        </p>
                        {item.baseAmount && item.taxAmount ? (
                          <p className="text-[10px] text-[#667085] dark:text-[#94A3B8]">
                            Taxable Value: ₹{Number(item.baseAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} + GST ({item.taxPercentage || 18}%): ₹{Number(item.taxAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </p>
                        ) : null}
                        {item.remarks && (
                          <p className="text-[11px] text-[#667085] italic">{item.remarks}</p>
                        )}
                      </div>

                      <div className="text-left sm:text-right shrink-0 space-y-1">
                        <span className="text-[10px] font-semibold uppercase text-[#667085] block">
                          Amount Paid
                        </span>
                        <span className="text-base font-black text-[#1E2930] dark:text-[#F3F4F6] block">
                          ₹{Number(item.amountPaid || 0).toLocaleString('en-IN')}
                        </span>
                        <div className="flex items-center gap-2 sm:justify-end">
                          <span className="text-[10px] text-emerald-600 font-bold uppercase">
                            {item.newStatus || 'ACTIVE'}
                          </span>
                          {item.amountPaid > 0 && (
                            <button
                              type="button"
                              onClick={() => handleOpenHistoryInvoice(item)}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono font-bold transition-all cursor-pointer shadow-xs"
                              title="Download / View GST Tax Invoice"
                            >
                              <FileText className="h-3 w-3 text-emerald-600" />
                              <span>{item.invoiceNumber || 'Tax Invoice'}</span>
                              <Download className="h-2.5 w-2.5 opacity-80" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* GST Tax Invoice Modal */}
        <TaxInvoiceModal
          isOpen={invoiceModalOpen}
          onClose={() => setInvoiceModalOpen(false)}
          invoice={selectedInvoice}
        />
      </AppShell>
    </AuthGuard>
  );
}
