'use client';

import React, { useState } from 'react';
import { AlertTriangle, AlertOctagon, Clock, ArrowRight, X } from 'lucide-react';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';

interface SubscriptionGraceBannerProps {
  onRenewPress?: () => void;
}

export const SubscriptionGraceBanner: React.FC<SubscriptionGraceBannerProps> = ({ onRenewPress }) => {
  const {
    subscription,
    lifecycleState,
    daysRemaining,
    isInGracePeriod,
    graceDaysRemaining,
    isExpired,
    hasLoaded,
    openRenewalModal,
  } = useSubscriptionStore();

  const [dismissedExpiringSoon, setDismissedExpiringSoon] = useState(false);

  // If subscription data has not loaded or active with > 3 days left, do not display
  const isExpiringSoon = !isInGracePeriod && !isExpired && daysRemaining > 0 && daysRemaining <= 3;

  if (!hasLoaded) {
    return null;
  }

  if (!isExpired && !isInGracePeriod && !isExpiringSoon && lifecycleState !== 'PENDING') {
    return null;
  }

  if (isExpiringSoon && dismissedExpiringSoon) {
    return null;
  }

  const handleAction = () => {
    if (onRenewPress) {
      onRenewPress();
    } else {
      openRenewalModal();
    }
  };

  let bannerClass = 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200';
  let badgeClass = 'bg-amber-500/20 text-[#DE8626] border-amber-500/30';
  let btnClass = 'bg-[#DE8626] hover:bg-[#C4721C] text-white shadow-amber-500/20';
  let title = '';
  let subtitle = '';
  let actionLabel = 'RENEW NOW';
  let IconComponent = AlertTriangle;
  let canDismiss = false;

  if (isExpired || lifecycleState === 'EXPIRED') {
    bannerClass = 'bg-red-500/10 border-red-500/30 text-red-900 dark:text-red-200';
    badgeClass = 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30';
    btnClass = 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20';
    title = 'SUBSCRIPTION EXPIRED';
    subtitle = 'Grace period ended. Operations and order taking are locked until your plan is renewed.';
    actionLabel = 'PAY & RENEW NOW';
    IconComponent = AlertOctagon;
    canDismiss = false;
  } else if (isInGracePeriod || lifecycleState === 'GRACE_PERIOD') {
    bannerClass = 'bg-amber-500/15 border-amber-500/40 text-amber-900 dark:text-amber-100';
    badgeClass = 'bg-amber-500/20 text-[#DE8626] border-amber-500/30';
    btnClass = 'bg-[#DE8626] hover:bg-[#C4721C] text-white shadow-amber-500/20';
    title = `GRACE PERIOD • ${graceDaysRemaining} DAY${graceDaysRemaining === 1 ? '' : 'S'} LEFT`;
    subtitle = 'Your subscription has ended. Orders remain active during grace period, but will lock soon.';
    actionLabel = 'RENEW PLAN';
    IconComponent = Clock;
    canDismiss = false;
  } else if (isExpiringSoon) {
    bannerClass = 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200';
    badgeClass = 'bg-amber-500/20 text-[#DE8626] border-amber-500/30';
    btnClass = 'bg-[#DE8626] hover:bg-[#C4721C] text-white shadow-amber-500/20';
    title = `EXPIRES IN ${daysRemaining} DAY${daysRemaining === 1 ? '' : 'S'}`;
    subtitle = 'Renew your store subscription early to prevent any service interruptions.';
    actionLabel = 'RENEW EARLY';
    IconComponent = AlertTriangle;
    canDismiss = true;
  } else {
    return null;
  }

  return (
    <div className={`w-full border-b px-4 py-2.5 transition-all shadow-sm ${bannerClass}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/40 dark:bg-black/20">
            <IconComponent className="h-4 w-4 shrink-0 text-current" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${badgeClass}`}>
                {title}
              </span>
              <p className="text-xs font-medium truncate sm:whitespace-normal">
                {subtitle}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleAction}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all shadow-sm hover:scale-[1.02] active:scale-[0.98] ${btnClass}`}
          >
            <span>{actionLabel}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>

          {canDismiss && (
            <button
              onClick={() => setDismissedExpiringSoon(true)}
              className="rounded-lg p-1 text-current/60 hover:text-current hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              aria-label="Dismiss warning"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
