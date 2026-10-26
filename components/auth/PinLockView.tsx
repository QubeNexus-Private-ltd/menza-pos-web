'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Lock,
  Delete,
  ShieldCheck,
  Store,
  Phone,
  HelpCircle,
  Clock,
  Sparkles,
  LogOut,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ArrowRightLeft,
  KeyRound,
  Smartphone,
  ChevronDown,
  Calendar,
  Wifi,
  Check,
  User,
} from 'lucide-react';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';

interface RecentStaff {
  mobile: string;
  name?: string;
  role?: string;
  lastActive: number;
}

interface PinLockViewProps {
  onSuccess?: () => void;
  onSwitchToOtp?: () => void;
  onForgotPin?: (prefilledMobile?: string) => void;
  showSwitchToOtp?: boolean;
  isOverlay?: boolean;
  initialMobile?: string;
}

// Local storage helper for remembering recent staff on this terminal
const RECENT_STAFF_KEY = 'menza_pos_recent_staff';

const getStoredRecentStaff = (): RecentStaff[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_STAFF_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const storeRecentStaff = (staff: { mobile: string; name?: string; role?: string }) => {
  if (typeof window === 'undefined') return;
  try {
    const cleanMobile = staff.mobile.replace(/[^0-9]/g, '').slice(-10);
    if (cleanMobile.length !== 10) return;
    const current = getStoredRecentStaff().filter((s) => s.mobile !== cleanMobile);
    const updated = [
      {
        mobile: cleanMobile,
        name: staff.name,
        role: staff.role,
        lastActive: Date.now(),
      },
      ...current,
    ].slice(0, 4);
    localStorage.setItem(RECENT_STAFF_KEY, JSON.stringify(updated));
  } catch {}
};

export const PinLockView: React.FC<PinLockViewProps> = ({
  onSuccess,
  onSwitchToOtp,
  onForgotPin,
  showSwitchToOtp = true,
  isOverlay = false,
  initialMobile,
}) => {
  const activeRestaurant = useAuthStore((state) => state.activeRestaurant);
  const activeStaffName = useAuthStore((state) => state.activeStaffName);
  const user = useAuthStore((state) => state.user);
  const rememberedMobile = useAuthStore((state) => state.rememberedMobile);
  const unlockWithPin = useAuthStore((state) => state.unlockWithPin);
  const setAuthMode = useAuthStore((state) => state.setAuthMode);
  const logout = useAuthStore((state) => state.logout);

  // Resolved initial phone
  const resolvedInitialMobile = (
    initialMobile ||
    rememberedMobile ||
    user?.mobile ||
    ''
  )
    .replace(/[^0-9]/g, '')
    .slice(-10);

  const [step, setStep] = useState<'mobile' | 'pin'>(
    resolvedInitialMobile.length === 10 ? 'pin' : 'mobile'
  );
  const [mobile, setMobile] = useState<string>(resolvedInitialMobile);
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [recentStaff, setRecentStaff] = useState<RecentStaff[]>([]);

  const mobileInputRef = useRef<HTMLInputElement>(null);

  // Load recent staff from terminal cache
  useEffect(() => {
    setRecentStaff(getStoredRecentStaff());
  }, []);

  // Sync remembered mobile if updated externally
  useEffect(() => {
    if (rememberedMobile && !mobile) {
      const clean = rememberedMobile.replace(/[^0-9]/g, '').slice(-10);
      if (clean.length === 10) {
        setMobile(clean);
        setStep('pin');
      }
    }
  }, [rememberedMobile, mobile]);

  // Live clock & Date
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
      setCurrentDate(
        now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
      );
    };
    updateDateTime();
    const interval = setInterval(updateDateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => {
      setIsShaking(false);
    }, 500);
  };

  // --- STEP 1: MOBILE ENTRY HANDLERS ---
  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
    setMobile(cleaned);
    if (errorMsg) setErrorMsg(null);

    // Auto-advance to PIN pad when 10 digits are reached
    if (cleaned.length === 10) {
      setTimeout(() => {
        setErrorMsg(null);
        setPin('');
        setStep('pin');
      }, 160);
    }
  };

  const handleContinueToPin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = mobile.replace(/[^0-9]/g, '').slice(-10);
    if (clean.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }
    setErrorMsg(null);
    setPin('');
    setStep('pin');
  };

  const handleSelectRecentStaff = (staff: RecentStaff) => {
    setMobile(staff.mobile);
    setPin('');
    setErrorMsg(null);
    setStep('pin');
  };

  const handleBackToMobile = () => {
    setPin('');
    setErrorMsg(null);
    setStep('mobile');
    setTimeout(() => {
      mobileInputRef.current?.focus();
    }, 120);
  };

  // --- STEP 2: PIN VERIFICATION HANDLERS ---
  const handleVerifyPin = useCallback(
    async (pinToVerify: string) => {
      if (isVerifying || pinToVerify.length !== 4) return;
      const cleanMobile = mobile.replace(/[^0-9]/g, '').slice(-10);

      setIsVerifying(true);
      setErrorMsg(null);

      try {
        const result = await unlockWithPin(pinToVerify, cleanMobile);
        if (result.success) {
          storeRecentStaff({
            mobile: cleanMobile,
            name: activeStaffName || user?.name,
            role: user?.roles?.[0] || 'Staff',
          });
          if (onSuccess) {
            onSuccess();
          }
        } else {
          triggerShake();
          setErrorMsg(result.message || 'Incorrect PIN. Try again (Default: 1234)');
          setPin('');
        }
      } catch (err: any) {
        triggerShake();
        setErrorMsg('Authentication failed. Please check connection and try again.');
        setPin('');
      } finally {
        setIsVerifying(false);
      }
    },
    [isVerifying, mobile, unlockWithPin, activeStaffName, user, onSuccess]
  );

  const handleKeyPress = useCallback(
    (val: string) => {
      if (isVerifying) return;

      if (step === 'pin') {
        if (pin.length >= 4) return;
        const nextPin = pin + val;
        setPin(nextPin);
        if (errorMsg) setErrorMsg(null);

        if (nextPin.length === 4) {
          setTimeout(() => {
            handleVerifyPin(nextPin);
          }, 80);
        }
      } else {
        if (mobile.length >= 10) return;
        const nextMobile = mobile + val;
        setMobile(nextMobile);
        if (errorMsg) setErrorMsg(null);

        if (nextMobile.length === 10) {
          setTimeout(() => {
            setErrorMsg(null);
            setPin('');
            setStep('pin');
          }, 160);
        }
      }
    },
    [step, pin, mobile, isVerifying, errorMsg, handleVerifyPin]
  );

  const handleDelete = useCallback(() => {
    if (isVerifying) return;
    if (step === 'pin') {
      if (pin.length > 0) {
        setPin((prev) => prev.slice(0, -1));
        if (errorMsg) setErrorMsg(null);
      }
    } else {
      if (mobile.length > 0) {
        setMobile((prev) => prev.slice(0, -1));
        if (errorMsg) setErrorMsg(null);
      }
    }
  }, [step, isVerifying, pin.length, mobile.length, errorMsg]);

  const handleClear = useCallback(() => {
    if (isVerifying) return;
    if (step === 'pin') {
      setPin('');
    } else {
      setMobile('');
    }
    if (errorMsg) setErrorMsg(null);
  }, [step, isVerifying, errorMsg]);

  // Physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter' && step === 'mobile' && mobile.length === 10) {
        e.preventDefault();
        handleContinueToPin();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, mobile.length, handleKeyPress, handleDelete, handleClear]);

  const restName = activeRestaurant?.restaurantName || 'Menza Restaurant POS';
  const restSubtitle = activeRestaurant?.city || activeRestaurant?.address || 'Terminal Active';
  const operatorLabel = activeStaffName || user?.name || null;
  const operatorInitial = operatorLabel ? operatorLabel.charAt(0).toUpperCase() : 'O';

  // Tactile sublabels for POS dialpad
  const keySubLabels: Record<string, string> = {
    '1': '',
    '2': 'ABC',
    '3': 'DEF',
    '4': 'GHI',
    '5': 'JKL',
    '6': 'MNO',
    '7': 'PQRS',
    '8': 'TUV',
    '9': 'WXYZ',
    '0': '+',
  };

  return (
    <div
      className={`flex min-h-screen w-full flex-col items-center justify-between p-3 sm:p-5 select-none transition-colors ${
        isOverlay
          ? 'fixed inset-0 z-50 overflow-y-auto bg-[#FAF7F2]/95 dark:bg-[#111418]/95 backdrop-blur-md'
          : 'relative bg-[#FAF7F2] dark:bg-[#111418]'
      }`}
    >
      {/* 
        ========================================================================
        AMBIENT LUXURY RESTAURANT WARM LIGHTING
        ========================================================================
      */}
      <div className="fixed -top-36 left-1/2 -translate-x-1/2 h-[420px] w-[650px] rounded-full bg-gradient-to-b from-[#FEA619]/25 via-[#DE8626]/12 to-transparent blur-3xl pointer-events-none" />
      <div className="fixed -bottom-40 -left-40 h-[380px] w-[380px] rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      <div className="fixed -bottom-40 -right-40 h-[380px] w-[380px] rounded-full bg-[#DE8626]/10 blur-3xl pointer-events-none" />

      {/* 
        ========================================================================
        TOP BAR: OUTLET PILL & LIVE CLOCK
        ========================================================================
      */}
      <header className="relative z-10 w-full max-w-md flex items-center justify-between py-1.5 sm:py-2">
        <div className="flex items-center gap-2.5 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF]/90 dark:bg-[#1B2127]/90 backdrop-blur-md px-3.5 py-1.5 shadow-xs">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-[#DE8626]">
            <Store className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-[#1E2930] dark:text-[#F3F4F6] truncate max-w-[170px] sm:max-w-xs">
              {restName}
            </p>
            <p className="text-[10px] font-semibold text-[#8C7A6B] dark:text-[#94A3B8] truncate max-w-[170px] sm:max-w-xs">
              {restSubtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF]/90 dark:bg-[#1B2127]/90 backdrop-blur-md px-3 py-1.5 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] shadow-xs">
            <Clock className="h-3.5 w-3.5 text-[#DE8626]" />
            <span className="font-mono">{currentTime}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF]/90 dark:bg-[#1B2127]/90 backdrop-blur-md p-1.5 text-[#8C7A6B] dark:text-[#94A3B8] hover:text-[#DE8626] transition-colors shadow-xs"
            title="PIN Login Help"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* 
        ========================================================================
        MAIN CONSOLE: HIGH-VISIBILITY LUXURY PIN CARD
        ========================================================================
      */}
      <main className="relative z-10 my-auto w-full max-w-[390px] sm:max-w-[420px] flex flex-col items-center">
        {/* Card Shell */}
        <div className="w-full rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF]/95 dark:bg-[#1B2127]/95 backdrop-blur-2xl p-5 sm:p-7 shadow-2xl shadow-amber-950/10 flex flex-col items-center transition-all">
          
          {/* 
            1. PROMINENT MENZA CLOCHE LOGO EMBLEM
            Placed proudly at top center with warm radiant halo
          */}
          <div className="relative mb-3 flex flex-col items-center">
            <div className="relative group">
              <div className="absolute inset-0 rounded-full bg-gradient-to-t from-[#FEA619]/35 via-[#DE8626]/20 to-transparent blur-xl transform scale-125 pointer-events-none" />
              <img
                src="/brand/menza_logo_clean.png"
                alt="Menza — Order • Dine • Delight"
                className="relative h-15 sm:h-17 w-auto object-contain drop-shadow-md transition-transform duration-300 hover:scale-105"
              />
            </div>
          </div>

          {/* 
            2. SEGMENTED AUTH MODE SWITCHER
          */}
          {showSwitchToOtp && (
            <div className="flex items-center rounded-2xl bg-[#FAF7F2] dark:bg-[#151A20] border border-[#E7E1DA] dark:border-[#2B3540] p-1 mb-4 w-full">
              <div className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-black bg-[#FFFFFF] dark:bg-[#1B2127] text-[#DE8626] shadow-xs">
                <Lock className="h-3.5 w-3.5 text-[#DE8626]" />
                <span>Quick Staff PIN</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('otp');
                  if (onSwitchToOtp) onSwitchToOtp();
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold text-[#8C7A6B] dark:text-[#94A3B8] hover:text-[#DE8626] transition-colors"
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Mobile OTP</span>
              </button>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 1: OPERATOR MOBILE NUMBER IDENTIFICATION            */}
          {/* ======================================================== */}
          {step === 'mobile' ? (
            <div className="w-full flex flex-col items-center animate-in fade-in duration-200">
              <div className="text-center mb-3">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                  Operator Identification
                </h1>
                <p className="mt-0.5 text-xs font-medium text-[#667085] dark:text-[#94A3B8]">
                  Select recent staff or enter 10-digit mobile number
                </p>
              </div>

              {/* Quick Staff Switch Chips */}
              {recentStaff.length > 0 && (
                <div className="mb-3.5 w-full">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#8C7A6B]">
                      Recent Operators
                    </span>
                    <span className="text-[10px] text-[#DE8626] font-bold">1-Tap Switch</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {recentStaff.map((staff) => (
                      <button
                        key={staff.mobile}
                        type="button"
                        onClick={() => handleSelectRecentStaff(staff)}
                        className="flex items-center gap-2 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-2 hover:border-[#DE8626] hover:bg-amber-500/5 transition-all text-left group active:scale-98 shadow-xs"
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-[#DE8626] to-[#B7791F] text-xs font-black text-white shrink-0 shadow-xs">
                          {staff.name ? staff.name.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-[#1E2930] dark:text-[#F3F4F6] truncate">
                            {staff.name || 'Staff'}
                          </p>
                          <p className="text-[10px] text-[#8C7A6B] dark:text-[#94A3B8] font-mono leading-none">
                            •••• {staff.mobile.slice(-4)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="mb-3 w-full flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 p-2.5 text-xs text-red-700 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                  <span className="font-bold">{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleContinueToPin} className="w-full space-y-3">
                <div>
                  <div className="flex items-center rounded-2xl border-2 border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2.5 shadow-inner focus-within:border-[#DE8626] focus-within:bg-[#FFFFFF] dark:focus-within:bg-[#1B2127] focus-within:ring-2 focus-within:ring-[#DE8626]/20 transition-all">
                    <div className="flex items-center gap-1.5 pr-2.5 border-r border-[#E7E1DA] dark:border-[#2B3540] select-none text-xs font-black text-[#1E2930] dark:text-[#F3F4F6]">
                      <span className="text-sm leading-none">🇮🇳</span>
                      <span>+91</span>
                      <ChevronDown className="h-3 w-3 text-[#667085]" />
                    </div>
                    <input
                      ref={mobileInputRef}
                      type="tel"
                      autoFocus
                      inputMode="numeric"
                      value={mobile}
                      onChange={handleMobileChange}
                      placeholder="Enter 10-digit mobile"
                      maxLength={10}
                      className="w-full bg-transparent pl-3 text-base sm:text-lg font-black tracking-wider text-[#1E2930] dark:text-[#F3F4F6] outline-none placeholder:text-[#94A3B8]"
                    />
                    {mobile.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setMobile('')}
                        className="text-xs font-bold text-[#8C7A6B] hover:text-red-600 px-1"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={mobile.length !== 10}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#DE8626] via-[#D96B14] to-[#B7791F] py-3 text-sm font-black text-white shadow-lg shadow-[#DE8626]/30 hover:from-[#C4721C] hover:to-[#A86414] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.99]"
                >
                  <span>Continue to PIN</span>
                  <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                </button>
              </form>

              {/* On-Screen Touch Keypad for touchscreens */}
              <div className="mt-4 w-full">
                <div className="grid grid-cols-3 gap-2 w-full">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleKeyPress(digit)}
                      className="flex flex-col items-center justify-center h-12 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/90 dark:bg-[#151A20]/90 hover:border-[#DE8626] hover:bg-[#FFFFFF] dark:hover:bg-[#1B2127] active:scale-95 transition-all shadow-xs"
                    >
                      <span className="text-lg font-black text-[#1E2930] dark:text-[#F3F4F6] leading-none">
                        {digit}
                      </span>
                      {keySubLabels[digit] && (
                        <span className="text-[8px] font-bold text-[#8C7A6B] dark:text-[#94A3B8] tracking-widest mt-0.5">
                          {keySubLabels[digit]}
                        </span>
                      )}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={mobile.length === 0}
                    onClick={handleClear}
                    className="flex items-center justify-center h-12 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/90 dark:bg-[#151A20]/90 text-xs font-black text-[#8C7A6B] hover:text-red-600 disabled:opacity-30 active:scale-95 transition-all shadow-xs"
                  >
                    CLR
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeyPress('0')}
                    className="flex flex-col items-center justify-center h-12 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/90 dark:bg-[#151A20]/90 hover:border-[#DE8626] hover:bg-[#FFFFFF] dark:hover:bg-[#1B2127] active:scale-95 transition-all shadow-xs"
                  >
                    <span className="text-lg font-black text-[#1E2930] dark:text-[#F3F4F6] leading-none">
                      0
                    </span>
                    <span className="text-[8px] font-bold text-[#8C7A6B] dark:text-[#94A3B8] tracking-widest mt-0.5">
                      +
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={mobile.length === 0}
                    onClick={handleDelete}
                    className="flex items-center justify-center h-12 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/90 dark:bg-[#151A20]/90 text-[#8C7A6B] hover:text-[#DE8626] disabled:opacity-30 active:scale-95 transition-all shadow-xs"
                  >
                    <Delete className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /* STEP 2: HIGH-VISIBILITY LUXURY PIN PAD                   */
            /* ======================================================== */
            <div className="w-full flex flex-col items-center animate-in fade-in duration-200">
              {/* Recognized Operator Banner */}
              <div className="mb-3 flex items-center justify-between w-full rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 px-3.5 py-2 shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#DE8626] to-[#B7791F] text-xs font-black text-white shrink-0 shadow-md">
                      {operatorInitial}
                    </div>
                    <img
                      src="/brand/panda_chef_clean.png"
                      alt="Panda Chef"
                      className="absolute -bottom-1 -right-1 h-4 w-4 object-contain drop-shadow-xs"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-black text-[#1E2930] dark:text-[#F3F4F6] truncate text-xs sm:text-sm">
                        {operatorLabel || 'Staff Operator'}
                      </p>
                      <span className="rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">
                        Active
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8C7A6B] dark:text-[#94A3B8] font-mono leading-tight font-bold">
                      +91 {mobile.slice(0, 5)} {mobile.slice(5)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleBackToMobile}
                  className="flex items-center gap-1 rounded-xl bg-white dark:bg-[#1B2127] px-2.5 py-1 text-xs font-black text-[#DE8626] border border-amber-200 dark:border-amber-900/50 hover:bg-amber-500/10 transition-all shadow-xs shrink-0 active:scale-95"
                >
                  <ArrowRightLeft className="h-3 w-3" />
                  <span>Switch</span>
                </button>
              </div>

              {/* Title */}
              <h2 className="text-sm sm:text-base font-black tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                Enter 4-Digit Staff PIN
              </h2>

              {/* 
                4 LUXURY HIGH-VISIBILITY PIN VAULT BOXES 
                Large, unmistakable, jewel-like digit indicators
              */}
              <div
                className={`my-3 flex items-center justify-center gap-3 sm:gap-3.5 ${
                  isShaking ? 'animate-shake' : ''
                }`}
              >
                {[0, 1, 2, 3].map((idx) => {
                  const isFilled = pin.length > idx;
                  const isCurrent = pin.length === idx;
                  return (
                    <div
                      key={`pin-vault-${idx}`}
                      className={`flex h-13 w-12 sm:h-14 sm:w-13 items-center justify-center rounded-2xl border-2 transition-all duration-200 transform ${
                        isFilled
                          ? 'scale-105 border-[#DE8626] bg-gradient-to-br from-[#DE8626] to-[#CB741B] text-white shadow-lg shadow-[#DE8626]/40 ring-4 ring-[#DE8626]/20'
                          : isCurrent
                          ? 'border-[#DE8626] bg-[#FFFFFF] dark:bg-[#1B2127] ring-4 ring-[#DE8626]/15 shadow-sm'
                          : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20]'
                      }`}
                    >
                      {isFilled ? (
                        <div className="h-3.5 w-3.5 rounded-full bg-white shadow-xs animate-in zoom-in-75 duration-150" />
                      ) : (
                        <div
                          className={`h-2 w-2 rounded-full ${
                            isCurrent
                              ? 'bg-[#DE8626] animate-pulse'
                              : 'bg-[#E7E1DA] dark:bg-[#2B3540]'
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Status Message / Error Alert */}
              <div className="min-h-[22px] mb-2.5 text-center">
                {isVerifying ? (
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#DE8626]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Authenticating credentials...</span>
                  </div>
                ) : errorMsg ? (
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                    <span>{errorMsg}</span>
                  </div>
                ) : (
                  <p className="text-[11px] font-medium text-[#8C7A6B] dark:text-[#94A3B8]">
                    Enter 4-digit PIN • Default: <strong className="font-extrabold text-[#DE8626]">1234</strong>
                  </p>
                )}
              </div>

              {/* 
                ULTRA-TACTILE 3x4 LUXURY KEYPAD
                Crisp contrast, comfortable touch targets, responsive haptic feel
              */}
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5 w-full">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    disabled={isVerifying}
                    onClick={() => handleKeyPress(digit)}
                    className="flex flex-col items-center justify-center h-13 sm:h-14 w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] shadow-xs hover:border-[#DE8626] hover:bg-amber-500/5 hover:text-[#DE8626] hover:shadow-md hover:shadow-amber-500/10 active:scale-95 active:bg-[#DE8626] active:text-white disabled:opacity-40 transition-all select-none group"
                  >
                    <span className="text-xl sm:text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6] group-hover:text-[#DE8626] group-active:text-white leading-none">
                      {digit}
                    </span>
                    {keySubLabels[digit] && (
                      <span className="text-[9px] font-extrabold text-[#8C7A6B] dark:text-[#94A3B8] tracking-widest mt-0.5 group-active:text-white/80">
                        {keySubLabels[digit]}
                      </span>
                    )}
                  </button>
                ))}

                {/* Bottom Row: Clear, 0, Backspace */}
                <button
                  type="button"
                  disabled={isVerifying || pin.length === 0}
                  onClick={handleClear}
                  className="flex flex-col items-center justify-center h-13 sm:h-14 w-full rounded-2xl border border-rose-200/60 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 text-xs font-black text-rose-700 dark:text-rose-400 hover:bg-rose-100/70 hover:border-rose-300 active:scale-95 disabled:opacity-30 transition-all select-none shadow-xs"
                  title="Clear PIN"
                >
                  <span>CLR</span>
                  <span className="text-[8px] font-bold text-rose-500/70 dark:text-rose-400/70 tracking-tight">Reset</span>
                </button>

                <button
                  type="button"
                  disabled={isVerifying}
                  onClick={() => handleKeyPress('0')}
                  className="flex flex-col items-center justify-center h-13 sm:h-14 w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] shadow-xs hover:border-[#DE8626] hover:bg-amber-500/5 hover:text-[#DE8626] hover:shadow-md hover:shadow-amber-500/10 active:scale-95 active:bg-[#DE8626] active:text-white disabled:opacity-40 transition-all select-none group"
                >
                  <span className="text-xl sm:text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6] group-hover:text-[#DE8626] group-active:text-white leading-none">
                    0
                  </span>
                  <span className="text-[9px] font-extrabold text-[#8C7A6B] dark:text-[#94A3B8] tracking-widest mt-0.5 group-active:text-white/80">
                    +
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isVerifying || pin.length === 0}
                  onClick={handleDelete}
                  className="flex flex-col items-center justify-center h-13 sm:h-14 w-full rounded-2xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 text-[#DE8626] hover:bg-amber-100/70 hover:border-amber-300 active:scale-95 disabled:opacity-30 transition-all select-none shadow-xs"
                  title="Backspace"
                >
                  <Delete className="h-5 w-5 stroke-[2.2]" />
                  <span className="text-[8px] font-bold text-[#8C7A6B] dark:text-[#94A3B8] tracking-tight">Del</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 
        ========================================================================
        FOOTER ACTIONS & BRAND SECURITY TAG
        ========================================================================
      */}
      <footer className="relative z-10 w-full max-w-md flex flex-col items-center gap-1.5 py-2">
        {step === 'pin' && (
          <div className="flex items-center justify-center gap-3 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                if (onForgotPin) {
                  onForgotPin(mobile);
                } else {
                  setAuthMode('forgot_pin');
                }
              }}
              className="flex items-center gap-1 text-[#DE8626] hover:underline transition-colors"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>Forgot PIN? (SMS OTP)</span>
            </button>
            <span className="text-[#E7E1DA] dark:text-[#2B3540]">•</span>
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="text-[#8C7A6B] dark:text-[#94A3B8] hover:text-[#DE8626] transition-colors"
            >
              Master PIN: 1234
            </button>
          </div>
        )}

        {isOverlay && (
          <button
            type="button"
            onClick={() => {
              logout();
              setAuthMode('otp');
              if (onSwitchToOtp) onSwitchToOtp();
            }}
            className="flex items-center gap-1.5 text-[11px] font-black text-[#8C7A6B] hover:text-red-600 transition-colors"
          >
            <LogOut className="h-3 w-3" />
            <span>Switch Account / Sign Out</span>
          </button>
        )}

        <div className="flex items-center gap-2 text-[10px] font-bold text-[#8C7A6B] dark:text-[#94A3B8]">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Menza POS • Order • Dine • Delight • SHA-256 Vault</span>
        </div>
      </footer>

      {/* 
        ========================================================================
        HELP MODAL
        ========================================================================
      */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-[#DE8626]">
                <HelpCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#1E2930] dark:text-[#F3F4F6]">
                  Staff Authentication Guide
                </h3>
                <p className="text-[11px] font-medium text-[#667085] dark:text-[#94A3B8]">
                  Quick operator switching instructions
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20 p-3.5 space-y-2 text-xs text-[#1E2930] dark:text-[#F3F4F6]">
              <p className="font-extrabold text-[#DE8626]">
                Default Master PIN: <strong>1234</strong>
              </p>
              <p className="text-[11px] leading-relaxed text-[#667085] dark:text-[#94A3B8]">
                Each employee (Cashier, Waiter, Manager) can have an individual 4-digit PIN assigned in{' '}
                <strong>Staff Management</strong>. Entering their mobile number and PIN immediately switches the active operator.
              </p>
              <p className="text-[10px] text-[#8C7A6B] dark:text-[#94A3B8] font-bold">
                Keyboard shortcuts: 0-9 to enter digits, Backspace to delete, Esc to clear.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="w-full rounded-2xl bg-gradient-to-r from-[#DE8626] via-[#D96B14] to-[#B7791F] py-2.5 text-xs font-black text-white shadow-md shadow-[#DE8626]/20 hover:from-[#C4721C] hover:to-[#A86414] transition-all"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
