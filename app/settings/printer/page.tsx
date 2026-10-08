'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Printer,
  ArrowLeft,
  Check,
  Receipt,
  UtensilsCrossed,
  Info,
  Laptop,
  Tablet,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { usePrinterStore } from '@/stores/usePrinterStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { PaperWidth } from '@/types/printer';
import { WebPrinterService } from '@/services/webPrinterService';

export default function PrinterSettingsPage() {
  const router = useRouter();
  const { activeRestaurant } = useAuthStore();
  const {
    paperWidth,
    autoPrintReceipt,
    autoPrintKot,
    customFooter,
    setPaperWidth,
    setAutoPrintReceipt,
    setAutoPrintKot,
    setCustomFooter,
  } = usePrinterStore();

  const [footerText, setFooterText] = useState(customFooter);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
  const [isPrintingKot, setIsPrintingKot] = useState(false);
  const [previewTab, setPreviewTab] = useState<'receipt' | 'kot'>('receipt');

  useEffect(() => {
    setFooterText(customFooter);
  }, [customFooter]);

  const handleSaveFooter = async () => {
    try {
      await setCustomFooter(footerText.trim());
      setSuccessMsg('Receipt footer updated successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setErrorMsg('Failed to update receipt footer');
      setTimeout(() => setErrorMsg(null), 3000);
    }
  };

  const handleTestPrintReceipt = async () => {
    setIsPrintingReceipt(true);
    setErrorMsg(null);
    try {
      const restName = activeRestaurant?.restaurantName || 'Menza Restaurant';
      const success = await WebPrinterService.printTestReceipt(restName, paperWidth);
      if (success) {
        setSuccessMsg(`Test ${paperWidth} receipt sent to browser print driver!`);
      } else {
        setErrorMsg('Failed to open print driver. Please allow popups if prompted.');
      }
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to dispatch test receipt');
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setIsPrintingReceipt(false);
    }
  };

  const handleTestPrintKot = async () => {
    setIsPrintingKot(true);
    setErrorMsg(null);
    try {
      const restName = activeRestaurant?.restaurantName || 'Menza Restaurant';
      const success = await WebPrinterService.printTestKot(restName, paperWidth);
      if (success) {
        setSuccessMsg(`Test ${paperWidth} KOT sent to browser print driver!`);
      } else {
        setErrorMsg('Failed to open print driver. Please allow popups if prompted.');
      }
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to dispatch test KOT');
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setIsPrintingKot(false);
    }
  };

  const [isSerialConnected, setIsSerialConnected] = useState(false);
  const [serialSupported, setSerialSupported] = useState(false);
  const [showDriverGuide, setShowDriverGuide] = useState(false);

  useEffect(() => {
    setSerialSupported(WebPrinterService.isWebSerialSupported());
    setIsSerialConnected(WebPrinterService.isSerialConnected());
  }, []);

  const handleConnectSerial = async () => {
    setErrorMsg(null);
    const res = await WebPrinterService.requestSerialPort();
    if (res.success) {
      setIsSerialConnected(true);
      setSuccessMsg(res.message);
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(res.message);
      setTimeout(() => setErrorMsg(null), 5000);
    }
  };

  const handleDisconnectSerial = async () => {
    await WebPrinterService.disconnectSerialPort();
    setIsSerialConnected(false);
    setSuccessMsg('Disconnected from Web Serial port');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/settings')}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Settings</span>
            </button>
            <div className="flex items-center gap-2">
              {isSerialConnected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                  Web Serial Connected (COM)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Browser Print Spooler Active
                </span>
              )}
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
              Thermal Printer & KOT Settings
            </h1>
            <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8]">
              Configure POS thermal receipt roll dimensions, automated billing workflows, and test print hardware on Windows PC and Android tablets.
            </p>
          </div>

          {/* MPT-II Troubleshooting & Driver Unavailable Banner */}
          <div className="rounded-2xl border border-amber-300 dark:border-amber-900/60 bg-amber-500/10 p-4 space-y-2.5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-[#DE8626] shrink-0" />
                <h4 className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                  Seeing "MPT-II — Driver is unavailable" or "Not connected" in Windows?
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowDriverGuide(!showDriverGuide)}
                className="text-xs font-bold text-[#DE8626] hover:underline cursor-pointer"
              >
                {showDriverGuide ? 'Hide Fix Steps' : 'View Quick 4-Step Fix'}
              </button>
            </div>
            <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] leading-relaxed">
              When MPT-II (or any Bluetooth thermal printer) is paired, Windows classifies it as a raw Bluetooth Serial device without automatically attaching a printer queue driver. To print reliably:
            </p>

            {showDriverGuide && (
              <div className="mt-2 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-white/80 dark:bg-[#1B2127]/80 p-3.5 space-y-2 text-[11px] text-[#1E2930] dark:text-[#F3F4F6]">
                <ol className="list-decimal pl-4 space-y-1.5 font-medium">
                  <li>
                    Open <strong>Windows Settings &gt; Bluetooth &amp; devices &gt; Printers &amp; scanners</strong>, click <strong>Add device</strong>, then select <strong>Add manually</strong>.
                  </li>
                  <li>
                    Select <strong>Add a local printer or network printer with manual settings</strong> and click Next.
                  </li>
                  <li>
                    Under <em>Use an existing port</em>, choose the Bluetooth COM port assigned to MPT-II (e.g. <code>COM3</code> or <code>COM4</code>, visible in Device Manager under Ports), or <code>USB001</code> if USB connected.
                  </li>
                  <li>
                    Under Manufacturer select <strong>Generic</strong> &gt; Printer: <strong>Generic / Text Only</strong> (or install the POS-58 driver), and name it <strong>MPT-II</strong>.
                  </li>
                </ol>
                <div className="pt-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                  ✓ Windows will immediately mark MPT-II as "Ready", and Chrome print dialog will print directly without driver errors.
                </div>
              </div>
            )}

            {/* Direct Web Serial Alternative */}
            {serialSupported && (
              <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/40 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                  <strong>Alternative (Direct Web Serial):</strong> Connect directly to the MPT-II COM port to bypass the Windows driver completely.
                </div>
                {isSerialConnected ? (
                  <button
                    type="button"
                    onClick={handleDisconnectSerial}
                    className="px-3 py-1.5 rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/20 text-xs font-bold text-rose-600 hover:bg-rose-100 transition-colors"
                  >
                    Disconnect Web Serial
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConnectSerial}
                    className="px-3 py-1.5 rounded-xl border border-[#DE8626] bg-[#DE8626] text-xs font-bold text-white shadow-sm hover:bg-[#C4721C] transition-colors"
                  >
                    Connect via Web Serial (COM Port)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Feedback alerts */}
          {successMsg && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 p-3.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20 p-3.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Settings & Actions (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Paper Width Selector */}
              <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                    Thermal Paper Width
                  </h3>
                  <span className="text-[11px] font-bold text-[#DE8626] uppercase">
                    Active: {paperWidth}
                  </span>
                </div>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                  Select the roll size used by your billing counter receipt & kitchen printers.
                </p>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setPaperWidth('58mm')}
                    className={`flex flex-col items-center justify-center rounded-2xl border p-4 text-center transition-all ${
                      paperWidth === '58mm'
                        ? 'border-[#DE8626] bg-amber-500/10 text-[#DE8626] font-bold shadow-sm ring-1 ring-[#DE8626]'
                        : 'border-[#E7E1DA] dark:border-[#2B3540] text-[#667085] hover:border-gray-400 dark:hover:border-gray-600'
                    }`}
                  >
                    <span className="text-lg font-extrabold">58mm (2 Inch)</span>
                    <span className="text-[11px] opacity-75 mt-0.5">Compact POS roll (32 chars)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaperWidth('80mm')}
                    className={`flex flex-col items-center justify-center rounded-2xl border p-4 text-center transition-all ${
                      paperWidth === '80mm'
                        ? 'border-[#DE8626] bg-amber-500/10 text-[#DE8626] font-bold shadow-sm ring-1 ring-[#DE8626]'
                        : 'border-[#E7E1DA] dark:border-[#2B3540] text-[#667085] hover:border-gray-400 dark:hover:border-gray-600'
                    }`}
                  >
                    <span className="text-lg font-extrabold">80mm (3 Inch)</span>
                    <span className="text-[11px] opacity-75 mt-0.5">Standard High-Volume (48 chars)</span>
                  </button>
                </div>
              </div>

              {/* Automated Printing Preferences */}
              <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                  Automated Printing Workflow
                </h3>

                {/* Auto Print Receipt */}
                <div className="flex items-center justify-between py-2 border-b border-[#E7E1DA]/60 dark:border-[#2B3540]/60">
                  <div className="pr-4">
                    <p className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                      Auto-Print Customer Receipt
                    </p>
                    <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                      Trigger browser thermal print dialog automatically when an order is settled at POS.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoPrintReceipt(!autoPrintReceipt)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      autoPrintReceipt ? 'bg-[#DE8626]' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                    aria-label="Toggle auto print receipt"
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        autoPrintReceipt ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Auto Print KOT */}
                <div className="flex items-center justify-between py-2">
                  <div className="pr-4">
                    <p className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                      Auto-Print Kitchen KOT Ticket
                    </p>
                    <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                      Automatically dispatch kitchen ticket to kitchen printer when an order is punched.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoPrintKot(!autoPrintKot)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      autoPrintKot ? 'bg-[#DE8626]' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                    aria-label="Toggle auto print KOT"
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        autoPrintKot ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Custom Footer Message */}
              <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                  Receipt Footer Message
                </h3>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                  Custom greeting, tax declaration, or return policy printed at the bottom of customer receipts.
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    placeholder="Thank you! Please visit again."
                    className="flex-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                  <button
                    type="button"
                    onClick={handleSaveFooter}
                    className="rounded-xl bg-[#DE8626] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#C4721C] transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>

              {/* Hardware Verification / Test Actions */}
              <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                  Hardware Verification
                </h3>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                  Trigger a formatted test print through the browser thermal spooler to verify column alignment, font size, and paper tear-off spacing.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleTestPrintReceipt}
                    disabled={isPrintingReceipt}
                    className="flex items-center gap-2 rounded-xl border border-[#DE8626] bg-amber-500/10 px-4 py-2.5 text-xs font-bold text-[#DE8626] hover:bg-amber-500/20 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    <Receipt className="h-4 w-4" />
                    <span>{isPrintingReceipt ? 'Printing...' : `Print Test Receipt (${paperWidth})`}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTestPrintKot}
                    disabled={isPrintingKot}
                    className="flex items-center gap-2 rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-2.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    <UtensilsCrossed className="h-4 w-4" />
                    <span>{isPrintingKot ? 'Printing...' : `Print Test KOT (${paperWidth})`}</span>
                  </button>
                </div>
              </div>

              {/* Platform Instructions */}
              <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/60 dark:bg-[#151A20]/60 p-4 space-y-3 text-xs">
                <div className="flex items-center gap-2 font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                  <Info className="h-4 w-4 text-[#DE8626]" />
                  <span>Thermal Printing Best Practices</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-[#667085] dark:text-[#94A3B8]">
                  <div className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                      <Laptop className="h-3.5 w-3.5 text-[#DE8626]" />
                      <span>Windows PC (Chrome / Edge)</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>In print dialog, set <strong>Margins: None</strong>.</li>
                      <li>Uncheck <strong>Headers and footers</strong>.</li>
                      <li>Paper size: choose <strong>{paperWidth === '58mm' ? '58mm / Roll Paper' : '80mm / Receipt'}</strong>.</li>
                    </ul>
                  </div>

                  <div className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                      <Tablet className="h-3.5 w-3.5 text-blue-500" />
                      <span>Android Tablet Browser</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Allow popups if prompted on first print.</li>
                      <li>Select your USB OTG, Bluetooth, or WiFi POS printer.</li>
                      <li>Set page size to Roll / Continuous.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Live Thermal Print Simulation (5 cols) */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                  Live Thermal Roll Preview
                </h3>
                <div className="inline-flex rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] p-0.5 bg-[#FAF7F2] dark:bg-[#151A20]">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('receipt')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors ${
                      previewTab === 'receipt'
                        ? 'bg-white dark:bg-[#1B2127] text-[#DE8626] shadow-xs'
                        : 'text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
                    }`}
                  >
                    Receipt
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('kot')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors ${
                      previewTab === 'kot'
                        ? 'bg-white dark:bg-[#1B2127] text-[#DE8626] shadow-xs'
                        : 'text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
                    }`}
                  >
                    KOT
                  </button>
                </div>
              </div>

              {/* Thermal Paper Visual Simulator */}
              <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 flex justify-center items-start overflow-x-auto min-h-[480px]">
                <div
                  style={{
                    width: paperWidth === '80mm' ? '280px' : '210px',
                    fontFamily: "'Courier New', Courier, monospace",
                  }}
                  className="bg-white text-black shadow-lg rounded-sm p-3.5 text-[11px] leading-tight select-none border-t-4 border-amber-500 transition-all duration-300"
                >
                  {previewTab === 'receipt' ? (
                    /* Receipt Simulation */
                    <div className="space-y-1.5">
                      <div className="text-center font-black text-xs uppercase tracking-wide">
                        {activeRestaurant?.restaurantName || 'Menza Restaurant'}
                      </div>
                      <div className="text-center text-[10px] text-gray-700">
                        {activeRestaurant?.address || '100 Feet Road, Indiranagar'}
                      </div>
                      <div className="text-center text-[10px] text-gray-700">
                        GSTIN: 29ABCDE1234F1Z5
                      </div>

                      <div className="border-t border-black my-1" />

                      <div className="flex justify-between text-[10px]">
                        <span>Order: #TEST-101</span>
                        <span>{new Date().toLocaleDateString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span>Type: <strong>DINE_IN</strong></span>
                        <span>Table: <strong>4</strong></span>
                      </div>

                      <div className="border-t border-dashed border-black my-1" />

                      <div className="flex justify-between font-bold text-[10px] py-0.5">
                        <span>ITEM</span>
                        <span>QTY</span>
                        <span>AMT</span>
                      </div>
                      <div className="border-b border-dashed border-black my-0.5" />

                      <div className="flex justify-between text-[10.5px]">
                        <span className="truncate pr-1">Paneer Butter Masala</span>
                        <span className="shrink-0">x1</span>
                        <span className="shrink-0 font-medium">₹240.00</span>
                      </div>
                      <div className="flex justify-between text-[10.5px]">
                        <span className="truncate pr-1">Butter Naan</span>
                        <span className="shrink-0">x3</span>
                        <span className="shrink-0 font-medium">₹120.00</span>
                      </div>
                      <div className="flex justify-between text-[10.5px]">
                        <span className="truncate pr-1">Jeera Rice</span>
                        <span className="shrink-0">x1</span>
                        <span className="shrink-0 font-medium">₹150.00</span>
                      </div>

                      <div className="border-t border-dashed border-black my-1" />

                      <div className="flex justify-between text-[10px]">
                        <span>Total Items:</span>
                        <span>5 Qty</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span>Subtotal:</span>
                        <span>₹510.00</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span>CGST (2.5%):</span>
                        <span>₹12.75</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span>SGST (2.5%):</span>
                        <span>₹12.75</span>
                      </div>

                      <div className="border-t border-b border-black py-1 my-1 flex justify-between font-black text-xs">
                        <span>GRAND TOTAL:</span>
                        <span>₹535.50</span>
                      </div>

                      <div className="flex justify-between text-[10px]">
                        <span>Payment Mode:</span>
                        <span className="font-bold">CASH</span>
                      </div>

                      <div className="border-t border-dashed border-black my-1.5" />

                      <div className="text-center text-[10px] text-gray-800 font-semibold italic">
                        {footerText || 'Thank you! Please visit again.'}
                      </div>
                      <div className="text-center text-[8px] text-gray-500 pt-1">
                        Powered by Menza Cloud POS
                      </div>

                      {/* Paper feed indicator */}
                      <div className="pt-4 border-b-2 border-dashed border-gray-300 text-center text-[8px] text-gray-400">
                        ✂ Tear along cut line
                      </div>
                    </div>
                  ) : (
                    /* KOT Simulation */
                    <div className="space-y-1.5">
                      <div className="text-center border border-dashed border-black py-0.5 text-[10px] font-black">
                        --- [ ✂ KITCHEN KOT ✂ ] ---
                      </div>
                      <div className="text-center text-[10px] font-bold">
                        {activeRestaurant?.restaurantName || 'RESTAURANT'} - KITCHEN
                      </div>

                      <div className="border-2 border-black p-1 text-center font-black text-base my-1">
                        TOKEN #T-01
                      </div>

                      <div className="flex justify-between text-[10px]">
                        <span>Order: #TEST-101</span>
                        <span>{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold">
                        <span>TABLE: 4 (AC Dining)</span>
                        <span>DINE_IN</span>
                      </div>

                      <div className="border-t border-black my-1" />
                      <div className="flex justify-between font-black text-[10px]">
                        <span>ITEM</span>
                        <span>QTY</span>
                      </div>
                      <div className="border-b border-black my-0.5" />

                      <div className="flex justify-between font-bold text-[11px]">
                        <span>[ ] Paneer Butter Masala</span>
                        <span>x1</span>
                      </div>
                      <div className="text-[9px] italic pl-3 text-gray-700">
                        * Note: Less spicy
                      </div>

                      <div className="flex justify-between font-bold text-[11px] pt-1">
                        <span>[ ] Butter Naan</span>
                        <span>x3</span>
                      </div>

                      <div className="flex justify-between font-bold text-[11px] pt-1">
                        <span>[ ] Jeera Rice</span>
                        <span>x1</span>
                      </div>

                      <div className="border-t border-dashed border-black my-2" />
                      <div className="text-center text-[9px] font-bold">
                        End of KOT • Dispatch Immediately
                      </div>

                      {/* Paper feed indicator */}
                      <div className="pt-4 border-b-2 border-dashed border-gray-300 text-center text-[8px] text-gray-400">
                        ✂ Tear along cut line
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}

