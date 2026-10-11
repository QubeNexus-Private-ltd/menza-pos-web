'use client';

import React, { useState } from 'react';
import {
  X,
  Clock,
  PlayCircle,
  PauseCircle,
  PowerOff,
  AlertCircle,
  CheckCircle2,
  Store,
  ChefHat,
  Loader2,
  Coffee,
  Wallet,
} from 'lucide-react';
import { StoreOperatingStatus, ToggleOrderingRequest } from '@shared/domain/models/RestaurantConfig';
import { RestaurantConfigRemoteDataSource } from '@shared/data/datasources/RestaurantConfigRemoteDataSource';

const configDataSource = new RestaurantConfigRemoteDataSource();

interface StoreOperatingStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: number;
  restaurantName: string;
  status: StoreOperatingStatus | null;
  onStatusUpdated?: (status: StoreOperatingStatus) => void;
}

export const StoreOperatingStatusModal: React.FC<StoreOperatingStatusModalProps> = ({
  isOpen,
  onClose,
  restaurantId,
  restaurantName,
  status,
  onStatusUpdated,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pauseDuration, setPauseDuration] = useState<number>(30);
  const [pauseReason, setPauseReason] = useState<string>('Kitchen rush');

  if (!isOpen) return null;

  const handleUpdate = async (request: ToggleOrderingRequest) => {
    try {
      setSubmitting(true);
      setError(null);
      const updated = await configDataSource.toggleOrdering(restaurantId, request);
      if (updated) {
        onStatusUpdated?.(updated);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update store operating status');
    } finally {
      setSubmitting(false);
    }
  };

  const currentStatus = status?.status || 'OPEN';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E7E1DA] dark:border-[#2B3540] pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-[#DE8626]">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                Store Operating Controls
              </h3>
              <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                {restaurantName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current State Banner */}
        <div
          className={`flex items-center justify-between rounded-2xl p-4 mb-5 border ${
            currentStatus === 'OPEN'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
              : currentStatus === 'PAUSED'
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
              : 'border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={`h-3 w-3 rounded-full animate-pulse ${
                currentStatus === 'OPEN'
                  ? 'bg-emerald-500'
                  : currentStatus === 'PAUSED'
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
            />
            <div>
              <span className="text-xs font-black uppercase tracking-wider block">
                Store is currently {currentStatus}
              </span>
              <span className="text-[11px] opacity-90 block mt-0.5">
                {status?.statusMessage ||
                  (currentStatus === 'OPEN'
                    ? 'POS orders and online orders are active.'
                    : currentStatus === 'PAUSED'
                    ? 'Orders are temporarily paused.'
                    : 'Outlet is closed. Billing is locked.')}
              </span>
            </div>
          </div>

          {status?.walletBalance !== undefined && (
            <div className="text-right pl-3 border-l border-current/20">
              <span className="text-[10px] uppercase font-bold block opacity-80">Prepaid Wallet</span>
              <span className="text-xs font-black">₹{status.walletBalance.toFixed(2)}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="space-y-4">
          <label className="block text-xs font-bold uppercase text-[#667085] tracking-wider">
            Change Store Operating State
          </label>

          {/* 1. Resume / Open */}
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleUpdate({ isAccepting: true, mode: 'MANUAL' })}
            className={`w-full flex items-center justify-between rounded-2xl border p-4 text-left transition-all ${
              currentStatus === 'OPEN'
                ? 'border-emerald-500 bg-emerald-500/10 shadow-sm'
                : 'border-[#E7E1DA] dark:border-[#2B3540] hover:border-emerald-500/60 bg-[#FAF7F2] dark:bg-[#151A20]'
            }`}
          >
            <div className="flex items-center gap-3">
              <PlayCircle className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <span className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6] block">
                  Open Store & Accept Orders
                </span>
                <span className="text-xs text-[#667085] dark:text-[#94A3B8]">
                  Enable POS cashier billing and live digital ordering
                </span>
              </div>
            </div>
            {currentStatus === 'OPEN' && (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            )}
          </button>

          {/* 2. Temporary Pause */}
          <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] p-4 bg-[#FAF7F2] dark:bg-[#151A20] space-y-3">
            <div className="flex items-center gap-2.5">
              <PauseCircle className="h-5 w-5 text-amber-500 shrink-0" />
              <span className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                Pause Orders Temporarily
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-1">
              {[15, 30, 60, 120].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setPauseDuration(mins)}
                  className={`rounded-xl py-1.5 text-xs font-bold transition-all ${
                    pauseDuration === mins
                      ? 'bg-[#DE8626] text-white shadow-sm'
                      : 'border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#667085]'
                  }`}
                >
                  {mins} mins
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={() =>
                handleUpdate({
                  isAccepting: false,
                  pauseMinutes: pauseDuration,
                  reason: pauseReason || 'Kitchen rush',
                  mode: 'MANUAL',
                })
              }
              className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 py-2.5 text-xs font-bold hover:bg-amber-500/25 transition-colors"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Clock className="h-4 w-4" />
              )}
              <span>Pause for {pauseDuration} minutes</span>
            </button>
          </div>

          {/* 3. Close Store */}
          <button
            type="button"
            disabled={submitting}
            onClick={() =>
              handleUpdate({
                isAccepting: false,
                reason: 'Closed for the day',
                mode: 'MANUAL',
              })
            }
            className={`w-full flex items-center justify-between rounded-2xl border p-4 text-left transition-all ${
              currentStatus === 'CLOSED'
                ? 'border-red-500 bg-red-500/10 shadow-sm'
                : 'border-[#E7E1DA] dark:border-[#2B3540] hover:border-red-500/60 bg-[#FAF7F2] dark:bg-[#151A20]'
            }`}
          >
            <div className="flex items-center gap-3">
              <PowerOff className="h-5 w-5 text-red-600 shrink-0" />
              <div>
                <span className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6] block">
                  Close Store for Today
                </span>
                <span className="text-xs text-[#667085] dark:text-[#94A3B8]">
                  Stop taking all orders until manually reopened tomorrow
                </span>
              </div>
            </div>
            {currentStatus === 'CLOSED' && (
              <CheckCircle2 className="h-5 w-5 text-red-600 shrink-0" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
