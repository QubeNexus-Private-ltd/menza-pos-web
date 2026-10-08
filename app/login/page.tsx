'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Store,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { AuthRemoteDataSource } from '@shared/data/datasources/AuthRemoteDataSource';
import { AuthRepositoryImpl } from '@shared/data/repositories/AuthRepositoryImpl';
import { TermsConditionRemoteDataSource } from '@shared/data/datasources/TermsConditionRemoteDataSource';
import { TermsConditionRepositoryImpl } from '@shared/data/repositories/TermsConditionRepositoryImpl';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { RestaurantDetail } from '@shared/domain/models/Restaurant';

const authRepository = new AuthRepositoryImpl(new AuthRemoteDataSource());
const termsRepository = new TermsConditionRepositoryImpl(new TermsConditionRemoteDataSource());

export default function LoginPage() {
  const router = useRouter();
  const { setAuthData, isAuthenticated } = useAuthStore();

  const [mobile, setMobile] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(120);
  const [canResend, setCanResend] = useState(false);

  // Multi-restaurant selector modal state
  const [pendingAuthResponse, setPendingAuthResponse] = useState<any | null>(null);
  const [restaurantSelectionModal, setRestaurantSelectionModal] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!isOtpSent || resendTimer <= 0) {
      setCanResend(isOtpSent && resendTimer <= 0);
      return;
    }
    const timer = setInterval(() => {
      setResendTimer((val) => (val <= 1 ? 0 : val - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOtpSent, resendTimer]);

  const formatTimer = (seconds: number) =>
    `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
    setMobile(cleaned);
    if (errorMsg) setErrorMsg(null);
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
    setOtpCode(cleaned);
    if (errorMsg) setErrorMsg(null);
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (loading) return;

    if (mobile.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      await authRepository.generateOtp(mobile);
      setIsOtpSent(true);
      setResendTimer(120);
      setCanResend(false);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to send OTP. Please check the mobile number and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (loading) return;

    if (otpCode.length !== 6) {
      setErrorMsg('Please enter the complete 6-digit OTP code.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await authRepository.loginWithOtp(mobile, otpCode);

      if (res.restaurants && res.restaurants.length > 1) {
        setPendingAuthResponse(res);
        setRestaurantSelectionModal(true);
        return;
      }

      completeLogin(res, res.activeRestaurantId || (res.restaurants?.[0]?.restaurantId));
    } catch (err: any) {
      setErrorMsg(err?.message || 'Invalid or expired OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const completeLogin = (res: any, activeRestId?: number) => {
    setAuthData(
      res.token,
      res.refreshToken,
      {
        id: res.userId,
        name: res.name,
        mobile: res.mobile,
        roles: res.roles,
        activeRestaurantId: activeRestId,
      },
      res.restaurants || [],
      activeRestId,
      res.isTermConditionChecked
    );
    router.replace('/dashboard');
  };

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-[#FAF7F2] dark:bg-[#111418] p-4">
      {/* Decorative Warm Ambient Glow */}
      <div className="fixed -top-40 -left-40 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      <div className="fixed -bottom-40 -right-40 h-96 w-96 rounded-full bg-amber-600/10 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 sm:p-8 shadow-2xl shadow-amber-900/5">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#DE8626] to-[#B7791F] text-white shadow-lg shadow-[#DE8626]/25 mb-4">
            <span className="font-extrabold text-2xl tracking-wider">M</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
            Menza Restaurant Suite
          </h1>
          <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8]">
            Multi-Tenant POS, Kitchen KOT, and Restaurant Operations
          </p>
        </div>

        {/* Error Alert Box */}
        {errorMsg && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 p-3.5 text-xs text-red-700 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="font-medium leading-relaxed">{errorMsg}</p>
          </div>
        )}

        {/* Step 1: Mobile Phone Number Form */}
        {!isOtpSent ? (
          <form onSubmit={handleSendOtp} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] uppercase tracking-wider mb-2">
                Registered Mobile Number
              </label>
              <div className="relative flex items-center rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-3 focus-within:border-[#DE8626] focus-within:ring-2 focus-within:ring-[#DE8626]/20 transition-all">
                <span className="text-sm font-bold text-[#667085] dark:text-[#94A3B8] pr-3 border-r border-[#E7E1DA] dark:border-[#2B3540]">
                  +91
                </span>
                <input
                  type="tel"
                  autoFocus
                  value={mobile}
                  onChange={handleMobileChange}
                  placeholder="Enter 10-digit mobile number"
                  maxLength={10}
                  className="w-full bg-transparent pl-3 text-sm font-semibold tracking-wider text-[#1E2930] dark:text-[#F3F4F6] outline-none placeholder:text-[#667085]/60"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-[#667085] dark:text-[#94A3B8]">
                We will send a one-time verification code (OTP) via SMS.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || mobile.length !== 10}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#DE8626] py-3.5 text-sm font-bold text-white shadow-md shadow-[#DE8626]/25 hover:bg-[#C4721C] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Requesting OTP...</span>
                </>
              ) : (
                <>
                  <span>Continue with OTP</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* Step 2: 6-Digit OTP Verification Form */
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsOtpSent(false)}
                className="flex items-center gap-1 text-xs font-semibold text-[#DE8626] hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Change Mobile</span>
              </button>
              <span className="text-xs font-semibold text-[#667085] dark:text-[#94A3B8]">
                +91 {mobile}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] uppercase tracking-wider mb-2">
                6-Digit Verification Code
              </label>
              <input
                type="text"
                autoFocus
                value={otpCode}
                onChange={handleOtpChange}
                placeholder="• • • • • •"
                maxLength={6}
                className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-3.5 text-center text-xl font-extrabold tracking-[0.5em] text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626] focus:ring-2 focus:ring-[#DE8626]/20 transition-all placeholder:text-[#667085]/40"
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-[#667085] dark:text-[#94A3B8]">
                Resend code in: <span className="font-semibold">{formatTimer(resendTimer)}</span>
              </span>
              <button
                type="button"
                disabled={!canResend || loading}
                onClick={() => handleSendOtp()}
                className="font-semibold text-[#DE8626] hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Resend OTP
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#DE8626] py-3.5 text-sm font-bold text-white shadow-md shadow-[#DE8626]/25 hover:bg-[#C4721C] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying Session...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Verify & Sign In</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Security & Multi-Store Badge */}
        <div className="mt-8 flex items-center justify-center gap-2 border-t border-[#E7E1DA] dark:border-[#2B3540] pt-5 text-[11px] text-[#667085] dark:text-[#94A3B8]">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Encrypted Session • Cloud Multi-Store Controller</span>
        </div>

        {/* Legal links */}
        <div className="mt-3 text-center text-[11px] text-[#667085] dark:text-[#94A3B8]">
          <span>By signing in, you agree to Menza's </span>
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#DE8626] hover:underline">
            Terms of Service
          </a>
          <span> and </span>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#DE8626] hover:underline">
            Privacy Policy
          </a>
        </div>
      </div>

      {/* Multi-Restaurant Selection Modal */}
      {restaurantSelectionModal && pendingAuthResponse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-[#DE8626]">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">Select Active Outlet</h3>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                  Choose which restaurant you want to operate today
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto my-4">
              {pendingAuthResponse.restaurants.map((rest: RestaurantDetail) => (
                <button
                  key={rest.restaurantId}
                  onClick={() => completeLogin(pendingAuthResponse, rest.restaurantId)}
                  className="flex w-full items-center justify-between rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] p-3 text-left hover:border-[#DE8626] hover:bg-amber-500/5 transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6] truncate">
                      {rest.restaurantName}
                    </p>
                    <p className="text-xs text-[#667085] dark:text-[#94A3B8] truncate">
                      {rest.address || 'Central Terminal'}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-[#DE8626] ml-2 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
