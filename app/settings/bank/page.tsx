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
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  QrCode,
  RefreshCw,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { usePosCatalogStore } from '@/stores/usePosCatalogStore';
import {
  RestaurantBankRemoteDataSource,
  RestaurantBankAccountResponse,
  VerifyBankAccountResponse,
} from '@shared/data/datasources/RestaurantBankRemoteDataSource';

const bankDataSource = new RestaurantBankRemoteDataSource();

export default function BankAccountPage() {
  const router = useRouter();
  const { activeRestaurant, restaurants } = useAuthStore();
  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);


  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [existingAccount, setExistingAccount] = useState<RestaurantBankAccountResponse | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerifyBankAccountResponse | null>(null);

  // Form Fields
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [printUpiQrOnReceipts, setPrintUpiQrOnReceipts] = useState(true);

  // Clean slate upon restaurant switch
  useEffect(() => {
    setExistingAccount(null);
    setAccountHolder('');
    setAccountNumber('');
    setConfirmAccountNumber('');
    setIfsc('');
    setBankName('');
    setUpiId('');
    setLoading(true);
  }, [currentRestId]);


  const gwConfig = bankDataSource.getPaymentGatewayConfig();

  const loadBank = useCallback(async () => {
    if (!currentRestId) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      const acc = await bankDataSource.getBankAccount(currentRestId);
      if (acc) {
        setExistingAccount(acc);
        setAccountHolder(acc.accountHolder || '');
        setIfsc(acc.ifsc || '');
        setBankName(acc.bankName || '');
        setUpiId(acc.upiId || '');
        if (acc.printUpiQrOnReceipts !== undefined) {
          setPrintUpiQrOnReceipts(acc.printUpiQrOnReceipts);
        }
      }
    } catch (err: any) {
      console.warn('Bank load error', err);
      setErrorMsg(err?.response?.data?.message || err?.message || 'Could not load existing bank details.');
    } finally {
      setLoading(false);
    }
  }, [currentRestId]);

  useEffect(() => {
    loadBank();
  }, [loadBank]);

  const handleVerifyAccount = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanAcct = accountNumber.trim();
    const cleanIfsc = ifsc.trim().toUpperCase();

    if (!cleanAcct) {
      setErrorMsg('Please enter the bank account number first to verify.');
      return;
    }

    if (cleanAcct.length < 9 || cleanAcct.length > 20) {
      setErrorMsg('Bank account numbers must typically be between 9 and 20 digits.');
      return;
    }

    if (confirmAccountNumber.trim() && cleanAcct !== confirmAccountNumber.trim()) {
      setErrorMsg('Bank account numbers do not match.');
      return;
    }

    if (cleanIfsc.length !== 11) {
      setErrorMsg('Please enter a valid 11-character IFSC code (e.g. HDFC0001234).');
      return;
    }

    try {
      setVerifying(true);
      const res = await bankDataSource.verifyBankAccount({
        accountNumber: cleanAcct,
        ifsc: cleanIfsc,
        accountHolder: accountHolder.trim() || undefined,
        restaurantId: currentRestId,
        isRazorpay: gwConfig.isRazorpay,
        gateway: gwConfig.gateway,
      });

      setVerificationResult(res);

      if (res.isValid) {
        if (res.registeredName && !accountHolder.trim()) {
          setAccountHolder(res.registeredName);
        }
        if (res.bankName && !bankName.trim()) {
          setBankName(res.bankName);
        }
      } else {
        setErrorMsg(res.message || 'Verification failed. Please check account number and IFSC.');
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Account verification encountered an error.');
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRestId) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    if (!accountNumber.trim()) {
      setErrorMsg('Please enter bank account number.');
      return;
    }

    if (accountNumber.trim() !== confirmAccountNumber.trim()) {
      setErrorMsg('Bank account numbers do not match.');
      return;
    }

    if (ifsc.trim().length !== 11) {
      setErrorMsg('Please enter a valid 11-character IFSC code.');
      return;
    }

    if (upiId.trim()) {
      const upiRegex = /^[\w.\-_]{2,256}@[a-zA-Z]{2,64}$/;
      if (!upiRegex.test(upiId.trim())) {
        setErrorMsg('Please enter a valid UPI ID format (e.g. restaurant@icici or 9876543210@paytm).');
        return;
      }
    }

    try {
      setSaving(true);

      await bankDataSource.registerBankAccount(currentRestId, {
        accountNumber: accountNumber.trim(),
        accountHolder: accountHolder.trim(),
        ifsc: ifsc.trim().toUpperCase(),
        bankName: bankName.trim() || undefined,
        upiId: upiId.trim() || undefined,
        printUpiQrOnReceipts,
        isRazorpay: gwConfig.isRazorpay,
        gateway: gwConfig.gateway,
      });

      const updated = await bankDataSource.getBankAccount(currentRestId);
      if (updated) {
        setExistingAccount(updated);
        if (updated.upiId) setUpiId(updated.upiId);
        if (updated.printUpiQrOnReceipts !== undefined) {
          setPrintUpiQrOnReceipts(updated.printUpiQrOnReceipts);
        }

        // Synchronize banker details into activeRestaurant session store
        const activeRest = useAuthStore.getState().activeRestaurant;
        if (activeRest) {
          useAuthStore.getState().setActiveRestaurant({
            ...activeRest,
            bankerUpiId: updated.upiId,
            bankerAccountHolderName: updated.accountHolder,
            printUpiQrOnReceipts: updated.printUpiQrOnReceipts,
          } as any);
        }

        // Invalidate and refresh POS catalog cache so new UPI ID is instantly live
        const currentCfg = usePosCatalogStore.getState().restaurantConfig;
        if (currentCfg) {
          usePosCatalogStore.getState().updateRestaurantConfig({
            ...currentCfg,
            bankerUpiId: updated.upiId,
            bankerAccountHolderName: updated.accountHolder,
            printUpiQrOnReceipts: updated.printUpiQrOnReceipts,
          });
        }
        usePosCatalogStore.getState().invalidateCatalog();
      }

      setSuccessMsg(
        `Bank account & UPI details successfully registered with ${gwConfig.gateway}! Dynamic QR is now active for settlements and receipt printing.`
      );
      setAccountNumber('');
      setConfirmAccountNumber('');
      setVerificationResult(null);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Failed to save bank account details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-2xl mx-auto">
          {/* Back link & Refresh */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/settings')}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Settings</span>
            </button>
            <button
              onClick={loadBank}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#667085] hover:text-[#DE8626] transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-[#DE8626]' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                Bank Account & QR Settlements
              </h1>
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-[#DE8626] border border-amber-500/20">
                {gwConfig.gateway} ROUTE
              </span>
            </div>
            <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8]">
              Link your restaurant bank checking account for 100% direct customer UPI payouts and dynamic receipt QR printing.
            </p>
          </div>

          {/* ACTIVE LINKED ACCOUNT BANNER */}
          {existingAccount && (
            <div className="rounded-2xl border border-emerald-300 dark:border-emerald-800/60 bg-emerald-500/10 p-4 space-y-1.5 text-xs shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Active Bank Account Linked</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/60 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300">
                  {existingAccount.status || 'ACTIVE'}
                </span>
              </div>
              <p className="text-[#1E2930] dark:text-[#F3F4F6] font-semibold text-sm">
                {existingAccount.accountHolder || 'Registered Restaurant'} • {existingAccount.accountNumberMasked || '••••••••'}
              </p>
              <p className="text-[#667085] dark:text-[#94A3B8] text-[11px]">
                IFSC: <strong className="text-[#1E2930] dark:text-[#F3F4F6]">{existingAccount.ifsc}</strong> • Bank: {existingAccount.bankName || 'Verified Bank'}
              </p>
              {existingAccount.upiId && (
                <p className="text-[#667085] dark:text-[#94A3B8] text-[11px] flex items-center gap-1.5 pt-0.5">
                  <QrCode className="h-3.5 w-3.5 text-[#DE8626]" />
                  <span>Banker UPI: <strong className="text-[#1E2930] dark:text-[#F3F4F6]">{existingAccount.upiId}</strong></span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    ({existingAccount.printUpiQrOnReceipts !== false ? 'QR Print Enabled' : 'QR Print Disabled'})
                  </span>
                </p>
              )}
            </div>
          )}

          {/* ALERTS */}
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 p-3.5 text-xs font-semibold text-red-700 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 p-3.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <Check className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* FORM */}
          <form onSubmit={handleSubmit} className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-[#E7E1DA] dark:border-[#2B3540]">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#DE8626]" />
                <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                  {existingAccount ? 'Update Settlement Bank & UPI' : 'Register New Bank Account'}
                </h3>
              </div>
              <span className="text-[10px] text-[#667085] dark:text-[#94A3B8] font-medium">
                Direct RestaurantConfig API
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                Account Holder Name (As per Bank Passbook) *
              </label>
              <input
                type="text"
                required
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                placeholder="e.g. Royal Spice Hospitality LLP"
                className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
              />
              <p className="mt-1 text-[11px] text-[#667085] dark:text-[#94A3B8]">
                Must match the official account name registered with your bank branch.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                Bank Account Number *
              </label>
              <input
                type="password"
                required
                value={accountNumber}
                onChange={(e) => {
                  setAccountNumber(e.target.value.replace(/[^0-9]/g, ''));
                  setVerificationResult(null);
                }}
                placeholder="Enter 9 to 18 digit bank account number"
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
                onChange={(e) => {
                  setConfirmAccountNumber(e.target.value.replace(/[^0-9]/g, ''));
                  setVerificationResult(null);
                }}
                placeholder="Re-enter bank account number"
                className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                  IFSC Code (11 characters) *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    maxLength={11}
                    value={ifsc}
                    onChange={(e) => {
                      setIfsc(e.target.value.toUpperCase().slice(0, 11));
                      setVerificationResult(null);
                    }}
                    placeholder="e.g. HDFC0001234"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyAccount}
                    disabled={verifying || !accountNumber.trim() || ifsc.trim().length !== 11}
                    className="shrink-0 flex items-center gap-1.5 rounded-xl border border-[#DE8626]/40 bg-[#DE8626]/10 px-3 py-2 text-xs font-bold text-[#DE8626] hover:bg-[#DE8626]/20 disabled:opacity-40 transition-colors"
                  >
                    {verifying ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    <span>{verifying ? 'Verifying...' : 'Penny Drop'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                  Bank Name (Optional)
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. HDFC Bank, Indiranagar"
                  className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                />
              </div>
            </div>

            {/* Verification Result Card */}
            {verificationResult && (
              <div
                className={`rounded-xl border p-3 text-xs space-y-1 ${
                  verificationResult.isValid
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300'
                    : 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 text-red-800 dark:text-red-300'
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  {verificationResult.isValid ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
                  )}
                  <span>
                    {verificationResult.isValid
                      ? `${gwConfig.gateway} Penny Drop Confirmed Active`
                      : 'Account Verification Failed'}
                  </span>
                </div>
                {verificationResult.registeredName && (
                  <p className="text-[11px]">
                    Official Registered Beneficiary: <strong>{verificationResult.registeredName}</strong>
                  </p>
                )}
                {verificationResult.bankName && (
                  <p className="text-[11px]">Bank: {verificationResult.bankName}</p>
                )}
                <p className="text-[10px] opacity-80">{verificationResult.message}</p>
              </div>
            )}

            {/* Banker UPI ID field */}
            <div>
              <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                Banker UPI ID / VPA (For Receipt QR Code)
              </label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value.toLowerCase().trim())}
                placeholder="e.g. restaurant@icici or 9876543210@paytm"
                className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
              />
              <p className="mt-1 text-[11px] text-[#667085] dark:text-[#94A3B8]">
                Customers can scan the printed QR code on receipts and guest checks to pay directly to this UPI ID.
              </p>
            </div>

            {/* Print Dynamic UPI QR Toggle */}
            <div className="flex items-start gap-3 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-3.5">
              <input
                type="checkbox"
                id="printUpiQrOnReceipts"
                checked={printUpiQrOnReceipts}
                onChange={(e) => setPrintUpiQrOnReceipts(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#DE8626] focus:ring-[#DE8626] cursor-pointer"
              />
              <label htmlFor="printUpiQrOnReceipts" className="text-xs select-none cursor-pointer">
                <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6] block">
                  Print UPI Payment QR Code on Receipts & Invoices
                </span>
                <span className="text-[#667085] dark:text-[#94A3B8] text-[11px] block mt-0.5">
                  When checked, Menza POS will dynamically generate and print the payment QR code with table, bill number, and amount on customer checks and tax receipts.
                </span>
              </label>
            </div>

            {/* Gateway Security Badge */}
            <div className="rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/20 p-3 text-[11px] text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <span>
                Account verification active via <strong>{gwConfig.gateway}</strong> (penny-drop validation). Account holder name will be verified against banking records and persisted directly into <code>RestaurantConfig</code>.
              </span>
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-2xl bg-[#DE8626] px-6 py-3 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] disabled:opacity-50 transition-all cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving to RestaurantConfig...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Save Bank Details</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
