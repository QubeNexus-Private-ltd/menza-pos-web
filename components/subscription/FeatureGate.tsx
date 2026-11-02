'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Crown, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';

interface FeatureGateProps {
  feature: string;
  title: string;
  description?: string;
  planSuggestion?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  title,
  description,
  planSuggestion = 'Dine-In Pro or Enterprise Plan',
  children,
  fallback,
}) => {
  const router = useRouter();
  const { isFeatureAllowed, isAppAllowed, openRenewalModal, hasLoaded } = useSubscriptionStore();

  // If subscription has not loaded yet, render children to prevent flash
  if (!hasLoaded) {
    return <>{children}</>;
  }

  // Check Application Level Gate first
  const isWebPosAllowed = isAppAllowed('webPos');
  if (!isWebPosAllowed) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6 bg-[#FAF7F2]">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-amber-200/60 shadow-xl shadow-amber-900/5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-5 text-amber-600 shadow-inner">
            <Lock className="w-8 h-8 text-amber-600" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100/80 text-amber-800 border border-amber-200 mb-3">
            <Crown className="w-3.5 h-3.5 text-amber-600" />
            Client Application Locked
          </span>
          <h2 className="text-xl font-bold text-stone-900 mb-2">Web POS Terminal Not Licensed</h2>
          <p className="text-sm text-stone-600 mb-6 leading-relaxed">
            Your restaurant subscription does not include browser-based Desktop Web POS access. Please upgrade your subscription to access the desktop terminal.
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => openRenewalModal(undefined, 'explore')}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600 text-white font-medium rounded-xl shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Upgrade Plan
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded-xl transition-all text-sm"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check Functional Feature Level Gate
  const isAllowed = isFeatureAllowed(feature);
  if (isAllowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="min-h-[65vh] flex items-center justify-center p-6 bg-[#FAF7F2]">
      <div className="max-w-lg w-full bg-white rounded-3xl p-8 border border-amber-100 shadow-2xl shadow-stone-900/5 text-center relative overflow-hidden">
        {/* Subtle decorative background gradient */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-100/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-orange-100/40 rounded-full blur-3xl pointer-events-none" />

        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/80 flex items-center justify-center mx-auto mb-5 text-amber-600 shadow-sm">
          <Lock className="w-8 h-8 text-[#D96B14]" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 mb-3">
          <Crown className="w-3.5 h-3.5 text-amber-600" />
          Requires {planSuggestion}
        </div>

        <h2 className="text-2xl font-bold text-stone-900 mb-2">{title}</h2>
        <p className="text-sm text-stone-600 mb-6 max-w-sm mx-auto leading-relaxed">
          {description ||
            `The ${title} module is not included in your restaurant's active subscription plan. Upgrade your plan to unlock this functionality on your POS.`}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <button
            onClick={() => openRenewalModal(undefined, 'explore')}
            className="w-full sm:w-auto py-3 px-6 bg-gradient-to-r from-[#D96B14] to-[#E08726] hover:from-[#CB5F0D] hover:to-[#D57B1A] text-white font-semibold rounded-xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Upgrade Subscription
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full sm:w-auto py-3 px-5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded-xl transition-all text-sm"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
