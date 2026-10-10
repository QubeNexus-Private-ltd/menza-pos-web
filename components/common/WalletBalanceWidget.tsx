'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Wallet, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { WalletRemoteDataSource } from '@shared/data/datasources/WalletRemoteDataSource';
import { WalletEvents } from '@shared/core/utils/walletEvents';
import { RestaurantWallet } from '@shared/domain/models/Wallet';

const walletDataSource = new WalletRemoteDataSource();

interface WalletBalanceWidgetProps {
  restaurantId?: number;
  onPress?: () => void;
  variant?: 'pill' | 'compact' | 'card';
  className?: string;
}

export const WalletBalanceWidget: React.FC<WalletBalanceWidgetProps> = ({
  restaurantId,
  onPress,
  variant = 'pill',
  className = '',
}) => {
  const { activeRestaurant, restaurants } = useAuthStore();
  const [wallet, setWallet] = useState<RestaurantWallet | null>(null);
  const [loading, setLoading] = useState(true);

  const effectiveRestId =
    restaurantId ||
    activeRestaurant?.restaurantId ||
    (restaurants.length > 0 ? restaurants[0].restaurantId : 0);

  const loadWallet = useCallback(async () => {
    if (!effectiveRestId || effectiveRestId <= 0) {
      setLoading(false);
      return;
    }
    try {
      const data = await walletDataSource.getWallet(effectiveRestId);
      if (data) {
        setWallet(data);
      }
    } catch (err) {
      console.warn('Failed to fetch wallet in widget', err);
    } finally {
      setLoading(false);
    }
  }, [effectiveRestId]);

  useEffect(() => {
    loadWallet();
    const unsubscribe = WalletEvents.subscribe(() => {
      loadWallet();
    });
    return () => {
      unsubscribe();
    };
  }, [loadWallet]);

  const balance = Number(wallet?.balance ?? 0);
  const lowThreshold = Number(wallet?.lowBalanceThreshold ?? 200);
  const isLowBalance = balance < lowThreshold;

  // 1. PILL VARIANT (Header Bar - Identical UX to F:\Menza)
  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={onPress}
        title={`Prepaid Platform Fee Wallet: ₹${balance.toLocaleString('en-IN')}${
          isLowBalance ? ' (Low Balance - Click to Recharge)' : ' (Click to Top Up)'
        }`}
        className={`group inline-flex h-[34px] items-center gap-2 rounded-full border px-2.5 text-xs font-extrabold transition-all cursor-pointer shadow-xs active:scale-[0.98] ${
          isLowBalance
            ? 'border-amber-400 bg-[#FFF7EE] dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 hover:border-[#DE8626] ring-1 ring-amber-400/30'
            : 'border-[#E7E0D6] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#1C1917] dark:text-[#F3F4F6] hover:border-[#DE8626] hover:shadow-sm'
        } ${className}`}
      >
        <div className="flex items-center gap-1.5">
          <Wallet
            className={`h-3.5 w-3.5 shrink-0 ${
              isLowBalance ? 'text-[#DE8626]' : 'text-[#DE8626]'
            }`}
          />
          {loading && !wallet ? (
            <span className="inline-block h-3.5 w-10 animate-pulse rounded bg-black/10 dark:bg-white/10" />
          ) : (
            <span className="text-[12px] font-extrabold tracking-tight">
              ₹{balance.toLocaleString('en-IN')}
            </span>
          )}
        </div>

        {/* Small '+' Top Up Pill Circle Button (exact parity with Menza pillPlus) */}
        <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#DE8626] text-white shadow-xs group-hover:scale-110 transition-transform">
          <Plus className="h-2.5 w-2.5 stroke-[3]" />
        </div>
      </button>
    );
  }

  // 2. COMPACT VARIANT (Used in POS sidebars or quick toolbars)
  if (variant === 'compact') {
    return (
      <div
        onClick={onPress}
        className={`flex items-center justify-between rounded-xl border p-2.5 text-xs transition-all cursor-pointer ${
          isLowBalance
            ? 'border-amber-500/40 bg-amber-500/10'
            : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20]'
        } ${className}`}
      >
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-[#DE8626]" />
          <span className="text-[#667085] dark:text-[#94A3B8]">Wallet:</span>
          <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
            ₹{balance.toLocaleString('en-IN')}
          </span>
        </div>
        <button
          type="button"
          className="rounded-lg bg-[#DE8626] px-2 py-1 text-[11px] font-bold text-white hover:bg-[#C4721C]"
        >
          Top Up
        </button>
      </div>
    );
  }

  // 3. CARD VARIANT (Used in Dashboard & Billing screens)
  return (
    <div
      onClick={onPress}
      className={`rounded-2xl border p-5 transition-all cursor-pointer hover:shadow-md ${
        isLowBalance
          ? 'border-amber-500/40 bg-amber-500/5'
          : 'border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127]'
      } ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#667085] dark:text-[#94A3B8]">
          <Wallet className="h-4 w-4 text-[#DE8626]" />
          <span>Prepaid Platform Wallet</span>
        </div>
        {isLowBalance && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-[#DE8626]">
            Low Balance
          </span>
        )}
      </div>

      <div className="flex items-baseline justify-between">
        <div>
          <span className="text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6]">
            ₹{balance.toLocaleString('en-IN')}
          </span>
          <p className="mt-1 text-[11px] text-[#667085] dark:text-[#94A3B8]">
            Used for transaction commissions & SMS receipts
          </p>
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-xl bg-[#DE8626] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#C4721C]"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Money</span>
        </button>
      </div>
    </div>
  );
};
