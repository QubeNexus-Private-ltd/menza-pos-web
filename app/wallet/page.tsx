'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  RefreshCw,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Sparkles,
  AlertCircle,
  FileText,
  IndianRupee,
  X,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@/stores/useAuthStore';
import { WebWalletService, RestaurantWalletDTO, WalletTransactionDTO } from '@/services/walletService';

export default function WalletPage() {
  const { activeRestaurant, restaurants, user } = useAuthStore();
  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);

  const [wallet, setWallet] = useState<RestaurantWalletDTO | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionDTO[]>([]);
  const [loading, setLoading] = useState(true);

  // Recharge Modal
  const [rechargeModalOpen, setRechargeModalOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState<number>(1000);
  const [isRecharging, setIsRecharging] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentRestId) return;
    try {
      setLoading(true);
      const [wRes, txRes] = await Promise.allSettled([
        WebWalletService.getWallet(currentRestId),
        WebWalletService.getStatement(currentRestId),
      ]);

      if (wRes.status === 'fulfilled') {
        setWallet(wRes.value);
      }
      if (txRes.status === 'fulfilled') {
        setTransactions(txRes.value);
      }
    } catch (err) {
      console.warn('Failed to load wallet data', err);
    } finally {
      setLoading(false);
    }
  }, [currentRestId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInitiateRecharge = async () => {
    if (rechargeAmount < 100) {
      alert('Minimum recharge amount is ₹100.');
      return;
    }

    try {
      setIsRecharging(true);
      const res = await WebWalletService.initiateRecharge(currentRestId, rechargeAmount, user?.mobile || '9999999999');
      if (res.paymentLink) {
        window.open(res.paymentLink, '_blank');
      } else {
        // Simulated local topup if in test/sandbox
        setPaymentSuccess(true);
        setTimeout(() => {
          setRechargeModalOpen(false);
          setPaymentSuccess(false);
          loadData();
        }, 1500);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to initiate recharge');
    } finally {
      setIsRecharging(false);
    }
  };

  const isHealthy = (wallet?.balance || 0) >= (wallet?.lowBalanceThreshold || 200);

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                  Prepaid Commission & SMS Wallet
                </h1>
                <span
                  className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                    isHealthy
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-red-500/10 text-red-600'
                  }`}
                >
                  {isHealthy ? 'Healthy Balance' : 'Low Balance'}
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-[#667085] dark:text-[#94A3B8]">
                Prepaid wallet ledger for transactional SMS, WhatsApp receipts, and commission deductions
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3.5 py-2 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                onClick={() => setRechargeModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-[#DE8626] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Top Up Wallet</span>
              </button>
            </div>
          </div>

          {/* KPI Wallet Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Balance Card */}
            <div className="rounded-2xl border border-[#DE8626]/30 bg-gradient-to-br from-[#FFF4E5] to-[#FFFFFF] dark:from-[#2A1E11] dark:to-[#1B2127] p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider">
                  Available Balance
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DE8626] text-white shadow-md shadow-[#DE8626]/30">
                  <Wallet className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <h2 className="text-3xl font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  ₹{Number(wallet?.balance || 0).toLocaleString('en-IN')}
                </h2>
                <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8]">
                  Threshold: ₹{wallet?.lowBalanceThreshold || 200}
                </p>
              </div>
            </div>

            {/* Total Recharged */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider">
                  Total Recharges
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <ArrowDownLeft className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <h2 className="text-3xl font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  ₹{Number(wallet?.totalRecharged || 0).toLocaleString('en-IN')}
                </h2>
                <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8]">
                  Lifetime credits via Cashfree
                </p>
              </div>
            </div>

            {/* Deductions / Commissions */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider">
                  Total Deductions
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <h2 className="text-3xl font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  ₹{Number(wallet?.totalCommissionPaid || 0).toLocaleString('en-IN')}
                </h2>
                <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8]">
                  SMS, WhatsApp & order commission
                </p>
              </div>
            </div>
          </div>

          {/* Statement & Ledger Passbook */}
          <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                  Transaction Passbook & Statement
                </h3>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                  Audit trail of all wallet credits, top-ups, and service debits
                </p>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-[#667085]">Loading transactions...</div>
            ) : transactions.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#667085] dark:text-[#94A3B8]">
                No wallet transactions recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E7E1DA] dark:border-[#2B3540] text-[#667085] dark:text-[#94A3B8]">
                    <tr>
                      <th className="pb-3 font-semibold">Txn ID / Ref</th>
                      <th className="pb-3 font-semibold">Description</th>
                      <th className="pb-3 font-semibold">Type</th>
                      <th className="pb-3 font-semibold">Amount</th>
                      <th className="pb-3 font-semibold">Balance After</th>
                      <th className="pb-3 font-semibold text-right">Date & Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60">
                    {transactions.map((tx) => {
                      const isCredit = tx.direction === 'CREDIT';
                      return (
                        <tr key={tx.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                          <td className="py-3 font-mono text-[11px] text-[#667085]">
                            {tx.paymentReference || tx.id.slice(0, 12)}
                          </td>
                          <td className="py-3 font-semibold text-[#1E2930] dark:text-[#F3F4F6]">
                            {tx.description}
                          </td>
                          <td className="py-3">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                                isCredit
                                  ? 'bg-emerald-500/10 text-emerald-600'
                                  : 'bg-red-500/10 text-red-600'
                              }`}
                            >
                              {tx.transactionType}
                            </span>
                          </td>
                          <td className={`py-3 font-extrabold ${isCredit ? 'text-emerald-600' : 'text-red-500'}`}>
                            {isCredit ? `+₹${tx.amount}` : `-₹${tx.amount}`}
                          </td>
                          <td className="py-3 font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                            ₹{tx.balanceAfter}
                          </td>
                          <td className="py-3 text-right text-[#667085]">
                            {new Date(tx.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
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

        {/* Top Up Recharge Modal */}
        {rechargeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-[#DE8626]">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">Top Up Wallet</h3>
                </div>
                <button
                  onClick={() => setRechargeModalOpen(false)}
                  className="rounded-lg p-1 text-[#667085] hover:bg-black/5"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {paymentSuccess ? (
                <div className="py-8 text-center space-y-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 mx-auto">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <h4 className="text-base font-bold text-emerald-600">Recharge Successful!</h4>
                  <p className="text-xs text-[#667085]">Your wallet has been credited with ₹{rechargeAmount}</p>
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold mb-2 text-[#667085]">Select Quick Amount</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[500, 1000, 2000, 5000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setRechargeAmount(amt)}
                          className={`rounded-xl py-2.5 font-bold transition-all ${
                            rechargeAmount === amt
                              ? 'bg-[#DE8626] text-white shadow-md shadow-[#DE8626]/20'
                              : 'border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#1E2930] dark:text-[#F3F4F6]'
                          }`}
                        >
                          ₹{amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Custom Amount (₹)</label>
                    <input
                      type="number"
                      min={100}
                      value={rechargeAmount}
                      onChange={(e) => setRechargeAmount(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-2.5 font-bold text-sm outline-none focus:border-[#DE8626]"
                    />
                  </div>

                  <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3 text-[11px] text-[#667085] dark:text-[#94A3B8]">
                    <div className="flex items-center gap-1.5 font-bold text-[#DE8626] mb-1">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Instant Cashfree Gateway</span>
                    </div>
                    <span>Supports UPI (Google Pay, PhonePe, Paytm), Netbanking, and Debit/Credit Cards.</span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E7E1DA] dark:border-[#2B3540]">
                    <button
                      type="button"
                      onClick={() => setRechargeModalOpen(false)}
                      className="rounded-xl border border-[#E7E1DA] px-4 py-2 font-semibold text-[#667085]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isRecharging}
                      onClick={handleInitiateRecharge}
                      className="rounded-xl bg-[#DE8626] px-5 py-2 font-bold text-white shadow-md hover:bg-[#C4721C] disabled:opacity-50"
                    >
                      {isRecharging ? 'Redirecting to Gateway...' : `Proceed to Pay ₹${rechargeAmount}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </AppShell>
    </AuthGuard>
  );
}
