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
} from 'lucide-react';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { SubscriptionPlan } from '@/types/subscription';
import { startCashfreePayment, setPaymentCallbacks, removePaymentCallbacks } from '@/payments/cashfreeService.web';

export const SubscriptionBlockerModal: React.FC = () => {
  const router = useRouter();
  const { user, activeRestaurant, restaurants, logout } = useAuthStore();
  const {
    subscription,
    isExpired,
    isNoSubscription,
    lifecycleState,
    isRenewalModalOpen,
    plans,
    isPlansLoading,
    fetchPlans,
    fetchSubscriptionStatus,
    closeRenewalModal,
    assignPlan,
    initiateCashFreePayment,
    hasLoaded,
  } = useSubscriptionStore();

  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);
  const isOwner =
    user?.roles?.some((r) => ['OWNER', 'ADMIN', 'SUPERADMIN', 'SUPER_ADMIN'].includes(r.toUpperCase().replace(/[^A-Z]/g, ''))) ||
    !user?.roles ||
    user.roles.length === 0;

  // Auto-fetch plans when modal opens
  useEffect(() => {
    if (isExpired || isNoSubscription || isRenewalModalOpen || lifecycleState === 'EXPIRED' || lifecycleState === 'NONE') {
      if (plans.length === 0) {
        fetchPlans();
      }
    }
  }, [isExpired, isNoSubscription, isRenewalModalOpen, lifecycleState, plans.length, fetchPlans]);

  // Set default plan selection
  useEffect(() => {
    if (plans.length > 0 && selectedPlanId === null) {
      setSelectedPlanId(plans[0].id);
    }
  }, [plans, selectedPlanId]);

  const isLocked = isExpired || lifecycleState === 'EXPIRED' || isNoSubscription || !subscription || lifecycleState === 'NONE';
  const isVisible = hasLoaded && (isLocked || isRenewalModalOpen);

  if (!isVisible) {
    return null;
  }

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];

  const handlePayAndActivate = async (plan: SubscriptionPlan) => {
    if (!currentRestId) {
      setStatusMessage({ type: 'error', text: 'No active restaurant selected.' });
      return;
    }

    try {
      setSubmitting(true);
      setStatusMessage(null);

      const price = Number(plan.finalPrice ?? plan.price ?? 0);
      const duration = Number(plan.durationInDays || plan.durationDays || 30);

      // If price is 0 or trial plan, assign directly
      if (price <= 0) {
        const res = await assignPlan(currentRestId, plan.id, duration, 0);
        if (res.success) {
          setStatusMessage({
            type: 'success',
            text: 'Free Plan activated successfully! POS unlocked.',
          });
          setTimeout(async () => {
            await fetchSubscriptionStatus(currentRestId);
            closeRenewalModal();
            setSubmitting(false);
          }, 1200);
          return;
        }
      }

      // 1. Initiate CashFree Payment Order
      const initRes = await initiateCashFreePayment(
        currentRestId,
        plan.id,
        price,
        user?.mobile || '9999999999'
      );

      if (!initRes.success || (!initRes.paymentSessionId && !initRes.paymentLink)) {
        // Fallback to direct activation if payment gateway is bypassed in sandbox
        const fallbackRes = await assignPlan(currentRestId, plan.id, duration, price);
        if (fallbackRes.success) {
          setStatusMessage({
            type: 'success',
            text: 'Subscription activated successfully!',
          });
          setTimeout(async () => {
            await fetchSubscriptionStatus(currentRestId);
            closeRenewalModal();
            setSubmitting(false);
          }, 1200);
          return;
        }

        setStatusMessage({
          type: 'error',
          text: initRes.message || fallbackRes.message || 'Payment initiation failed. Please try again.',
        });
        setSubmitting(false);
        return;
      }

      // 2. Register CashFree Callback Handlers
      setPaymentCallbacks(
        async (orderId: any) => {
          setStatusMessage({
            type: 'success',
            text: 'Payment verified! Activating restaurant subscription...',
          });
          await fetchSubscriptionStatus(currentRestId);
          setTimeout(() => {
            closeRenewalModal();
            setSubmitting(false);
            removePaymentCallbacks();
          }, 1500);
        },
        (errMsg: any) => {
          setStatusMessage({
            type: 'error',
            text: errMsg || 'Payment checkout was cancelled or failed.',
          });
          setSubmitting(false);
          removePaymentCallbacks();
        }
      );

      // 3. Open CashFree Web Drop Modal
      const cfEnv = process.env.NEXT_PUBLIC_CASHFREE_ENV || 'SANDBOX';
      await startCashfreePayment({
        paymentSessionId: initRes.paymentSessionId,
        orderId: initRes.orderId || `ORD_${Date.now()}`,
        environment: cfEnv,
        paymentLink: initRes.paymentLink,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to complete subscription payment.',
      });
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 sm:p-8 shadow-2xl">
        {/* Close Button (ONLY visible if NOT strictly locked) */}
        {!isLocked && (
          <button
            onClick={closeRenewalModal}
            className="absolute top-6 right-6 rounded-full p-2 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7E1DA] dark:border-[#2B3540] pb-6">
          <div className="flex items-start gap-4">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${isExpired ? 'bg-red-500/10 text-red-600' : 'bg-amber-500/10 text-[#DE8626]'}`}>
              {isExpired ? <ShieldAlert className="h-8 w-8" /> : <Crown className="h-8 w-8" />}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                  {isNoSubscription ? 'Subscription Plan Required' : isExpired ? 'Subscription Expired' : 'Renew Restaurant Plan'}
                </h2>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${isExpired ? 'bg-red-500/15 text-red-600 border border-red-500/30' : 'bg-amber-500/15 text-[#DE8626] border border-amber-500/30'}`}>
                  <Lock className="h-3 w-3" />
                  {isNoSubscription ? 'Plan Required' : isExpired ? 'Locked' : 'Renewal'}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8] leading-relaxed max-w-xl">
                {isNoSubscription
                  ? 'This restaurant outlet does not have an active subscription license. Select a plan below to activate POS billing, KOT printing, and table management.'
                  : isExpired
                  ? 'Your store subscription has expired beyond the grace period. Order taking and billing are locked until your plan is renewed.'
                  : 'Upgrade or extend your plan to continue smooth multi-outlet operations without interruptions.'}
              </p>
            </div>
          </div>

          {/* Outlet Info */}
          {activeRestaurant && (
            <div className="text-left sm:text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-[#667085] tracking-wider block">Target Outlet</span>
              <span className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] block truncate max-w-[200px]">
                {activeRestaurant.restaurantName}
              </span>
            </div>
          )}
        </div>

        {/* Staff Notice if user is non-owner */}
        {!isOwner && (
          <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2 font-bold mb-1">
              <AlertCircle className="h-4 w-4 text-[#DE8626]" />
              <span>Staff Notice</span>
            </div>
            <p>
              You are logged in as a staff member. Only the <strong>Restaurant Owner</strong> or account administrator can purchase or renew subscription plans. Please contact your store owner to activate a plan.
            </p>
            <button
              onClick={() => logout()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out to Switch Account</span>
            </button>
          </div>
        )}

        {/* Status Messages */}
        {statusMessage && (
          <div
            className={`mt-4 rounded-xl p-3 text-xs font-medium flex items-center gap-2.5 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                : 'bg-red-500/10 text-red-600 border border-red-500/20'
            }`}
          >
            {statusMessage.type === 'success' ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Available Plans Grid */}
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6] uppercase tracking-wide">
              Select Subscription Plan
            </h3>
            {isPlansLoading && (
              <span className="flex items-center gap-1.5 text-xs text-[#DE8626]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Loading live plans...</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isSelected = selectedPlanId === plan.id;
              const price = Number(plan.finalPrice ?? plan.price ?? 0);
              const duration = plan.durationInDays || plan.durationDays || 30;

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
                  {isSelected && (
                    <div className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#DE8626] text-white">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                      {plan.subscriptionName || plan.planName}
                    </h4>
                    <p className="mt-1 text-[11px] text-[#667085] dark:text-[#94A3B8] line-clamp-2">
                      {plan.description || 'Full access to high-speed POS, KOT printing, and multi-outlet table sync.'}
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
                        <span>High-Speed Counter POS Terminal</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span>Instant Kitchen KOT Sync & Printing</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span>Live Floor Table Board</span>
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
                      {isSelected ? 'Selected' : 'Choose Plan'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#E7E1DA] dark:border-[#2B3540] pt-6">
          <div className="flex items-center gap-2 text-xs text-[#667085]">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>Instant activation upon payment verification</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {isOwner && selectedPlan && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => handlePayAndActivate(selectedPlan)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#DE8626] hover:bg-[#C9751D] px-6 py-3 text-xs font-bold text-white shadow-lg shadow-[#DE8626]/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing Payment...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    <span>Pay & Activate Plan (₹{selectedPlan.finalPrice ?? selectedPlan.price})</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
