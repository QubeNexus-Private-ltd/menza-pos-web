'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  FileText,
  Check,
  ArrowRight,
  LogOut,
  UtensilsCrossed,
  CreditCard,
  Lock,
  Building2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';

export default function TermsPage() {
  const router = useRouter();
  const { user, isAuthenticated, hasAcceptedTerms, isHydrating, acceptTerms, logout } = useAuthStore();
  const [isChecked, setIsChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If already accepted, route to dashboard immediately
  useEffect(() => {
    if (!isHydrating && isAuthenticated && hasAcceptedTerms) {
      router.replace('/dashboard');
    }
  }, [isHydrating, isAuthenticated, hasAcceptedTerms, router]);

  // If not authenticated, route to login
  useEffect(() => {
    if (!isHydrating && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isHydrating, isAuthenticated, router]);

  const handleAccept = async () => {
    if (!isChecked || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await acceptTerms();
      router.replace('/dashboard');
    } catch (err: any) {
      setErrorMsg(
        err?.message || 'Unable to record your acceptance. Please check your network connection and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to log out? Acceptance of the Terms of Service is required to access the Menza suite.')) {
      logout();
      router.replace('/login');
    }
  };

  if (isHydrating || !isAuthenticated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#FAF7F2] dark:bg-[#111418]">
        <Loader2 className="h-8 w-8 animate-spin text-[#DE8626]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#FAF7F2] dark:bg-[#111418] flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Ambient background glows */}
      <div className="fixed -top-40 -left-40 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      <div className="fixed -bottom-40 -right-40 h-96 w-96 rounded-full bg-amber-600/10 blur-3xl pointer-events-none" />

      <div className="relative max-w-4xl w-full mx-auto flex-1 flex flex-col my-auto">
        {/* Header Card */}
        <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 sm:p-8 shadow-xl shadow-amber-950/5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#E7E1DA] dark:border-[#2B3540]">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-[#DE8626] text-xs font-bold tracking-wider mb-3">
                <ShieldCheck className="h-4 w-4" />
                <span>MERCHANT COMPLIANCE & TERMS</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E2930] dark:text-[#F3F4F6] tracking-tight">
                Terms of Service & Merchant Agreement
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-[#667085] dark:text-[#94A3B8] leading-relaxed max-w-2xl">
                Welcome to Menza, <span className="font-semibold text-[#1E2930] dark:text-[#F3F4F6]">{user?.name || 'Partner'}</span>. Please review and accept our Merchant Terms and Operating Policies to activate your restaurant operations and access your POS terminal.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-[#667085] dark:text-[#94A3B8] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                title="Log out from Menza"
              >
                <LogOut className="h-4 w-4" />
                <span>Log Out</span>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 p-4 text-xs text-red-700 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="font-medium leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {/* Terms Content Sections */}
          <div className="mt-6 max-h-[440px] overflow-y-auto pr-2 space-y-4 rounded-2xl bg-[#FAF7F2]/60 dark:bg-[#151A20]/60 p-4 sm:p-6 border border-[#E7E1DA]/80 dark:border-[#2B3540]/80">
            {/* Section 1 */}
            <div className="rounded-xl bg-white dark:bg-[#1B2127] p-4 sm:p-5 border border-[#E7E1DA] dark:border-[#2B3540] shadow-xs">
              <div className="flex items-center gap-2.5 font-bold text-sm text-[#1E2930] dark:text-[#F3F4F6] mb-2">
                <Building2 className="h-4 w-4 text-[#DE8626]" />
                <span>1. Merchant Licensing & Legal Representation</span>
              </div>
              <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed">
                By utilizing the Menza Restaurant Management Suite, you warrant that your dining establishment holds all mandatory statutory licenses, including valid FSSAI food safety registrations, local municipal health trade licenses, and Goods and Services Tax (GST) registrations where required. You assume full legal responsibility for food preparation, hygiene, raw material sourcing, and fair trade practices.
              </p>
            </div>

            {/* Section 2 */}
            <div className="rounded-xl bg-white dark:bg-[#1B2127] p-4 sm:p-5 border border-[#E7E1DA] dark:border-[#2B3540] shadow-xs">
              <div className="flex items-center gap-2.5 font-bold text-sm text-[#1E2930] dark:text-[#F3F4F6] mb-2">
                <UtensilsCrossed className="h-4 w-4 text-[#DE8626]" />
                <span>2. POS, KOT & Financial Record Keeping</span>
              </div>
              <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed">
                Menza provides high-speed cloud point-of-sale (POS), table-side ordering, and kitchen display automation. You agree that all customer receipts, tax breakdowns (CGST/SGST), kitchen order tickets (KOT), and audit logs created via your store credentials reflect authentic business operations. You remain responsible for configuring accurate tax percentages and item pricing.
              </p>
            </div>

            {/* Section 3 */}
            <div className="rounded-xl bg-white dark:bg-[#1B2127] p-4 sm:p-5 border border-[#E7E1DA] dark:border-[#2B3540] shadow-xs">
              <div className="flex items-center gap-2.5 font-bold text-sm text-[#1E2930] dark:text-[#F3F4F6] mb-2">
                <CreditCard className="h-4 w-4 text-[#DE8626]" />
                <span>3. Payment Gateways, Settlements & Refunds</span>
              </div>
              <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed">
                Online ordering, QR table-top payments, and digital wallet collections facilitated through Cashfree and affiliated gateways are bound by RBI guidelines and payment gateway agreements. Settlement frequencies, processing charges, customer refund claims, and dispute reconciliations are processed according to merchant bank account arrangements.
              </p>
            </div>

            {/* Section 4 */}
            <div className="rounded-xl bg-white dark:bg-[#1B2127] p-4 sm:p-5 border border-[#E7E1DA] dark:border-[#2B3540] shadow-xs">
              <div className="flex items-center gap-2.5 font-bold text-sm text-[#1E2930] dark:text-[#F3F4F6] mb-2">
                <Lock className="h-4 w-4 text-[#DE8626]" />
                <span>4. Customer Privacy & Indian DPDP Act Compliance</span>
              </div>
              <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed">
                Customer mobile numbers, dining records, and payment metadata collected through Menza must be handled with strict confidentiality pursuant to the Digital Personal Data Protection (DPDP) Act. You agree not to distribute, sell, or disclose patron contact data to unauthorized third parties or use it for unsolicited spam campaigns.
              </p>
            </div>

            {/* Section 5 */}
            <div className="rounded-xl bg-white dark:bg-[#1B2127] p-4 sm:p-5 border border-[#E7E1DA] dark:border-[#2B3540] shadow-xs">
              <div className="flex items-center gap-2.5 font-bold text-sm text-[#1E2930] dark:text-[#F3F4F6] mb-2">
                <FileText className="h-4 w-4 text-[#DE8626]" />
                <span>5. Service Availability & Platform Updates</span>
              </div>
              <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed">
                Menza provides continuous cloud syncing, multi-terminal routing, and analytics. Operating terminals must maintain reliable internet connectivity for real-time kitchen routing and catalog sync. Menza regularly updates software to improve security, reliability, and regulatory compliance.
              </p>
            </div>
          </div>

          {/* Interactive Acceptance Section */}
          <div className="mt-6 pt-6 border-t border-[#E7E1DA] dark:border-[#2B3540] space-y-5">
            <label className="flex items-start gap-3.5 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => setIsChecked(e.target.checked)}
                className="mt-1 h-4 w-4 rounded-md border-gray-300 text-[#DE8626] focus:ring-[#DE8626] cursor-pointer"
              />
              <span className="text-xs sm:text-sm text-[#1E2930] dark:text-[#F3F4F6] font-medium leading-relaxed">
                I have read, understood, and accept the <span className="text-[#DE8626] font-semibold">Menza Merchant Terms of Service</span>, Privacy Policy, and Operational Agreement on behalf of my restaurant entity.
              </span>
            </label>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                Acceptance is required to activate and operate your restaurant suite.
              </p>

              <button
                type="button"
                onClick={handleAccept}
                disabled={!isChecked || isSubmitting}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl font-bold text-xs sm:text-sm text-white transition-all shadow-md ${
                  isChecked && !isSubmitting
                    ? 'bg-[#DE8626] hover:bg-[#C9751D] shadow-amber-900/20 cursor-pointer'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed shadow-none'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Recording Acceptance...</span>
                  </>
                ) : (
                  <>
                    <span>Accept & Continue</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-[#667085] dark:text-[#94A3B8]">
          &copy; {new Date().getFullYear()} Menza Restaurant Suite. All rights reserved.
        </p>
      </div>
    </div>
  );
}
