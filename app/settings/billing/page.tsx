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

export default function SubscriptionBillingPage() {
  const router = useRouter();
  const { activeRestaurant, restaurants } = useAuthStore();
  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);

  const [loading, setLoading] = useState(true);
  const [activeSub, setActiveSub] = useState<UserSubscriptionStatus | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [history, setHistory] = useState<RestaurantSubscriptionHistory[]>([]);

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

  const checkEntitlementAllowed = (configKey: string, planFlag?: boolean): boolean => {
    const ents = activeSub?.entitlements || matchedPlan?.entitlements || [];
    const found = ents.find(
      (e: any) => String(e.configKey || e.ConfigKey || '').toLowerCase() === configKey.toLowerCase()
    );
    if (found !== undefined) {
      return Boolean(found.isAllowed ?? (found as any).IsAllowed);
    }
    if (planFlag !== undefined) {
      return Boolean(planFlag);
    }
    return true;
  };

  const entitlementItems = [
    {
      label: 'Counter POS & Instant Billing',
      enabled: checkEntitlementAllowed('IsCounterOrderingEnabled', matchedPlan?.allowCounterOrdering),
    },
    {
      label: 'Table QR & Dine-In Ordering',
      enabled: checkEntitlementAllowed('IsTableOrderingEnabled', matchedPlan?.allowTableOrdering),
    },
    {
      label: 'Kitchen Display System (KDS & KOT)',
      enabled: checkEntitlementAllowed('IsKdsEnabled', matchedPlan?.allowKds),
    },
    {
      label: 'Self-Pickup & Takeaway Orders',
      enabled: checkEntitlementAllowed('IsSelfPickupEnabled', matchedPlan?.allowSelfPickup),
    },
    {
      label: 'Delivery Channel Management',
      enabled: checkEntitlementAllowed('IsDeliveryEnabled', matchedPlan?.allowDelivery),
    },
    {
      label: 'Online Gateway Payments (UPI/Cards)',
      enabled: checkEntitlementAllowed('AllowOnlinePayment', matchedPlan?.allowOnlinePayment),
    },
  ];

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

              <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#667085] dark:text-[#94A3B8]">
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                  <span>Amount Paid</span>
                </div>
                <p className="mt-1.5 text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  ₹{Number(activeSub?.amountPaid ?? matchedPlan?.finalPrice ?? matchedPlan?.price ?? 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[11px] text-[#667085]">
                  Billing Cycle: {matchedPlan?.billingCycle || `${planDurationDays} Days`}
                </span>
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
                  {matchedPlan?.baseCommissionPercentage !== undefined && matchedPlan.baseCommissionPercentage > 0
                    ? `${matchedPlan.baseCommissionPercentage}% per order`
                    : matchedPlan?.baseFlatCommissionPerOrder
                    ? `₹${matchedPlan.baseFlatCommissionPerOrder} flat / order`
                    : '0% Commission Plan'}
                </p>
                <span className="text-[11px] text-[#667085]">
                  {matchedPlan?.maxCommissionCapPerOrder
                    ? `Max cap: ₹${matchedPlan.maxCommissionCapPerOrder}/order`
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

            {/* Feature Entitlements */}
            <div className="border-t border-[#E7E1DA] dark:border-[#2B3540] pt-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#667085] dark:text-[#94A3B8]">
                  Active Plan Feature Entitlements
                </h4>
                <span className="text-xs font-bold text-emerald-600">
                  {entitlementItems.filter((i) => i.enabled).length} / {entitlementItems.length} Enabled
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                {entitlementItems.map((item) => (
                  <div
                    key={item.label}
                    className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 border ${
                      item.enabled
                        ? 'border-emerald-500/25 bg-emerald-500/5 text-[#1E2930] dark:text-[#F3F4F6]'
                        : 'border-[#E7E1DA] dark:border-[#2B3540] bg-black/5 dark:bg-white/5 text-[#667085] line-through opacity-70'
                    }`}
                  >
                    {item.enabled ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Lock className="h-4 w-4 text-[#667085] shrink-0" />
                    )}
                    <span className="font-semibold">{item.label}</span>
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
                        {item.remarks && (
                          <p className="text-[11px] text-[#667085] italic">{item.remarks}</p>
                        )}
                      </div>

                      <div className="text-left sm:text-right shrink-0">
                        <span className="text-[10px] font-semibold uppercase text-[#667085] block">
                          Amount Paid
                        </span>
                        <span className="text-base font-black text-[#1E2930] dark:text-[#F3F4F6]">
                          ₹{Number(item.amountPaid || 0).toLocaleString('en-IN')}
                        </span>
                        <span className="block text-[10px] text-emerald-600 font-bold uppercase">
                          {item.newStatus || 'ACTIVE'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
