'use client';

import React, { useState, useEffect } from 'react';
import {
  Printer,
  X,
  CheckCircle2,
  Settings,
  FileText,
  Sliders,
  Check,
  Bluetooth,
  Smartphone,
  Laptop,
} from 'lucide-react';
import { usePrinterStore, PrintChannel } from '@shared/presentation/state/usePrinterStore';
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
    printChannel,
    setPrintChannel,
  } = usePrinterStore();

  const [footerText, setFooterText] = useState(customFooter || 'Thank you! Visit again.');
  const [testPrinting, setTestPrinting] = useState(false);
  const [isBleConnected, setIsBleConnected] = useState(false);
  const [bleDeviceName, setBleDeviceName] = useState<string | null>(null);
  const [isBleSupported, setIsBleSupported] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isConnectingBle, setIsConnectingBle] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsBleSupported(WebPrinterService.isWebBluetoothSupported());
      setIsBleConnected(WebPrinterService.isBluetoothConnected());
      setBleDeviceName(WebPrinterService.getConnectedBluetoothDeviceName());
      setIsAndroid(WebPrinterService.isAndroid());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePairBle = async () => {
    try {
      setIsConnectingBle(true);
      setStatusFeedback(null);
      const res = await WebPrinterService.requestBluetoothDevice();
      if (res.success) {
        setIsBleConnected(true);
        setBleDeviceName(res.deviceName || 'Thermal BLE Printer');
        setStatusFeedback(res.message);
      } else {
        setStatusFeedback(res.message);
      }
    } catch (err: any) {
      setStatusFeedback(err?.message || 'Failed to connect Bluetooth printer.');
    } finally {
      setIsConnectingBle(false);
      setTimeout(() => setStatusFeedback(null), 4000);
    }
  };

  const handleDisconnectBle = async () => {
    await WebPrinterService.disconnectBluetoothDevice();
    setIsBleConnected(false);
    setBleDeviceName(null);
    setStatusFeedback('Bluetooth printer disconnected');
    setTimeout(() => setStatusFeedback(null), 3000);
  };

  const handleTestPrint = async () => {
    try {
      setTestPrinting(true);
      setStatusFeedback(null);
      const success = await WebPrinterService.printReceipt(
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
      if (success) {
        setStatusFeedback('Test receipt sent to printer!');
      }
    } catch (err: any) {
      setStatusFeedback(err?.message || 'Test print failed.');
    } finally {
      setTestPrinting(false);
      setTimeout(() => setStatusFeedback(null), 4000);
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
        className="relative w-full max-w-lg rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 shadow-2xl animate-in zoom-in-95 duration-200"
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
                Thermal receipt and kitchen printer options across Mobile & Desktop
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

        {/* Feedback message */}
        {statusFeedback && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-300 dark:border-amber-800 text-[11px] font-bold text-[#DE8626]">
            {statusFeedback}
          </div>
        )}

        <div className="py-4 space-y-4 text-xs max-h-[70vh] overflow-y-auto pr-1">
          {/* Print Channel Selector */}
          <div>
            <label className="block text-[11px] font-bold text-[#667085] dark:text-[#94A3B8] uppercase mb-1.5">
              Printer Connection Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPrintChannel('auto')}
                className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                  printChannel === 'auto'
                    ? 'border-[#DE8626] bg-amber-500/10 text-[#DE8626] ring-1 ring-[#DE8626]'
                    : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#1E2930] dark:text-[#F3F4F6]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Smartphone className="h-3.5 w-3.5" />
                  <span>Auto Smart Dispatch</span>
                </div>
                <span className="text-[10px] opacity-75 mt-0.5">
                  Direct BT / RawBT / Serial / Spooler
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPrintChannel('web_bluetooth')}
                className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                  printChannel === 'web_bluetooth'
                    ? 'border-[#DE8626] bg-amber-500/10 text-[#DE8626] ring-1 ring-[#DE8626]'
                    : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#1E2930] dark:text-[#F3F4F6]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Bluetooth className="h-3.5 w-3.5" />
                  <span>Direct Bluetooth</span>
                </div>
                <span className="text-[10px] opacity-75 mt-0.5">
                  BLE thermal printer (No app)
                </span>
              </button>

              {isAndroid && (
                <button
                  type="button"
                  onClick={() => setPrintChannel('rawbt')}
                  className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                    printChannel === 'rawbt'
                      ? 'border-[#DE8626] bg-amber-500/10 text-[#DE8626] ring-1 ring-[#DE8626]'
                      : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#1E2930] dark:text-[#F3F4F6]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Smartphone className="h-3.5 w-3.5" />
                    <span>Android RawBT</span>
                  </div>
                  <span className="text-[10px] opacity-75 mt-0.5">
                    Classic BT / USB OTG
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setPrintChannel('browser_spooler')}
                className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                  printChannel === 'browser_spooler'
                    ? 'border-[#DE8626] bg-amber-500/10 text-[#DE8626] ring-1 ring-[#DE8626]'
                    : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#1E2930] dark:text-[#F3F4F6]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Printer className="h-3.5 w-3.5" />
                  <span>Browser Spooler</span>
                </div>
                <span className="text-[10px] opacity-75 mt-0.5">
                  Desktop driver / AirPrint dialog
                </span>
              </button>
            </div>
          </div>

          {/* Web Bluetooth Device Status & Pairing */}
          {isBleSupported && (
            <div className="p-3 rounded-2xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bluetooth className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="font-bold text-xs text-[#1E2930] dark:text-[#F3F4F6]">
                    Bluetooth Thermal Connection
                  </span>
                </div>
                {isBleConnected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Connected
                  </span>
                ) : (
                  <span className="text-[10px] text-[#667085] dark:text-[#94A3B8]">
                    Not Paired
                  </span>
                )}
              </div>

              {isBleConnected && bleDeviceName && (
                <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                  Active Printer: <strong>{bleDeviceName}</strong>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                {isBleConnected ? (
                  <button
                    type="button"
                    onClick={handleDisconnectBle}
                    className="px-2.5 py-1.5 rounded-lg border border-rose-300 bg-rose-50 dark:bg-rose-950/30 text-[11px] font-bold text-rose-600 hover:bg-rose-100 transition-colors"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePairBle}
                    disabled={isConnectingBle}
                    className="px-3 py-1.5 rounded-xl border border-blue-600 bg-blue-600 text-[11px] font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
                  >
                    {isConnectingBle ? 'Searching...' : 'Pair Bluetooth Printer'}
                  </button>
                )}
              </div>
            </div>
          )}

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
        <div className="pt-3 flex items-center justify-between gap-2 border-t border-[#E7E1DA] dark:border-[#2B3540]">
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
