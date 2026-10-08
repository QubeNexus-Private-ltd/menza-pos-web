'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  Building2,
  UtensilsCrossed,
  CreditCard,
  Lock,
  LogOut,
  ArrowRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { isOwnerUser } from '@/lib/auth/permissions';
import { logger } from '@/lib/logger';

export function TermsConsentCard() {
  const { user, activeRestaurant, hasAcceptedTerms, acceptTerms, logout } = useAuthStore();
  const [isChecked, setIsChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Consent is strictly required ONLY for the Owner role
  const isOwner = isOwnerUser(user?.roles);

  // If user is not an owner or has already accepted terms, do not render
  if (!isOwner || hasAcceptedTerms) {
    return null;
  }

  const handleAccept = async () => {
    if (!isChecked || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      logger.info('Owner accepted Terms & Conditions consent card', { userId: user?.userId });
      await acceptTerms();
    } catch (err: any) {
      setErrorMsg(
        err?.message || 'Unable to record your acceptance. Please check your internet connection and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to log out? Accepting the Terms & Conditions is required to operate Menza as an owner.')) {
      logout();
      window.location.href = '/login';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 sm:p-8 shadow-2xl space-y-5">
        {/* Header */}
        <div className="text-center flex flex-col items-center">
          <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-amber-500/10 text-[#DE8626] mb-3">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#DE8626] mb-1">
            Owner Terms & Consent
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#1E2930] dark:text-[#F3F4F6] tracking-tight">
            Terms & Conditions
          </h2>
          <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8] leading-relaxed max-w-sm">
            Welcome, <span className="font-semibold text-[#1E2930] dark:text-[#F3F4F6]">{user?.name || 'Partner'}</span>. Please review and accept the operating conditions to activate and use the application.
          </p>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 p-3 text-xs text-red-700 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="font-medium leading-relaxed">{errorMsg}</p>
          </div>
        )}

        {/* Scrollable Summary Box */}
        <div className="max-h-48 overflow-y-auto space-y-3 rounded-2xl bg-[#FAF7F2] dark:bg-[#151A20] p-4 border border-[#E7E1DA] dark:border-[#2B3540] text-xs">
          <div className="flex items-start gap-2.5">
            <Building2 className="h-4 w-4 text-[#DE8626] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">Licensing & Representation</p>
              <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed">
                You confirm your restaurant holds valid statutory licenses, including FSSAI food safety and GST registrations where applicable.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <UtensilsCrossed className="h-4 w-4 text-[#DE8626] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">POS & Operational Accuracy</p>
              <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed">
                Invoices, tax computations, and kitchen order tickets (KOT) generated from this terminal represent accurate store transactions.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <CreditCard className="h-4 w-4 text-[#DE8626] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">Payment Processing</p>
              <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed">
                Digital payments and QR settlements facilitated through Cashfree and partners are governed by standard banking settlement terms.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Lock className="h-4 w-4 text-[#DE8626] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">Customer Data Privacy</p>
              <p className="text-[11px] text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed">
                Customer contact and billing details must be kept confidential pursuant to Indian DPDP regulations.
              </p>
            </div>
          </div>
        </div>

        {/* Checkbox */}
        <label className="flex items-center gap-3 cursor-pointer select-none group">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => setIsChecked(e.target.checked)}
            className="h-4 w-4 rounded-md border-gray-300 text-[#DE8626] focus:ring-[#DE8626] cursor-pointer"
          />
          <span className="text-xs sm:text-sm text-[#1E2930] dark:text-[#F3F4F6] font-semibold">
            I accept this condition and agree to the Menza Merchant Terms.
          </span>
        </label>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleAccept}
          disabled={!isChecked || isSubmitting}
          className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-white transition-all shadow-md ${
            isChecked && !isSubmitting
              ? 'bg-[#DE8626] hover:bg-[#C9751D] shadow-amber-900/20 cursor-pointer'
              : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed shadow-none'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving Acceptance...</span>
            </>
          ) : (
            <>
              <span>Accept & Continue</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>

        {/* Subtle Logout Option (no disagree) */}
        <div className="text-center pt-1">
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 text-xs text-[#667085] dark:text-[#94A3B8] hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
