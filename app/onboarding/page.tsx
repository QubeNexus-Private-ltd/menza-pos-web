'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingBag,
  UtensilsCrossed,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';

const SLIDES = [
  {
    id: 1,
    badge: 'POS & KOT SYSTEM',
    title: 'Lightning-Fast POS & Instant Kitchen KOT',
    description:
      'Engineered for peak counter service, dine-in tables, and high-volume delivery. Punch orders in seconds with zero latency kitchen synchronization.',
    icon: ShoppingBag,
    gradient: 'from-amber-500/20 to-orange-500/20',
    iconColor: 'text-[#DE8626]',
  },
  {
    id: 2,
    badge: 'DIGITAL CATALOG & INVENTORY',
    title: 'Live Menu Catalog & Instant Item Toggles',
    description:
      'Update item pricing, toggle availability in real-time across counter and customer QR codes, and customize variants and modifier options effortlessly.',
    icon: UtensilsCrossed,
    gradient: 'from-emerald-500/20 to-teal-500/20',
    iconColor: 'text-emerald-500',
  },
  {
    id: 3,
    badge: 'MULTI-STORE ANALYTICS',
    title: 'Multi-Outlet Analytics & Staff Role Security',
    description:
      'Switch between locations, monitor live daily sales, track hourly heatmap spikes, and manage Cashier, Waiter, and Kitchen roles with enterprise precision.',
    icon: TrendingUp,
    gradient: 'from-blue-500/20 to-indigo-500/20',
    iconColor: 'text-blue-500',
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { setCompletedOnboarding, isAuthenticated } = useAuthStore();
  const [activeIndex, setActiveIndex] = useState(0);

  const currentSlide = SLIDES[activeIndex];
  const Icon = currentSlide.icon;

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      setActiveIndex(activeIndex + 1);
    } else {
      setCompletedOnboarding(true);
      router.replace(isAuthenticated ? '/dashboard' : '/login');
    }
  };

  const handleSkip = () => {
    setCompletedOnboarding(true);
    router.replace(isAuthenticated ? '/dashboard' : '/login');
  };

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-[#FAF7F2] dark:bg-[#111418] p-4">
      <div className="relative w-full max-w-lg rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-8 sm:p-10 shadow-2xl shadow-amber-900/5">
        {/* Header skip link */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#DE8626] text-white font-extrabold text-sm">
              M
            </div>
            <span className="font-bold text-sm text-[#1E2930] dark:text-[#F3F4F6]">Menza POS</span>
          </div>
          <button
            onClick={handleSkip}
            className="text-xs font-semibold text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6] transition-colors"
          >
            Skip Intro
          </button>
        </div>

        {/* Feature Visual Hero Card */}
        <div
          className={`flex flex-col items-center justify-center rounded-3xl bg-gradient-to-br ${currentSlide.gradient} p-12 text-center transition-all duration-300 mb-8 border border-[#E7E1DA]/40 dark:border-[#2B3540]/40`}
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white dark:bg-[#111418] shadow-lg shadow-black/5 mb-4">
            <Icon className={`h-10 w-10 ${currentSlide.iconColor}`} />
          </div>
          <span className="rounded-full bg-white/80 dark:bg-[#111418]/80 px-3 py-1 text-[10px] font-extrabold tracking-widest text-[#DE8626] uppercase">
            {currentSlide.badge}
          </span>
        </div>

        {/* Slide Copy */}
        <div className="text-center mb-8">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1E2930] dark:text-[#F3F4F6] mb-3">
            {currentSlide.title}
          </h2>
          <p className="text-xs sm:text-sm leading-relaxed text-[#667085] dark:text-[#94A3B8]">
            {currentSlide.description}
          </p>
        </div>

        {/* Pagination Dots */}
        <div className="flex justify-center items-center gap-2 mb-8">
          {SLIDES.map((slide, idx) => (
            <button
              key={slide.id}
              onClick={() => setActiveIndex(idx)}
              className={`h-2 rounded-full transition-all duration-300 ${
                activeIndex === idx ? 'w-8 bg-[#DE8626]' : 'w-2 bg-[#E7E1DA] dark:bg-[#2B3540]'
              }`}
            />
          ))}
        </div>

        {/* Action Button */}
        <button
          onClick={handleNext}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#DE8626] py-3.5 text-sm font-bold text-white shadow-md shadow-[#DE8626]/25 hover:bg-[#C4721C] transition-all"
        >
          <span>{activeIndex === SLIDES.length - 1 ? 'Get Started' : 'Next Step'}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
