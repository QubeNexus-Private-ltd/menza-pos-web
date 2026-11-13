'use client';

import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  X,
  Copy,
  Check,
  ExternalLink,
  Smartphone,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { WebWhatsAppService, WhatsAppReceiptData } from '@/services/whatsAppService';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  receiptData?: WhatsAppReceiptData;
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  isOpen,
  onClose,
  order,
  receiptData,
}) => {
  const [phone, setPhone] = useState('');
  const [copied, setCopied] = useState(false);
  const [maskedHint, setMaskedHint] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !order) return;

    // Check if there is an unmasked phone candidate
    const resolved = WebWhatsAppService.resolveMobileNumber(
      order.mobileNumber || order.customerPhone || order.phone,
      order
    );

    if (resolved && resolved.length >= 10) {
      setPhone(resolved.slice(-10));
      setMaskedHint(null);
    } else {
      // Check if original is masked e.g. ******1234
      const raw = order.mobileNumber || order.customerPhone || '';
      if (typeof raw === 'string' && raw.includes('*')) {
        const lastDigits = raw.replace(/[^0-9]/g, '');
        setMaskedHint(lastDigits.length > 0 ? `...${lastDigits}` : null);
      } else {
        setMaskedHint(null);
      }
      setPhone('');
    }
    setCopied(false);
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const effectiveReceiptData: WhatsAppReceiptData = receiptData || {
    restaurantName: order.restaurantName || 'Menza Restaurant',
    orderId: order.orderId || order.id || '',
    customerName: order.customerName,
    tableName: order.tableName,
    orderType: order.orderTypeName || (order.tableId ? 'Dine-In' : 'Counter'),
    items: Array.isArray(order.items)
      ? order.items.map((i: any) => ({
          itemName: i.itemName,
          quantity: i.quantity,
          price: Number(i.unitPrice || i.price || 0),
        }))
      : [],
    grandTotal: Number(order.totalAmount || order.grandTotal || 0),
    paymentMode: order.paymentMode || 'CASH',
    paymentStatus: order.paymentStatus || 'Paid',
  };

  const cleanOrderId = String(effectiveReceiptData.orderId).replace(/[^0-9]/g, '') || String(effectiveReceiptData.orderId);
  const formattedText = WebWhatsAppService.formatReceiptMessage(effectiveReceiptData);
  const billPdfUrl = `https://menzaorder.co.in/bill/${cleanOrderId}`;

  const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
  const isValidPhone = cleanPhone.length === 10;
  const fullPhone = `91${cleanPhone}`;

  // Direct Button Click Action 1: Standard WhatsApp Web / Universal Link
  const handleOpenWhatsAppWeb = () => {
    if (!isValidPhone) return;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const url = isMobile
      ? `https://wa.me/${fullPhone}?text=${encodeURIComponent(formattedText)}`
      : `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(formattedText)}`;

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Direct Button Click Action 2: Native WhatsApp Desktop App (Zero browser tabs!)
  const handleOpenWhatsAppApp = () => {
    if (!isValidPhone) return;
    const desktopProtocolUrl = `whatsapp://send?phone=${fullPhone}&text=${encodeURIComponent(formattedText)}`;
    window.location.href = desktopProtocolUrl;
  };

  // Direct Button Click Action 3: Copy Text & Link for Already Open WhatsApp Web tab
  const handleCopyBill = async () => {
    try {
      await navigator.clipboard.writeText(formattedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      alert('Unable to copy to clipboard.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E7E1DA] dark:border-[#2B3540] pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                Share Bill via WhatsApp
              </h3>
              <p className="text-xs text-[#667085]">
                Order #{cleanOrderId} • Total ₹{effectiveReceiptData.grandTotal.toFixed(2)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] p-1.5 text-[#667085] hover:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Recipient Phone Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-[#667085]">
            <label htmlFor="customerPhone">Customer WhatsApp Mobile Number *</label>
            {maskedHint && (
              <span className="text-amber-600 dark:text-amber-400 text-[11px] font-medium flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Customer number ends in {maskedHint}
              </span>
            )}
          </div>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#667085]">
              +91
            </span>
            <input
              id="customerPhone"
              type="tel"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Enter 10-digit mobile number"
              className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] pl-12 pr-4 py-3 text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-emerald-500 transition-colors"
              autoFocus
            />
          </div>
          {!isValidPhone && phone.length > 0 && (
            <p className="text-[11px] text-red-500">
              Please enter a complete 10-digit mobile number ({10 - phone.length} digits remaining).
            </p>
          )}
        </div>

        {/* Bill Preview Box */}
        <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF8F5] dark:bg-[#15191E] p-3 text-xs text-[#1E2930] dark:text-[#E2E8F0] space-y-1 max-h-36 overflow-y-auto font-mono">
          <div className="flex items-center justify-between font-bold text-[#DE8626] border-b border-black/5 dark:border-white/5 pb-1">
            <span>Bill Preview:</span>
            <a
              href={billPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
            >
              <span>View PDF</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-[#667085] dark:text-[#94A3B8]">
            {formattedText}
          </pre>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          {/* Main Primary Button: WhatsApp Web */}
          <button
            onClick={handleOpenWhatsAppWeb}
            disabled={!isValidPhone}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-40 transition-all cursor-pointer"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Send via WhatsApp Web</span>
          </button>

          {/* Secondary Button: WhatsApp Desktop App (No browser tab conflict!) */}
          <button
            onClick={handleOpenWhatsAppApp}
            disabled={!isValidPhone}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 py-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 transition-all cursor-pointer"
            title="Opens Windows WhatsApp Desktop app directly without opening any browser tabs"
          >
            <Smartphone className="h-4 w-4" />
            <span>Open in WhatsApp Desktop App (Zero Tabs)</span>
          </button>

          {/* Third Button: Copy Bill to Clipboard */}
          <button
            onClick={handleCopyBill}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] py-2.5 text-xs font-semibold text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-600" />
                <span className="text-emerald-600 font-bold">Copied! Paste into your open WhatsApp</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy Bill & PDF Link (Paste into open WhatsApp)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
