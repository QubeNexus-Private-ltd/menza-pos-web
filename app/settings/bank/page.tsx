'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CreditCard,
  ArrowLeft,
  Save,
  Check,
  Building2,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@/stores/useAuthStore';
import { BankService } from '@/services/bankService';
import { RestaurantBankAccountResponse } from '@/types/bank';

export default function BankAccountPage() {
  const router = useRouter();
  const { activeRestaurant, restaurants } = useAuthStore();
  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [existingAccount, setExistingAccount] = useState<RestaurantBankAccountResponse | null>(null);

  // Form
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');

  const loadBank = useCallback(async () => {
    if (!currentRestId) return;
    try {
      setLoading(true);
      const acc = await BankService.getBankAccount(currentRestId);
      if (acc) {
        setExistingAccount(acc);
        setAccountHolder(acc.accountHolder || '');
        setIfsc(acc.ifsc || '');
        setBankName(acc.bankName || '');
      }
    } catch (err) {
      console.warn('Bank load error', err);
    } finally {
      setLoading(false);
    }
  }, [currentRestId]);

  useEffect(() => {
    loadBank();
  }, [loadBank]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRestId) return;

    if (!accountNumber.trim()) {
      alert('Please enter bank account number.');
      return;
    }

    if (accountNumber.trim() !== confirmAccountNumber.trim()) {
      alert('Bank account numbers do not match.');
      return;
    }

    if (ifsc.trim().length !== 11) {
      alert('Please enter a valid 11-character IFSC code.');
      return;
    }

    try {
      setSaving(true);
      setSuccessMsg(null);

      await BankService.registerBankAccount(currentRestId, {
        accountNumber: accountNumber.trim(),
        accountHolder: accountHolder.trim(),
        ifsc: ifsc.trim().toUpperCase(),
        bankName: bankName.trim() || undefined,
      });

      const updated = await BankService.getBankAccount(currentRestId);
      if (updated) {
        setExistingAccount(updated);
      }
      setSuccessMsg('Bank account registered successfully for automated settlements!');
      setAccountNumber('');
      setConfirmAccountNumber('');
    } catch (err: any) {
      alert(err?.message || 'Failed to save bank account details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-2xl mx-auto">
          <button
            onClick={() => router.push('/settings')}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Settings</span>
          </button>

          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
              Bank Account & Payout Settlements
            </h1>
            <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8]">
              Link your restaurant business checking account for automated UPI & card payouts
            </p>
          </div>

          {existingAccount && (
            <div className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-500/10 p-4 space-y-1 text-xs">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="h-4 w-4" />
                <span>Active Bank Account Linked</span>
              </div>
              <p className="text-[#1E2930] dark:text-[#F3F4F6] font-semibold">
                {existingAccount.accountHolder || 'Registered Account'} • {existingAccount.accountNumberMasked || '••••••••'}
              </p>
              <p className="text-[#667085] dark:text-[#94A3B8]">
                IFSC: {existingAccount.ifsc} • Bank: {existingAccount.bankName || 'Verified Bank'}
              </p>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 p-3.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <Check className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
              {existingAccount ? 'Update Bank Account Details' : 'Register New Bank Account'}
            </h3>

            <div>
              <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                Account Holder Name (As per Bank Passbook) *
              </label>
              <input
                type="text"
                required
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                placeholder="e.g. Menza Hospitality LLP"
                className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                Account Number *
              </label>
              <input
                type="password"
                required
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Enter bank account number"
                className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                Confirm Account Number *
              </label>
              <input
                type="text"
                required
                value={confirmAccountNumber}
                onChange={(e) => setConfirmAccountNumber(e.target.value)}
                placeholder="Re-enter bank account number"
                className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                  IFSC Code (11 characters) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={11}
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                  placeholder="e.g. HDFC0001234"
                  className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                  Bank Name (Optional)
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. HDFC Bank"
                  className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-2xl bg-[#DE8626] px-6 py-3 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] disabled:opacity-50 transition-all"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? 'Saving...' : 'Save Bank Details'}</span>
              </button>
            </div>
          </form>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
