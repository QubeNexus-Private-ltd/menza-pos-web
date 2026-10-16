'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  TrendingUp,
  Coins,
  Percent,
  Plus,
  ArrowUpRight,
  Store,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  Loader2,
  ReceiptIndianRupee as Receipt,
  Download,
  Info,
  Building,
  CreditCard,
  Gift,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { SalesService } from '@/services/salesService';
import {
  SalesEarningsSummary,
  SalesEarningRecord,
  SalesEarningTriggerType,
} from '@/types/sales';

export default function SalesEarningsPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [summary, setSummary] = useState<SalesEarningsSummary | null>(null);
  const [ledger, setLedger] = useState<SalesEarningRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilterTab, setActiveFilterTab] = useState<'ALL' | SalesEarningTriggerType>('ALL');

  useEffect(() => {
    const salesPersonId = (user as any)?.salesPersonId || (user as any)?.id || (user as any)?.userId || 0;
    Promise.all([
      SalesService.getEarningsSummary(salesPersonId),
      SalesService.getEarningsLedger(salesPersonId),
    ])
      .then(([sum, txns]) => {
        setSummary(sum);
        setLedger(txns);
      })
      .catch((err) => console.warn('Failed to load earnings', err))
      .finally(() => setLoading(false));
  }, [(user as any)?.salesPersonId, (user as any)?.id, (user as any)?.userId]);

  // Filtered ledger records
  const filteredLedger = useMemo(() => {
    if (activeFilterTab === 'ALL') return ledger;
    if (activeFilterTab === 'FIRST_RECHARGE_BONUS') {
      return ledger.filter(
        (item) =>
          item.triggerType === 'FIRST_RECHARGE_BONUS' ||
          item.triggerType === 'STORE_ONBOARD' ||
          item.triggerType === 'ONBOARDING'
      );
    }
    return ledger.filter((item) => item.triggerType === activeFilterTab);
  }, [ledger, activeFilterTab]);

  // Calculate Breakdown
  const breakdown = useMemo(() => {
    let rechargeTotal = 0;
    let orderFeeTotal = 0;
    let bonusTotal = 0;

    ledger.forEach((item) => {
      if (item.triggerType === 'RECHARGE') rechargeTotal += item.commissionAmount;
      else if (item.triggerType === 'ORDER_FEE') orderFeeTotal += item.commissionAmount;
      else bonusTotal += item.commissionAmount;
    });

    return { rechargeTotal, orderFeeTotal, bonusTotal };
  }, [ledger]);

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7E1DA] dark:border-[#2B3540] pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Wallet className="h-4 w-4" />
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6] tracking-tight">
                  Partner Earnings & Commission
                </h1>
              </div>
              <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1">
                Real-time commission ledger accrued from restaurant wallet recharges and order platform fee take-rates
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => router.push('/superadmin/onboard')}
                className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-800 transition-all"
              >
                <Plus className="h-4 w-4 stroke-[3]" />
                <span>ONBOARD NEW OUTLET</span>
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Lifetime Earnings */}
            <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#667085] dark:text-[#94A3B8]">
                Lifetime Earnings
              </span>
              <p className="text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6] mt-2">
                ₹{(summary?.totalLifetimeEarnings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                ✓ Across {summary?.totalOnboardedCount || 0} referral stores
              </p>
            </div>

            {/* Unpaid / Available for Payout */}
            <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Pending Payout Balance
              </span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                ₹{(summary?.unpaidBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] font-medium mt-1">
                Auto-settled to registered UPI/Bank
              </p>
            </div>

            {/* This Month Earnings */}
            <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#667085] dark:text-[#94A3B8]">
                This Month's Accrual
              </span>
              <p className="text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6] mt-2">
                ₹{(summary?.currentMonthEarnings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              {summary && summary.lastMonthEarnings > 0 ? (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>
                    {(((summary.currentMonthEarnings - summary.lastMonthEarnings) / summary.lastMonthEarnings) * 100) >= 0 ? '+' : ''}
                    {(((summary.currentMonthEarnings - summary.lastMonthEarnings) / summary.lastMonthEarnings) * 100).toFixed(0)}% vs last month
                  </span>
                </p>
              ) : (
                <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] font-medium mt-1">
                  Current billing period
                </p>
              )}
            </div>

            {/* Paid Out Total */}
            <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#667085] dark:text-[#94A3B8]">
                Settled & Withdrawn
              </span>
              <p className="text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6] mt-2">
                ₹{(summary?.paidBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] font-medium mt-1">
                Transferred to bank
              </p>
            </div>
          </div>

          {/* Active Formula & Earning Rules Banner */}
          {summary?.activeFormula && (
            <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 sm:p-6 shadow-xs">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-600">
                      Your Active Commission Formula
                    </span>
                    <span className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold uppercase">
                      {summary.activeFormula.commissionModel}
                    </span>
                  </div>
                  <h3 className="text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                    {summary.activeFormula.formulaName}
                  </h3>
                  <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                    Configured and governed by SuperAdmin for partner attribution code <strong>{summary.partnerCode || 'Active'}</strong>
                  </p>
                </div>

                {/* Formula Breakdown Chips */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs">
                    <span className="text-[10px] text-[#667085] block font-bold uppercase">RECHARGE TAKE</span>
                    <strong className="text-amber-700 dark:text-amber-300 font-extrabold text-sm">
                      {summary.activeFormula.rechargeCommissionPercent}%
                    </strong>
                  </div>

                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs">
                    <span className="text-[10px] text-[#667085] block font-bold uppercase">PLATFORM FEE SHARE</span>
                    <strong className="text-blue-700 dark:text-blue-300 font-extrabold text-sm">
                      {summary.activeFormula.platformFeeSharePercent}%
                    </strong>
                  </div>

                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs">
                    <span className="text-[10px] text-[#667085] block font-bold uppercase">1ST TOP-UP BOUNTY</span>
                    <strong className="text-emerald-700 dark:text-emerald-300 font-extrabold text-sm">
                      ₹{summary.activeFormula.firstRechargeBonusAmount}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Revenue Breakdown Category Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-[#DE8626]">
                <Coins className="h-5 w-5" />
              </span>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">
                  Recharge Cuts Total
                </span>
                <p className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  ₹{breakdown.rechargeTotal.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                <Percent className="h-5 w-5" />
              </span>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">
                  Order Platform Fee Cuts
                </span>
                <p className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  ₹{breakdown.orderFeeTotal.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <Gift className="h-5 w-5" />
              </span>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">
                  Onboarding Milestone Bonuses
                </span>
                <p className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  ₹{breakdown.bonusTotal.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Transaction Ledger Table Section */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <h2 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                Itemized Commission Ledger
              </h2>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-1">
                {[
                  { id: 'ALL', label: 'All Events' },
                  { id: 'RECHARGE', label: 'Recharges' },
                  { id: 'ORDER_FEE', label: 'Order Fees' },
                  { id: 'FIRST_RECHARGE_BONUS', label: 'Bonuses' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveFilterTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all ${
                      activeFilterTab === tab.id
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-[#667085] hover:text-[#1E2930]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] shadow-xs overflow-hidden">
              {loading ? (
                <div className="py-16 text-center text-xs text-[#667085] flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                  <span>Loading commission ledger...</span>
                </div>
              ) : filteredLedger.length === 0 ? (
                <div className="py-16 text-center text-xs text-[#667085] space-y-2">
                  <Receipt className="h-10 w-10 text-[#667085]/40 mx-auto" />
                  <p className="font-bold text-sm text-[#1E2930] dark:text-[#F3F4F6]">No transactions recorded</p>
                  <p className="text-xs text-[#667085]">Commission transactions will appear as onboarded stores recharge and punch orders.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[10px] font-black uppercase tracking-wider text-[#667085] dark:text-[#94A3B8]">
                      <tr>
                        <th className="py-3.5 px-5">Date & Time</th>
                        <th className="py-3.5 px-4">Restaurant Outlet</th>
                        <th className="py-3.5 px-4">Trigger Event</th>
                        <th className="py-3.5 px-4">Base Amount</th>
                        <th className="py-3.5 px-4">Applied Formula</th>
                        <th className="py-3.5 px-4">Commission</th>
                        <th className="py-3.5 px-5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60">
                      {filteredLedger.map((txn) => (
                        <tr
                          key={txn.id}
                          className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                        >
                          {/* Date */}
                          <td className="py-4 px-5 font-mono text-[#667085]">
                            {new Date(txn.createdAt).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                            <span className="block text-[10px] text-[#94A3B8]">
                              {new Date(txn.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </td>

                          {/* Restaurant */}
                          <td className="py-4 px-4">
                            <div>
                              <p className="font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                                {txn.restaurantName}
                              </p>
                              <span className="font-mono text-[10px] text-[#667085]">
                                Outlet #{txn.restaurantId}
                              </span>
                            </div>
                          </td>

                          {/* Trigger Event */}
                          <td className="py-4 px-4">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                                txn.triggerType === 'RECHARGE'
                                  ? 'bg-amber-500/10 text-[#DE8626] border border-amber-500/20'
                                  : txn.triggerType === 'ORDER_FEE'
                                  ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20'
                                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                              }`}
                            >
                              {txn.triggerType === 'RECHARGE' ? (
                                <>
                                  <Coins className="h-3 w-3" />
                                  <span>Wallet Recharge</span>
                                </>
                              ) : txn.triggerType === 'ORDER_FEE' ? (
                                <>
                                  <Percent className="h-3 w-3" />
                                  <span>Order Take-Rate</span>
                                </>
                              ) : (
                                <>
                                  <Gift className="h-3 w-3" />
                                  <span>Onboard Bounty</span>
                                </>
                              )}
                            </span>
                            {txn.referenceId && (
                              <span className="block font-mono text-[10px] text-[#667085] mt-0.5">
                                Ref: {txn.referenceId}
                              </span>
                            )}
                          </td>

                          {/* Base Value */}
                          <td className="py-4 px-4 font-mono font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                            ₹{txn.baseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>

                          {/* Applied Formula */}
                          <td className="py-4 px-4 text-[#667085] dark:text-[#94A3B8] text-[11px]">
                            {txn.appliedFormula}
                          </td>

                          {/* Earned Commission */}
                          <td className="py-4 px-4 font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                            +₹{txn.commissionAmount.toFixed(2)}
                          </td>

                          {/* Status */}
                          <td className="py-4 px-5 text-right">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                                txn.payoutStatus === 'PAID'
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                              }`}
                            >
                              {txn.payoutStatus === 'PAID' ? 'Settled' : 'Accrued'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
