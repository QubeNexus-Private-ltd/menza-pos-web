'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { QrCode, Printer, X, Download, Copy, Check, Clock, RefreshCw, Sparkles } from 'lucide-react';
import { WebTableQrService, TableQrResponseDTO } from '@/services/tableQrService';

interface TableQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableId: number;
  tableNumber: string;
  restaurantName: string;
  restaurantId: number;
}

export function TableQrModal({
  isOpen,
  onClose,
  tableId,
  tableNumber,
  restaurantName,
  restaurantId,
}: TableQrModalProps) {
  const [mode, setMode] = useState<'rolling' | 'sticker'>('rolling');
  const [qrData, setQrData] = useState<TableQrResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5 mins in seconds

  const loadQr = useCallback(async () => {
    if (!tableId) return;
    setLoading(true);
    try {
      if (mode === 'rolling') {
        const data = await WebTableQrService.getRollingTableQr(tableId, 5);
        setQrData(data);
        setTimeLeft(data?.ttlSeconds ?? 300);
      } else {
        const data = await WebTableQrService.getTableQr(tableId, restaurantId);
        setQrData(data);
        setTimeLeft(0);
      }
    } finally {
      setLoading(false);
    }
  }, [tableId, restaurantId, mode]);

  useEffect(() => {
    if (!isOpen || !tableId) return;
    loadQr();
  }, [isOpen, tableId, mode, loadQr]);

  // Rolling countdown timer
  useEffect(() => {
    if (!isOpen || mode !== 'rolling' || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Auto refresh QR when expired
          loadQr();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, mode, timeLeft, loadQr]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const customerUrl = qrData?.qrUrl || `${process.env.NEXT_PUBLIC_CUSTOMER_ORDERING_BASE_URL || 'https://lemon-mud-097d55a00.7.azurestaticapps.net'}?restId=${restaurantId}&table=${tableNumber}`;
  const qrImageSrc = qrData?.qrCodeBase64
    ? (qrData.qrCodeBase64.startsWith('data:') ? qrData.qrCodeBase64 : `data:image/png;base64,${qrData.qrCodeBase64}`)
    : `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(customerUrl)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(customerUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert(`Direct Order URL:\n${customerUrl}`);
    }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = qrImageSrc;
    a.download = `${restaurantName.replace(/\s+/g, '_')}_Table_${tableNumber}_${mode}_QR.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-[#DE8626]" />
            <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">Table #{tableNumber} QR</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-[#667085] hover:bg-black/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="flex rounded-xl bg-[#FAF7F2] dark:bg-[#151A20] p-1 border border-[#E7E1DA] dark:border-[#2B3540] text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('rolling')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
              mode === 'rolling'
                ? 'bg-white dark:bg-[#1E2930] text-[#DE8626] shadow-sm'
                : 'text-[#667085] hover:text-[#1E2930]'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Dynamic (5m TTL)</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('sticker')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
              mode === 'sticker'
                ? 'bg-white dark:bg-[#1E2930] text-[#DE8626] shadow-sm'
                : 'text-[#667085] hover:text-[#1E2930]'
            }`}
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Sticker</span>
          </button>
        </div>

        {/* Expiry Banner / Info */}
        {mode === 'rolling' ? (
          <div className="flex items-center justify-between rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 px-3 py-2 text-xs">
            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold">
              <Clock className="h-4 w-4 shrink-0" />
              <span>Valid for order claim:</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-extrabold text-amber-800 dark:text-amber-300">
                {formatCountdown(timeLeft)}
              </span>
              <button
                type="button"
                onClick={loadQr}
                className="p-1 hover:bg-amber-100 rounded text-amber-700 dark:hover:bg-amber-900"
                title="Refresh QR"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 px-3 py-2 text-[11px] text-emerald-800 dark:text-emerald-300">
            📌 <strong>Physical Sticker QR:</strong> Valid for a few minutes upon initial guest scan; automatically stays active once order is placed until the bill is settled or cancelled.
          </div>
        )}

        {/* Printable Standee / Sticker Preview */}
        <div
          id="printable-table-qr"
          className="rounded-2xl border-2 border-dashed border-[#DE8626]/40 bg-[#FAF7F2] dark:bg-[#151A20] p-5 text-center space-y-2.5"
        >
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#DE8626]">
              {restaurantName}
            </span>
            <h4 className="text-xl font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
              TABLE #{tableNumber}
            </h4>
          </div>

          <div className="flex justify-center p-2 bg-white rounded-xl shadow-inner mx-auto w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrImageSrc}
              alt={`Table ${tableNumber} QR`}
              className={`h-40 w-40 object-contain ${loading ? 'opacity-40 animate-pulse' : ''}`}
            />
          </div>

          <div>
            <p className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">Scan to View Menu & Order</p>
            <p className="text-[10px] text-[#667085] mt-0.5">
              {mode === 'rolling' ? 'Valid until bill settlement' : 'Contactless Digital Dining'}
            </p>
          </div>
        </div>

        {/* Quick Share Link */}
        <div className="flex items-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-2 text-xs">
          <input
            type="text"
            readOnly
            value={customerUrl}
            className="flex-1 bg-transparent text-[11px] font-mono text-[#667085] dark:text-[#94A3B8] outline-none truncate"
          />
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1 rounded-lg bg-white dark:bg-[#1B2127] border border-[#E7E1DA] dark:border-[#2B3540] px-2 py-1 text-[10px] font-bold text-[#DE8626] hover:bg-black/5 shrink-0"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3 py-2.5 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5 transition-colors"
            title="Download QR Image"
          >
            <Download className="h-4 w-4 text-[#DE8626]" />
            <span className="hidden sm:inline">Download</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#DE8626] py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#C4721C] transition-colors"
          >
            <Printer className="h-4 w-4" />
            <span>Print {mode === 'sticker' ? 'Sticker' : 'QR'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2.5 rounded-xl border border-[#E7E1DA] text-xs font-semibold text-[#667085]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
