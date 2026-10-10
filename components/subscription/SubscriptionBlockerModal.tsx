'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Crown,
  ShieldAlert,
  Check,
  Zap,
  ArrowRight,
  Loader2,
  X,
  Lock,
  Sparkles,
  AlertCircle,
  CreditCard,
  LogOut,
  Clock,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { SubscriptionPlan } from '@/types/subscription';
import { PaymentGatewayService } from '@/payments/paymentGatewayService.web';

export const SubscriptionBlockerModal: React.FC = () => {
  const router = useRouter();
  const { user, activeRestaurant, restaurants, setActiveRestaurant, logout } = useAuthStore();
  const {
    subscription,
    isExpired,
    isNoSubscription,
    lifecycleState,
    daysRemaining,
    isInGracePeriod,
    graceDaysRemaining,
    isRenewalModalOpen,
    activeModalTab,
    plans,
    isPlansLoading,
    fetchPlans,
    fetchSubscriptionStatus,
    closeRenewalModal,
    assignPlan,
    initiateCashFreePayment,
    verifyPayment,
    hasLoaded,
  } = useSubscriptionStore();

  const [modalTab, setModalTab] = useState<'renew' | 'explore'>(activeModalTab || 'explore');
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);
  const isSuperAdmin = Boolean(
    user?.roles?.some((r) =>
      ['SUPERADMIN', 'SUPER_ADMIN', 'SUPERADMINONLY'].includes(r.toUpperCase().replace(/[^A-Z]/g, ''))
    )
  );
  const isOwner =
    user?.roles?.some((r) => ['OWNER', 'ADMIN', 'SUPERADMIN', 'SUPER_ADMIN'].includes(r.toUpperCase().replace(/[^A-Z]/g, ''))) ||
    !user?.roles ||
    user.roles.length === 0;

  // Sync tab from store when opened
  useEffect(() => {
    if (!subscription || isNoSubscription) {
      setModalTab('explore');
    } else if (activeModalTab) {
      setModalTab(activeModalTab);
    } else {
      setModalTab('renew');
    }
  }, [activeModalTab, subscription, isNoSubscription, isRenewalModalOpen]);

  // Ensure subscription status is fetched when restaurant is set
  useEffect(() => {
    if (!hasLoaded && currentRestId > 0) {
      fetchSubscriptionStatus(currentRestId);
    }
  }, [hasLoaded, currentRestId, fetchSubscriptionStatus]);

  // Strictly locked when no active subscription or expired beyond grace period (SuperAdmin exempt)
  const isStrictlyLocked =
    !isSuperAdmin &&
    (isNoSubscription || !subscription || isExpired || lifecycleState === 'EXPIRED' || lifecycleState === 'NONE');
  const isVisible = hasLoaded && (isStrictlyLocked || isRenewalModalOpen);

  // Auto-fetch plans when modal opens or locked
  useEffect(() => {
    if (isStrictlyLocked || isRenewalModalOpen) {
      if (plans.length === 0) {
        fetchPlans();
      }
    }
  }, [isStrictlyLocked, isRenewalModalOpen, plans.length, fetchPlans]);

  // Set default plan selection
  useEffect(() => {
    if (plans.length > 0 && (selectedPlanId === null || !plans.some((p) => p.id === selectedPlanId))) {
      // Find matching current plan, or default to first
      const currentPlanMatch = plans.find(
        (p) =>
          p.id === (subscription as any)?.subscriptionPlanId ||
          (p.subscriptionName && subscription?.planName && p.subscriptionName.toLowerCase() === subscription.planName.toLowerCase())
      );
      setSelectedPlanId(currentPlanMatch ? currentPlanMatch.id : plans[0].id);
    }
  }, [plans, selectedPlanId, subscription]);

  const handleSelectOutlet = async (restId: number) => {
    const target = restaurants.find((r) => r.restaurantId === restId);
    if (target) {
      setActiveRestaurant(target);
      setStatusMessage(null);
      await fetchSubscriptionStatus(target.restaurantId);
    }
  };

  if (!isVisible) {
    return null;
  }

  // Find the user's active current plan in plans list
  const currentPlan =
    plans.find(
      (p) =>
        p.id === (subscription as any)?.subscriptionPlanId ||
        (p.subscriptionName && subscription?.planName && p.subscriptionName.toLowerCase() === subscription.planName.toLowerCase())
    ) || (plans.length > 0 ? plans[0] : null);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || currentPlan || plans[0];

  const handlePayAndActivate = async (plan: SubscriptionPlan, isRenewAction: boolean = false) => {
    if (!currentRestId) {
      setStatusMessage({ type: 'error', text: 'No active restaurant selected.' });
      return;
    }

    try {
      setSubmitting(true);
      setStatusMessage(null);

      const price = Number(plan.finalPrice ?? plan.price ?? 0);
      const duration = Number(plan.durationInDays || plan.durationDays || 30);

      // Free / Trial direct assignment
      if (price <= 0) {
        const res = await assignPlan(currentRestId, plan.id, duration, 0);
        if (res.success) {
          setStatusMessage({
            type: 'success',
            text: isRenewAction
              ? 'Plan renewed successfully!'
              : 'Free Plan activated successfully! POS unlocked.',
          });
          setTimeout(async () => {
            await fetchSubscriptionStatus(currentRestId);
            closeRenewalModal();
            setSubmitting(false);
          }, 1200);
          return;
        }
      }

      // 1. Initiate Payment Order (checks Razorpay vs Cashfree)
      const initRes = await initiateCashFreePayment(
        currentRestId,
        plan.id,
        price,
        user?.mobile || '9999999999'
      );

      if (!initRes.success || (!initRes.paymentSessionId && !initRes.paymentLink && !initRes.orderId)) {
        setStatusMessage({
          type: 'error',
          text: initRes.message || 'Payment gateway is not configured. Please contact administrator to set up payment credentials.',
        });
        setSubmitting(false);
        return;
      }

      // 2. Open Unified Payment Gateway Checkout (Razorpay if isRazorpay=true, else Cashfree)
      const paymentResult = await PaymentGatewayService.startPayment({
        orderId: initRes.orderId || `SUB_${Date.now()}`,
        amount: initRes.amount || price,
        currency: initRes.currency || 'INR',
        gateway: initRes.gateway,
        keyId: initRes.keyId,
        paymentSessionId: initRes.paymentSessionId,
        paymentLink: initRes.paymentLink,
        customerName: activeRestaurant?.restaurantName || user?.name || 'Restaurant Owner',
        customerPhone: user?.mobile || activeRestaurant?.ownerMobile || '9999999999',
        customerEmail: (user as any)?.email || 'billing@menza.com',
        orderNotes: `${isRenewAction ? 'Renewal' : 'Plan Upgrade'} - ${plan.subscriptionName || plan.planName} (₹${price})`,
      });

      if (!paymentResult.success) {
        setStatusMessage({
          type: 'error',
          text: paymentResult.error || 'Payment checkout was cancelled or failed.',
        });
        setSubmitting(false);
        return;
      }

      // 3. Verify Payment
      const verifyRes = await verifyPayment(
        initRes.orderId || '',
        currentRestId,
        plan.id,
        price,
        paymentResult.razorpayPaymentId,
        paymentResult.razorpaySignature
      );

      if (verifyRes?.success) {
        setStatusMessage({
          type: 'success',
          text: isRenewAction
            ? 'Plan renewed successfully! Your coverage has been extended.'
            : 'Subscription activated successfully! POS unlocked.',
        });
        await fetchSubscriptionStatus(currentRestId);
        setTimeout(() => {
          closeRenewalModal();
          setSubmitting(false);
        }, 1500);
      } else {
        await fetchSubscriptionStatus(currentRestId);
        const latestSub = useSubscriptionStore.getState().subscription;
        if (latestSub && !useSubscriptionStore.getState().isExpired) {
          setStatusMessage({
            type: 'success',
            text: 'Subscription activated successfully! POS unlocked.',
          });
          setTimeout(() => {
            closeRenewalModal();
            setSubmitting(false);
          }, 1200);
        } else {
          setStatusMessage({
            type: 'error',
            text: verifyRes?.message || 'Payment verification pending. Please contact support if your account was debited.',
          });
          setSubmitting(false);
        }
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to complete subscription payment.',
      });
      setSubmitting(false);
    }
  };

  const expiryFormatted = subscription?.endDate
    ? new Date(subscription.endDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'No active date';

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="border-b border-[#E7E1DA] dark:border-[#2B3540] px-6 py-5 bg-[#FAF7F2] dark:bg-[#151A20]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                  isStrictlyLocked ? 'bg-red-500/10 text-red-600' : 'bg-amber-500/10 text-[#DE8626]'
                }`}
              >
                {isStrictlyLocked ? <ShieldAlert className="h-6 w-6" /> : <Crown className="h-6 w-6" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl font-black tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                    {isNoSubscription || !subscription
                      ? 'Subscription Plan Required'
                      : isStrictlyLocked
                      ? 'Subscription Expired'
                      : 'Manage Restaurant Subscription'}
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                      isStrictlyLocked
                        ? 'bg-red-500/15 text-red-600 border border-red-500/30'
                        : 'bg-amber-500/15 text-[#DE8626] border border-amber-500/30'
                    }`}
                  >
                    <Lock className="h-3 w-3" />
                    {isStrictlyLocked ? 'Locked' : subscription ? 'Active' : 'Plan Required'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8]">
                  {isNoSubscription || !subscription
                    ? `No active subscription found for ${activeRestaurant?.restaurantName || 'this store'}. Please purchase a plan below to unlock POS.`
                    : isStrictlyLocked
                    ? `Subscription for ${activeRestaurant?.restaurantName || 'this store'} has expired. Please renew or select a plan to resume operations.`
                    : `${activeRestaurant?.restaurantName || 'Active Store'} • Seamless billing, KOT kitchen routing, and multi-terminal sync.`}
                </p>
              </div>
            </div>

            {/* Header Right Actions: Outlet Switcher + Logout + Optional Close */}
            <div className="flex items-center gap-2 shrink-0">
              {restaurants.length > 1 && (
                <select
                  value={activeRestaurant?.restaurantId || currentRestId}
                  onChange={(e) => handleSelectOutlet(Number(e.target.value))}
                  className="text-xs font-semibold py-1.5 px-2.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#1E2930] dark:text-[#F3F4F6] focus:outline-none focus:ring-2 focus:ring-[#DE8626]"
                  title="Switch Restaurant Outlet"
                >
                  {restaurants.map((r) => (
                    <option key={r.restaurantId} value={r.restaurantId}>
                      {r.restaurantName}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={() => {
                  logout();
                  router.replace('/login');
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3 py-1.5 text-xs font-bold text-[#667085] hover:text-red-600 hover:border-red-500/30 transition-colors"
                title="Log Out of Menza POS"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Log Out</span>
              </button>

              {!isStrictlyLocked && (
                <button
                  onClick={closeRenewalModal}
                  className="rounded-full p-2 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Primary Tabs */}
        <div className="flex border-b border-[#E7E1DA] dark:border-[#2B3540] px-6 bg-white dark:bg-[#1B2127]">
          {subscription && !isNoSubscription && (
            <button
              onClick={() => {
                setModalTab('renew');
                setStatusMessage(null);
              }}
              className={`flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-bold transition-all ${
                modalTab === 'renew'
                  ? 'border-[#DE8626] text-[#DE8626]'
                  : 'border-transparent text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
              }`}
            >
              <RotateCcw className="h-4 w-4" />
              <span>Renew Current Plan</span>
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-[#DE8626]">
                {daysRemaining}d left
              </span>
            </button>
          )}

          <button
            onClick={() => {
              setModalTab('explore');
              setStatusMessage(null);
            }}
            className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-bold transition-all ${
              modalTab === 'explore'
                ? 'border-[#DE8626] text-[#DE8626]'
                : 'border-transparent text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>
              {subscription && !isNoSubscription
                ? `Explore Other Plans (${plans.length})`
                : `Choose Subscription Plan (${plans.length})`}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Staff Warning if non-owner */}
          {!isOwner && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2 font-bold mb-1">
                <AlertCircle className="h-4 w-4 text-[#DE8626]" />
                <span>Staff Notice</span>
              </div>
              <p>
                You are logged in as a staff member. An active subscription is required to use Menza POS. Only the <strong>Restaurant Owner</strong> can purchase or renew subscription plans.
              </p>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    router.replace('/login');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Log Out & Switch Account</span>
                </button>
              </div>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`rounded-xl p-3.5 text-xs font-medium flex items-center gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-600 border border-red-500/20'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* TAB 1: RENEW CURRENT PLAN */}
          {modalTab === 'renew' && subscription && !isNoSubscription && currentPlan && (
            <div className="space-y-5">
              {/* Active Plan Hero Card */}
              <div className="rounded-3xl border-2 border-[#DE8626] bg-amber-500/5 p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="inline-block rounded-md bg-[#DE8626] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white mb-2">
                      Active Subscription
                    </span>
                    <h3 className="text-xl font-black text-[#1E2930] dark:text-[#F3F4F6]">
                      {subscription.planName || currentPlan.subscriptionName || currentPlan.planName}
                    </h3>
                    <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8]">
                      Expires on <strong>{expiryFormatted}</strong> • {daysRemaining} days remaining
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-4 text-left sm:text-right">
                    <span className="text-[11px] text-[#667085]">Renewal Price</span>
                    <p className="text-2xl font-black text-[#DE8626]">
                      ₹{currentPlan.finalPrice ?? currentPlan.price}
                    </p>
                    <span className="text-[10px] text-[#667085]">
                      for {currentPlan.durationInDays || currentPlan.durationDays || 30} days
                    </span>
                  </div>
                </div>

                {/* Continuous Date Extension Explainer */}
                <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-3">
                  <RotateCcw className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Continuous Seamless Extension:</strong>
                    <span>
                      Renewing now appends {currentPlan.durationInDays || currentPlan.durationDays || 30} full days directly to your existing expiry date ({expiryFormatted}). You lose zero days and experience no disruption.
                    </span>
                  </div>
                </div>
              </div>

              {/* What is Included Checklist */}
              <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 space-y-2">
                <span className="text-xs font-bold text-[#667085] uppercase tracking-wider">
                  Features Included with this Plan
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#1E2930] dark:text-[#F3F4F6] pt-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>High-Speed Counter POS Terminal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Station-Bifurcated Kitchen KOT Printing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Live Floor Table Board & Merging</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Executive Revenue & GST Analytics</span>
                  </div>
                </div>
              </div>

              {/* Instant Renew Button */}
              {isOwner && (
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handlePayAndActivate(currentPlan, true)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#DE8626] to-[#CB741B] py-4 text-sm font-extrabold text-white shadow-xl shadow-[#DE8626]/25 hover:from-[#C4721C] hover:to-[#B66415] disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99]"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Processing Renewal...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4" />
                        <span>
                          Renew Current Plan Now (₹{currentPlan.finalPrice ?? currentPlan.price})
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EXPLORE OTHER PLANS */}
          {modalTab === 'explore' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6] uppercase tracking-wide">
                    Choose a Subscription Tier
                  </h3>
                  <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                    Compare features and select the tier best tailored to your operations
                  </p>
                </div>
                {isPlansLoading && (
                  <span className="flex items-center gap-1.5 text-xs text-[#DE8626]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Loading plans...</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;
                  const price = Number(plan.finalPrice ?? plan.price ?? 0);
                  const duration = plan.durationInDays || plan.durationDays || 30;
                  const isCurrent =
                    subscription &&
                    ((plan.id === (subscription as any)?.subscriptionPlanId) ||
                      (plan.subscriptionName && subscription.planName && plan.subscriptionName.toLowerCase() === subscription.planName.toLowerCase()));

                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`relative flex flex-col justify-between rounded-2xl border p-5 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#DE8626] bg-amber-500/5 shadow-md shadow-amber-500/10 ring-2 ring-[#DE8626]'
                          : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/50 dark:bg-[#151A20] hover:border-[#DE8626]/50'
                      }`}
                    >
                      {isCurrent && (
                        <div className="absolute top-3 right-3 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-extrabold text-emerald-600 uppercase">
                          Current Tier
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Crown className="h-4 w-4 text-[#DE8626]" />
                          <h4 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                            {plan.subscriptionName || plan.planName}
                          </h4>
                        </div>
                        <p className="mt-1 text-[11px] text-[#667085] dark:text-[#94A3B8] line-clamp-2">
                          {plan.description || 'Full POS, KOT printing, and multi-outlet table sync.'}
                        </p>

                        <div className="mt-4 flex items-baseline gap-1">
                          <span className="text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6]">
                            ₹{price}
                          </span>
                          <span className="text-[11px] text-[#667085]">/ {duration} days</span>
                        </div>

                        <div className="mt-4 space-y-1.5 border-t border-[#E7E1DA]/60 dark:border-[#2B3540]/60 pt-3 text-[11px] text-[#667085] dark:text-[#94A3B8]">
                          <div className="flex items-center gap-1.5">
                            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <span>Counter POS & Billing</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <span>Kitchen KOT Routing & Print</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <span>Live Floor Table Status</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <span>Daily Revenue Analytics</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-[#E7E1DA]/40 dark:border-[#2B3540]/40">
                        <span
                          className={`block w-full text-center text-xs font-bold py-2 rounded-xl transition-colors ${
                            isSelected
                              ? 'bg-[#DE8626] text-white shadow-sm'
                              : 'bg-black/5 dark:bg-white/5 text-[#667085] hover:text-[#1E2930]'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Select Plan'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Primary Action Button for Selected Plan */}
              {isOwner && selectedPlan && (
                <div className="pt-2 flex items-center justify-between gap-4 border-t border-[#E7E1DA] dark:border-[#2B3540] pt-4">
                  <div className="text-xs text-[#667085]">
                    <span>Selected Tier: </span>
                    <strong className="text-sm font-black text-[#1E2930] dark:text-[#F3F4F6]">
                      {selectedPlan.subscriptionName || selectedPlan.planName} (₹{selectedPlan.finalPrice ?? selectedPlan.price})
                    </strong>
                  </div>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handlePayAndActivate(selectedPlan, false)}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#DE8626] px-6 py-3 text-xs font-extrabold text-white shadow-lg shadow-[#DE8626]/20 hover:bg-[#C4721C] disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4" />
                        <span>
                          Activate {selectedPlan.subscriptionName || selectedPlan.planName} (₹{selectedPlan.finalPrice ?? selectedPlan.price})
                        </span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
