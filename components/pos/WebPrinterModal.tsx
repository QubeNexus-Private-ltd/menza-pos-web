'use client';

import React, { useState } from 'react';
import {
  Printer,
  X,
  CheckCircle2,
  Settings,
  FileText,
  Sliders,
  Check,
} from 'lucide-react';
import { usePrinterStore } from '@shared/presentation/state/usePrinterStore';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { usePosCatalogStore } from '@/stores/usePosCatalogStore';
import { WebPrinterService } from '@/services/webPrinterService';

interface WebPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantName?: string;
}

export const WebPrinterModal: React.FC<WebPrinterModalProps> = ({
  isOpen,
  onClose,
  restaurantName = 'Menza Restaurant',
}) => {
  const {
    paperWidth,
    setPaperWidth,
    autoPrintReceipt,
    setAutoPrintReceipt,
    autoPrintKot,
    setAutoPrintKot,
    customFooter,
    setCustomFooter,
  } = usePrinterStore();

  const [footerText, setFooterText] = useState(customFooter || 'Thank you! Visit again.');
  const [testPrinting, setTestPrinting] = useState(false);

  if (!isOpen) return null;

  const handleTestPrint = async () => {
    try {
      setTestPrinting(true);
      await WebPrinterService.printReceipt(
        {
          orderId: 'TEST-101',
          orderNumber: 'TEST-101',
          pickupToken: '101',
          restaurantName,
          address: 'Test Address',
          contactPhone: '9876543210',
          customerName: 'Test Customer',
          orderType: 'COUNTER',
          items: [{ itemName: 'Test Masala Dosa', quantity: 1, unitPrice: 120, totalPrice: 120 }],
          subtotal: 120,
          grandTotal: 120,
          paymentMode: 'CASH',
          date: new Date().toLocaleString('en-IN'),
          upiId: (
            usePosCatalogStore.getState().restaurantConfig?.bankerUpiId ||
            (useAuthStore.getState().activeRestaurant as any)?.bankerUpiId ||
            'menzahospitality@icici'
          ).trim(),
          upiPayeeName:
            usePosCatalogStore.getState().restaurantConfig?.bankerAccountHolderName ||
            restaurantName,
          showUpiQr: true,
          footerMessage: footerText,
        },
        paperWidth
      );
    } catch (err) {
      console.warn('Test print error:', err);
    } finally {
      setTestPrinting(false);
    }
  };

  const handleSave = () => {
    setCustomFooter(footerText);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-[#E7E1DA] dark:border-[#2B3540]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-[#DE8626]">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                Printer & Slip Settings
              </h3>
              <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                Thermal receipt and kitchen printer options
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#8C7A6B] hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="py-4 space-y-4 text-xs">
          {/* Paper Width Selection */}
          <div>
            <label className="block text-[11px] font-bold text-[#667085] dark:text-[#94A3B8] uppercase mb-1.5">
              Thermal Paper Width
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['58mm', '80mm'] as const).map((width) => (
                <button
                  key={width}
                  type="button"
                  onClick={() => setPaperWidth(width)}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 font-bold transition-all ${
                    paperWidth === width
                      ? 'border-[#DE8626] bg-amber-500/10 text-[#DE8626]'
                      : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#1E2930] dark:text-[#F3F4F6]'
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  <span>{width === '58mm' ? '58mm (2 Inch / Small)' : '80mm (3 Inch / Standard)'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Auto Print Toggles */}
          <div className="space-y-2.5 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] p-3.5 bg-[#FAF7F2] dark:bg-[#151A20]">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6] block">Auto-Print Invoice Receipt</span>
                <span className="text-[10px] text-[#667085] dark:text-[#94A3B8]">Print bill automatically when settling</span>
              </div>
              <input
                type="checkbox"
                checked={autoPrintReceipt}
                onChange={(e) => setAutoPrintReceipt(e.target.checked)}
                className="h-4 w-4 rounded accent-[#DE8626] cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#E7E1DA]/60 dark:border-[#2B3540]/60">
              <div>
                <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6] block">Auto-Print Kitchen Ticket (KOT)</span>
                <span className="text-[10px] text-[#667085] dark:text-[#94A3B8]">Print KOT slip on sending order</span>
              </div>
              <input
                type="checkbox"
                checked={autoPrintKot}
                onChange={(e) => setAutoPrintKot(e.target.checked)}
                className="h-4 w-4 rounded accent-[#DE8626] cursor-pointer"
              />
            </div>
          </div>

          {/* Custom Footer */}
          <div>
            <label className="block text-[11px] font-bold text-[#667085] dark:text-[#94A3B8] uppercase mb-1">
              Custom Footer Message
            </label>
            <input
              type="text"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="e.g. Thank you! Visit again."
              className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3 py-2 text-xs text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex items-center justify-between gap-2 border-t border-[#E7E1DA] dark:border-[#2B3540]">
          <button
            type="button"
            onClick={handleTestPrint}
            disabled={testPrinting}
            className="rounded-xl border border-[#DE8626] bg-transparent px-3 py-2 text-xs font-bold text-[#DE8626] hover:bg-amber-500/10 transition-colors"
          >
            {testPrinting ? 'Testing...' : 'Test Print Slip'}
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-xl bg-[#DE8626] px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-[#C4721C] transition-colors"
          >
            <Check className="h-4 w-4" />
            <span>Save & Close</span>
          </button>
        </div>
      </div>
    </div>
  );
};
