'use client';

import React, { useState } from 'react';
import {
  X,
  CreditCard,
  IndianRupee,
  CheckCircle2,
  Printer,
  MessageCircle,
  ArrowRight,
  Receipt,
  Sparkles,
} from 'lucide-react';
import { OrderMaster } from '@shared/domain/models/Order';
import { OrderRemoteDataSource } from '@shared/data/datasources/OrderRemoteDataSource';
import { WebPrinterService } from '@/services/webPrinterService';
import { WebWhatsAppService } from '@/services/whatsAppService';
import { usePrinterStore } from '@shared/presentation/state/usePrinterStore';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { ReceiptData } from '@shared/core/printer/EscPosBuilder';

interface OrderSettleModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderMaster | null;
  onSettled: (orderId: number) => void;
}

const orderDataSource = new OrderRemoteDataSource();

export function OrderSettleModal({
  isOpen,
  onClose,
  order,
  onSettled,
}: OrderSettleModalProps) {
  const { activeRestaurant } = useAuthStore();
  const { paperWidth, customFooter, autoPrintReceipt } = usePrinterStore();

  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'CARD' | 'DUE'>('CASH');
  const [discountInput, setDiscountInput] = useState<string>('');
  const [tenderedInput, setTenderedInput] = useState<string>('');
  const [isSettling, setIsSettling] = useState(false);
  const [settledSuccess, setSettledSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const originalTotal = Number(order.totalAmount || 0);
  const discountAmount = Math.max(0, parseFloat(discountInput) || 0);
  const payableAmount = Math.max(0, Math.round(originalTotal - discountAmount));
  const numericTendered = parseFloat(tenderedInput) || payableAmount;
  const changeToReturn = paymentMode === 'CASH' ? Math.max(0, numericTendered - payableAmount) : 0;

  const handleSettle = async () => {
    try {
      setIsSettling(true);
      setErrorMsg(null);

      const res = await orderDataSource.settleOrder(order.id, {
        orderId: order.id,
        paymentMode,
        discountAmount,
        tenderedAmount: paymentMode === 'CASH' ? numericTendered : undefined,
        changeAmount: paymentMode === 'CASH' ? changeToReturn : undefined,
        orderStatus: 'Settled',
      });

      // If Dine-In table session, also free up the table
      if (order.tableId) {
        await orderDataSource.settleTable(order.tableId).catch((err) =>
          console.warn('Table settle session warning:', err)
        );
      }

      setSettledSuccess(true);
      onSettled(order.id);

      // Auto-print receipt if configured
      if (autoPrintReceipt) {
        handlePrintReceipt();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to settle order. Please check connection.');
    } finally {
      setIsSettling(false);
    }
  };

  const buildReceiptData = (): ReceiptData => {
    return {
      restaurantName: activeRestaurant?.restaurantName || order.restaurantName || 'Menza Restaurant',
      address: activeRestaurant?.address || order.address,
      contactPhone: activeRestaurant?.ownerMobile || order.contactNumber,
      gstNumber: (activeRestaurant as any)?.gstNumber || (order as any)?.gstNumber,
      orderId: order.id,
      orderType: order.orderTypeName || (order.tableId ? 'Dine-In' : 'Counter'),
      tableName: order.tableName,
      customerName: order.customerName,
      customerPhone: order.mobileNumber,
      items: (order.items || []).map((it) => ({
        itemName: it.itemName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: (it.quantity || 1) * (it.unitPrice || 0),
      })),
      subtotal: Number(order.subtotal || payableAmount),
      taxAmount: Number((order.cgst || 0) + (order.sgst || 0)),
      discountAmount,
      grandTotal: payableAmount,
      paymentMode,
      date: new Date().toLocaleString('en-IN'),
      footerMessage: customFooter || 'Thank you! Please visit again.',
    };
  };

  const handlePrintReceipt = () => {
    WebPrinterService.printReceipt(buildReceiptData(), paperWidth).catch((err) =>
      console.warn('Print receipt error:', err)
    );
  };

  const handleShareWhatsApp = () => {
    let phone = order.mobileNumber;
    if (!phone) {
      const entered = window.prompt('Enter customer 10-digit WhatsApp phone:');
      if (!entered) return;
      phone = entered.replace(/[^0-9]/g, '').slice(-10);
    }
    if (!phone || phone.length < 10) {
      alert('Please enter a valid 10-digit mobile number');
      return;
    }

    const url = WebWhatsAppService.getWhatsAppReceiptUrl(phone, {
      restaurantName: activeRestaurant?.restaurantName || 'Menza Restaurant',
      orderId: order.id,
      customerName: order.customerName,
      items: (order.items || []).map((it) => ({
        itemName: it.itemName,
        quantity: it.quantity,
        price: it.unitPrice,
      })),
      grandTotal: payableAmount,
      paymentMode,
    });

    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        {!settledSuccess ? (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-[#DE8626]" />
                  <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                    Settle Bill • Order #{order.id}
                  </h3>
                </div>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-0.5">
                  {order.tableName || order.orderTypeName || 'Counter'} • {order.customerName || 'Walk-in Guest'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 font-semibold">
                {errorMsg}
              </div>
            )}

            {/* Itemized summary */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 text-xs space-y-2">
              <span className="font-bold uppercase tracking-wider text-[10px] text-[#667085]">
                Order Items ({order.items?.length || 0})
              </span>
              <div className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60 max-h-36 overflow-y-auto pr-1">
                {(order.items || []).map((it, idx) => (
                  <div key={idx} className="flex justify-between py-1.5">
                    <span className="font-medium text-[#1E2930] dark:text-[#F3F4F6]">
                      {it.quantity}x {it.itemName}
                    </span>
                    <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                      ₹{(it.quantity || 1) * (it.unitPrice || 0)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-dashed border-[#E7E1DA] dark:border-[#2B3540] space-y-1 text-[11px]">
                <div className="flex justify-between text-[#667085]">
                  <span>Subtotal:</span>
                  <span>₹{order.subtotal || originalTotal}</span>
                </div>
                {Boolean((order.cgst || 0) + (order.sgst || 0)) && (
                  <div className="flex justify-between text-[#667085]">
                    <span>Taxes (GST):</span>
                    <span>₹{Number((order.cgst || 0) + (order.sgst || 0))}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Total Payable Display & Discount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl bg-amber-500/10 p-4 flex flex-col justify-center">
                <span className="text-[11px] font-bold uppercase text-[#DE8626]">
                  Payable Total
                </span>
                <span className="text-3xl font-extrabold text-[#DE8626]">
                  ₹{payableAmount}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                  Discount (₹ Optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#667085]">₹</span>
                  <input
                    type="number"
                    min="0"
                    max={originalTotal}
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] pl-8 pr-3 py-3 text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs font-semibold text-[#667085] uppercase mb-2">
                Payment Method
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['CASH', 'UPI', 'CARD', 'DUE'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentMode(mode)}
                    className={`rounded-xl border py-2.5 text-xs font-bold transition-all ${
                      paymentMode === mode
                        ? 'border-[#DE8626] bg-[#DE8626] text-white shadow-md'
                        : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#1E2930] dark:text-[#F3F4F6]'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Cash Tendered & Change Return */}
            {paymentMode === 'CASH' && (
              <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-3.5 space-y-2">
                <div>
                  <label className="block text-xs font-semibold text-[#667085] mb-1">
                    Cash Tendered by Customer
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs">₹</span>
                    <input
                      type="number"
                      value={tenderedInput}
                      onChange={(e) => setTenderedInput(e.target.value)}
                      placeholder={String(payableAmount)}
                      className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] pl-8 pr-3 py-2 text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-none"
                    />
                  </div>
                </div>

                {changeToReturn > 0 && (
                  <div className="flex justify-between items-center text-xs font-bold text-emerald-600 dark:text-emerald-400 pt-1">
                    <span>Change to Return:</span>
                    <span className="text-sm">₹{changeToReturn}</span>
                  </div>
                )}
              </div>
            )}

            {/* Action Button */}
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] py-3 text-xs font-semibold text-[#667085]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSettling}
                onClick={handleSettle}
                className="flex-2 flex items-center justify-center gap-2 rounded-2xl bg-[#DE8626] py-3 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] disabled:opacity-50 transition-all"
              >
                <span>{isSettling ? 'Settling Bill...' : `Confirm & Collect ₹${payableAmount}`}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Settlement Complete Screen */
          <div className="flex flex-col items-center text-center space-y-4 py-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                Bill Settled Successfully!
              </h3>
              <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1">
                Order #{order.id} • {paymentMode} • Total ₹{payableAmount}
              </p>
              {order.tableId && (
                <span className="inline-block mt-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-600">
                  {order.tableName || `Table ${order.tableId}`} is now Available
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full pt-4">
              <button
                onClick={handlePrintReceipt}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[#DE8626] bg-amber-500/10 py-2.5 text-xs font-bold text-[#DE8626] hover:bg-amber-500/20 transition-colors"
              >
                <Printer className="h-4 w-4" />
                <span>Print Receipt</span>
              </button>
              <button
                onClick={handleShareWhatsApp}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2.5 text-xs font-bold text-emerald-600 hover:bg-emerald-500/20 transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                <span>WhatsApp</span>
              </button>
              <button
                onClick={onClose}
                className="flex items-center justify-center rounded-xl bg-[#DE8626] py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#C4721C] transition-colors"
              >
                <span>Done</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
