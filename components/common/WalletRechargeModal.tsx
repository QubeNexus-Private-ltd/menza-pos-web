'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  X,
  Plus,
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Loader2,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
  History,
} from 'lucide-react';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { WebWalletService, RestaurantWalletDTO, WalletTransactionDTO } from '@/services/walletService';
import { PaymentGatewayService } from '@/payments/paymentGatewayService.web';
import { WalletEvents } from '@shared/core/utils/walletEvents';

const PRESET_AMOUNTS = [500, 1000, 2000, 5000];

interface WalletRechargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId?: number;
  onRechargeSuccess?: () => void;
  initialTab?: 'recharge' | 'history';
}

export const WalletRechargeModal: React.FC<WalletRechargeModalProps> = ({
  isOpen,
  onClose,
  restaurantId: propRestId,
  onRechargeSuccess,
  initialTab = 'recharge',
}) => {
  const { activeRestaurant, restaurants, user } = useAuthStore();
  const currentRestId =
    propRestId ||
    activeRestaurant?.restaurantId ||
    (restaurants.length > 0 ? restaurants[0].restaurantId : 0);

  const [activeTab, setActiveTab] = useState<'recharge' | 'history'>(initialTab);
  const [wallet, setWallet] = useState<RestaurantWalletDTO | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionDTO[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [selectedAmount, setSelectedAmount] = useState<number>(1000);
  const [customAmountText, setCustomAmountText] = useState<string>('1000');
  const [submitting, setSubmitting] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    if (!currentRestId || !isOpen) return;
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
        setTransactions(txRes.value || []);
      }
    } catch (err) {
      console.warn('Failed to load wallet data in modal', err);
    } finally {
      setLoading(false);
    }
  }, [currentRestId, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setStatusMessage(null);
      loadData();
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  const handleSelectPreset = (amt: number) => {
    setSelectedAmount(amt);
    setCustomAmountText(amt.toString());
    setStatusMessage(null);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[^0-9]/g, '');
    setCustomAmountText(cleaned);
    const parsed = parseInt(cleaned, 10);
    setSelectedAmount(!isNaN(parsed) && parsed > 0 ? parsed : 0);
    setStatusMessage(null);
  };

  const handleInitiateRecharge = async () => {
    if (selectedAmount < 100) {
      setStatusMessage({ type: 'error', text: 'Minimum recharge amount is ₹100.' });
      return;
    }

    if (!currentRestId) {
      setStatusMessage({ type: 'error', text: 'Please select an active restaurant outlet first.' });
      return;
    }

    try {
      setSubmitting(true);
      setStatusMessage(null);

      const res = await WebWalletService.initiateRecharge(
        currentRestId,
        selectedAmount,
        user?.mobile || '9999999999'
      );

      if (!res.success || !res.orderId) {
        setStatusMessage({
          type: 'error',
          text: res.message || 'Could not initiate recharge order. Please try again.',
        });
        setSubmitting(false);
        return;
      }

      // Check isRazorpay: if true, opens Razorpay Checkout modal; else opens Cashfree Drop modal
      const paymentResult = await PaymentGatewayService.startPayment({
        orderId: res.orderId,
        amount: selectedAmount,
        currency: res.currency || 'INR',
        gateway: res.gateway,
        keyId: res.keyId,
        paymentSessionId: res.paymentSessionId,
        paymentLink: res.paymentLink,
        customerName: activeRestaurant?.restaurantName || user?.name || 'Restaurant Owner',
        customerPhone: user?.mobile || activeRestaurant?.ownerMobile || '9999999999',
        customerEmail: (user as any)?.email || 'billing@menza.com',
        orderNotes: `Platform Fee Wallet Top-up (₹${selectedAmount})`,
      });

      if (!paymentResult.success) {
        setStatusMessage({
          type: 'error',
          text: paymentResult.error || 'Payment checkout was cancelled or failed.',
        });
        setSubmitting(false);
        return;
      }

      // Verify and credit wallet in database
      const verifyRes = await WebWalletService.verifyRecharge(
        res.orderId,
        currentRestId,
        selectedAmount,
        paymentResult.razorpayPaymentId,
        paymentResult.razorpaySignature
      );

      if (verifyRes.success) {
        setStatusMessage({
          type: 'success',
          text: `Success! ₹${selectedAmount.toLocaleString('en-IN')} credited to your wallet.`,
        });
        WalletEvents.emit();
        onRechargeSuccess?.();
        await loadData();
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setStatusMessage({
          type: 'error',
          text: verifyRes.message || 'Recharge verification pending. Contact support if debited.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to complete wallet recharge.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCsv = async () => {
    if (!transactions.length) {
      alert('No transactions available to export.');
      return;
    }

    try {
      setExportingCsv(true);
      const headers = ['Date', 'Type', 'Amount', 'Reference', 'Description', 'Balance'];
      const rows = transactions.map((t) => [
        new Date(t.createdAt).toLocaleString('en-IN'),
        t.direction || t.transactionType,
        t.amount,
        t.paymentReference || '',
        `"${(t.description || '').replace(/"/g, '""')}"`,
        t.balanceAfter,
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Wallet_Statement_${activeRestaurant?.restaurantName || 'Menza'}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Export failed', err);
    } finally {
      setExportingCsv(false);
    }
  };

  const balance = Number(wallet?.balance ?? 0);
  const lowThreshold = Number(wallet?.lowBalanceThreshold ?? 200);
  const isLowBalance = balance < lowThreshold;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E7E1DA] dark:border-[#2B3540] px-6 py-5 bg-[#FAF7F2] dark:bg-[#151A20]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-[#DE8626]">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  Prepaid Platform Wallet
                </h2>
                {isLowBalance && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-[#DE8626]">
                    Low Balance
                  </span>
                )}
              </div>
              <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                {activeRestaurant?.restaurantName || 'Active Restaurant'} • Live Balance: <strong>₹{balance.toLocaleString('en-IN')}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#E7E1DA] dark:border-[#2B3540] px-6 bg-white dark:bg-[#1B2127]">
          <button
            onClick={() => setActiveTab('recharge')}
            className={`flex items-center gap-2 border-b-2 py-3 text-xs font-bold transition-colors ${
              activeTab === 'recharge'
                ? 'border-[#DE8626] text-[#DE8626]'
                : 'border-transparent text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
            }`}
          >
            <Plus className="h-4 w-4" />
            <span>Top Up Wallet</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-bold transition-colors ${
              activeTab === 'history'
                ? 'border-[#DE8626] text-[#DE8626]'
                : 'border-transparent text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Ledger History ({transactions.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Status Message Alert */}
          {statusMessage && (
            <div
              className={`rounded-2xl p-3.5 text-xs font-medium flex items-center gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-600 border border-red-500/20'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {activeTab === 'recharge' ? (
            <div className="space-y-5">
              {/* Wallet Balance Hero Card */}
              <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-[#667085] dark:text-[#94A3B8]">
                    Current Usable Balance
                  </span>
                  <p className="text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6] mt-0.5">
                    ₹{balance.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="text-right text-[11px] text-[#667085] dark:text-[#94A3B8]">
                  <span>Threshold: </span>
                  <span className="font-bold text-[#DE8626]">₹{lowThreshold}</span>
                </div>
              </div>

              {/* Preset Amounts Grid */}
              <div>
                <label className="block text-xs font-bold text-[#667085] uppercase tracking-wider mb-2">
                  Select Recharge Amount
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {PRESET_AMOUNTS.map((amt) => {
                    const isSelected = selectedAmount === amt;
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleSelectPreset(amt)}
                        className={`rounded-xl border py-3 text-center text-sm font-extrabold transition-all ${
                          isSelected
                            ? 'border-[#DE8626] bg-[#DE8626] text-white shadow-md shadow-[#DE8626]/20'
                            : 'border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626]'
                        }`}
                      >
                        ₹{amt.toLocaleString('en-IN')}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Amount Field */}
              <div>
                <label className="block text-xs font-bold text-[#667085] uppercase tracking-wider mb-2">
                  Or Custom Amount (₹)
                </label>
                <div className="relative flex items-center rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-3 focus-within:border-[#DE8626] focus-within:ring-2 focus-within:ring-[#DE8626]/20 transition-all">
                  <span className="text-base font-bold text-[#DE8626] mr-2">₹</span>
                  <input
                    type="text"
                    value={customAmountText}
                    onChange={handleCustomChange}
                    placeholder="Enter amount (Min ₹100)"
                    className="w-full bg-transparent text-lg font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-none"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-[#667085]">
                  Minimum recharge is ₹100. Money is credited instantly upon payment confirmation.
                </p>
              </div>

              {/* Reassurances */}
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>Supports UPI, Cards, NetBanking, and Wallets with 100% Secure Payment Gateways.</span>
              </div>
            </div>
          ) : (
            /* History / Ledger Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#667085] uppercase tracking-wider">
                  Recent Ledger Transactions
                </span>
                {transactions.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    disabled={exportingCsv}
                    className="flex items-center gap-1.5 rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-2.5 py-1 text-xs font-semibold text-[#667085] hover:text-[#DE8626] hover:border-[#DE8626] transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download CSV</span>
                  </button>
                )}
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-[#667085]">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-[#DE8626]" />
                  <span>Loading ledger statements...</span>
                </div>
              ) : transactions.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#667085]">
                  No wallet transactions recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60 max-h-72 overflow-y-auto rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540]">
                  {transactions.map((tx) => {
                    const isCredit = (tx.direction || tx.transactionType)?.toUpperCase() === 'CREDIT';
                    return (
                      <div key={tx.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                              isCredit ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                            }`}
                          >
                            {isCredit ? (
                              <ArrowDownLeft className="h-4 w-4" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-[#1E2930] dark:text-[#F3F4F6] truncate">
                              {tx.description || (isCredit ? 'Wallet Top-Up' : 'Commission Deduction')}
                            </p>
                            <p className="text-[10px] text-[#667085] mt-0.5">
                              {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              • Ref: {tx.paymentReference || 'Direct'}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p
                            className={`font-black ${
                              isCredit ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {isCredit ? '+' : '-'}₹{Number(tx.amount).toLocaleString('en-IN')}
                          </p>
                          <p className="text-[10px] text-[#667085]">
                            Bal: ₹{Number(tx.balanceAfter).toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {activeTab === 'recharge' && (
          <div className="border-t border-[#E7E1DA] dark:border-[#2B3540] px-6 py-4 bg-[#FAF7F2] dark:bg-[#151A20] flex items-center justify-between">
            <div className="text-xs text-[#667085]">
              <span>Recharge Amount: </span>
              <strong className="text-sm font-black text-[#1E2930] dark:text-[#F3F4F6]">
                ₹{selectedAmount.toLocaleString('en-IN')}
              </strong>
            </div>

            <button
              type="button"
              disabled={submitting || selectedAmount < 100}
              onClick={handleInitiateRecharge}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#DE8626] px-6 py-3 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.99]"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing Payment...</span>
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  <span>Pay & Top Up ₹{selectedAmount.toLocaleString('en-IN')}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
