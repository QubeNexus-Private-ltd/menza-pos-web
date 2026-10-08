'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { AuthService } from '@/services/authService';
import { Store, ShieldAlert, RefreshCw, LogOut, CheckCircle2, Clock } from 'lucide-react';

export default function PendingApprovalPage() {
  const router = useRouter();
  const { user, setRestaurants, setActiveRestaurant, logout } = useAuthStore();
  const [checking, setChecking] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCheckStatus = async () => {
    try {
      setChecking(true);
      setInfoMessage(null);
      setErrorMessage(null);

      const list = await AuthService.getMyRestaurants();
      if (list && list.length > 0) {
        setRestaurants(list);
        const defaultRest = list.find((r) => r.isDefault) || list[0];
        setActiveRestaurant(defaultRest);
        setInfoMessage('Outlet assigned! Redirecting to dashboard...');
        setTimeout(() => {
          router.replace('/dashboard');
        }, 1000);
      } else {
        setInfoMessage('No outlet assigned yet. Please contact your restaurant owner or administrator.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to refresh status at this time. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-[#FAF7F2] dark:bg-[#111418] p-4 text-[#1E2930] dark:text-[#F3F4F6]">
      {/* Decorative Glow */}
      <div className="fixed -top-40 -left-40 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      <div className="fixed -bottom-40 -right-40 h-96 w-96 rounded-full bg-amber-600/10 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-lg rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 sm:p-8 shadow-2xl shadow-amber-900/5">
        {/* Brand Icon Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[#DE8626] mb-4">
            <Clock className="h-8 w-8 animate-pulse" />
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-[#DE8626] uppercase tracking-wider mb-2">
            <ShieldAlert className="h-3.5 w-3.5" />
            Pending Assignment
          </span>

          <h1 className="text-2xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
            No Restaurant Assigned
          </h1>

          <p className="mt-2 text-xs sm:text-sm text-[#667085] dark:text-[#94A3B8] max-w-sm">
            Your mobile number{' '}
            <span className="font-semibold text-[#1E2930] dark:text-[#F3F4F6]">
              {user?.mobile || 'is verified'}
            </span>{' '}
            is not yet linked to any restaurant outlet or POS branch.
          </p>
        </div>

        {/* Informative Guidance Card */}
        <div className="mt-6 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Store className="h-5 w-5 text-[#DE8626] shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">Are you a staff member or manager?</p>
              <p className="text-[#667085] dark:text-[#94A3B8] leading-relaxed">
                Please request your restaurant owner or administrator to invite your phone number from{' '}
                <span className="font-semibold text-[#DE8626]">Staff &amp; Roles</span> in their dashboard.
              </p>
            </div>
          </div>
        </div>

        {/* Feedback Messages */}
        {infoMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs font-semibold text-[#DE8626]">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{infoMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-semibold text-red-600 dark:text-red-400">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={handleCheckStatus}
            disabled={checking}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#DE8626] to-[#B7791F] py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/20 hover:brightness-105 transition-all disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Checking Status...' : 'Check Assignment Status'}</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-transparent py-2.5 text-xs font-semibold text-[#667085] dark:text-[#94A3B8] hover:bg-black/5 dark:hover:bg-white/5 transition-all"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out &amp; Use Another Number</span>
          </button>
        </div>
      </div>
    </div>
  );
}
