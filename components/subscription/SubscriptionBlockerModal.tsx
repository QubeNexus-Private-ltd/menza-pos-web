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
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { SubscriptionPlan } from '@/types/subscription';

export const SubscriptionBlockerModal: React.FC = () => {
  const router = useRouter();
  const { activeRestaurant, restaurants, logout } = useAuthStore();
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

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] shadow-2xl">
        {/* Close Button - Only allowed if not hard-locked */}
        {!isLocked && (
          <button
            onClick={closeRenewalModal}
            className="absolute top-4 right-4 z-10 rounded-full p-2 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* Modal Header */}
        <div className="border-b border-[#E7E1DA] dark:border-[#2B3540] bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#DE8626]/20 border border-[#DE8626]/30 text-[#DE8626]">
            {isLocked ? <Lock className="h-7 w-7 text-red-500" /> : <Crown className="h-7 w-7 text-[#DE8626]" />}
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
            {isLocked ? 'Store Subscription Expired' : 'Renew Store Subscription'}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-[#667085] dark:text-[#94A3B8] max-w-md mx-auto">
            {isLocked
              ? `Operations for "${activeRestaurant?.restaurantName || 'this store'}" are locked. Please pay for a subscription to resume billing and orders.`
              : `Select a plan to renew or upgrade licensing for "${activeRestaurant?.restaurantName || 'this store'}".`}
          </p>
        </div>

        {/* Status feedback message */}
        {statusMessage && (
          <div
            className={`mx-6 mt-4 flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                : 'bg-red-500/10 text-red-600 border border-red-500/20'
            }`}
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Plan Cards */}
        <div className="p-6 space-y-4">
          {isPlansLoading && plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#DE8626]" />
              <p className="text-xs text-[#667085]">Fetching subscription plans...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {plans.map((plan) => {
                const isSelected = plan.id === selectedPlanId;
                const price = plan.finalPrice ?? plan.price;
                const days = plan.durationInDays || plan.durationDays || 30;

                return (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`cursor-pointer rounded-2xl border p-4 transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#DE8626] bg-amber-500/5 shadow-md shadow-amber-500/10 ring-1 ring-[#DE8626]'
                        : 'border-[#E7E1DA] dark:border-[#2B3540] hover:border-amber-400/50 bg-[#FAF7F2]/50 dark:bg-[#151A20]/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#DE8626]">
                          {plan.billingCycle || `${days} Days`}
                        </span>
                        {isSelected && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#DE8626] text-white">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                        {plan.subscriptionName || plan.planName}
                      </h3>

                      <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8] line-clamp-2">
                        {plan.description || 'Full POS terminal, KOT printing, menu management & reports.'}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#E7E1DA]/60 dark:border-[#2B3540]/60 flex items-baseline justify-between">
                      <div>
                        <span className="text-xl font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                          ₹{price}
                        </span>
                        <span className="text-[10px] text-[#667085] ml-1">
                          / {days} days
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPlanId(plan.id);
                          handlePayAndActivate(plan);
                        }}
                        disabled={submitting}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-[#DE8626] text-white hover:bg-[#C4721C] shadow-sm'
                            : 'border border-[#DE8626] text-[#DE8626] hover:bg-amber-500/10'
                        }`}
                      >
                        {submitting && isSelected ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          'Pay & Renew'
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Feature Highlights of Selected Plan */}
          {selectedPlan && (
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 text-xs">
              <p className="font-bold text-[#1E2930] dark:text-[#F3F4F6] mb-2 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-[#DE8626]" />
                <span>Included in {selectedPlan.subscriptionName || selectedPlan.planName}:</span>
              </p>
              <div className="grid grid-cols-2 gap-2 text-[#667085] dark:text-[#94A3B8]">
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Unlimited POS & KOT Billing</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Live Floor Table Sync</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Real-Time Kitchen KDS</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Revenue & GST Analytics</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/60 dark:bg-[#151A20]/60 p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[#667085]">
            <CreditCard className="h-4 w-4 text-[#DE8626]" />
            <span>Instant activation upon payment confirmation</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isLocked && (
              <button
                onClick={() => {
                  logout();
                  router.replace('/login');
                }}
                className="w-full sm:w-auto rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] px-4 py-2 text-xs font-semibold text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6] hover:bg-black/5 dark:hover:bg-white/5 transition-all"
              >
                Log Out
              </button>
            )}

            {selectedPlan && (
              <button
                onClick={() => handlePayAndActivate(selectedPlan)}
                disabled={submitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#DE8626] px-5 py-2 text-xs font-bold text-white shadow-lg shadow-amber-500/20 hover:bg-[#C4721C] transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Processing Payment...</span>
                  </>
                ) : (
                  <>
                    <span>Pay for Subscription (₹{selectedPlan.finalPrice ?? selectedPlan.price})</span>
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
