'use client';

import React, { useState } from 'react';
import { Store, Power, Clock, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { RestaurantConfigRemoteDataSource } from '@shared/data/datasources/RestaurantConfigRemoteDataSource';
import { StoreOperatingStatus } from '@shared/domain/models/RestaurantConfig';

interface StoreShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: number;
  restaurantName: string;
  currentStatus: StoreOperatingStatus | null;
  onStatusUpdated: (status: StoreOperatingStatus) => void;
}

export function StoreShiftModal({
  isOpen,
  onClose,
  restaurantId,
  restaurantName,
  currentStatus,
  onStatusUpdated,
}: StoreShiftModalProps) {
  const [isOpenShift, setIsOpenShift] = useState(Boolean(currentStatus?.isOpen));
  const [openingTime, setOpeningTime] = useState(currentStatus?.openingTime || '09:00');
  const [closingTime, setClosingTime] = useState(currentStatus?.closingTime || '23:00');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const ds = new RestaurantConfigRemoteDataSource();
      const updated = await ds.toggleOrdering(restaurantId, {
        isAccepting: isOpenShift,
        reason: isOpenShift ? 'Shift opened via Web App' : 'Shift closed via Web App',
        mode: 'MANUAL',
      });

      if (openingTime && closingTime) {
        try {
          await ds.updateOperatingHours(restaurantId, {
            openingTime,
            closingTime,
            orderingMode: 'MANUAL',
          });
        } catch (hourErr) {
          console.warn('Could not update operating hours:', hourErr);
        }
      }

      const result: StoreOperatingStatus = updated || {
        ...(currentStatus || {}),
        restaurantId,
        restaurantName: currentStatus?.restaurantName || restaurantName,
        isOpen: isOpenShift,
        orderingMode: 'MANUAL',
        status: isOpenShift ? 'OPEN' : 'CLOSED',
        statusMessage: isOpenShift ? 'Store is open' : 'Store is closed',
        openingTime,
        closingTime,
        lastOrderTime: currentStatus?.lastOrderTime || closingTime,
        lastOrderBufferMinutes: currentStatus?.lastOrderBufferMinutes || 0,
        canPlaceOrder: isOpenShift,
        isKitchenActive: currentStatus?.isKitchenActive ?? true,
      };

      onStatusUpdated(result);
      onClose();
    } catch (err: any) {
      alert(err?.message || 'Failed to update store operating shift');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-[#DE8626]" />
            <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">Daily Store Shift</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-[#667085] hover:bg-black/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
          Toggle your store active shift status for billing, customer online orders, and kitchen operations.
        </p>

        {/* Big Switch Card */}
        <div
          onClick={() => setIsOpenShift(!isOpenShift)}
          className={`cursor-pointer rounded-2xl border p-4 flex items-center justify-between transition-all ${
            isOpenShift
              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-400'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${
                isOpenShift ? 'bg-emerald-600' : 'bg-red-600'
              }`}
            >
              <Power className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold">{isOpenShift ? 'Store Open' : 'Store Closed'}</h4>
              <p className="text-[11px] opacity-80">
                {isOpenShift ? 'Actively taking bills & orders' : 'Shift currently closed'}
              </p>
            </div>
          </div>
          <span className="text-xs font-bold underline">Change</span>
        </div>

        {/* Operating Timings */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block font-semibold mb-1 text-[#667085]">Opening Time</label>
            <input
              type="time"
              value={openingTime}
              onChange={(e) => setOpeningTime(e.target.value)}
              className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-2 outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-[#667085]">Closing Time</label>
            <input
              type="time"
              value={closingTime}
              onChange={(e) => setClosingTime(e.target.value)}
              className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-2 outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E7E1DA] dark:border-[#2B3540]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#E7E1DA] px-4 py-2 text-xs font-semibold text-[#667085]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="rounded-xl bg-[#DE8626] px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-[#C4721C] disabled:opacity-50"
          >
            {isSaving ? 'Updating...' : 'Save Shift Status'}
          </button>
        </div>
      </div>
    </div>
  );
}
