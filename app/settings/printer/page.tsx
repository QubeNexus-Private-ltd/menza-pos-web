'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Printer,
  ArrowLeft,
  Check,
  ReceiptIndianRupee as Receipt,
  UtensilsCrossed,
  Info,
  Laptop,
  Tablet,
  Smartphone,
  Bluetooth,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Download,
  Radio,
  RefreshCw,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { usePrinterStore, PrintChannel } from '@shared/presentation/state/usePrinterStore';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { usePosCatalogStore } from '@/stores/usePosCatalogStore';
import { RestaurantConfigRemoteDataSource } from '@shared/data/datasources/RestaurantConfigRemoteDataSource';
import { PaperWidth } from '@shared/core/printer/EscPosBuilder';
import { WebPrinterService } from '@/services/webPrinterService';

export default function PrinterSettingsPage() {
  const router = useRouter();
  const { activeRestaurant, restaurants } = useAuthStore();
  const restaurantConfig = usePosCatalogStore((state) => state.restaurantConfig);
  const previewLogoUrl = (
    restaurantConfig?.logoUrl ||
    activeRestaurant?.logoUrl ||
    restaurantConfig?.imageUrl ||
    activeRestaurant?.imageUrl ||
    ''
  ).trim();
  const {
    paperWidth,
    autoPrintReceipt,
    autoPrintKot,
    customFooter,
    printChannel,
    setPaperWidth,
    setAutoPrintReceipt,
    setAutoPrintKot,
    setCustomFooter,
    setPrintChannel,
  } = usePrinterStore();

  const [footerText, setFooterText] = useState(customFooter);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
  const [isPrintingKot, setIsPrintingKot] = useState(false);
  const [previewTab, setPreviewTab] = useState<'receipt' | 'kot'>('receipt');
  const [processedLogoUrl, setProcessedLogoUrl] = useState<string>('');

  // Hardware Connection States
  const [isSerialConnected, setIsSerialConnected] = useState(false);
  const [serialSupported, setSerialSupported] = useState(false);
  const [isBleSupported, setIsBleSupported] = useState(false);
  const [isBleConnected, setIsBleConnected] = useState(false);
  const [bleDeviceName, setBleDeviceName] = useState<string | null>(null);
  const [isConnectingBle, setIsConnectingBle] = useState(false);
  const [isAndroidDevice, setIsAndroidDevice] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [showDriverGuide, setShowDriverGuide] = useState(false);

  useEffect(() => {
    setFooterText(customFooter);
  }, [customFooter]);

  useEffect(() => {
    if (!previewLogoUrl) {
      setProcessedLogoUrl('');
      return;
    }
    let active = true;
    WebPrinterService.resolveLogoDataUrl(previewLogoUrl, paperWidth)
      .then((url) => {
        if (active) setProcessedLogoUrl(url || previewLogoUrl);
      })
      .catch(() => {
        if (active) setProcessedLogoUrl(previewLogoUrl);
      });
    return () => {
      active = false;
    };
  }, [previewLogoUrl, paperWidth]);

  useEffect(() => {
    const restId = activeRestaurant?.restaurantId || restaurants?.[0]?.restaurantId || 0;
    if (!restId) return;
    new RestaurantConfigRemoteDataSource()
      .getConfig(restId)
      .then((cfg) => {
        if (cfg) {
          usePosCatalogStore.getState().updateRestaurantConfig(cfg);
        }
      })
      .catch(() => {});
  }, [activeRestaurant?.restaurantId, restaurants]);

  useEffect(() => {
    setSerialSupported(WebPrinterService.isWebSerialSupported());
    setIsSerialConnected(WebPrinterService.isSerialConnected());
    setIsBleSupported(WebPrinterService.isWebBluetoothSupported());
    setIsBleConnected(WebPrinterService.isBluetoothConnected());
    setBleDeviceName(WebPrinterService.getConnectedBluetoothDeviceName());
    setIsAndroidDevice(WebPrinterService.isAndroid());
    setIsMobileDevice(WebPrinterService.isMobile());
    setIsIOSDevice(WebPrinterService.isIOS());
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

  const handleConnectBle = async () => {
    try {
      setIsConnectingBle(true);
      setErrorMsg(null);
      const res = await WebPrinterService.requestBluetoothDevice();
      if (res.success) {
        setIsBleConnected(true);
        setBleDeviceName(res.deviceName || 'Thermal BLE Printer');
        setSuccessMsg(res.message);
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res.message);
        setTimeout(() => setErrorMsg(null), 5000);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Bluetooth connection failed');
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setIsConnectingBle(false);
    }
  };

  const handleDisconnectBle = async () => {
    await WebPrinterService.disconnectBluetoothDevice();
    setIsBleConnected(false);
    setBleDeviceName(null);
    setSuccessMsg('Disconnected from Bluetooth printer');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

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
        setSuccessMsg(`Test ${paperWidth} receipt dispatched successfully!`);
      } else {
        setErrorMsg('Failed to dispatch receipt. Check your printer connection.');
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
        setSuccessMsg(`Test ${paperWidth} KOT dispatched successfully!`);
      } else {
        setErrorMsg('Failed to dispatch KOT. Check your printer connection.');
      }
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to dispatch test KOT');
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setIsPrintingKot(false);
    }
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
              {isBleConnected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                  Bluetooth Connected ({bleDeviceName || 'BLE'})
                </span>
              ) : isSerialConnected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                  Web Serial Connected (COM)
                </span>
              ) : isAndroidDevice ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Android POS Driver Ready
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
              Connect Bluetooth receipt & kitchen printers across Desktop and Mobile browser URLs (Android & iOS).
            </p>
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

          {/* Device Detection Banner */}
          <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-[#DE8626]">
                {isMobileDevice ? <Smartphone className="h-5 w-5" /> : <Laptop className="h-5 w-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xs text-[#1E2930] dark:text-[#F3F4F6]">
                    Active Environment:
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DE8626]/10 text-[#DE8626]">
                    {isAndroidDevice
                      ? 'Android Mobile Browser (Chrome/Samsung)'
                      : isIOSDevice
                      ? 'Apple iOS Mobile Browser (Safari)'
                      : isMobileDevice
                      ? 'Mobile Browser'
                      : 'Desktop PC Browser (Windows / Mac)'}
                  </span>
                </div>
                <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] mt-0.5">
                  {isAndroidDevice
                    ? 'Bluetooth thermal printers (MPT-II, PT-210) connect seamlessly via Direct BLE or RawBT.'
                    : isIOSDevice
                    ? 'Use AirPrint-compatible thermal printers or Wi-Fi network KOT printers.'
                    : 'Supports USB COM port (Web Serial) and direct Windows thermal driver spooling.'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Settings & Actions (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Connection Channel Selector */}
              <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                    Printer Connection Method
                  </h3>
                  <span className="text-[11px] font-bold text-[#DE8626] uppercase">
                    Active: {printChannel}
                  </span>
                </div>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                  Choose how your browser delivers ESC/POS commands to your thermal printer.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {/* Option 1: Auto */}
                  <button
                    type="button"
                    onClick={() => setPrintChannel('auto')}
                    className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all ${
                      printChannel === 'auto'
                        ? 'border-[#DE8626] bg-amber-500/10 text-[#DE8626] font-bold ring-1 ring-[#DE8626]'
                        : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#1E2930] dark:text-[#F3F4F6]'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <Radio className="h-4 w-4" />
                      <span>Auto Smart Dispatch</span>
                    </div>
                    <span className="text-[10px] opacity-75 mt-1 font-normal">
                      Auto-detects Bluetooth, RawBT, USB Serial, or Spooler
                    </span>
                  </button>

                  {/* Option 2: Web Bluetooth */}
                  <button
                    type="button"
                    onClick={() => setPrintChannel('web_bluetooth')}
                    className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all ${
                      printChannel === 'web_bluetooth'
                        ? 'border-[#DE8626] bg-amber-500/10 text-[#DE8626] font-bold ring-1 ring-[#DE8626]'
                        : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#1E2930] dark:text-[#F3F4F6]'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <Bluetooth className="h-4 w-4" />
                      <span>Direct Web Bluetooth</span>
                    </div>
                    <span className="text-[10px] opacity-75 mt-1 font-normal">
                      Pure browser BLE pairing (No app needed)
                    </span>
                  </button>

                  {/* Option 3: RawBT (Android) */}
                  <button
                    type="button"
                    onClick={() => setPrintChannel('rawbt')}
                    className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all ${
                      printChannel === 'rawbt'
                        ? 'border-[#DE8626] bg-amber-500/10 text-[#DE8626] font-bold ring-1 ring-[#DE8626]'
                        : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#1E2930] dark:text-[#F3F4F6]'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <Smartphone className="h-4 w-4" />
                      <span>Android RawBT Protocol</span>
                    </div>
                    <span className="text-[10px] opacity-75 mt-1 font-normal">
                      Classic Bluetooth (MPT-II / PT-210) & USB OTG
                    </span>
                  </button>

                  {/* Option 4: Browser Spooler */}
                  <button
                    type="button"
                    onClick={() => setPrintChannel('browser_spooler')}
                    className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all ${
                      printChannel === 'browser_spooler'
                        ? 'border-[#DE8626] bg-amber-500/10 text-[#DE8626] font-bold ring-1 ring-[#DE8626]'
                        : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#1E2930] dark:text-[#F3F4F6]'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <Printer className="h-4 w-4" />
                      <span>Browser Spooler</span>
                    </div>
                    <span className="text-[10px] opacity-75 mt-1 font-normal">
                      Native Windows driver or iOS AirPrint dialog
                    </span>
                  </button>
                </div>

                {/* Direct Web Bluetooth Device Pairing Card */}
                {isBleSupported && (
                  <div className="mt-3 p-3.5 rounded-2xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bluetooth className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-bold text-xs text-[#1E2930] dark:text-[#F3F4F6]">
                          Web Bluetooth BLE Connection
                        </span>
                      </div>
                      {isBleConnected ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Connected
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#667085] dark:text-[#94A3B8]">
                          Not Paired
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                      Connect directly to your Bluetooth Low Energy thermal printer from Chrome on Android or Desktop.
                    </p>

                    {isBleConnected && bleDeviceName && (
                      <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                        Active Paired Printer: <strong>{bleDeviceName}</strong>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {isBleConnected ? (
                        <button
                          type="button"
                          onClick={handleDisconnectBle}
                          className="px-3 py-1.5 rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/30 text-xs font-bold text-rose-600 hover:bg-rose-100 transition-colors"
                        >
                          Disconnect Bluetooth
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleConnectBle}
                          disabled={isConnectingBle}
                          className="px-3 py-1.5 rounded-xl border border-blue-600 bg-blue-600 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                        >
                          <Bluetooth className="h-3.5 w-3.5" />
                          <span>{isConnectingBle ? 'Searching Nearby Printers...' : 'Pair Bluetooth Printer'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Android RawBT Setup Guide Card */}
                {(isAndroidDevice || printChannel === 'rawbt') && (
                  <div className="mt-3 p-3.5 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-[#DE8626]" />
                        <span className="font-bold text-xs text-[#1E2930] dark:text-[#F3F4F6]">
                          Android Bluetooth Thermal Setup (RawBT)
                        </span>
                      </div>
                      <a
                        href={WebPrinterService.getRawBtPlayStoreUrl()}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#DE8626] hover:underline"
                      >
                        <span>Free on Play Store</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                      For standard ₹1,500–₹3,000 Bluetooth thermal printers (MPT-II, PT-210, Everycom):
                    </p>

                    <ol className="list-decimal pl-4 space-y-1 text-[11px] text-[#1E2930] dark:text-[#F3F4F6] font-medium">
                      <li>Install the <strong>RawBT</strong> app from Google Play Store on this Android phone.</li>
                      <li>Turn on Bluetooth and pair your thermal printer in Android Bluetooth Settings.</li>
                      <li>In RawBT, select your paired Bluetooth printer as the default printer.</li>
                      <li>Bills and KOTs will print automatically and silently from Menza POS!</li>
                    </ol>
                  </div>
                )}
              </div>

              {/* Windows Driver Guide / Web Serial Banner (Desktop only) */}
              {!isMobileDevice && (
                <div className="rounded-2xl border border-amber-300 dark:border-amber-900/60 bg-amber-500/10 p-4 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-[#DE8626] shrink-0" />
                      <h4 className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                        Windows PC: MPT-II / USB Serial Guide
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDriverGuide(!showDriverGuide)}
                      className="text-xs font-bold text-[#DE8626] hover:underline cursor-pointer"
                    >
                      {showDriverGuide ? 'Hide Steps' : 'View Quick Setup'}
                    </button>
                  </div>
                  <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] leading-relaxed">
                    Connect directly to the printer COM port via Web Serial to bypass Windows printer driver installation.
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
                          Under <em>Use an existing port</em>, choose the Bluetooth COM port assigned to MPT-II (e.g. <code>COM3</code> or <code>COM4</code>), or <code>USB001</code> if USB connected.
                        </li>
                        <li>
                          Under Manufacturer select <strong>Generic</strong> &gt; Printer: <strong>Generic / Text Only</strong>, and name it <strong>MPT-II</strong>.
                        </li>
                      </ol>
                    </div>
                  )}

                  {/* Direct Web Serial Alternative */}
                  {serialSupported && (
                    <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/40 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                        <strong>Web Serial (USB / COM):</strong> Direct binary stream.
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
              )}

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
                      Automatically print customer tax invoice when an order is paid or settled.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoPrintReceipt}
                    onChange={(e) => setAutoPrintReceipt(e.target.checked)}
                    className="h-5 w-5 rounded accent-[#DE8626] cursor-pointer"
                  />
                </div>

                {/* Auto Print KOT */}
                <div className="flex items-center justify-between py-2">
                  <div className="pr-4">
                    <p className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                      Auto-Print Kitchen Ticket (KOT)
                    </p>
                    <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                      Automatically dispatch KOT slip to kitchen station when order is placed.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoPrintKot}
                    onChange={(e) => setAutoPrintKot(e.target.checked)}
                    className="h-5 w-5 rounded accent-[#DE8626] cursor-pointer"
                  />
                </div>
              </div>

              {/* Receipt Footer Customization */}
              <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                  Customer Receipt Footer
                </h3>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                  Custom greeting or thank you note printed at the bottom of customer receipts.
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    placeholder="e.g. Thank you! Visit us again."
                    className="flex-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
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
                  Trigger a formatted test print through the active driver to verify column alignment, font size, and paper tear-off spacing.
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
                      {(processedLogoUrl || previewLogoUrl) && (
                        <div className="flex justify-center pb-1.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={processedLogoUrl || previewLogoUrl}
                            alt="Store Logo"
                            style={{
                              maxWidth: paperWidth === '80mm' ? '200px' : '160px',
                              maxHeight: paperWidth === '80mm' ? '180px' : '145px',
                            }}
                            className="object-contain mx-auto block"
                          />
                        </div>
                      )}
                      <div className="text-center font-black text-xs uppercase tracking-wide">
                        {restaurantConfig?.restaurantName || activeRestaurant?.restaurantName || 'Menza Restaurant'}
                      </div>
                      <div className="text-center text-[10px] text-gray-700">
                        {restaurantConfig?.address || activeRestaurant?.address || '100 Feet Road, Indiranagar'}
                      </div>
                      <div className="text-center text-[10px] text-gray-700">
                        GSTIN: {restaurantConfig?.gstNumber || '29ABCDE1234F1Z5'}
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

                      <div className="border-t border-black my-1" />
                      <div className="flex justify-between font-black text-[10px]">
                        <span>ITEM</span>
                        <span>QTY</span>
                        <span>AMT</span>
                      </div>
                      <div className="border-b border-black my-0.5" />

                      <div className="flex justify-between text-[10px]">
                        <span className="truncate pr-1">Paneer Butter Masala</span>
                        <span>1</span>
                        <span>240.00</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="truncate pr-1">Butter Naan</span>
                        <span>3</span>
                        <span>120.00</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="truncate pr-1">Jeera Rice</span>
                        <span>1</span>
                        <span>150.00</span>
                      </div>

                      <div className="border-t border-black my-1" />
                      <div className="flex justify-between text-[10px]">
                        <span>Subtotal:</span>
                        <span>510.00</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span>CGST (2.5%):</span>
                        <span>12.75</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span>SGST (2.5%):</span>
                        <span>12.75</span>
                      </div>
                      <div className="border-t-2 border-black my-1" />
                      <div className="flex justify-between font-black text-xs">
                        <span>GRAND TOTAL:</span>
                        <span>₹535.50</span>
                      </div>
                      <div className="border-b-2 border-black my-1" />

                      <div className="text-center text-[10px] font-bold">
                        Mode: CASH (PAID)
                      </div>

                      <div className="pt-2 text-center text-[10px] italic">
                        {footerText || 'Thank you! Visit us again.'}
                      </div>

                      {/* Paper feed indicator */}
                      <div className="pt-4 border-b-2 border-dashed border-gray-300 text-center text-[8px] text-gray-400">
                        ✂ Tear along cut line
                      </div>
                    </div>
                  ) : (
                    /* KOT Simulation */
                    <div className="space-y-1.5">
                      <div className="text-center font-black text-xs border border-dashed border-black py-1">
                        --- [ ✂ KITCHEN KOT ✂ ] ---
                      </div>
                      <div className="text-center font-bold text-[11px] pt-1">
                        {restaurantConfig?.restaurantName || activeRestaurant?.restaurantName || 'Menza Bistro'} - MAIN KITCHEN
                      </div>
                      <div className="border-2 border-black p-1 text-center font-black text-sm my-1">
                        TOKEN #T-42
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span>Order: #KOT-99</span>
                        <span>{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold">
                        <span>TYPE: DINE_IN</span>
                        <span>TABLE: 12</span>
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
