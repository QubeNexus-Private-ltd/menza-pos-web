'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  RefreshCw,
  Printer,
  Receipt,
  IndianRupee,
  Clock,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowDownCircle,
} from 'lucide-react';
import {
  getShiftTotals,
  getRecentShiftOrders,
  ShiftTotals,
  ShiftRegisterEntry,
} from '@/lib/offline/webPosDatabase';
import { useWebNetworkStore } from '@/lib/offline/useWebNetworkStore';
import { syncPendingOfflineOrders } from '@/services/webOfflineSyncWorker';
import { WebPrinterService } from '@/services/webPrinterService';
import { usePrinterStore } from '@shared/presentation/state/usePrinterStore';

interface OfflineShiftRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: number;
}

export function OfflineShiftRegisterModal({
  isOpen,
  onClose,
  restaurantId,
}: OfflineShiftRegisterModalProps) {
  const [totals, setTotals] = useState<ShiftTotals>({
    totalOrders: 0,
    totalSales: 0,
    cashSales: 0,
    upiSales: 0,
    cardSales: 0,
    unpaidTotal: 0,
  });
  const [orders, setOrders] = useState<ShiftRegisterEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [reprintingId, setReprintingId] = useState<string | null>(null);

  const { isOnline, isSyncing, pendingOfflineCount, lastSyncMessage } = useWebNetworkStore();
  const paperWidth = usePrinterStore((s) => s.paperWidth);

  const loadData = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [totalsRes, ordersRes] = await Promise.all([
        getShiftTotals(restaurantId),
        getRecentShiftOrders(restaurantId, 50),
      ]);
      setTotals(totalsRes);
      setOrders(ordersRes);
    } catch (err) {
      console.warn('Failed to load shift register:', err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  const handleSyncNow = async () => {
    if (!restaurantId || isSyncing) return;
    try {
      await syncPendingOfflineOrders(restaurantId);
      await loadData();
    } catch (err) {
      console.warn('Manual sync error:', err);
    }
  };

  const handleReprint = async (entry: ShiftRegisterEntry) => {
    if (!entry.receiptPayload) return;
    setReprintingId(entry.offlineReferenceId);
    try {
      await WebPrinterService.printReceipt(entry.receiptPayload, paperWidth);
    } catch (err) {
      console.warn('Reprint failed:', err);
    } finally {
      setReprintingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-3xl bg-[#FAF7F2] dark:bg-[#161B22] border border-[#DE8626]/30 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E7E1DA] dark:border-[#2B3540] flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-[#DE8626]/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#DE8626] to-amber-600 text-white shadow-md">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#111418] dark:text-white flex items-center gap-2">
                Shift Register & Offline Orders
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    isOnline
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </h2>
              <p className="text-xs text-[#637588] dark:text-[#9BA1A6]">
                24-Hour local register • Instant bill reprint • Queue synchronization
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {pendingOfflineCount > 0 && isOnline && (
              <button
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#DE8626] to-amber-600 text-white text-xs font-bold shadow-sm hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
            )}

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 text-[#637588] dark:text-[#9BA1A6] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Shift Sales Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl bg-white dark:bg-[#1B2127] border border-[#E7E1DA] dark:border-[#2B3540] shadow-xs">
              <span className="text-[10px] font-bold text-[#637588] dark:text-[#9BA1A6] uppercase tracking-wider block">
                Total Orders
              </span>
              <p className="text-lg font-black text-[#111418] dark:text-white mt-0.5">
                {totals.totalOrders}
              </p>
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold">
                {pendingOfflineCount} in queue
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-white dark:bg-[#1B2127] border border-[#E7E1DA] dark:border-[#2B3540] shadow-xs">
              <span className="text-[10px] font-bold text-[#637588] dark:text-[#9BA1A6] uppercase tracking-wider block">
                Total Shift Sales
              </span>
              <p className="text-lg font-black text-[#DE8626] mt-0.5">
                ₹{totals.totalSales.toFixed(2)}
              </p>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                Rolling 24h
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-white dark:bg-[#1B2127] border border-[#E7E1DA] dark:border-[#2B3540] shadow-xs">
              <span className="text-[10px] font-bold text-[#637588] dark:text-[#9BA1A6] uppercase tracking-wider block">
                Cash In Drawer
              </span>
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                ₹{totals.cashSales.toFixed(2)}
              </p>
              <span className="text-[10px] text-[#637588] dark:text-[#9BA1A6]">
                Physical cash
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-white dark:bg-[#1B2127] border border-[#E7E1DA] dark:border-[#2B3540] shadow-xs">
              <span className="text-[10px] font-bold text-[#637588] dark:text-[#9BA1A6] uppercase tracking-wider block">
                UPI / Digital
              </span>
              <p className="text-lg font-black text-blue-600 dark:text-blue-400 mt-0.5">
                ₹{(totals.upiSales + totals.cardSales).toFixed(2)}
              </p>
              <span className="text-[10px] text-[#637588] dark:text-[#9BA1A6]">
                QR & Card
              </span>
            </div>
          </div>

          {/* Sync Status Banner */}
          {lastSyncMessage && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>{lastSyncMessage}</span>
            </div>
          )}

          {/* Orders Table */}
          <div className="rounded-2xl bg-white dark:bg-[#1B2127] border border-[#E7E1DA] dark:border-[#2B3540] shadow-xs overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#E7E1DA] dark:border-[#2B3540] flex items-center justify-between">
              <span className="text-xs font-black text-[#111418] dark:text-white uppercase tracking-wider">
                Recent Orders ({orders.length})
              </span>
              <span className="text-[11px] text-[#637588] dark:text-[#9BA1A6]">
                Click reprint to produce thermal bill copy
              </span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-sm text-[#637588] dark:text-[#9BA1A6]">
                Loading shift register...
              </div>
            ) : orders.length === 0 ? (
              <div className="py-12 text-center text-sm text-[#637588] dark:text-[#9BA1A6]">
                No orders recorded in the current shift.
              </div>
            ) : (
              <div className="divide-y divide-[#E7E1DA] dark:divide-[#2B3540] max-h-80 overflow-y-auto">
                {orders.map((ord) => (
                  <div
                    key={ord.offlineReferenceId}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-[#111418] dark:text-white">
                          {ord.orderNumber}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#DE8626]/10 text-[#DE8626]">
                          {ord.paymentMode}
                        </span>
                        {ord.tableNumber && (
                          <span className="text-xs text-[#637588] dark:text-[#9BA1A6]">
                            • Table {ord.tableNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#637588] dark:text-[#9BA1A6] truncate mt-0.5">
                        {ord.customerName} • {new Date(ord.createdAtUtc).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-black text-sm text-[#111418] dark:text-white">
                        ₹{ord.totalAmount.toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleReprint(ord)}
                        disabled={reprintingId === ord.offlineReferenceId}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-[#DE8626]/10 hover:text-[#DE8626] text-xs font-bold text-[#637588] dark:text-[#9BA1A6] transition-colors"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        {reprintingId === ord.offlineReferenceId ? 'Printing...' : 'Reprint'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#E7E1DA] dark:border-[#2B3540] bg-[#F5EFE6]/60 dark:bg-[#1B2127]/60 flex items-center justify-between text-xs text-[#637588] dark:text-[#9BA1A6]">
          <span>
            Offline reference IDs are verified and synced with Menza Cloud.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-xs font-bold text-[#111418] dark:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
