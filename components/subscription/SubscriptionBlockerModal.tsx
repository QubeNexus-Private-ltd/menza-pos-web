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
} from 'lucide-react';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { SubscriptionPlan } from '@/types/subscription';

export const SubscriptionBlockerModal: React.FC = () => {
  const router = useRouter();
  const { activeRestaurant, restaurants } = useAuthStore();
  const {
    isExpired,
    lifecycleState,
    isRenewalModalOpen,
    plans,
    isPlansLoading,
    fetchPlans,
    closeRenewalModal,
    assignPlan,
    hasLoaded,
  } = useSubscriptionStore();

  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);

  // Auto-fetch plans when modal opens
  useEffect(() => {
    if (isExpired || isRenewalModalOpen) {
      if (plans.length === 0) {
        fetchPlans();
      }
    }
  }, [isExpired, isRenewalModalOpen, plans.length, fetchPlans]);

  // Set default plan selection
  useEffect(() => {
    if (plans.length > 0 && selectedPlanId === null) {
      setSelectedPlanId(plans[0].id);
    }
  }, [plans, selectedPlanId]);

  const isLocked = isExpired || lifecycleState === 'EXPIRED';
  const isVisible = hasLoaded && (isLocked || isRenewalModalOpen);

  if (!isVisible) {
    return null;
  }

  const handlePayAndActivate = async (plan: SubscriptionPlan) => {
    if (!currentRestId) {
      setStatusMessage({ type: 'error', text: 'No active restaurant selected.' });
      return;
    }

    try {
      setSubmitting(true);
      setStatusMessage(null);

      const price = plan.finalPrice ?? plan.price;
      const duration = plan.durationInDays || plan.durationDays || 30;

      const res = await assignPlan(currentRestId, plan.id, duration, price);

      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: 'Payment verified! Subscription activated successfully.',
        });
        setTimeout(() => {
          closeRenewalModal();
          setStatusMessage(null);
        }, 1200);
      } else {
        setStatusMessage({
          type: 'error',
          text: res.message || 'Payment activation failed. Please try again.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to complete subscription payment.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 sm:p-8 shadow-2xl text-[#1E2930] dark:text-[#F3F4F6]">
        {/* Close Button only if voluntary renewal and not locked */}
        {!isLocked && (
          <button
            onClick={closeRenewalModal}
            className="absolute top-6 right-6 rounded-xl p-2 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* Modal Header */}
        <div className="flex flex-col items-center text-center max-w-xl mx-auto">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-red-500/20 border border-amber-500/30 text-[#DE8626] mb-4 shadow-lg shadow-amber-500/10">
            {isLocked ? <Lock className="h-8 w-8 text-red-500 animate-bounce" /> : <Crown className="h-8 w-8 text-[#DE8626]" />}
          </div>

          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wider mb-2 ${
            isLocked
              ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
              : 'bg-amber-500/10 text-[#DE8626] border border-amber-500/20'
          }`}>
            <ShieldAlert className="h-3.5 w-3.5" />
            {isLocked ? 'Subscription Required • POS Locked' : 'Renew Store Plan'}
          </span>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
            {isLocked ? 'Pay For Subscription' : 'Upgrade or Extend Plan'}
          </h2>

          <p className="mt-2 text-xs sm:text-sm text-[#667085] dark:text-[#94A3B8]">
            {isLocked
              ? `The license for "${activeRestaurant?.restaurantName || 'Active Outlet'}" has ended. Complete your plan payment below to unlock operations, order taking, and KOT dispatch.`
              : `Select a plan for "${activeRestaurant?.restaurantName || 'Active Outlet'}" to ensure uninterrupted service.`}
          </p>
        </div>

        {/* Status Messages */}
        {statusMessage && (
          <div
            className={`mt-6 flex items-center gap-2.5 rounded-2xl p-4 text-xs font-semibold ${
              statusMessage.type === 'success'
                ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Plan Cards Grid */}
        <div className="mt-8">
          {isPlansLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#DE8626]" />
            </div>
          ) : plans.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#E7E1DA] dark:border-[#2B3540] p-8 text-center text-xs text-[#667085]">
              No plans available. Please contact support or system administrator.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {plans.map((plan) => {
                const isSelected = selectedPlanId === plan.id;
                const price = plan.finalPrice ?? plan.price;
                const duration = plan.durationInDays || plan.durationDays || 30;

                return (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`relative flex flex-col justify-between rounded-3xl border p-5 sm:p-6 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#DE8626] bg-amber-500/[0.04] dark:bg-amber-500/[0.08] shadow-lg shadow-amber-500/10 ring-2 ring-[#DE8626]/30'
                        : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] hover:border-amber-400'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#DE8626] px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-md">
                        Selected Plan
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#DE8626]">
                          {plan.billingCycle || 'Standard'}
                        </span>
                        {plan.includedWalletCredit && plan.includedWalletCredit > 0 ? (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                            +₹{plan.includedWalletCredit} Credit
                          </span>
                        ) : null}
                      </div>

                      <h3 className="text-lg font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                        {plan.subscriptionName || plan.planName}
                      </h3>
                      <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1 min-h-[32px] line-clamp-2">
                        {plan.description || 'Full POS terminal, KOT printing, menu management & live tables.'}
                      </p>

                      <div className="my-4 flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                          ₹{price}
                        </span>
                        <span className="text-xs text-[#667085]">
                          / {duration} days
                        </span>
                      </div>

                      <div className="space-y-2 border-t border-[#E7E1DA]/60 dark:border-[#2B3540]/60 pt-4 text-xs text-[#667085] dark:text-[#94A3B8]">
                        <div className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <span>POS Terminal &amp; Billing</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <span>Kitchen KOT Realtime Sync</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <span>Table Orders &amp; Menu Catalog</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <span>Sales &amp; Tax Settlement</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPlanId(plan.id);
                        handlePayAndActivate(plan);
                      }}
                      className={`mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-xs font-bold transition-all shadow-md ${
                        isSelected
                          ? 'bg-gradient-to-r from-[#DE8626] to-[#B7791F] text-white shadow-amber-500/25 hover:brightness-105'
                          : 'border border-[#DE8626] text-[#DE8626] hover:bg-amber-500/10'
                      }`}
                    >
                      {submitting && isSelected ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Activating Plan...</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4" />
                          <span>Pay &amp; Activate Plan</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="mt-6 flex items-center justify-between border-t border-[#E7E1DA] dark:border-[#2B3540] pt-4 text-xs text-[#667085] dark:text-[#94A3B8]">
          <p>Instant activation upon payment • 100% secure processing</p>
          <button
            onClick={() => {
              closeRenewalModal();
              router.push('/settings/billing');
            }}
            className="font-bold text-[#DE8626] hover:underline"
          >
            View Full Billing Details
          </button>
        </div>
      </div>
    </div>
  );
};
