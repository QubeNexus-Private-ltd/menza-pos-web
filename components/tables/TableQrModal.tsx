'use client';

import React, { useState, useEffect } from 'react';
import { QrCode, Printer, X, Download, Copy, Check, ExternalLink, Sparkles } from 'lucide-react';
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
  const [qrData, setQrData] = useState<TableQrResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !tableId) return;

    let mounted = true;
    setLoading(true);
    WebTableQrService.getTableQr(tableId, restaurantId)
      .then((data) => {
        if (mounted) setQrData(data);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, tableId, restaurantId]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  // Fallback direct ordering URL if backend hasn't generated base64 yet
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
    a.download = `${restaurantName.replace(/\s+/g, '_')}_Table_${tableNumber}_QR.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-[#DE8626]" />
            <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">Table #{tableNumber} Sticker</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-[#667085] hover:bg-black/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Printable Standee / Sticker Preview */}
        <div
          id="printable-table-qr"
          className="rounded-2xl border-2 border-dashed border-[#DE8626]/40 bg-[#FAF7F2] dark:bg-[#151A20] p-6 text-center space-y-3"
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
              className="h-44 w-44 object-contain"
            />
          </div>

          <div>
            <p className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">Scan to View Menu & Order</p>
            <p className="text-[10px] text-[#667085] mt-0.5">Contactless Digital Dining</p>
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
            <span>{copied ? 'Copied' : 'Copy Link'}</span>
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
            <span>Print Sticker</span>
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
