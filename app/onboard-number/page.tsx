'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { AuthService } from '@/services/authService';
import {
  Smartphone,
  Store,
  RefreshCw,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Users,
  Building2,
  PhoneCall,
  HelpCircle,
} from 'lucide-react';

export default function OnboardNumberPage() {
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
        const formattedList = list.map((r: any) => ({
          ...r,
          role: r.role || 'Staff',
          isDefault: Boolean(r.isDefault),
        }));
        setRestaurants(formattedList);
        const defaultRest = formattedList.find((r) => r.isDefault) || formattedList[0];
        setActiveRestaurant(defaultRest);
        setInfoMessage('Outlet detected! Redirecting to your store dashboard...');
        setTimeout(() => {
          router.replace('/dashboard');
        }, 1200);
      } else {
        setInfoMessage('No restaurant outlet is assigned to your number yet. Please ask your administrator to invite you in Staff & Roles.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to check onboarding status right now. Please try again.');
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
      {/* Decorative Warm Ambient Glow */}
      <div className="fixed -top-40 -left-40 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      <div className="fixed -bottom-40 -right-40 h-96 w-96 rounded-full bg-amber-600/10 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-lg rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 sm:p-8 shadow-2xl shadow-amber-900/5">
        {/* Header Icon */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#DE8626] to-[#B7791F] text-white shadow-lg shadow-[#DE8626]/20 mb-4">
            <Smartphone className="h-8 w-8" />
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-[#DE8626] uppercase tracking-wider mb-2 border border-amber-500/20">
            Number Not Onboarded
          </span>

          <h1 className="text-2xl font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
            Onboard Your Mobile Number
          </h1>

          <p className="mt-2 text-xs sm:text-sm text-[#667085] dark:text-[#94A3B8] leading-relaxed">
            Logged in as{' '}
            <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
              {user?.mobile || user?.name || 'Operator'}
            </span>
            . This number is not linked to any active restaurant outlet.
          </p>
        </div>

        {/* Options for different user types */}
        <div className="mt-6 space-y-3">
          {/* Path 1: Staff Member */}
          <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 text-xs">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-[#DE8626] mt-0.5">
                <Users className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                  Are you a restaurant staff member?
                </h3>
                <p className="mt-1 text-[#667085] dark:text-[#94A3B8] leading-relaxed">
                  Ask your restaurant owner or manager to add this phone number in their POS Dashboard under{' '}
                  <span className="font-semibold text-[#1E2930] dark:text-[#F3F4F6]">Staff & Roles</span>. Once added, click Check Status.
                </p>
              </div>
            </div>
          </div>

          {/* Path 2: New Store Owner */}
          <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 text-xs">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 mt-0.5">
                <Store className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                  Want to onboard a new restaurant?
                </h3>
                <p className="mt-1 text-[#667085] dark:text-[#94A3B8] leading-relaxed">
                  To register and launch a new store with Menza POS billing and kitchen automation, contact our onboarding team.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Status Alerts */}
        {infoMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs font-semibold text-[#DE8626]">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{infoMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs font-semibold text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleCheckStatus}
            disabled={checking}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#DE8626] px-5 py-3 text-xs font-bold text-white shadow-lg shadow-amber-500/20 hover:bg-[#C4721C] transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Checking Status...' : 'Check Status'}</span>
          </button>

          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] px-5 py-3 text-xs font-bold text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6] hover:bg-black/5 dark:hover:bg-white/5 transition-all"
          >
            <LogOut className="h-4 w-4" />
            <span>Switch Number</span>
          </button>
        </div>
      </div>
    </div>
  );
}
