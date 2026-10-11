'use client';

import React, { useState, useEffect } from 'react';
import { QrCode, Printer, X, Download, Store, Copy, Check, Sparkles } from 'lucide-react';
import { WebTableQrService, RestaurantQrResponseDTO } from '@/services/tableQrService';

interface StorefrontQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: number;
  restaurantName: string;
}

export function StorefrontQrModal({
  isOpen,
  onClose,
  restaurantId,
  restaurantName,
}: StorefrontQrModalProps) {
  const [qrData, setQrData] = useState<RestaurantQrResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !restaurantId) return;

    let mounted = true;
    setLoading(true);
    WebTableQrService.getStorefrontQr(restaurantId)
      .then((data) => {
        if (mounted) setQrData(data);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, restaurantId]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const customerUrl = qrData?.qrUrl || `${process.env.NEXT_PUBLIC_CUSTOMER_ORDERING_BASE_URL || 'https://lemon-mud-097d55a00.7.azurestaticapps.net'}?restId=${restaurantId}`;
  const qrImageSrc = qrData?.qrCodeBase64
    ? (qrData.qrCodeBase64.startsWith('data:') ? qrData.qrCodeBase64 : `data:image/png;base64,${qrData.qrCodeBase64}`)
    : `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(customerUrl)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(customerUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert(`Storefront URL:\n${customerUrl}`);
    }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = qrImageSrc;
    a.download = `${restaurantName.replace(/\s+/g, '_')}_Storefront_QR.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-[#DE8626]" />
            <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">Storefront Menu Standee</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-[#667085] hover:bg-black/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Printable Standee Card */}
        <div
          id="printable-store-qr"
          className="rounded-3xl border-2 border-[#DE8626] bg-gradient-to-b from-[#FFF4E5] to-[#FFFFFF] dark:from-[#2A1E11] dark:to-[#1B2127] p-6 text-center space-y-3 shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#DE8626] text-white shadow-md mx-auto">
            <span className="font-extrabold text-xl">M</span>
          </div>

          <div>
            <h4 className="text-xl font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
              {restaurantName}
            </h4>
            <p className="text-xs text-[#DE8626] font-bold uppercase tracking-wider mt-0.5">
              Contactless Digital Menu
            </p>
          </div>

          <div className="flex justify-center p-3 bg-white rounded-2xl shadow-md mx-auto w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrImageSrc}
              alt={`${restaurantName} QR`}
              className="h-48 w-48 object-contain"
            />
          </div>

          <div>
            <p className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">Scan to Browse Menu & Pay</p>
            <p className="text-[10px] text-[#667085] mt-0.5">No App Download Required</p>
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
            <span>Print Standee</span>
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
