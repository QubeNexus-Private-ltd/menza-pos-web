'use client';

import React from 'react';
import {
  X,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  CheckCheck,
  Trash2,
  Clock,
  User,
  ShoppingBag,
  IndianRupee,
  Utensils,
  ReceiptIndianRupee as Receipt,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { useNotificationStore, OrderNotificationItem } from '@shared/presentation/state/useNotificationStore';

interface OrderNotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOrder?: (orderId: number, tableId?: number) => void;
}

export const OrderNotificationDrawer: React.FC<OrderNotificationDrawerProps> = ({
  isOpen,
  onClose,
  onSelectOrder,
}) => {
  const {
    notifications,
    unreadCount,
    soundEnabled,
    setSoundEnabled,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAllNotifications,
  } = useNotificationStore();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full border-l border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-[#E7E1DA] dark:border-[#2B3540] p-4 bg-[#FAF7F2] dark:bg-[#151A20]">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-[#DE8626]">
              {unreadCount > 0 ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                Order Notifications
              </h3>
              <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Mute alert chime' : 'Enable alert chime'}
              className={`p-2 rounded-xl border transition-colors ${
                soundEnabled
                  ? 'border-amber-500/30 bg-amber-500/10 text-[#DE8626]'
                  : 'border-[#E7E1DA] dark:border-[#2B3540] text-[#667085]'
              }`}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] text-[#8C7A6B] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Drawer Action Bar */}
        {notifications.length > 0 && (
          <div className="flex items-center justify-between border-b border-[#E7E1DA]/60 dark:border-[#2B3540]/60 px-4 py-2 bg-[#FAF7F2]/50 dark:bg-[#151A20]/50 text-xs">
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#DE8626] hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>Mark all read</span>
            </button>

            <button
              onClick={clearAllNotifications}
              className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:underline"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear all</span>
            </button>
          </div>
        )}

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center text-xs text-[#667085] dark:text-[#94A3B8]">
              <Bell className="h-8 w-8 text-[#DE8626]/30 mb-2" />
              <p className="font-bold text-sm text-[#1E2930] dark:text-[#F3F4F6]">No notifications</p>
              <p className="text-[11px] mt-0.5">Real-time alerts for incoming orders, KOT and bill requests will appear here.</p>
            </div>
          ) : (
            notifications.map((item) => {
              const statusUpper = String(item.orderStatus || '').toUpperCase();
              const isBillReq = item.eventType === 'REQUEST_BILL' || statusUpper === 'BILL_REQUESTED';
              const isWaterReq = item.eventType === 'REQUEST_WATER' || statusUpper === 'WATER_REQUESTED';
              const isWaiterReq =
                item.eventType === 'CALL_WAITER' ||
                statusUpper === 'WAITER_CALLED' ||
                statusUpper === 'ATTEND_COUNTER';
              const isCancelled = item.eventType === 'CANCELLED' || statusUpper === 'CANCELLED';
              const isSettled =
                item.eventType === 'SETTLED' ||
                statusUpper === 'SETTLED' ||
                statusUpper === 'COMPLETED' ||
                statusUpper === 'PAID';
              const isReady = statusUpper === 'READY';
              const isPreparing = statusUpper === 'PREPARING' || statusUpper === 'COOKING';
              const isServed = statusUpper === 'SERVED' || statusUpper === 'DELIVERED';
              const isAddOn = Boolean(item.isAddOn);
              const isNewOrder = item.eventType === 'NEW_ORDER' && !isAddOn;

              const badgeLabel = isBillReq
                ? 'Bill Requested 🧾'
                : isWaterReq
                ? 'Water Refill 💧'
                : isWaiterReq
                ? 'Waiter Call 🛎️'
                : isCancelled
                ? 'Cancelled ❌'
                : isSettled
                ? 'Settled ✅'
                : isReady
                ? 'Ready to Serve 🍽️'
                : isPreparing
                ? 'Preparing 👨‍🍳'
                : isServed
                ? 'Served ✅'
                : isAddOn
                ? `Add-On KOT${item.roundNumber ? ` #${item.roundNumber}` : ''} ➕`
                : isNewOrder
                ? 'New Order 🔔'
                : item.orderStatus;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    markAsRead(item.id);
                    if (onSelectOrder) {
                      onSelectOrder(item.orderId, item.tableId);
                    }
                  }}
                  className={`group relative rounded-2xl border p-3.5 transition-all cursor-pointer ${
                    !item.isRead
                      ? 'border-[#DE8626]/40 bg-amber-500/5 shadow-sm'
                      : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/30 dark:bg-[#151A20]/30 hover:border-[#DE8626]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          isBillReq || isCancelled
                            ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
                            : isWaterReq || isPreparing
                            ? 'bg-blue-500/10 text-blue-600 border border-blue-500/30'
                            : isSettled || isReady || isServed
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                            : 'bg-amber-500/10 text-[#DE8626] border border-amber-500/30'
                        }`}
                      >
                        {badgeLabel}
                      </span>

                      {!item.isRead && (
                        <span className="h-2 w-2 rounded-full bg-[#DE8626] animate-pulse" />
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-[#667085] dark:text-[#94A3B8]">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          clearNotification(item.id);
                        }}
                        className="text-[#667085] hover:text-red-500 p-0.5"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                        {item.orderId > 0 ? `Order #${item.orderId} • ` : ''}{item.tableName || 'Counter'}
                      </span>
                      {item.customerName && (
                        <span className="text-[11px] text-[#667085] dark:text-[#94A3B8] ml-1.5">
                          • {item.customerName}
                        </span>
                      )}
                    </div>

                    {item.totalAmount > 0 && (
                      <span className="font-extrabold text-[#DE8626]">
                        ₹{item.totalAmount.toFixed(2)}
                      </span>
                    )}
                  </div>

                  {item.itemsSummary && (
                    <p className="mt-1 text-[11px] text-[#667085] dark:text-[#94A3B8] line-clamp-1">
                      {item.itemsSummary}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
