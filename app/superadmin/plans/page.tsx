'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Crown,
  Plus,
  ArrowLeft,
  Check,
  X,
  Sparkles,
  RefreshCw,
  Power,
  Layers,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { SubscriptionService } from '@/services/subscriptionService';
import { SubscriptionPlan } from '@/types/subscription';

export default function SuperAdminPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Plan Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [planCode, setPlanCode] = useState('');
  const [planName, setPlanName] = useState('');
  const [price, setPrice] = useState('');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [durationInDays, setDurationInDays] = useState('30');
  const [billingCycle, setBillingCycle] = useState('MONTHLY');
  const [description, setDescription] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      const list = await SubscriptionService.getPlans();
      setPlans(list);
    } catch (err) {
      console.warn('Plans fetch error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const handleTogglePlan = async (plan: SubscriptionPlan) => {
    try {
      const res = await SubscriptionService.togglePlanStatus(plan.id, !plan.isActive);
      if (res.success) {
        setPlans((prev) =>
          prev.map((p) => (p.id === plan.id ? { ...p, isActive: !p.isActive } : p))
        );
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to toggle plan status');
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planCode.trim() || !planName.trim() || !price) {
      alert('Please fill in code, name, and price.');
      return;
    }

    try {
      setSavingPlan(true);
      const res = await SubscriptionService.createPlan({
        subscriptionCode: planCode.trim(),
        subscriptionName: planName.trim(),
        planName: planName.trim(),
        price: parseFloat(price),
        discountAmount: parseFloat(discountAmount) || 0,
        finalPrice: Math.max(0, parseFloat(price) - (parseFloat(discountAmount) || 0)),
        durationInDays: parseInt(durationInDays, 10) || 30,
        durationDays: parseInt(durationInDays, 10) || 30,
        billingCycle,
        description: description.trim(),
        allowTableOrdering: true,
        allowCounterOrdering: true,
        allowSelfPickup: true,
        allowDelivery: true,
        allowKds: true,
        allowOnlinePayment: true,
        isActive: true,
      });

      if (res.success) {
        await loadPlans();
        setCreateModalOpen(false);
        setPlanCode('');
        setPlanName('');
        setPrice('');
        setDescription('');
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
                Configure billing tiers, duration periods, and feature entitlements for restaurant clients
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadPlans}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3.5 py-2 text-xs font-semibold hover:bg-black/5"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Sync</span>
              </button>

              <button
                onClick={() => setCreateModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-[#DE8626] px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-[#C4721C]"
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
                No subscription plans configured. Click "Create Plan Tier" to add one.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#667085] dark:text-[#94A3B8]">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold">Plan Code</th>
                      <th className="py-3.5 px-4 font-semibold">Plan Name</th>
                      <th className="py-3.5 px-4 font-semibold">Billing Cycle</th>
                      <th className="py-3.5 px-4 font-semibold">Price (₹)</th>
                      <th className="py-3.5 px-4 font-semibold">Duration</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60">
                    {plans.map((p) => (
                      <tr key={p.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#DE8626]">
                          {p.subscriptionCode}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-sm text-[#1E2930] dark:text-[#F3F4F6]">
                            {p.subscriptionName || p.planName}
                          </p>
                          {p.description && (
                            <p className="text-[10px] text-[#667085] line-clamp-1">{p.description}</p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-[#667085] font-semibold">
                          {p.billingCycle || 'Monthly'}
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-sm text-[#1E2930] dark:text-[#F3F4F6]">
                          ₹{p.finalPrice ?? p.price}
                        </td>
                        <td className="py-3.5 px-4 text-[#667085]">
                          {p.durationInDays || 30} Days
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleTogglePlan(p)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold ${
                              p.isActive
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : 'bg-red-500/10 text-red-600'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${p.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            <span>{p.isActive ? 'Active' : 'Inactive'}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Create Plan Modal */}
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">Create Subscription Tier</h3>
                <button onClick={() => setCreateModalOpen(false)} className="rounded-lg p-1 text-[#667085]">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreatePlan} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                    Plan Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={planCode}
                    onChange={(e) => setPlanCode(e.target.value.toUpperCase())}
                    placeholder="e.g. ENTERPRISE_PRO"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
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
                    placeholder="e.g. Enterprise Pro Suite"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                      Price (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="1999"
                      className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                      Duration (Days) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={durationInDays}
                      onChange={(e) => setDurationInDays(e.target.value)}
                      placeholder="30"
                      className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                    Plan Description
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Full restaurant POS, KOT printing, and analytics."
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="flex-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] py-2.5 text-xs font-semibold text-[#667085]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPlan}
                    className="flex-1 rounded-xl bg-[#DE8626] py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#C4721C] disabled:opacity-50"
                  >
                    {savingPlan ? 'Creating...' : 'Create Tier'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AppShell>
    </AuthGuard>
  );
}
