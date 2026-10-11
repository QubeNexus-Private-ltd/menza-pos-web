'use client';

import React, { useState, useEffect } from 'react';
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
  QrCode,
  Building2,
  FileText,
  Split,
  ChevronDown,
  ChevronUp,
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

  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'CARD' | 'DUE' | 'SPLIT'>('CASH');
  const [discountInput, setDiscountInput] = useState<string>('');
  const [tenderedInput, setTenderedInput] = useState<string>('');
  const [isSettling, setIsSettling] = useState(false);
  const [settledSuccess, setSettledSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Split Payment State
  const [splitCash, setSplitCash] = useState<string>('');
  const [splitDigital, setSplitDigital] = useState<string>('');
  const [splitDigitalMode, setSplitDigitalMode] = useState<'UPI' | 'CARD'>('UPI');

  // B2B GSTIN Corporate Billing
  const [showB2bFields, setShowB2bFields] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');

  // Show Dynamic UPI QR Code
  const [showUpiQr, setShowUpiQr] = useState(false);

  useEffect(() => {
    if (isOpen && order) {
      setPaymentMode('CASH');
      setDiscountInput('');
      setTenderedInput('');
      setSettledSuccess(false);
      setErrorMsg(null);
      setShowUpiQr(false);
      setShowB2bFields(false);
      setCompanyName('');
      setCustomerGstin('');

      const total = Number(order.totalAmount || 0);
      setSplitCash(String(Math.floor(total / 2)));
      setSplitDigital(String(Math.ceil(total / 2)));
    }
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const originalTotal = Number(order.totalAmount || 0);
  const discountAmount = Math.max(0, parseFloat(discountInput) || 0);
  const payableAmount = Math.max(0, Math.round(originalTotal - discountAmount));
  const numericTendered = parseFloat(tenderedInput) || payableAmount;
  const changeToReturn = paymentMode === 'CASH' ? Math.max(0, numericTendered - payableAmount) : 0;

  // Split validation
  const numSplitCash = parseFloat(splitCash) || 0;
  const numSplitDigital = parseFloat(splitDigital) || 0;
  const splitTotal = numSplitCash + numSplitDigital;
  const isSplitBalanced = Math.abs(splitTotal - payableAmount) < 0.01;

  // Dynamic UPI String
  const upiId = (activeRestaurant as any)?.upiId || 'menza@upi';
  const restName = activeRestaurant?.restaurantName || order.restaurantName || 'Menza';
  const upiPayable = paymentMode === 'SPLIT' ? numSplitDigital : payableAmount;
  const upiIntentString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    restName
  )}&am=${upiPayable.toFixed(2)}&tr=${order.id}&cu=INR`;
  const upiQrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    upiIntentString
  )}`;

  const handleSettle = async () => {
    try {
      setIsSettling(true);
      setErrorMsg(null);

      if (paymentMode === 'SPLIT' && !isSplitBalanced) {
        setErrorMsg(`Split sum (₹${splitTotal}) does not match payable total (₹${payableAmount})`);
        setIsSettling(false);
        return;
      }

      if (showB2bFields && customerGstin.trim()) {
        const cleanGst = customerGstin.trim().toUpperCase();
        if (cleanGst.length !== 15) {
          setErrorMsg('Customer GSTIN must be exactly 15 characters.');
          setIsSettling(false);
          return;
        }
      }

      const effectiveRemarks = (() => {
        const parts: string[] = [];
        if (paymentMode === 'SPLIT') {
          parts.push(`Split: Cash ₹${numSplitCash} + ${splitDigitalMode} ₹${numSplitDigital}`);
        }
        if (showB2bFields && customerGstin.trim()) {
          parts.push(`B2B: ${companyName.trim()} | GSTIN: ${customerGstin.trim().toUpperCase()}`);
        }
        return parts.join(' | ') || undefined;
      })();

      const effectivePaymentMode =
        paymentMode === 'SPLIT'
          ? `SPLIT (Cash ₹${numSplitCash} + ${splitDigitalMode} ₹${numSplitDigital})`
          : paymentMode;

      await orderDataSource.settleOrder(order.id, {
        orderId: order.id,
        paymentMode: effectivePaymentMode,
        discountAmount,
        tenderedAmount: paymentMode === 'CASH' ? numericTendered : undefined,
        changeAmount: paymentMode === 'CASH' ? changeToReturn : undefined,
        remarks: effectiveRemarks,
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
      customerName: companyName.trim() || order.customerName,
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
      paymentMode:
        paymentMode === 'SPLIT'
          ? `SPLIT (Cash ₹${numSplitCash} + ${splitDigitalMode} ₹${numSplitDigital})`
          : paymentMode,
      tenderedAmount: paymentMode === 'CASH' ? numericTendered : undefined,
      changeAmount: paymentMode === 'CASH' ? changeToReturn : undefined,
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
      <div className="w-full max-w-lg rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-2xl max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        {!settledSuccess ? (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-[#DE8626]" />
                  <h3 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                    Settle Bill • Order #{order.id}
                  </h3>
                </div>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-0.5">
                  {order.tableName || order.orderTypeName || 'Counter'} • {order.customerName || 'Walk-in Guest'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-xl p-1.5 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 font-semibold">
                {errorMsg}
              </div>
            )}

            {/* Total Payable Display & Discount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl bg-amber-500/10 p-4 flex flex-col justify-center">
                <span className="text-[11px] font-bold uppercase text-[#DE8626]">
                  Payable Total
                </span>
                <span className="text-3xl font-extrabold text-[#DE8626]">
                  ₹{payableAmount}
                </span>
                {discountAmount > 0 && (
                  <span className="text-[10px] text-emerald-600 font-bold mt-0.5">
                    Discount Applied: ₹{discountAmount}
                  </span>
                )}
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
                    className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] pl-8 pr-3 py-3 text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs font-semibold text-[#667085] uppercase mb-2">
                Payment Method
              </label>
              <div className="grid grid-cols-5 gap-2">
                {(['CASH', 'UPI', 'CARD', 'DUE', 'SPLIT'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setPaymentMode(mode);
                      setShowUpiQr(mode === 'UPI');
                    }}
                    className={`rounded-xl border py-2.5 text-xs font-bold transition-all ${
                      paymentMode === mode
                        ? 'border-[#DE8626] bg-[#DE8626] text-white shadow-md'
                        : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#1E2930] dark:text-[#F3F4F6]'
                    }`}
                  >
                    {mode === 'SPLIT' ? 'SPLIT ⚡' : mode}
                  </button>
                ))}
              </div>
            </div>

            {/* SPLIT Payment Configuration */}
            {paymentMode === 'SPLIT' && (
              <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#DE8626] uppercase flex items-center gap-1.5">
                    <Split className="h-4 w-4" />
                    <span>Split Settlement</span>
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      isSplitBalanced
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-red-500/10 text-red-600'
                    }`}
                  >
                    {isSplitBalanced
                      ? 'Balanced (₹' + splitTotal + ')'
                      : `Difference: ₹${(payableAmount - splitTotal).toFixed(2)}`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#667085] mb-1">
                      Cash Portion (₹)
                    </label>
                    <input
                      type="number"
                      value={splitCash}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSplitCash(val);
                        const c = parseFloat(val) || 0;
                        setSplitDigital(String(Math.max(0, payableAmount - c)));
                      }}
                      className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3 py-2 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#667085] mb-1">
                      Digital Portion ({splitDigitalMode}) (₹)
                    </label>
                    <input
                      type="number"
                      value={splitDigital}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSplitDigital(val);
                        const d = parseFloat(val) || 0;
                        setSplitCash(String(Math.max(0, payableAmount - d)));
                      }}
                      className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3 py-2 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSplitDigitalMode('UPI')}
                    className={`flex-1 rounded-xl py-1.5 text-[11px] font-bold border ${
                      splitDigitalMode === 'UPI'
                        ? 'border-[#DE8626] bg-[#DE8626]/10 text-[#DE8626]'
                        : 'border-[#E7E1DA] text-[#667085]'
                    }`}
                  >
                    Digital via UPI
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitDigitalMode('CARD')}
                    className={`flex-1 rounded-xl py-1.5 text-[11px] font-bold border ${
                      splitDigitalMode === 'CARD'
                        ? 'border-[#DE8626] bg-[#DE8626]/10 text-[#DE8626]'
                        : 'border-[#E7E1DA] text-[#667085]'
                    }`}
                  >
                    Digital via Card
                  </button>
                </div>
              </div>
            )}

            {/* Dynamic UPI QR Code Display (When UPI or Split UPI selected) */}
            {(paymentMode === 'UPI' || (paymentMode === 'SPLIT' && splitDigitalMode === 'UPI')) && (
              <div className="rounded-2xl border border-dashed border-[#DE8626]/60 bg-amber-500/5 p-4 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#DE8626]">
                    <QrCode className="h-4 w-4" />
                    <span>Scan Counter UPI QR</span>
                  </div>
                  <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                    Pay exact ₹{upiPayable} via PhonePe, GPay, or Paytm
                  </p>
                  <p className="text-[10px] font-mono text-[#667085] opacity-80 truncate max-w-[200px]">
                    UPI ID: {upiId}
                  </p>
                </div>

                <div className="bg-white p-2 rounded-xl shadow-sm border shrink-0">
                  <img
                    src={upiQrImageUrl}
                    alt="UPI QR Code"
                    className="h-24 w-24 object-contain"
                    loading="lazy"
                  />
                </div>
              </div>
            )}

            {/* Cash Tendered & Change Return */}
            {paymentMode === 'CASH' && (
              <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[#667085] dark:text-[#94A3B8]">
                    Cash Tendered by Customer
                  </label>
                  {tenderedInput !== '' && !isNaN(parseFloat(tenderedInput)) && (
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        parseFloat(tenderedInput) >= payableAmount
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-red-500/10 text-red-600 dark:text-red-400'
                      }`}
                    >
                      {parseFloat(tenderedInput) >= payableAmount
                        ? `Change: ₹${changeToReturn.toFixed(2)}`
                        : `Short: ₹${(payableAmount - parseFloat(tenderedInput)).toFixed(2)}`}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-[#DE8626]">₹</span>
                  <input
                    type="number"
                    value={tenderedInput}
                    onChange={(e) => setTenderedInput(e.target.value)}
                    placeholder={String(payableAmount)}
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] pl-8 pr-3 py-2 text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                {/* Quick Cash Preset Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setTenderedInput(payableAmount.toFixed(0))}
                    className="rounded-lg border border-[#DE8626] bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-[#DE8626] hover:bg-amber-500/20"
                  >
                    Exact (₹{payableAmount})
                  </button>
                  {[
                    Math.ceil((payableAmount + 1) / 50) * 50,
                    Math.ceil((payableAmount + 1) / 100) * 100,
                    500,
                    1000,
                    2000,
                  ]
                    .filter((val, idx, arr) => val > payableAmount && arr.indexOf(val) === idx)
                    .slice(0, 3)
                    .map((val) => (
                      <button
                        key={`settle-chip-${val}`}
                        type="button"
                        onClick={() => setTenderedInput(val.toString())}
                        className="rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-2.5 py-1 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626]"
                      >
                        ₹{val}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* B2B Corporate Invoice Accordion */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-3">
              <button
                type="button"
                onClick={() => setShowB2bFields(!showB2bFields)}
                className="flex items-center justify-between w-full text-xs font-bold text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]"
              >
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-[#DE8626]" />
                  <span>B2B Corporate Invoice (Customer GSTIN)</span>
                </div>
                {showB2bFields ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showB2bFields && (
                <div className="grid grid-cols-2 gap-2.5 pt-3 mt-2 border-t border-[#E7E1DA] dark:border-[#2B3540]">
                  <div>
                    <label className="block text-[10px] font-semibold text-[#667085] uppercase mb-1">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Acme Infotech Pvt Ltd"
                      className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3 py-1.5 text-xs text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-[#667085] uppercase mb-1">
                      Customer GSTIN (15 Digits)
                    </label>
                    <input
                      type="text"
                      maxLength={15}
                      value={customerGstin}
                      onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                      placeholder="e.g. 29ABCDE1234F1Z5"
                      className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3 py-1.5 text-xs font-mono text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
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
