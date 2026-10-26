'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Store,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronDown,
  Lock,
  KeyRound,
  Check,
  Smartphone,
  Clock,
  HelpCircle,
} from 'lucide-react';
import { AuthRemoteDataSource } from '@shared/data/datasources/AuthRemoteDataSource';
import { AuthRepositoryImpl } from '@shared/data/repositories/AuthRepositoryImpl';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { RestaurantDetail } from '@shared/domain/models/Restaurant';
import { isSalesPersonUser } from '@/lib/auth/permissions';
import { PinLockView } from '@/components/auth/PinLockView';

const authRepository = new AuthRepositoryImpl(new AuthRemoteDataSource());

type ValidMode = 'pin' | 'otp' | 'setup-pin' | 'forgot-pin';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    setAuthData,
    isAuthenticated,
    isPinLocked,
    authMode,
    setAuthMode,
    completePinSetup,
    resetPinWithOtp,
    user,
    activeRestaurant,
  } = useAuthStore();

  // Resolve current active mode from URL search params (defaults to 'pin')
  const modeParam = searchParams.get('mode');
  const activeMode: ValidMode =
    modeParam === 'otp'
      ? 'otp'
      : modeParam === 'forgot-pin' || modeParam === 'forgot_pin'
      ? 'forgot-pin'
      : modeParam === 'setup-pin' || modeParam === 'setup_pin'
      ? 'setup-pin'
      : 'pin';

  // Synchronize Zustand store authMode with current URL mode
  useEffect(() => {
    const storeTarget =
      activeMode === 'setup-pin'
        ? 'setup_pin'
        : activeMode === 'forgot-pin'
        ? 'forgot_pin'
        : activeMode;
    if (authMode !== storeTarget) {
      setAuthMode(storeTarget);
    }
  }, [activeMode, authMode, setAuthMode]);

  const navigateToMode = (mode: ValidMode) => {
    const storeMode =
      mode === 'setup-pin' ? 'setup_pin' : mode === 'forgot-pin' ? 'forgot_pin' : mode;
    setAuthMode(storeMode);
    router.push(`/login?mode=${mode}`);
  };

  // OTP Login state
  const [mobile, setMobile] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(120);
  const [canResend, setCanResend] = useState(false);
  const [autoDetectedOtp, setAutoDetectedOtp] = useState<string | null>(null);

  // Multi-restaurant selector modal state
  const [pendingAuthResponse, setPendingAuthResponse] = useState<any | null>(null);
  const [restaurantSelectionModal, setRestaurantSelectionModal] = useState(false);

  // First-Time PIN Setup state (activeMode === 'setup-pin')
  const [setupPin, setSetupPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);

  // Forgot PIN state (activeMode === 'forgot-pin')
  const mobileFromUrl = searchParams.get('mobile') || '';
  const [resetMobile, setResetMobile] = useState(mobileFromUrl);
  const [resetOtp, setResetOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [resetStep, setResetStep] = useState<'mobile' | 'verify'>('mobile');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetResendTimer, setResetResendTimer] = useState(120);
  const [resetCanResend, setResetCanResend] = useState(false);

  const [currentTime, setCurrentTime] = useState<string>('');
  const otpInputRef = useRef<HTMLInputElement>(null);
  const isVerifyingRef = useRef(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const urlMobile = searchParams.get('mobile');
    if (urlMobile && !resetMobile) {
      setResetMobile(urlMobile.replace(/[^0-9]/g, '').slice(-10));
    }
  }, [searchParams, resetMobile]);

  // Redirect if already authenticated and unlocked (unless in setup-pin flow)
  useEffect(() => {
    if (isAuthenticated && !isPinLocked && activeMode !== 'setup-pin') {
      if (isSalesPersonUser(user?.roles)) {
        router.replace('/sales/earnings');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [isAuthenticated, isPinLocked, activeMode, user?.roles, router]);

  // Resend OTP countdown timer for OTP login
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

  // Resend OTP timer for Forgot PIN
  useEffect(() => {
    if (resetStep !== 'verify' || resetResendTimer <= 0) {
      setResetCanResend(resetStep === 'verify' && resetResendTimer <= 0);
      return;
    }
    const timer = setInterval(() => {
      setResetResendTimer((val) => (val <= 1 ? 0 : val - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resetStep, resetResendTimer]);

  const formatTimer = (seconds: number) =>
    `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  const getSanitizedAuthError = (err: any, context: 'send_otp' | 'verify_otp'): string => {
    if (typeof window !== 'undefined' && !window.navigator.onLine) {
      return 'You appear to be offline. Please check your internet connection.';
    }

    const status = Number(err?.response?.status);
    const rawMsg =
      err?.response?.data?.message || err?.response?.data?.Message || err?.response?.data;

    if (
      typeof rawMsg === 'string' &&
      rawMsg.trim().length > 0 &&
      rawMsg.length < 120 &&
      !rawMsg.includes('{')
    ) {
      return rawMsg.trim();
    }

    if (context === 'send_otp') {
      if (status === 429) {
        return 'Too many attempts. Please wait a few moments before requesting another OTP.';
      }
      if (status === 400 || status === 422) {
        return 'Please enter a valid 10-digit mobile number.';
      }
      return 'Unable to send OTP. Please check your mobile number and try again.';
    }

    if (status === 400 || status === 401 || status === 404) {
      return 'Invalid or expired verification code. Please check and try again.';
    }

    return 'Verification failed. Please try again.';
  };

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
    setMobile(cleaned);
    if (errorMsg) setErrorMsg(null);
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
    setOtpCode(cleaned);
    if (errorMsg) setErrorMsg(null);

    if (cleaned.length === 6 && !loading && !isVerifyingRef.current) {
      setTimeout(() => {
        handleVerifyOtp(undefined, cleaned);
      }, 100);
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    const digits = pasted.replace(/[^0-9]/g, '').slice(0, 6);
    if (digits.length === 6) {
      e.preventDefault();
      setOtpCode(digits);
      if (errorMsg) setErrorMsg(null);
      setTimeout(() => {
        handleVerifyOtp(undefined, digits);
      }, 100);
    }
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
      setAutoDetectedOtp(null);

      const res = await authRepository.generateOtp(mobile);
      setIsOtpSent(true);
      setResendTimer(120);
      setCanResend(false);

      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 150);

      if (res?.otpCode && /^\d{6}$/.test(res.otpCode)) {
        setAutoDetectedOtp(res.otpCode);
        setOtpCode(res.otpCode);
        setTimeout(() => {
          handleVerifyOtp(undefined, res.otpCode);
        }, 300);
      }
    } catch (err: any) {
      setErrorMsg(getSanitizedAuthError(err, 'send_otp'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent, codeOverride?: string) => {
    if (e) e.preventDefault();
    if (loading || isVerifyingRef.current) return;

    const codeToVerify = codeOverride || otpCode;
    if (codeToVerify.length !== 6) {
      setErrorMsg('Please enter the complete 6-digit OTP code.');
      return;
    }

    try {
      isVerifyingRef.current = true;
      setLoading(true);
      setErrorMsg(null);

      const res = await authRepository.loginWithOtp(mobile, codeToVerify);

      if (isSalesPersonUser(res.roles)) {
        completeLogin(res);
        return;
      }

      if (res.restaurants && res.restaurants.length > 1) {
        setPendingAuthResponse(res);
        setRestaurantSelectionModal(true);
        return;
      }

      const targetRestId = res.activeRestaurantId || res.restaurants?.[0]?.restaurantId;
      completeLogin(res, targetRestId);
    } catch (err: any) {
      setErrorMsg(getSanitizedAuthError(err, 'verify_otp'));
    } finally {
      isVerifyingRef.current = false;
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
      res.isTermConditionChecked,
      res.isPinConfigured
    );

    // If first-time user without configured personal PIN, guide to PIN setup!
    if (!res.isPinConfigured) {
      navigateToMode('setup-pin');
      return;
    }

    useAuthStore.setState({ isPinLocked: false });

    if (isSalesPersonUser(res.roles)) {
      router.replace('/sales/earnings');
    } else {
      router.replace('/dashboard');
    }
  };

  const handleBackToMobile = () => {
    setIsOtpSent(false);
    setOtpCode('');
    setErrorMsg(null);
    setAutoDetectedOtp(null);
    setResendTimer(120);
    setCanResend(false);
  };

  // --- FIRST-TIME PIN SETUP HANDLERS ---
  const handleSavePinSetup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (setupLoading) return;

    if (setupPin.length !== 4) {
      setSetupError('Please enter a 4-digit PIN.');
      return;
    }
    if (setupPin !== confirmPin) {
      setSetupError('PINs do not match. Please re-enter.');
      return;
    }

    try {
      setSetupLoading(true);
      setSetupError(null);
      await completePinSetup(setupPin);
      if (isSalesPersonUser(user?.roles)) {
        router.replace('/sales/earnings');
      } else {
        router.replace('/dashboard');
      }
    } catch (err: any) {
      setSetupError(err?.message || 'Failed to save PIN.');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleSkipPinSetup = () => {
    useAuthStore.setState({ isPinLocked: false, isPinConfigured: true, authMode: 'pin' });
    if (isSalesPersonUser(user?.roles)) {
      router.replace('/sales/earnings');
    } else {
      router.replace('/dashboard');
    }
  };

  // --- FORGOT PIN HANDLERS ---
  const handleSendResetOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (resetLoading) return;

    const cleanM = resetMobile.replace(/[^0-9]/g, '').slice(-10);
    if (cleanM.length !== 10) {
      setResetError('Please enter a valid 10-digit registered mobile number.');
      return;
    }

    try {
      setResetLoading(true);
      setResetError(null);
      const res = await authRepository.generateOtp(cleanM);
      setResetStep('verify');
      setResetResendTimer(120);
      setResetCanResend(false);
      if (res?.otpCode && /^\d{6}$/.test(res.otpCode)) {
        setResetOtp(res.otpCode);
      }
    } catch (err: any) {
      setResetError(getSanitizedAuthError(err, 'send_otp'));
    } finally {
      setResetLoading(false);
    }
  };

  const handleConfirmResetPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (resetLoading) return;

    if (resetOtp.length !== 6) {
      setResetError('Please enter the complete 6-digit OTP code.');
      return;
    }
    if (newPin.length !== 4) {
      setResetError('New PIN must be exactly 4 digits.');
      return;
    }
    if (newPin !== confirmNewPin) {
      setResetError('New PIN and Confirm PIN do not match.');
      return;
    }

    try {
      setResetLoading(true);
      setResetError(null);
      const result = await resetPinWithOtp(resetMobile, resetOtp, newPin);
      if (result.success) {
        if (isSalesPersonUser(user?.roles)) {
          router.replace('/sales/earnings');
        } else {
          router.replace('/dashboard');
        }
      } else {
        setResetError(result.message || 'Failed to reset PIN. Invalid or expired OTP.');
      }
    } catch (err: any) {
      setResetError(err?.message || 'Failed to reset PIN.');
    } finally {
      setResetLoading(false);
    }
  };

  // 1. DEFAULT VIEW: Quick Staff PIN Login
  if (activeMode === 'pin') {
    return (
      <PinLockView
        onSuccess={() => {
          if (isSalesPersonUser(user?.roles)) {
            router.replace('/sales/earnings');
          } else {
            router.replace('/dashboard');
          }
        }}
        onForgotPin={(prefilledMobile) => {
          if (prefilledMobile) {
            setResetMobile(prefilledMobile);
          }
          setResetStep('mobile');
          setResetError(null);
          navigateToMode('forgot-pin');
        }}
        onSwitchToOtp={() => navigateToMode('otp')}
        showSwitchToOtp={true}
      />
    );
  }

  const restName = activeRestaurant?.restaurantName || 'Menza Restaurant POS';

  // 2. FIRST-TIME PIN SETUP VIEW
  if (activeMode === 'setup-pin') {
    return (
      <div className="flex min-h-screen w-screen items-center justify-center bg-[#FAF7F2] dark:bg-[#111418] p-3 sm:p-5 transition-colors select-none">
        <div className="fixed -top-36 left-1/2 -translate-x-1/2 h-[420px] w-[650px] rounded-full bg-gradient-to-b from-[#FEA619]/25 via-[#DE8626]/12 to-transparent blur-3xl pointer-events-none" />
        <div className="fixed -bottom-40 -left-40 h-[380px] w-[380px] rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-[390px] sm:max-w-[420px] rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF]/95 dark:bg-[#1B2127]/95 backdrop-blur-2xl p-5 sm:p-7 shadow-2xl shadow-amber-950/10 flex flex-col items-center transition-all">
          {/* Prominent Menza Cloche Logo */}
          <div className="relative mb-3 flex flex-col items-center">
            <div className="relative group">
              <div className="absolute inset-0 rounded-full bg-gradient-to-t from-[#FEA619]/35 via-[#DE8626]/20 to-transparent blur-xl transform scale-125 pointer-events-none" />
              <img
                src="/brand/menza_logo_clean.png"
                alt="Menza"
                className="relative h-15 sm:h-17 w-auto object-contain drop-shadow-md"
              />
            </div>
          </div>

          <div className="flex flex-col items-center text-center mb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#DE8626] to-[#B7791F] text-white shadow-lg shadow-[#DE8626]/25 mb-2.5">
              <KeyRound className="h-5 w-5 stroke-[2.2]" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
              Set Up Staff PIN
            </h1>
            <p className="mt-0.5 text-xs font-medium text-[#667085] dark:text-[#94A3B8] max-w-xs">
              Create your personal 4-digit PIN for rapid counter unlocking
            </p>
          </div>

          {setupError && (
            <div className="mb-4 w-full flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 p-2.5 text-xs text-red-700 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="font-bold">{setupError}</p>
            </div>
          )}

          <form onSubmit={handleSavePinSetup} className="w-full space-y-3.5">
            <div>
              <label className="block text-[11px] font-extrabold text-[#8C7A6B] uppercase tracking-wider mb-1.5">
                New 4-Digit PIN
              </label>
              <input
                type="password"
                maxLength={4}
                autoFocus
                inputMode="numeric"
                value={setupPin}
                onChange={(e) => setSetupPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                placeholder="••••"
                className="w-full rounded-2xl border-2 border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-2.5 text-center text-2xl font-black tracking-[0.5em] text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626] focus:ring-2 focus:ring-[#DE8626]/20 transition-all placeholder:text-[#667085]/40"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-[#8C7A6B] uppercase tracking-wider mb-1.5">
                Confirm 4-Digit PIN
              </label>
              <input
                type="password"
                maxLength={4}
                inputMode="numeric"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                placeholder="••••"
                className="w-full rounded-2xl border-2 border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-2.5 text-center text-2xl font-black tracking-[0.5em] text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626] focus:ring-2 focus:ring-[#DE8626]/20 transition-all placeholder:text-[#667085]/40"
              />
            </div>

            <button
              type="submit"
              disabled={setupLoading || setupPin.length !== 4 || confirmPin.length !== 4}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#DE8626] via-[#D96B14] to-[#B7791F] py-3 text-sm font-black text-white shadow-lg shadow-[#DE8626]/30 hover:from-[#C4721C] hover:to-[#A86414] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.99] mt-1"
            >
              {setupLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving PIN...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 stroke-[2.5]" />
                  <span>Save PIN & Open POS</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSkipPinSetup}
              className="w-full text-center text-xs font-bold text-[#8C7A6B] hover:text-[#DE8626] transition-colors py-1.5"
            >
              Skip for now (Use default master PIN 1234)
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. FORGOT PIN / OTP RECOVERY VIEW
  if (activeMode === 'forgot-pin') {
    return (
      <div className="flex min-h-screen w-screen items-center justify-center bg-[#FAF7F2] dark:bg-[#111418] p-3 sm:p-5 transition-colors select-none">
        <div className="fixed -top-36 left-1/2 -translate-x-1/2 h-[420px] w-[650px] rounded-full bg-gradient-to-b from-[#FEA619]/25 via-[#DE8626]/12 to-transparent blur-3xl pointer-events-none" />
        <div className="fixed -bottom-40 -left-40 h-[380px] w-[380px] rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-[390px] sm:max-w-[420px] rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF]/95 dark:bg-[#1B2127]/95 backdrop-blur-2xl p-5 sm:p-7 shadow-2xl shadow-amber-950/10 flex flex-col items-center transition-all">
          {/* Prominent Menza Cloche Logo */}
          <div className="relative mb-3 flex flex-col items-center">
            <div className="relative group">
              <div className="absolute inset-0 rounded-full bg-gradient-to-t from-[#FEA619]/35 via-[#DE8626]/20 to-transparent blur-xl transform scale-125 pointer-events-none" />
              <img
                src="/brand/menza_logo_clean.png"
                alt="Menza"
                className="relative h-15 sm:h-17 w-auto object-contain drop-shadow-md"
              />
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => {
                setResetError(null);
                navigateToMode('pin');
              }}
              className="flex items-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 py-1 text-xs font-black text-[#DE8626] hover:bg-amber-500/10 transition-colors shadow-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to PIN</span>
            </button>
            <span className="text-[11px] font-bold text-[#8C7A6B]">Self-Recovery</span>
          </div>

          <div className="flex flex-col items-center text-center mb-4">
            <h1 className="text-xl font-black tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
              Reset Staff PIN
            </h1>
            <p className="mt-0.5 text-xs font-medium text-[#667085] dark:text-[#94A3B8]">
              {resetStep === 'mobile'
                ? 'Enter your registered mobile to receive SMS verification'
                : `Enter SMS OTP sent to +91 ${resetMobile} and choose new PIN`}
            </p>
          </div>

          {resetError && (
            <div className="mb-3.5 w-full flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 p-2.5 text-xs text-red-700 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="font-bold">{resetError}</p>
            </div>
          )}

          {resetStep === 'mobile' ? (
            <form onSubmit={handleSendResetOtp} className="w-full space-y-3.5">
              <div>
                <label className="block text-[11px] font-extrabold text-[#8C7A6B] uppercase tracking-wider mb-1.5">
                  Registered Mobile Number
                </label>
                <div className="relative flex items-center rounded-2xl border-2 border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 focus-within:border-[#DE8626] transition-all">
                  <span className="text-xs font-black text-[#1E2930] dark:text-[#F3F4F6] pr-2.5 border-r border-[#E7E1DA] dark:border-[#2B3540]">
                    +91
                  </span>
                  <input
                    type="tel"
                    autoFocus
                    maxLength={10}
                    value={resetMobile}
                    onChange={(e) =>
                      setResetMobile(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))
                    }
                    placeholder="Enter 10-digit mobile"
                    className="w-full bg-transparent pl-3 text-base font-bold tracking-wider text-[#1E2930] dark:text-[#F3F4F6] outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={resetLoading || resetMobile.length !== 10}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#DE8626] via-[#D96B14] to-[#B7791F] py-3 text-sm font-black text-white shadow-lg shadow-[#DE8626]/30 hover:from-[#C4721C] hover:to-[#A86414] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {resetLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleConfirmResetPin} className="w-full space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setResetStep('mobile')}
                  className="text-xs font-bold text-[#DE8626] hover:underline flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span>Change +91 {resetMobile}</span>
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-[#8C7A6B] uppercase tracking-wider mb-1">
                  6-Digit SMS Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  inputMode="numeric"
                  value={resetOtp}
                  onChange={(e) =>
                    setResetOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))
                  }
                  placeholder="• • • • • •"
                  className="w-full rounded-2xl border-2 border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-2.5 text-center text-xl font-black tracking-[0.5em] text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-[#8C7A6B] uppercase tracking-wider mb-1">
                  New 4-Digit PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) =>
                    setNewPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))
                  }
                  placeholder="••••"
                  className="w-full rounded-2xl border-2 border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-2 text-center text-xl font-black tracking-[0.5em] text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-[#8C7A6B] uppercase tracking-wider mb-1">
                  Confirm New PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  value={confirmNewPin}
                  onChange={(e) =>
                    setConfirmNewPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))
                  }
                  placeholder="••••"
                  className="w-full rounded-2xl border-2 border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-2 text-center text-xl font-black tracking-[0.5em] text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-[#667085]">
                <span>
                  Resend in:{' '}
                  <strong className="text-[#1E2930] dark:text-[#F3F4F6]">
                    {formatTimer(resetResendTimer)}
                  </strong>
                </span>
                <button
                  type="button"
                  disabled={!resetCanResend || resetLoading}
                  onClick={() => handleSendResetOtp()}
                  className="font-bold text-[#DE8626] hover:underline disabled:opacity-40"
                >
                  Resend OTP
                </button>
              </div>

              <button
                type="submit"
                disabled={
                  resetLoading ||
                  resetOtp.length !== 6 ||
                  newPin.length !== 4 ||
                  confirmNewPin.length !== 4
                }
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#DE8626] via-[#D96B14] to-[#B7791F] py-3 text-sm font-extrabold text-white shadow-lg shadow-[#DE8626]/30 hover:from-[#C4721C] hover:to-[#A86414] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {resetLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Updating PIN...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    <span>Verify OTP & Set New PIN</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // 4. MOBILE + OTP VIEW (activeMode === 'otp')
  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-[#FAF7F2] dark:bg-[#111418] p-3 sm:p-5 transition-colors select-none">
      <div className="fixed -top-36 left-1/2 -translate-x-1/2 h-[420px] w-[650px] rounded-full bg-gradient-to-b from-[#FEA619]/25 via-[#DE8626]/12 to-transparent blur-3xl pointer-events-none" />
      <div className="fixed -bottom-40 -left-40 h-[380px] w-[380px] rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      <div className="fixed -bottom-40 -right-40 h-[380px] w-[380px] rounded-full bg-amber-600/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-[390px] sm:max-w-[420px] rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF]/95 dark:bg-[#1B2127]/95 backdrop-blur-2xl p-5 sm:p-7 shadow-2xl shadow-amber-950/10 flex flex-col items-center transition-all">
        {/* Prominent Menza Cloche Logo */}
        <div className="relative mb-3 flex flex-col items-center">
          <div className="relative group">
            <div className="absolute inset-0 rounded-full bg-gradient-to-t from-[#FEA619]/35 via-[#DE8626]/20 to-transparent blur-xl transform scale-125 pointer-events-none" />
            <img
              src="/brand/menza_logo_clean.png"
              alt="Menza"
              className="relative h-15 sm:h-17 w-auto object-contain drop-shadow-md"
            />
          </div>
        </div>

        {/* Segmented Auth Mode Switcher */}
        <div className="flex items-center rounded-2xl bg-[#FAF7F2] dark:bg-[#151A20] border border-[#E7E1DA] dark:border-[#2B3540] p-1 mb-4 w-full">
          <button
            type="button"
            onClick={() => navigateToMode('pin')}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold text-[#8C7A6B] dark:text-[#94A3B8] hover:text-[#DE8626] transition-colors"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Quick Staff PIN</span>
          </button>
          <div className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-black bg-[#FFFFFF] dark:bg-[#1B2127] text-[#DE8626] shadow-xs">
            <Smartphone className="h-3.5 w-3.5" />
            <span>Mobile OTP</span>
          </div>
        </div>

        <div className="text-center mb-3">
          <h1 className="text-lg font-black tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
            Menza Restaurant Portal
          </h1>
          <p className="text-[11px] font-semibold text-[#8C7A6B] dark:text-[#94A3B8]">
            Multi-Tenant Counter & Kitchen Controller
          </p>
        </div>

        {errorMsg && (
          <div className="mb-3.5 w-full flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 p-2.5 text-xs text-red-700 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
            <p className="font-bold leading-relaxed">{errorMsg}</p>
          </div>
        )}

        {/* Step 1: Mobile Phone Number Form */}
        {!isOtpSent ? (
          <form onSubmit={handleSendOtp} className="w-full space-y-3.5">
            <div>
              <label className="block text-[11px] font-extrabold text-[#8C7A6B] uppercase tracking-wider mb-1.5">
                Registered Mobile Number
              </label>

              <div className="relative flex items-center rounded-2xl border-2 border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 focus-within:border-[#DE8626] focus-within:ring-2 focus-within:ring-[#DE8626]/20 transition-all shadow-inner">
                <div className="flex items-center gap-1.5 pr-2.5 border-r border-[#E7E1DA] dark:border-[#2B3540] select-none text-xs font-black text-[#1E2930] dark:text-[#F3F4F6]">
                  <span className="text-base leading-none">🇮🇳</span>
                  <span>+91</span>
                  <ChevronDown className="h-3.5 w-3.5 text-[#667085]" />
                </div>
                <input
                  type="tel"
                  autoFocus
                  value={mobile}
                  onChange={handleMobileChange}
                  placeholder="Enter 10-digit mobile"
                  maxLength={10}
                  className="w-full bg-transparent pl-3 text-base font-bold tracking-wider text-[#1E2930] dark:text-[#F3F4F6] outline-none placeholder:text-[#667085]/60"
                />
              </div>
              <p className="mt-1 text-[11px] font-medium text-[#667085] dark:text-[#94A3B8]">
                We will send an SMS verification code (OTP).
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || mobile.length !== 10}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#DE8626] via-[#D96B14] to-[#B7791F] py-3 text-sm font-black text-white shadow-lg shadow-[#DE8626]/30 hover:from-[#C4721C] hover:to-[#A86414] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.99]"
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
          <form onSubmit={handleVerifyOtp} className="w-full space-y-3.5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleBackToMobile}
                className="flex items-center gap-1 text-xs font-bold text-[#DE8626] hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Change mobile</span>
              </button>
              <span className="text-xs font-black text-[#1E2930] dark:text-[#F3F4F6]">
                +91 {mobile}
              </span>
            </div>

            {autoDetectedOtp && (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 p-2.5 text-xs text-emerald-700 dark:text-emerald-400">
                <Sparkles className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>
                  Code detected: <strong>{autoDetectedOtp}</strong> • Auto-verifying...
                </span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-extrabold text-[#8C7A6B] uppercase tracking-wider mb-1.5">
                6-Digit Verification Code
              </label>

              <input
                ref={otpInputRef}
                type="text"
                autoFocus
                value={otpCode}
                onChange={handleOtpChange}
                onPaste={handleOtpPaste}
                placeholder="• • • • • •"
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                className="w-full rounded-2xl border-2 border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-4 py-2.5 text-center text-xl font-black tracking-[0.6em] text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626] focus:ring-2 focus:ring-[#DE8626]/20 transition-all placeholder:text-[#667085]/40 shadow-inner"
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-[#667085] dark:text-[#94A3B8]">
                Resend in:{' '}
                <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                  {formatTimer(resendTimer)}
                </span>
              </span>
              <button
                type="button"
                disabled={!canResend || loading}
                onClick={() => handleSendOtp()}
                className="font-bold text-[#DE8626] hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Resend OTP
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#DE8626] via-[#D96B14] to-[#B7791F] py-3 text-sm font-extrabold text-white shadow-lg shadow-[#DE8626]/30 hover:from-[#C4721C] hover:to-[#A86414] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.99]"
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
        <div className="mt-5 flex items-center justify-center gap-2 border-t border-[#E7E1DA] dark:border-[#2B3540] pt-3 text-[10px] font-bold text-[#667085] dark:text-[#94A3B8]">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Encrypted Session • Cloud Multi-Store Controller</span>
        </div>

        {/* Legal links */}
        <div className="mt-1.5 text-center text-[10px] text-[#8C7A6B] dark:text-[#94A3B8]">
          <span>By signing in, you agree to Menza's </span>
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[#DE8626] hover:underline"
          >
            Terms
          </a>
          <span> and </span>
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[#DE8626] hover:underline"
          >
            Privacy Policy
          </a>
        </div>
      </div>

      {/* Multi-Restaurant Selection Modal */}
      {restaurantSelectionModal && pendingAuthResponse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-[#DE8626]">
                <Store className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#1E2930] dark:text-[#F3F4F6]">
                  Select Active Outlet
                </h3>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                  Choose which restaurant you want to operate today
                </p>
              </div>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto py-1">
              {pendingAuthResponse.restaurants.map((rest: RestaurantDetail) => {
                const role = rest.role || (pendingAuthResponse.roles?.[0] ?? 'Owner');
                return (
                  <button
                    key={rest.restaurantId}
                    onClick={() => completeLogin(pendingAuthResponse, rest.restaurantId)}
                    className="flex w-full items-center justify-between rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] p-3.5 text-left hover:border-[#DE8626] hover:bg-amber-500/5 transition-all group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6] truncate">
                          {rest.restaurantName}
                        </p>
                        <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#DE8626]">
                          {role}
                        </span>
                      </div>
                      <p className="text-xs text-[#667085] dark:text-[#94A3B8] truncate mt-0.5">
                        {rest.address || rest.city || 'Central Store'}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[#DE8626] ml-2 shrink-0 group-hover:translate-x-1 transition-transform" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LoginLoadingSkeleton() {
  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-[#FAF7F2] dark:bg-[#111418] p-4">
      <div className="fixed -top-40 -left-40 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      <div className="fixed -bottom-40 -right-40 h-96 w-96 rounded-full bg-amber-600/10 blur-3xl pointer-events-none" />
      <div className="relative w-full max-w-sm rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-8 shadow-2xl flex flex-col items-center">
        <img
          src="/brand/menza_logo_clean.png"
          alt="Menza"
          className="h-16 w-auto object-contain mb-3"
        />
        <div className="flex items-center gap-2 text-xs font-bold text-[#DE8626]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Starting Menza POS...</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoadingSkeleton />}>
      <LoginContent />
    </Suspense>
  );
}
