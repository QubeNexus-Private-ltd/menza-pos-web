'use client';

import React, { useState } from 'react';
import {
  X,
  Clock,
  Printer,
  Receipt,
  UtensilsCrossed,
  Phone,
  User,
  Table as TableIcon,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  MessageCircle,
  Share2,
  Ban,
  ChefHat,
  Sparkles,
  ShoppingBag,
  Check,
} from 'lucide-react';
import { OrderMaster } from '@shared/domain/models/Order';
import {
  normalizeOrderStatus,
  OrderStatuses,
  getOrderStatusBadge,
  getNextRecommendedStatus,
  canTransitionOrderStatus,
} from '@/lib/utils/orderStatusEngine';
import { WebPrinterService } from '@/services/webPrinterService';
import { WebWhatsAppService } from '@/services/whatsAppService';
import { usePrinterStore } from '@shared/presentation/state/usePrinterStore';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { ReceiptData } from '@shared/core/printer/EscPosBuilder';

interface DashboardOrderDetailDrawerProps {
  order: OrderMaster | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdate: (orderId: number, nextStatus: string) => Promise<void>;
  onSettleOrder: (order: OrderMaster) => void;
  onCancelOrder: (orderId: number, reason: string, tableId?: number) => Promise<void>;
}

export const DashboardOrderDetailDrawer: React.FC<DashboardOrderDetailDrawerProps> = ({
  order,
  isOpen,
  onClose,
  onStatusUpdate,
  onSettleOrder,
  onCancelOrder,
}) => {
  const { activeRestaurant } = useAuthStore();
  const { paperWidth } = usePrinterStore();

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen || !order) return null;

  const currentStatusNorm = normalizeOrderStatus(order.status);
  const statusBadge = getOrderStatusBadge(order.status);
  const nextProgression = getNextRecommendedStatus(order.status, order.orderTypeName, order.tableId);

  const isDineIn =
    Boolean(order.tableId) ||
    (order.orderTypeName && ['DINE-IN', 'DINE_IN', 'TABLE'].includes(order.orderTypeName.toUpperCase()));

  const isSettled =
    Boolean(order.settledDateUtc) ||
    currentStatusNorm === OrderStatuses.Settled ||
    (currentStatusNorm === OrderStatuses.Completed && order.paymentStatus?.toUpperCase() === 'PAID');

  const isCancelled = currentStatusNorm === OrderStatuses.Cancelled;

  // Format Token
  const tokenDisplay = (() => {
    const raw = order.pickupToken || order.tokenNumber || String(order.id);
    if (/^TK-/i.test(String(raw))) return String(raw).toUpperCase();
    const num = parseInt(String(raw), 10);
    if (!isNaN(num) && num > 0) return `TK-${String(num).padStart(3, '0')}`;
    return `TK-${String(order.id).slice(-3).padStart(3, '0')}`;
  })();

  // Order lifecycle stages for timeline
  const lifecycleSteps = isDineIn
    ? [
        { key: OrderStatuses.Placed, label: 'Placed' },
        { key: OrderStatuses.Preparing, label: 'Kitchen' },
        { key: OrderStatuses.Ready, label: 'Ready' },
        { key: OrderStatuses.Served, label: 'Served' },
        { key: OrderStatuses.Settled, label: 'Settled' },
      ]
    : [
        { key: OrderStatuses.Placed, label: 'Placed' },
        { key: OrderStatuses.Preparing, label: 'Kitchen' },
        { key: OrderStatuses.Ready, label: 'Ready' },
        { key: OrderStatuses.Delivered, label: 'Delivered' },
        { key: OrderStatuses.Settled, label: 'Settled' },
      ];

  const getStepState = (stepKey: string) => {
    if (isCancelled) return 'cancelled';
    if (isSettled) return 'completed';

    const orderRank = [
      OrderStatuses.PendingPayment,
      OrderStatuses.Placed,
      OrderStatuses.Confirmed,
      OrderStatuses.Preparing,
      OrderStatuses.Ready,
      OrderStatuses.Served,
      OrderStatuses.Delivered,
      OrderStatuses.Settled,
      OrderStatuses.Completed,
    ];

    const curIndex = orderRank.indexOf(currentStatusNorm);
    const stepIndex = orderRank.indexOf(stepKey as any);

    if (curIndex === stepIndex) return 'current';
    if (curIndex > stepIndex) return 'completed';
    return 'pending';
  };

  const handleAdvanceStatus = async () => {
    if (!nextProgression) return;
    if (nextProgression.nextStatus === OrderStatuses.Settled) {
      onSettleOrder(order);
      return;
    }

    try {
      setIsUpdatingStatus(true);
      await onStatusUpdate(order.id, nextProgression.nextStatus);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handlePrintCustomerBill = async () => {
    try {
      setIsPrinting(true);
      const itemsList = Array.isArray(order.items) ? order.items : [];
      const receiptData: ReceiptData = {
        restaurantName: activeRestaurant?.restaurantName || order.restaurantName || 'Menza Restaurant',
        address: activeRestaurant?.address,
        contactPhone: (activeRestaurant as any)?.contactNumber || activeRestaurant?.ownerMobile || '',
        gstNumber: (activeRestaurant as any)?.gstNumber || (activeRestaurant as any)?.gstin,
        orderId: order.id,
        orderNumber: order.orderNumber,
        pickupToken: tokenDisplay,
        tableName: order.tableName,
        orderType: order.orderTypeName,
        date: order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
        customerName: order.customerName,
        customerPhone: order.mobileNumber,
        items: itemsList.map((i) => ({
          itemName: i.itemName,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice || 0),
          totalPrice: Number(i.totalPrice || i.quantity * (i.unitPrice || 0)),
        })),
        subtotal: Number(order.subtotal || order.totalAmount),
        taxAmount: Number(order.cgst || 0) + Number(order.sgst || 0),
        discountAmount: Number(order.discountAmount || 0),
        grandTotal: Number(order.totalAmount),
        paymentMode: order.paymentMode || 'CASH',
        tenderedAmount: Number(order.tenderedAmount || 0),
        changeAmount: Number(order.changeAmount || 0),
      };

      await WebPrinterService.printReceipt(receiptData, paperWidth);
    } catch (err: any) {
      alert(`Print bill failed: ${err?.message || 'Check printer setup'}`);
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintKotTicket = async () => {
    try {
      setIsPrinting(true);
      const itemsList = Array.isArray(order.items) ? order.items : [];
      const kotData: ReceiptData = {
        restaurantName: activeRestaurant?.restaurantName || order.restaurantName || 'Menza Kitchen',
        orderId: order.id,
        orderNumber: order.orderNumber,
        pickupToken: tokenDisplay,
        tableName: order.tableName,
        orderType: order.orderTypeName || (order.tableId ? 'DINE_IN' : 'COUNTER'),
        date: order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
        customerName: order.customerName,
        customerPhone: order.mobileNumber,
        items: itemsList.map((i) => ({
          itemName: i.itemName,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice || 0),
          totalPrice: Number(i.totalPrice || i.quantity * (i.unitPrice || 0)),
          cookingInstruction: i.cookingInstruction,
        })),
        grandTotal: Number(order.totalAmount || 0),
        isKot: true,
      };

      await WebPrinterService.printKot(kotData, paperWidth);
    } catch (err: any) {
      alert(`KOT Print failed: ${err?.message || 'Check printer setup'}`);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleCancelClick = async () => {
    const reason = window.prompt(
      `Void / Cancel Order #${order.id} (${tokenDisplay})?\n\nPlease enter reason for voiding this order:`,
      'Customer cancelled'
    );
    if (reason === null) return;
    const trimmed = reason.trim() || 'Voided by Staff';
    await onCancelOrder(order.id, trimmed, order.tableId);
    onClose();
  };

  const handleShareWhatsApp = () => {
    const phone = order.mobileNumber || '';
    const receiptData = {
      restaurantName: activeRestaurant?.restaurantName || 'Menza Restaurant',
      orderId: order.id,
      customerName: order.customerName,
      items: Array.isArray(order.items)
        ? order.items.map((i) => ({
            itemName: i.itemName,
            quantity: i.quantity,
            price: Number(i.unitPrice || 0),
          }))
        : [],
      grandTotal: Number(order.totalAmount || 0),
      paymentMode: order.paymentMode || 'CASH',
    };

    const url = WebWhatsAppService.getWhatsAppReceiptUrl(phone, receiptData);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-fade-in">
      {/* Drawer Container */}
      <div className="relative w-full max-w-lg bg-[#FFFFFF] dark:bg-[#1B2127] h-full shadow-2xl flex flex-col justify-between border-l border-[#E7E1DA] dark:border-[#2B3540] animate-slide-left">
        {/* Header */}
        <div className="p-5 border-b border-[#E7E1DA] dark:border-[#2B3540] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DE8626]/10 text-[#DE8626] font-black text-sm">
              {tokenDisplay.replace('TK-', '#')}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  Order #{order.id}
                </h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase border ${statusBadge.bgClass} ${statusBadge.textClass} ${statusBadge.borderClass}`}
                >
                  <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${statusBadge.dotClass}`} />
                  {statusBadge.label}
                </span>
              </div>
              <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-0.5">
                {order.tableName ? `Table ${order.tableName}` : order.orderTypeName || 'Counter POS'}
                {' • '}
                {order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Visual Order Lifecycle Step Bar */}
          <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF8F5] dark:bg-[#151A1E] p-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#667085] dark:text-[#94A3B8] mb-3">
              Order Lifecycle Progress
            </h4>
            <div className="flex items-center justify-between relative">
              {/* Connector Line behind */}
              <div className="absolute left-3 right-3 top-3 h-0.5 bg-[#E7E1DA] dark:bg-[#2B3540] -z-0" />

              {lifecycleSteps.map((step) => {
                const state = getStepState(step.key);
                return (
                  <div key={step.key} className="flex flex-col items-center z-10">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                        state === 'completed'
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : state === 'current'
                          ? 'bg-[#DE8626] text-white ring-4 ring-[#DE8626]/20'
                          : 'bg-[#FFFFFF] dark:bg-[#2B3540] border border-[#E7E1DA] dark:border-[#3E4A56] text-[#667085]'
                      }`}
                    >
                      {state === 'completed' ? <Check className="h-3 w-3" /> : '•'}
                    </div>
                    <span
                      className={`text-[10px] font-bold mt-1.5 ${
                        state === 'current'
                          ? 'text-[#DE8626]'
                          : state === 'completed'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-[#667085] dark:text-[#94A3B8]'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Customer & Dining Details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] p-3">
              <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider">
                Guest / Service
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <User className="h-3.5 w-3.5 text-[#DE8626]" />
                <span className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] truncate">
                  {order.customerName || 'Walk-in Guest'}
                </span>
              </div>
              {order.mobileNumber && (
                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[#667085]">
                  <Phone className="h-3 w-3" />
                  <span>{order.mobileNumber}</span>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] p-3">
              <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider">
                Table & Mode
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <TableIcon className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                  {order.tableName ? `Table ${order.tableName}` : order.orderTypeName || 'Counter'}
                </span>
              </div>
              <div className="text-[11px] text-[#667085] mt-0.5">
                Token: <strong className="text-[#DE8626]">{tokenDisplay}</strong>
              </div>
            </div>
          </div>

          {/* Itemized Order List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#667085] dark:text-[#94A3B8]">
                Dishes Punched ({order.items?.length || 0})
              </h4>
            </div>

            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60 overflow-hidden">
              {Array.isArray(order.items) && order.items.length > 0 ? (
                order.items.map((it, idx) => (
                  <div key={idx} className="p-3 flex items-start justify-between gap-3 bg-white dark:bg-[#1B2127]">
                    <div className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#DE8626]/10 text-[#DE8626] font-extrabold text-[11px] shrink-0">
                        {it.quantity}x
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                            {it.itemName}
                          </span>
                          {it.stationCode && (
                            <span className="rounded-sm bg-orange-500/10 px-1.5 py-0.2 text-[9px] font-bold text-orange-600 uppercase">
                              {it.stationCode}
                            </span>
                          )}
                        </div>
                        {it.cookingInstruction && (
                          <p className="text-[10px] text-amber-700 dark:text-amber-400 italic mt-0.5">
                            Note: {it.cookingInstruction}
                          </p>
                        )}
                        <span className="text-[10px] text-[#667085]">
                          @ ₹{Number(it.unitPrice || 0)}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] shrink-0">
                      ₹{Number(it.totalPrice || it.quantity * (it.unitPrice || 0))}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-[#667085]">
                  No item breakdown available for this ticket.
                </div>
              )}
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF8F5] dark:bg-[#151A1E] p-4 space-y-2 text-xs">
            <div className="flex justify-between text-[#667085] dark:text-[#94A3B8]">
              <span>Subtotal</span>
              <span>₹{Number(order.subtotal || order.totalAmount || 0)}</span>
            </div>
            {Number(order.discountAmount || 0) > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Discount</span>
                <span>-₹{Number(order.discountAmount)}</span>
              </div>
            )}
            {(Number(order.cgst || 0) > 0 || Number(order.sgst || 0) > 0) && (
              <div className="flex justify-between text-[#667085] dark:text-[#94A3B8]">
                <span>Taxes (CGST + SGST)</span>
                <span>₹{(Number(order.cgst || 0) + Number(order.sgst || 0)).toFixed(2)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-[#E7E1DA] dark:border-[#2B3540] flex justify-between items-center text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
              <span>Grand Total</span>
              <span className="text-[#DE8626]">₹{Number(order.totalAmount || 0)}</span>
            </div>
            <div className="flex items-center justify-between pt-1 text-[11px]">
              <span className="text-[#667085]">Payment Mode</span>
              <span className="font-bold uppercase text-[#1E2930] dark:text-[#F3F4F6]">
                {order.paymentMode || 'CASH'} ({order.paymentStatus || (isSettled ? 'PAID' : 'PENDING')})
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls Footer */}
        <div className="p-5 border-t border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] space-y-3">
          {/* Next Stage Progression Button (if not terminal) */}
          {!isSettled && !isCancelled && nextProgression && (
            <button
              onClick={handleAdvanceStatus}
              disabled={isUpdatingStatus}
              className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold shadow-md transition-all ${nextProgression.buttonColor} disabled:opacity-50`}
            >
              <Sparkles className="h-4 w-4" />
              <span>{isUpdatingStatus ? 'Updating Status...' : nextProgression.actionLabel}</span>
            </button>
          )}

          {/* Quick Actions Row */}
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={handlePrintCustomerBill}
              disabled={isPrinting}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] p-2.5 text-[11px] font-bold text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Print Customer Tax Bill"
            >
              <Printer className="h-4 w-4 text-[#DE8626]" />
              <span>Tax Bill</span>
            </button>

            <button
              onClick={handlePrintKotTicket}
              disabled={isPrinting}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] p-2.5 text-[11px] font-bold text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Print KOT to Kitchen"
            >
              <ChefHat className="h-4 w-4 text-orange-500" />
              <span>KOT Ticket</span>
            </button>

            <button
              onClick={handleShareWhatsApp}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] p-2.5 text-[11px] font-bold text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Share Bill via WhatsApp"
            >
              <MessageCircle className="h-4 w-4 text-emerald-500" />
              <span>WhatsApp</span>
            </button>

            {!isSettled && !isCancelled ? (
              <button
                onClick={handleCancelClick}
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-red-200 dark:border-red-900/40 p-2.5 text-[11px] font-bold text-red-600 hover:bg-red-500/10 transition-colors"
                title="Void / Cancel Order"
              >
                <Ban className="h-4 w-4" />
                <span>Void</span>
              </button>
            ) : (
              <button
                onClick={() => onSettleOrder(order)}
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-emerald-200 dark:border-emerald-900/40 p-2.5 text-[11px] font-bold text-emerald-600 hover:bg-emerald-500/10 transition-colors"
                title="Re-open Settlement Details"
              >
                <Receipt className="h-4 w-4" />
                <span>Receipt</span>
              </button>
            )}
          </div>

          {/* Settle Bill Button (if not already settled) */}
          {!isSettled && !isCancelled && (
            <button
              onClick={() => onSettleOrder(order)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-bold text-white shadow-xs transition-colors"
            >
              <Receipt className="h-4 w-4" />
              <span>Settle Bill & Free Table</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
