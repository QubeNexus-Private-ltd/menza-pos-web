'use client';

import React, { useEffect } from 'react';
import { BellRing, X, ChevronRight, Utensils, ReceiptIndianRupee as Receipt } from 'lucide-react';
import { useNotificationStore } from '@shared/presentation/state/useNotificationStore';

interface OrderAlertBannerProps {
  onPress: () => void;
  onSettleOrder?: (orderId: number) => void;
}

export const OrderAlertBanner: React.FC<OrderAlertBannerProps> = ({ onPress, onSettleOrder }) => {
  const { latestIncomingOrder, dismissBanner } = useNotificationStore();

  useEffect(() => {
    if (latestIncomingOrder) {
      const timer = setTimeout(() => {
        dismissBanner();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [latestIncomingOrder, dismissBanner]);

  if (!latestIncomingOrder) return null;

  const statusUpper = (latestIncomingOrder.orderStatus || '').toUpperCase();
  const isBillReq = latestIncomingOrder.eventType === 'REQUEST_BILL' || statusUpper === 'BILL_REQUESTED';
  const isWaterReq = latestIncomingOrder.eventType === 'REQUEST_WATER' || statusUpper === 'WATER_REQUESTED';
  const isWaiterReq =
    latestIncomingOrder.eventType === 'CALL_WAITER' ||
    statusUpper === 'WAITER_CALLED' ||
    statusUpper === 'ATTEND_COUNTER';
  const isCancelled = latestIncomingOrder.eventType === 'CANCELLED' || statusUpper === 'CANCELLED';
  const isSettled =
    latestIncomingOrder.eventType === 'SETTLED' ||
    statusUpper === 'SETTLED' ||
    statusUpper === 'COMPLETED' ||
    statusUpper === 'PAID';
  const isReady = statusUpper === 'READY';
  const isPreparing = statusUpper === 'PREPARING' || statusUpper === 'COOKING';
  const isServed = statusUpper === 'SERVED' || statusUpper === 'DELIVERED';
  const isAddOn = Boolean(latestIncomingOrder.isAddOn);
  const isNewOrder = latestIncomingOrder.eventType === 'NEW_ORDER' && !isAddOn;

  const badgeText = isBillReq
    ? 'Bill Requested'
    : isWaterReq
    ? 'Water Refill'
    : isWaiterReq
    ? 'Waiter Call'
    : isCancelled
    ? 'Order Cancelled'
    : isSettled
    ? 'Order Settled'
    : isReady
    ? 'Order Ready'
    : isPreparing
    ? 'Preparing'
    : isServed
    ? 'Order Served'
    : isAddOn
    ? `Add-On KOT${latestIncomingOrder.roundNumber ? ` #${latestIncomingOrder.roundNumber}` : ''}`
    : isNewOrder
    ? 'New Incoming Order'
    : `Status • ${latestIncomingOrder.orderStatus || 'Updated'}`;

  return (
    <div
      onClick={onPress}
      className="fixed bottom-6 right-6 z-50 flex max-w-sm items-center gap-3 rounded-2xl border border-amber-500/40 bg-[#FFFFFF] dark:bg-[#1B2127] p-3.5 shadow-2xl ring-1 ring-amber-500/20 cursor-pointer animate-in slide-in-from-bottom-5 duration-200"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-[#DE8626] text-white shadow-md shadow-[#DE8626]/30">
        {isBillReq ? <Receipt className="h-5 w-5" /> : <BellRing className="h-5 w-5 animate-bounce" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-amber-500/10 text-[#DE8626]">
            {badgeText}
          </span>
          <span className="text-[10px] text-[#667085] dark:text-[#94A3B8]">Just now</span>
        </div>
        <p className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] truncate mt-0.5">
          {latestIncomingOrder.tableName || `Order #${latestIncomingOrder.orderId}`}
          {latestIncomingOrder.totalAmount > 0 ? ` • ₹${latestIncomingOrder.totalAmount.toFixed(2)}` : ''}
        </p>
        <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] truncate">
          {latestIncomingOrder.itemsSummary || latestIncomingOrder.customerName || 'Tap to view'}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <ChevronRight className="h-4 w-4 text-[#DE8626]" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            dismissBanner();
          }}
          className="p-1 rounded-lg text-[#8C7A6B] hover:bg-black/5 dark:hover:bg-white/5"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
