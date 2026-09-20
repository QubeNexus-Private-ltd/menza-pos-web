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
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { SubscriptionRemoteDataSource } from '@shared/data/datasources/SubscriptionRemoteDataSource';
import { SubscriptionPlan, UserSubscriptionStatus } from '@shared/domain/models/Subscription';

const subscriptionDataSource = new SubscriptionRemoteDataSource();

export default function SubscriptionBillingPage() {
  const router = useRouter();
  const { activeRestaurant, restaurants } = useAuthStore();
  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);

  const [loading, setLoading] = useState(true);
  const [activeSub, setActiveSub] = useState<UserSubscriptionStatus | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);

  const loadData = useCallback(async () => {
    if (!currentRestId) return;
    try {
      setLoading(true);
      const [subRes, plansRes] = await Promise.allSettled([
        subscriptionDataSource.getRestaurantSubscription(currentRestId),
        subscriptionDataSource.getPlans(),
      ]);

      if (subRes.status === 'fulfilled') setActiveSub(subRes.value);
      if (plansRes.status === 'fulfilled' && Array.isArray(plansRes.value)) {
        setPlans(plansRes.value.filter((p) => p.isActive));
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

          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
              Subscription Plan & Licensing
            </h1>
            <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8]">
              Manage your active Menza tier, renewal dates, billing cycles, and feature entitlements
            </p>
          </div>

          {/* Active Subscription Status Banner */}
          <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-[#DE8626]">
                  <Crown className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                      {activeSub?.planName || 'Enterprise POS License'}
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                        activeSub?.isExpired
                          ? 'bg-red-500/10 text-red-600'
                          : 'bg-emerald-500/10 text-emerald-600'
                      }`}
                    >
                      {activeSub?.status || 'Active'}
                    </span>
                  </div>
                  <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1">
                    Valid for {activeRestaurant?.restaurantName || 'Active Store'} • Auto-Renew Enabled
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-[#FAF7F2] dark:bg-[#151A20] p-3 text-right">
                <span className="text-[11px] font-medium text-[#667085]">Days Remaining</span>
                <p className="text-xl font-extrabold text-[#DE8626]">
                  {activeSub?.daysRemaining !== undefined ? activeSub.daysRemaining : 365} Days
                </p>
              </div>
            </div>
          </div>

          {/* Available Subscription Tiers */}
          <div>
            <h2 className="text-sm font-bold text-[#667085] uppercase tracking-wider mb-4">
              Available Store Plans
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex flex-col justify-between rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-sm hover:border-[#DE8626] hover:shadow-md transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-[#DE8626] uppercase tracking-wider">
                        {plan.billingCycle || 'Monthly'}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                      {plan.subscriptionName || plan.planName}
                    </h3>
                    <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1 min-h-[32px]">
                      {plan.description || 'Full POS, KOT ticketing, digital catalog, and reports.'}
                    </p>

                    <div className="my-5 flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                        ₹{plan.finalPrice ?? plan.price}
                      </span>
                      <span className="text-xs text-[#667085]">
                        / {plan.durationInDays || 30} days
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
                        <span>Executive Revenue & GST Reports</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>Multi-Role Staff Access Security</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => alert('To upgrade or renew your plan, please contact your store account administrator.')}
                    className="mt-6 w-full rounded-2xl border border-[#DE8626] bg-amber-500/10 py-3 text-xs font-bold text-[#DE8626] hover:bg-[#DE8626] hover:text-white transition-all"
                  >
                    Select Plan
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
