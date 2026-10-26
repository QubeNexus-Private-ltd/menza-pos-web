'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Plus,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Download,
  Search,
  RotateCcw,
  ReceiptIndianRupee as Receipt,
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { WalletSkeleton } from '@/components/common/Skeleton';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { WebWalletService, RestaurantWalletDTO, WalletTransactionDTO } from '@/services/walletService';
import { PaymentGatewayService, isRazorpayActive } from '@/payments/paymentGatewayService.web';
import { PdfLedgerGenerator } from '@shared/core/utils/pdfLedgerGenerator';
import { WalletEvents } from '@shared/core/utils/walletEvents';
import { TaxInvoiceModal, TaxInvoiceItem } from '@/components/invoice/TaxInvoiceModal';

type LedgerFilterTab = 'ALL' | 'CREDIT' | 'DEBIT' | 'REFUND';
type LedgerCategoryFilter = 'ALL' | 'PLATFORM_FEE' | 'RECHARGE' | 'REFUND' | 'BONUS' | 'ADJUSTMENT';
type DatePresetKey = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'LAST_MONTH' | null;

function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatCurrency(val: number | undefined | null): string {
  const num = Number(val ?? 0);
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTransactionTypeLabel(type: string, direction: string): string {
  const upper = (type || '').toUpperCase();
  if (upper.includes('RECHARGE')) return 'Wallet Recharge';
  if (upper.includes('BONUS')) return 'Bonus Credit';
  if (upper.includes('REFUND')) return 'Platform Fee Refund';
  if (upper.includes('ORDER_COMMISSION') || upper.includes('COMMISSION') || upper.includes('PLATFORM_FEE')) {
    return 'Platform Fee';
  }
  if (upper.includes('ADJUST')) return direction === 'CREDIT' ? 'Manual Credit' : 'Manual Debit';
  return type ? type.replace(/_/g, ' ') : direction === 'CREDIT' ? 'Wallet Credit' : 'Wallet Debit';
}

function parseLocalDateBounds(fromDate: string, toDate: string): { fromMs?: number; toMs?: number } {
  let fromMs: number | undefined;
  let toMs: number | undefined;

  if (fromDate && fromDate.trim()) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fromDate.trim());
    const d = m
      ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0)
      : new Date(fromDate.trim());
    if (!isNaN(d.getTime())) fromMs = d.getTime();
  }

  if (toDate && toDate.trim()) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(toDate.trim());
    const d = m
      ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999)
      : new Date(toDate.trim());
    if (!isNaN(d.getTime())) toMs = d.getTime();
  }

  if (fromMs !== undefined && toMs !== undefined && fromMs > toMs) {
    const startOfTo = new Date(toMs).setHours(0, 0, 0, 0);
    const endOfFrom = new Date(fromMs).setHours(23, 59, 59, 999);
    fromMs = startOfTo;
    toMs = endOfFrom;
  }

  return { fromMs, toMs };
}

export default function WalletPage() {
  const { activeRestaurant, restaurants, user } = useAuthStore();
  const currentRestId =
    activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);


  const [wallet, setWallet] = useState<RestaurantWalletDTO | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Ledger Filters
  const [activeFilterTab, setActiveFilterTab] = useState<LedgerFilterTab>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<LedgerCategoryFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [activeDatePreset, setActiveDatePreset] = useState<DatePresetKey>(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Recharge Modal
  const [rechargeModalOpen, setRechargeModalOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState<number>(1000);
  const [isRecharging, setIsRecharging] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Tax Invoice Modal
  const [selectedInvoice, setSelectedInvoice] = useState<TaxInvoiceItem | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);

  // Clean slate and show skeleton immediately upon restaurant switch
  useEffect(() => {
    setWallet(null);
    setTransactions([]);
    setLoading(true);
  }, [currentRestId]);


  const handleOpenInvoice = (tx: WalletTransactionDTO) => {
    const rawDigits = tx.id.replace(/[^0-9]/g, '');
    const seqStr = rawDigits ? rawDigits.slice(-5).padStart(5, '0') : '00001';
    const invNumber = tx.invoiceNumber || `MZ/26-27/W${seqStr}`;

    const recipientGst =
      wallet?.restaurantGstNumber ||
      (activeRestaurant as any)?.gstNumber ||
      (activeRestaurant as any)?.gstin ||
      undefined;

    const pGst = wallet?.platformGst;

    const invoiceItem: TaxInvoiceItem = {
      type: 'WALLET_RECHARGE',
      invoiceNumber: invNumber,
      invoiceDate: tx.createdAt,
      paymentReference: tx.paymentReference,
      orderId: tx.orderId,

      // Supplier (Menza Platform)
      supplierLegalName: pGst?.platformLegalName,
      supplierTradeName: pGst?.platformTradeName,
      supplierGstin: pGst?.platformGstin,
      supplierPan: pGst?.platformPan,
      supplierStateCode: pGst?.platformStateCode,
      supplierStateName: pGst?.platformStateName,
      supplierAddress: pGst?.platformAddress,
      supplierEmail: pGst?.supportEmail,
      supplierWebsite: pGst?.websiteUrl,

      // Restaurant (Recipient)
      restaurantName: wallet?.restaurantName || activeRestaurant?.restaurantName || 'Restaurant Partner',
      restaurantId: currentRestId,
      outletAddress: (activeRestaurant as any)?.address || (activeRestaurant as any)?.outletAddress || (activeRestaurant as any)?.restaurantAddress,
      ownerName: (activeRestaurant as any)?.ownerName || user?.name,
      contactPhone: user?.mobile || (activeRestaurant as any)?.ownerMobile || (activeRestaurant as any)?.phone,
      customerEmail: (user as any)?.email,
      customerGstin: recipientGst,

      itemTitle: 'Prepaid Platform Fee & SMS Top-Up Wallet Recharge',
      itemDescription: 'IT Business Support Services & prepaid credit top-up for order platform fees and transactional customer SMS',
      sacCode: pGst?.walletSacCode || '998599',
      totalAmount: tx.amount,
      baseAmount: tx.baseAmount,
      taxAmount: tx.taxAmount,
      taxPercentage: tx.taxPercentage || pGst?.defaultGstPercentage || 18,
      cgstPercentage: pGst?.cgstPercentage || (tx.taxPercentage ? tx.taxPercentage / 2 : 9),
      sgstPercentage: pGst?.sgstPercentage || (tx.taxPercentage ? tx.taxPercentage / 2 : 9),
    };
    setSelectedInvoice(invoiceItem);
    setInvoiceModalOpen(true);
  };

  const loadData = useCallback(
    async (background: boolean = false) => {
      if (!currentRestId) return;
      try {
        if (background) {
          setIsRefreshing(true);
        } else {
          setLoading(true);
        }
        const [wRes, txRes] = await Promise.allSettled([
          WebWalletService.getWallet(currentRestId),
          WebWalletService.getStatement(
            currentRestId,
            fromDate || undefined,
            toDate || undefined,
            1,
            500
          ),
        ]);

        let loadedWallet: RestaurantWalletDTO | null = null;
        if (wRes.status === 'fulfilled') {
          loadedWallet = wRes.value;
          setWallet(wRes.value);
        }
        if (txRes.status === 'fulfilled') {
          setTransactions(txRes.value);
        } else if (loadedWallet?.recentTransactions && loadedWallet.recentTransactions.length > 0) {
          setTransactions(loadedWallet.recentTransactions);
        } else {
          setTransactions([]);
        }
      } catch (err) {
        console.warn('Failed to load wallet data', err);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentRestId, fromDate, toDate]
  );

  // Initial load on restaurant change; background refresh on date changes
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  useEffect(() => {
    setHasLoadedOnce(false);
  }, [currentRestId]);

  useEffect(() => {
    loadData(hasLoadedOnce);
    if (!hasLoadedOnce) setHasLoadedOnce(true);
  }, [loadData, hasLoadedOnce]);

  // Real-time WalletEvents subscription (SignalR / POS order deduction / Modal top-up)
  useEffect(() => {
    const unsubscribe = WalletEvents.subscribe(() => {
      loadData(true);
    });
    return () => {
      unsubscribe();
    };
  }, [loadData]);

  // Reset pagination to Page 1 when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilterTab, categoryFilter, searchQuery, fromDate, toDate, pageSize]);

  const handleApplyDatePreset = (preset: DatePresetKey) => {
    if (activeDatePreset === preset) {
      setActiveDatePreset(null);
      setFromDate('');
      setToDate('');
      return;
    }

    const now = new Date();
    const todayStr = toLocalYmd(now);

    if (preset === 'TODAY') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === 'YESTERDAY') {
      const yest = new Date(now);
      yest.setDate(now.getDate() - 1);
      const yestStr = toLocalYmd(yest);
      setFromDate(yestStr);
      setToDate(yestStr);
    } else if (preset === 'LAST_7_DAYS') {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      setFromDate(toLocalYmd(start));
      setToDate(todayStr);
    } else if (preset === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(toLocalYmd(start));
      setToDate(todayStr);
    } else if (preset === 'LAST_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setFromDate(toLocalYmd(start));
      setToDate(toLocalYmd(end));
    }

    setActiveDatePreset(preset);
  };

  // Step 1: Filter by Date Range, Category, and Search Query
  const dateAndSearchFilteredTransactions = useMemo(() => {
    const { fromMs, toMs } = parseLocalDateBounds(fromDate, toDate);
    const rawQuery = searchQuery.trim().toLowerCase();
    const normalizedOrderQuery = rawQuery.replace(/^(order\s*#?|ord-|#)/i, '').trim();
    const normalizedAmountQuery = rawQuery.replace(/^[₹+\-\s]+/, '').replace(/,/g, '').trim();

    return transactions.filter((tx) => {
      // 1. Date Range Filter (inclusive of full start & end dates in local time)
      if (fromMs !== undefined || toMs !== undefined) {
        const txTime = new Date(tx.createdAt).getTime();
        if (!isNaN(txTime)) {
          if (fromMs !== undefined && txTime < fromMs) return false;
          if (toMs !== undefined && txTime > toMs) return false;
        }
      }

      // 2. Category Dropdown Filter
      const upperType = (tx.transactionType || '').toUpperCase();
      const lowerDesc = (tx.description || '').toLowerCase();
      const typeLabel = formatTransactionTypeLabel(tx.transactionType, tx.direction);

      if (categoryFilter !== 'ALL') {
        if (categoryFilter === 'PLATFORM_FEE') {
          const isPlatformFee =
            upperType.includes('COMMISSION') ||
            upperType.includes('PLATFORM_FEE') ||
            typeLabel === 'Platform Fee';
          if (!isPlatformFee) return false;
        } else if (categoryFilter === 'RECHARGE') {
          if (!upperType.includes('RECHARGE') && typeLabel !== 'Wallet Recharge') return false;
        } else if (categoryFilter === 'REFUND') {
          if (!upperType.includes('REFUND') && !lowerDesc.includes('refund')) return false;
        } else if (categoryFilter === 'BONUS') {
          if (!upperType.includes('BONUS') && !lowerDesc.includes('bonus')) return false;
        } else if (categoryFilter === 'ADJUSTMENT') {
          if (!upperType.includes('ADJUST')) return false;
        }
      }

      // 3. Multi-Criteria Search Query Filter
      if (rawQuery) {
        const idStr = (tx.id || '').toLowerCase();
        const descStr = lowerDesc;
        const refStr = (tx.paymentReference || '').toLowerCase();
        const ordStr = (tx.orderId || '').toLowerCase();
        const rawTypeStr = upperType.toLowerCase();
        const typeLabelStr = typeLabel.toLowerCase();
        const dirStr = (tx.direction || '').toLowerCase();
        const amtNumStr = String(tx.amount ?? '');
        const amtFmtStr = formatCurrency(tx.amount).toLowerCase();

        const dt = new Date(tx.createdAt);
        const dateFormatted = !isNaN(dt.getTime())
          ? `${dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ${dt.toISOString().slice(0, 10)}`.toLowerCase()
          : '';

        const matchesId = idStr.includes(rawQuery);
        const matchesDesc = descStr.includes(rawQuery);
        const matchesRef = refStr.includes(rawQuery);
        const matchesOrd =
          ordStr.includes(rawQuery) ||
          (normalizedOrderQuery.length > 0 && ordStr.includes(normalizedOrderQuery)) ||
          (ordStr.length > 0 && `order #${ordStr}`.includes(rawQuery)) ||
          (ordStr.length > 0 && `ord-${ordStr}`.includes(rawQuery));
        const matchesType = rawTypeStr.includes(rawQuery) || typeLabelStr.includes(rawQuery);
        const matchesDir = dirStr.includes(rawQuery);
        const matchesAmt =
          amtFmtStr.includes(rawQuery) ||
          (normalizedAmountQuery.length > 0 && amtNumStr.includes(normalizedAmountQuery));
        const matchesDate = dateFormatted.includes(rawQuery);

        if (
          !matchesId &&
          !matchesDesc &&
          !matchesRef &&
          !matchesOrd &&
          !matchesType &&
          !matchesDir &&
          !matchesAmt &&
          !matchesDate
        ) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, fromDate, toDate, categoryFilter, searchQuery]);

  // Step 2: Filter by Tab (ALL / CREDIT / DEBIT / REFUND)
  const filteredTransactions = useMemo(() => {
    return dateAndSearchFilteredTransactions.filter((tx) => {
      const upperType = (tx.transactionType || '').toUpperCase();
      const isRefund = upperType.includes('REFUND') || (tx.description || '').toLowerCase().includes('refund');
      const isCredit = tx.direction === 'CREDIT';

      if (activeFilterTab === 'CREDIT' && !isCredit) return false;
      if (activeFilterTab === 'DEBIT' && isCredit) return false;
      if (activeFilterTab === 'REFUND' && !isRefund) return false;

      return true;
    });
  }, [dateAndSearchFilteredTransactions, activeFilterTab]);

  // Step 3: Paginated slice for table view
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedTransactions = useMemo(() => {
    const startIdx = (safeCurrentPage - 1) * pageSize;
    return filteredTransactions.slice(startIdx, startIdx + pageSize);
  }, [filteredTransactions, safeCurrentPage, pageSize]);

  // Filtered Period Financial Summary
  const filteredPeriodSummary = useMemo(() => {
    let credited = 0;
    let debited = 0;
    let refunded = 0;
    for (const tx of filteredTransactions) {
      const amt = Number(tx.amount || 0);
      const upperType = (tx.transactionType || '').toUpperCase();
      const isRefund = upperType.includes('REFUND') || (tx.description || '').toLowerCase().includes('refund');
      if (isRefund) {
        refunded += amt;
      }
      if (tx.direction === 'CREDIT') {
        credited += amt;
      } else {
        debited += amt;
      }
    }
    return {
      count: filteredTransactions.length,
      credited,
      debited,
      refunded,
      net: credited - debited,
    };
  }, [filteredTransactions]);

  // Tab Counts & Summary (reflects active date range, category, and search filters)
  const ledgerCounts = useMemo(() => {
    let credits = 0;
    let debits = 0;
    let refunds = 0;
    for (const tx of dateAndSearchFilteredTransactions) {
      const upperType = (tx.transactionType || '').toUpperCase();
      if (upperType.includes('REFUND') || (tx.description || '').toLowerCase().includes('refund')) {
        refunds++;
      }
      if (tx.direction === 'CREDIT') credits++;
      else debits++;
    }
    return {
      all: dateAndSearchFilteredTransactions.length,
      credits,
      debits,
      refunds,
    };
  }, [dateAndSearchFilteredTransactions]);

  const hasActiveFilters = Boolean(
    fromDate || toDate || searchQuery.trim() || categoryFilter !== 'ALL' || activeFilterTab !== 'ALL'
  );

  const handleExportCsv = async () => {
    if (!currentRestId) return;
    try {
      setExportingCsv(true);
      const hasClientFilters =
        Boolean(fromDate || toDate || searchQuery.trim() || activeFilterTab !== 'ALL' || categoryFilter !== 'ALL');

      let csvData = '';
      if (!hasClientFilters) {
        csvData = await WebWalletService.exportStatementCsv(
          currentRestId,
          fromDate || undefined,
          toDate || undefined
        );
      }

      if (!csvData && filteredTransactions.length > 0) {
        const headers = [
          'Transaction ID',
          'Date & Time',
          'Category',
          'Direction',
          'Order ID',
          'Payment Reference',
          'Particulars',
          'Amount (INR)',
          'Balance Before (INR)',
          'Balance After (INR)',
        ];
        const rows = filteredTransactions.map((t) => [
          t.id,
          `"${new Date(t.createdAt).toLocaleString('en-IN')}"`,
          formatTransactionTypeLabel(t.transactionType, t.direction),
          t.direction,
          t.orderId ? `#${t.orderId}` : '-',
          t.paymentReference || '-',
          `"${(t.description || '').replace(/"/g, '""')}"`,
          (t.direction === 'CREDIT' ? '+' : '-') + Number(t.amount || 0).toFixed(2),
          Number(t.balanceBefore || 0).toFixed(2),
          Number(t.balanceAfter || 0).toFixed(2),
        ]);
        csvData = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      }

      if (!csvData) {
        alert('No wallet ledger transactions available to export.');
        return;
      }

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `Wallet_Ledger_${activeRestaurant?.restaurantName?.replace(/\s+/g, '_') || currentRestId}_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Failed to export wallet CSV', err);
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportPdf = async () => {
    if (!currentRestId) return;
    try {
      setExportingPdf(true);
      await PdfLedgerGenerator.exportAndSharePdf({
        restaurantName: activeRestaurant?.restaurantName || 'Menza Store',
        restaurantId: currentRestId,
        outletAddress: activeRestaurant?.address
          ? `${activeRestaurant.address}, ${activeRestaurant.city || ''}`
          : undefined,
        contactNumber: activeRestaurant?.ownerMobile || user?.mobile,
        wallet: wallet as any,
        transactions: filteredTransactions as any,
        generatedBy: user?.name || activeRestaurant?.ownerName || 'Store Manager',
      });
    } catch (err: any) {
      alert(err?.message || 'Failed to generate PDF statement.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleInitiateRecharge = async () => {
    if (rechargeAmount < 100) {
      alert('Minimum recharge amount is ₹100.');
      return;
    }

    if (!currentRestId) {
      alert('Please select an active restaurant location first.');
      return;
    }

    try {
      setIsRecharging(true);
      const res = await WebWalletService.initiateRecharge(
        currentRestId,
        rechargeAmount,
        user?.mobile || '9999999999'
      );

      if (!res.success || !res.orderId) {
        alert(res.message || 'Could not initiate recharge order.');
        setIsRecharging(false);
        return;
      }

      const paymentResult = await PaymentGatewayService.startPayment({
        orderId: res.orderId,
        amount: rechargeAmount,
        currency: res.currency || 'INR',
        gateway: res.gateway,
        keyId: res.keyId,
        paymentSessionId: res.paymentSessionId,
        paymentLink: res.paymentLink,
        customerName: activeRestaurant?.restaurantName || user?.name || 'Restaurant Owner',
        customerPhone: user?.mobile || activeRestaurant?.ownerMobile || '9999999999',
        customerEmail: (user as any)?.email || 'billing@menza.com',
        orderNotes: `Platform Fee Wallet Top-up (₹${rechargeAmount})`,
      });

      if (!paymentResult.success) {
        alert(paymentResult.error || 'Payment checkout was cancelled or failed.');
        setIsRecharging(false);
        return;
      }

      const verifyRes = await WebWalletService.verifyRecharge(
        res.orderId,
        currentRestId,
        rechargeAmount,
        paymentResult.razorpayPaymentId,
        paymentResult.razorpaySignature
      );

      if (verifyRes.success) {
        setPaymentSuccess(true);
        WalletEvents.emit();
        loadData(true);
      } else {
        alert(verifyRes.message || 'Recharge verification pending.');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to complete wallet recharge');
    } finally {
      setIsRecharging(false);
    }
  };

  const isHealthy = (wallet?.balance || 0) >= (wallet?.lowBalanceThreshold || 200);
  const recipientGst =
    wallet?.restaurantGstNumber ||
    (activeRestaurant as any)?.gstNumber ||
    (activeRestaurant as any)?.gstin ||
    undefined;

  const platformGstInfo = wallet?.platformGst;
  const gstRate = platformGstInfo?.defaultGstPercentage ?? 18;
  const cgstRate = platformGstInfo?.cgstPercentage ?? gstRate / 2;
  const sgstRate = platformGstInfo?.sgstPercentage ?? gstRate / 2;
  const rechargeBaseAmount = Math.round((rechargeAmount / (1 + gstRate / 100)) * 100) / 100;
  const rechargeTaxAmount = Math.round((rechargeAmount - rechargeBaseAmount) * 100) / 100;
  const rechargeCgstAmount = Math.round((rechargeBaseAmount * (cgstRate / 100)) * 100) / 100;
  const rechargeSgstAmount = Math.round((rechargeTaxAmount - rechargeCgstAmount) * 100) / 100;

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                  Prepaid Platform Fee & SMS Wallet
                </h1>
                <span
                  className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                    isHealthy
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-red-500/10 text-red-600'
                  }`}
                >
                  {isHealthy ? 'Healthy Balance' : 'Low Balance'}
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-[#667085] dark:text-[#94A3B8]">
                Prepaid wallet ledger for transactional SMS, WhatsApp receipts, and order platform fee deductions
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => loadData(true)}
                disabled={loading || isRefreshing}
                className="flex items-center gap-2 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3.5 py-2 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5"
              >
                <RefreshCw className={`h-4 w-4 ${loading || isRefreshing ? 'animate-spin text-[#DE8626]' : ''}`} />
                <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exportingPdf || transactions.length === 0}
                className="flex items-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3.5 py-2 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626] hover:text-[#DE8626] disabled:opacity-50 transition-colors"
              >
                <FileText className="h-4 w-4 text-[#DE8626]" />
                <span>{exportingPdf ? 'Generating...' : 'PDF Statement'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={exportingCsv || transactions.length === 0}
                className="flex items-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3.5 py-2 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626] hover:text-[#DE8626] disabled:opacity-50 transition-colors"
              >
                <Download className="h-4 w-4 text-emerald-600" />
                <span>{exportingCsv ? 'Exporting...' : 'Export CSV'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const latestCredit = transactions.find((t) => t.direction === 'CREDIT');
                  if (latestCredit) {
                    handleOpenInvoice(latestCredit);
                  } else {
                    alert('No wallet recharge credits found yet. Top up your wallet to generate and download a GST Tax Invoice.');
                  }
                }}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 transition-colors shadow-xs cursor-pointer"
                title="Download / View Latest GST Tax Invoice"
              >
                <FileText className="h-4 w-4 text-emerald-600" />
                <span>Tax Invoice</span>
                <Download className="h-3.5 w-3.5 opacity-80" />
              </button>

              <button
                type="button"
                onClick={() => setRechargeModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-[#DE8626] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Top Up Wallet</span>
              </button>
            </div>
          </div>

          {/* KPI Wallet Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Balance Card */}
            <div className="rounded-2xl border border-[#DE8626]/30 bg-gradient-to-br from-[#FFF4E5] to-[#FFFFFF] dark:from-[#2A1E11] dark:to-[#1B2127] p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider">
                  Available Balance
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DE8626] text-white shadow-md shadow-[#DE8626]/30">
                  <Wallet className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  ₹{formatCurrency(wallet?.balance)}
                </h2>
                <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8]">
                  Alert threshold: ₹{formatCurrency(wallet?.lowBalanceThreshold || 200)}
                </p>
              </div>
            </div>

            {/* Total Recharged */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider">
                  Total Recharges
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <ArrowDownLeft className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  +₹{formatCurrency(wallet?.totalRecharged)}
                </h2>
                <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8]">
                  Lifetime credits via {isRazorpayActive() ? 'Razorpay' : 'Cashfree'} ({ledgerCounts.credits} txns)
                </p>
              </div>
            </div>

            {/* Deductions / Platform Fees */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider">
                  Platform Fee Debited
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  -₹{formatCurrency(wallet?.totalCommissionPaid)}
                </h2>
                <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8]">
                  Order platform fees & usage debits ({ledgerCounts.debits} txns)
                </p>
              </div>
            </div>

            {/* Refunds / Reversals */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider">
                  Platform Fee Refunds
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                  <RotateCcw className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  ₹{formatCurrency(wallet?.totalRefunded)}
                </h2>
                <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8]">
                  Cancelled order reversals ({ledgerCounts.refunds} txns)
                </p>
              </div>
            </div>
          </div>

          {/* GST Platform Supplier & Restaurant GSTIN Disclosure Card */}
          <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-xs">
            <div className="flex items-start sm:items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-[#DE8626] font-black text-xs">
                GST
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                    Menza Platform Supplier:
                  </span>
                  <span className="font-semibold text-[#1E2930] dark:text-[#E2E8F0]">
                    {platformGstInfo?.platformLegalName || 'Menza Technologies Private Limited'}
                  </span>
                  <span className="font-mono font-black text-[#DE8626] bg-amber-500/10 px-2 py-0.5 rounded border border-[#DE8626]/30">
                    GSTIN: {platformGstInfo?.platformGstin || '27AABCM8821F1ZX'}
                  </span>
                </div>
                <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                  Inclusive GST {gstRate}% (CGST {cgstRate}% + SGST {sgstRate}%) • Tax Invoice issued on every recharge
                </p>
              </div>
            </div>

            {recipientGst ? (
              <div className="flex items-center gap-2 self-start md:self-center shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#E7E1DA] dark:border-[#2B3540]">
                <span className="text-[11px] text-[#667085] dark:text-[#94A3B8] font-semibold">Billed Restaurant GSTIN:</span>
                <span className="font-mono font-bold text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-xl">
                  {recipientGst}
                </span>
              </div>
            ) : null}
          </div>

          {/* Statement & Ledger Passbook */}
          <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E7E1DA] dark:border-[#2B3540] pb-4">
              <div>
                <h3 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  Wallet Ledger Passbook & Statement
                </h3>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                  Complete chronological audit trail of wallet recharges, order platform fee deductions, and opening/closing balances
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'ALL' as LedgerFilterTab, label: `All (${ledgerCounts.all})` },
                  { id: 'CREDIT' as LedgerFilterTab, label: `Credits (${ledgerCounts.credits})` },
                  { id: 'DEBIT' as LedgerFilterTab, label: `Debits (${ledgerCounts.debits})` },
                  { id: 'REFUND' as LedgerFilterTab, label: `Refunds (${ledgerCounts.refunds})` },
                ].map((tab) => {
                  const active = activeFilterTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveFilterTab(tab.id)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                        active
                          ? 'bg-[#DE8626] text-white shadow-xs'
                          : 'bg-[#FAF7F2] dark:bg-[#151A20] text-[#667085] dark:text-[#94A3B8] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search, Category & Date Range Bar */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 text-[#667085] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Order #, Txn ID, Category, Amount, Reference, or Particulars..."
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] pl-9 pr-4 py-2 text-xs text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <div className="flex items-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 py-1.5">
                    <span className="text-[11px] font-semibold text-[#667085]">Category:</span>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value as LedgerCategoryFilter)}
                      className="bg-transparent text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none cursor-pointer"
                    >
                      <option value="ALL">All Categories</option>
                      <option value="PLATFORM_FEE">Platform Fee</option>
                      <option value="RECHARGE">Wallet Recharge</option>
                      <option value="REFUND">Platform Fee Refund</option>
                      <option value="BONUS">Bonus Credit</option>
                      <option value="ADJUSTMENT">Manual Adjustment</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 py-1.5">
                    <span className="text-[11px] font-semibold text-[#667085]">From:</span>
                    <input
                      type="date"
                      value={fromDate}
                      max={toDate || undefined}
                      onChange={(e) => {
                        setActiveDatePreset(null);
                        setFromDate(e.target.value);
                      }}
                      className="bg-transparent text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3 py-1.5">
                    <span className="text-[11px] font-semibold text-[#667085]">To:</span>
                    <input
                      type="date"
                      value={toDate}
                      min={fromDate || undefined}
                      onChange={(e) => {
                        setActiveDatePreset(null);
                        setToDate(e.target.value);
                      }}
                      className="bg-transparent text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none"
                    />
                  </div>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setFromDate('');
                        setToDate('');
                        setActiveDatePreset(null);
                        setSearchQuery('');
                        setCategoryFilter('ALL');
                        setActiveFilterTab('ALL');
                      }}
                      className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] px-2.5 py-1.5 text-[11px] font-semibold text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Date Preset Chips */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="inline-flex items-center gap-1 font-semibold text-[#667085] mr-1">
                    <Calendar className="h-3.5 w-3.5 text-[#DE8626]" />
                    Quick Range:
                  </span>
                  {[
                    { id: 'TODAY' as DatePresetKey, label: 'Today' },
                    { id: 'YESTERDAY' as DatePresetKey, label: 'Yesterday' },
                    { id: 'LAST_7_DAYS' as DatePresetKey, label: 'Last 7 Days' },
                    { id: 'THIS_MONTH' as DatePresetKey, label: 'This Month' },
                    { id: 'LAST_MONTH' as DatePresetKey, label: 'Last Month' },
                  ].map((preset) => {
                    const isSelected = activeDatePreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleApplyDatePreset(preset.id)}
                        className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
                          isSelected
                            ? 'bg-[#DE8626]/15 text-[#DE8626] border border-[#DE8626]/40'
                            : 'bg-[#FAF7F2] dark:bg-[#151A20] text-[#667085] dark:text-[#94A3B8] border border-[#E7E1DA] dark:border-[#2B3540] hover:border-[#DE8626]/40 hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Filtered Period Summary Banner */}
                {hasActiveFilters && (
                  <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#FAF7F2] dark:bg-[#151A20] border border-[#E7E1DA] dark:border-[#2B3540] px-3 py-1.5 text-[11px]">
                    <span className="font-semibold text-[#667085]">
                      Filtered ({filteredPeriodSummary.count}):
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      +₹{formatCurrency(filteredPeriodSummary.credited)} Credited
                    </span>
                    <span className="text-[#E7E1DA] dark:text-[#2B3540]">|</span>
                    <span className="font-bold text-red-500">
                      -₹{formatCurrency(filteredPeriodSummary.debited)} Platform Fee / Debits
                    </span>
                    {filteredPeriodSummary.refunded > 0 && (
                      <>
                        <span className="text-[#E7E1DA] dark:text-[#2B3540]">|</span>
                        <span className="font-bold text-blue-600">
                          ₹{formatCurrency(filteredPeriodSummary.refunded)} Refunded
                        </span>
                      </>
                    )}
                    <span className="text-[#E7E1DA] dark:text-[#2B3540]">|</span>
                    <span
                      className={`font-extrabold ${
                        filteredPeriodSummary.net >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-[#1E2930] dark:text-[#F3F4F6]'
                      }`}
                    >
                      Net: {filteredPeriodSummary.net >= 0 ? '+' : '-'}₹
                      {formatCurrency(Math.abs(filteredPeriodSummary.net))}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {loading && transactions.length === 0 ? (
              <div className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60 animate-pulse p-4 space-y-3">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="pt-3 first:pt-0 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-black/10 dark:bg-white/10" />
                      <div className="space-y-1.5">
                        <div className="h-3.5 w-36 rounded bg-black/10 dark:bg-white/10" />
                        <div className="h-3 w-20 rounded bg-black/10 dark:bg-white/10" />
                      </div>
                    </div>
                    <div className="h-5 w-20 rounded-lg bg-black/10 dark:bg-white/10" />
                  </div>
                ))}
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#667085] dark:text-[#94A3B8]">
                No wallet ledger entries match the selected filter.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#E7E1DA] dark:border-[#2B3540] text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="pb-3 pr-3 font-bold">Txn ID / Reference</th>
                        <th className="pb-3 px-3 font-bold">Ledger Particulars</th>
                        <th className="pb-3 px-3 font-bold">Category</th>
                        <th className="pb-3 px-3 font-bold text-right">Amount</th>
                        <th className="pb-3 px-3 font-bold text-right">Opening Bal</th>
                        <th className="pb-3 px-3 font-bold text-right">Closing Bal</th>
                        <th className="pb-3 px-3 font-bold text-right">Date & Time</th>
                        <th className="pb-3 pl-3 font-bold text-center">Tax Invoice</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60">
                      {paginatedTransactions.map((tx) => {
                        const isCredit = tx.direction === 'CREDIT';
                        const typeLabel = formatTransactionTypeLabel(tx.transactionType, tx.direction);
                        const dt = new Date(tx.createdAt);
                        const validDate = !isNaN(dt.getTime());

                        return (
                          <tr
                            key={tx.id}
                            className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          >
                            {/* Txn ID & Order / Payment Reference */}
                            <td className="py-3.5 pr-3 align-top">
                              <div className="font-mono text-[11px] font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                                {tx.id}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                {tx.orderId && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-[#DE8626]">
                                    <Receipt className="h-3 w-3" />
                                    Order #{tx.orderId}
                                  </span>
                                )}
                                {tx.paymentReference && tx.paymentReference !== `ORD-${tx.orderId}` && (
                                  <span className="font-mono text-[10px] text-[#667085] dark:text-[#94A3B8]">
                                    Ref: {tx.paymentReference}
                                  </span>
                                )}
                                {(isCredit && (tx.invoiceNumber || tx.transactionType.toUpperCase().includes('RECHARGE'))) && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenInvoice(tx)}
                                    className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-mono font-bold transition-all cursor-pointer shadow-xs"
                                    title="View & Print GST Tax Invoice"
                                  >
                                    <FileText className="h-3 w-3 text-emerald-600" />
                                    <span>{tx.invoiceNumber || 'Tax Invoice'}</span>
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* Description */}
                            <td className="py-3.5 px-3 align-top">
                              <div className="flex items-start gap-2.5">
                                <div
                                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                                    isCredit
                                      ? 'bg-emerald-500/10 text-emerald-600'
                                      : 'bg-red-500/10 text-red-600'
                                  }`}
                                >
                                  {isCredit ? (
                                    <ArrowDownLeft className="h-4 w-4" />
                                  ) : (
                                    <ArrowUpRight className="h-4 w-4" />
                                  )}
                                </div>
                                <div>
                                  <p className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                                    {tx.description || typeLabel}
                                  </p>
                                  <p className="text-[11px] text-[#667085] dark:text-[#94A3B8] mt-0.5">
                                    {isCredit ? 'Credited to store prepaid wallet' : 'Deducted from store prepaid wallet'}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Category Badge */}
                            <td className="py-3.5 px-3 align-top">
                              <span
                                className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                                  isCredit
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-red-500/10 text-red-600 dark:text-red-400'
                                }`}
                              >
                                {typeLabel}
                              </span>
                            </td>

                            {/* Amount */}
                            <td
                              className={`py-3.5 px-3 align-top text-right font-extrabold text-sm whitespace-nowrap ${
                                isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                              }`}
                            >
                              {isCredit ? `+₹${formatCurrency(tx.amount)}` : `-₹${formatCurrency(tx.amount)}`}
                            </td>

                            {/* Balance Before */}
                            <td className="py-3.5 px-3 align-top text-right font-medium text-[#667085] dark:text-[#94A3B8] whitespace-nowrap">
                              ₹{formatCurrency(tx.balanceBefore)}
                            </td>

                            {/* Balance After */}
                            <td className="py-3.5 px-3 align-top text-right font-extrabold text-[#1E2930] dark:text-[#F3F4F6] whitespace-nowrap">
                              ₹{formatCurrency(tx.balanceAfter)}
                            </td>

                            {/* Date & Time */}
                            <td className="py-3.5 px-3 align-top text-right text-[#667085] dark:text-[#94A3B8] whitespace-nowrap">
                              {validDate ? (
                                <div>
                                  <div className="font-semibold text-[#1E2930] dark:text-[#F3F4F6]">
                                    {dt.toLocaleDateString('en-IN', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </div>
                                  <div className="text-[10px]">
                                    {dt.toLocaleTimeString('en-IN', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </div>
                                </div>
                              ) : (
                                tx.createdAt
                              )}
                            </td>

                            {/* Dedicated Tax Invoice Download / View Column */}
                            <td className="py-3.5 pl-3 align-middle text-center whitespace-nowrap">
                              {isCredit ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenInvoice(tx)}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-xs hover:scale-105 active:scale-95"
                                  title="Download / View Tax Invoice"
                                >
                                  <FileText className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>Invoice</span>
                                  <Download className="h-3 w-3 opacity-80" />
                                </button>
                              ) : (
                                <span className="text-[11px] text-[#667085] dark:text-[#94A3B8]">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#E7E1DA] dark:border-[#2B3540] pt-3 text-xs text-[#667085] dark:text-[#94A3B8]">
                  <div className="flex items-center gap-2">
                    <span>
                      Showing{' '}
                      <strong className="text-[#1E2930] dark:text-[#F3F4F6]">
                        {(safeCurrentPage - 1) * pageSize + 1}
                      </strong>
                      –
                      <strong className="text-[#1E2930] dark:text-[#F3F4F6]">
                        {Math.min(safeCurrentPage * pageSize, filteredTransactions.length)}
                      </strong>{' '}
                      of{' '}
                      <strong className="text-[#1E2930] dark:text-[#F3F4F6]">
                        {filteredTransactions.length}
                      </strong>{' '}
                      entries
                    </span>
                    <span className="text-[#E7E1DA] dark:text-[#2B3540]">|</span>
                    <div className="flex items-center gap-1">
                      <span>Rows:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-2 py-0.5 font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none"
                      >
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safeCurrentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-2.5 py-1 font-semibold text-[#1E2930] dark:text-[#F3F4F6] disabled:opacity-40 hover:border-[#DE8626]"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        <span>Prev</span>
                      </button>
                      <span className="px-2 font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                        Page {safeCurrentPage} of {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={safeCurrentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-2.5 py-1 font-semibold text-[#1E2930] dark:text-[#F3F4F6] disabled:opacity-40 hover:border-[#DE8626]"
                      >
                        <span>Next</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top Up Recharge Modal */}
        {rechargeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-[#DE8626]">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">Top Up Wallet</h3>
                </div>
                <button
                  onClick={() => setRechargeModalOpen(false)}
                  className="rounded-lg p-1 text-[#667085] hover:bg-black/5"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {paymentSuccess ? (
                <div className="py-8 text-center space-y-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 mx-auto">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-emerald-600">Recharge Successful!</h4>
                    <p className="text-xs text-[#667085]">Your wallet has been credited with ₹{rechargeAmount}</p>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const latestCredit = transactions.find((t) => t.direction === 'CREDIT');
                        if (latestCredit) {
                          handleOpenInvoice(latestCredit);
                        } else {
                          handleOpenInvoice({
                            id: `MZ-TX-${Date.now()}`,
                            restaurantId: currentRestId || '',
                            amount: rechargeAmount,
                            baseAmount: rechargeBaseAmount,
                            taxAmount: rechargeTaxAmount,
                            taxPercentage: gstRate,
                            direction: 'CREDIT',
                            transactionType: 'WALLET_RECHARGE',
                            description: 'Wallet top-up',
                            balanceBefore: wallet?.balance || 0,
                            balanceAfter: (wallet?.balance || 0) + rechargeAmount,
                            createdAt: new Date().toISOString(),
                          } as any);
                        }
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-colors cursor-pointer"
                    >
                      <FileText className="h-4 w-4" />
                      <span>Download Tax Invoice</span>
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRechargeModalOpen(false);
                        setPaymentSuccess(false);
                      }}
                      className="w-full sm:w-auto rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] px-4 py-2.5 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold mb-2 text-[#667085]">Select Quick Amount</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[500, 1000, 2000, 5000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setRechargeAmount(amt)}
                          className={`rounded-xl py-2.5 font-bold transition-all ${
                            rechargeAmount === amt
                              ? 'bg-[#DE8626] text-white shadow-md shadow-[#DE8626]/20'
                              : 'border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#1E2930] dark:text-[#F3F4F6]'
                          }`}
                        >
                          ₹{amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Custom Amount (₹)</label>
                    <input
                      type="number"
                      min={100}
                      value={rechargeAmount}
                      onChange={(e) => setRechargeAmount(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-2.5 font-bold text-sm outline-none focus:border-[#DE8626]"
                    />
                  </div>

                  {/* GST Bifurcated Breakdown Card */}
                  <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#1E2930] dark:text-[#F3F4F6] border-b border-[#E7E1DA] dark:border-[#2B3540] pb-1.5">
                      <span>GST Tax Invoice Breakdown</span>
                    </div>

                    <div className="space-y-1 text-[11px] text-[#667085] dark:text-[#94A3B8]">
                      <div className="flex justify-between">
                        <span>Net Value (Taxable Base)</span>
                        <span className="font-mono font-semibold text-[#1E2930] dark:text-[#F3F4F6]">₹{formatCurrency(rechargeBaseAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Central GST (CGST @ {cgstRate}%)</span>
                        <span className="font-mono">₹{formatCurrency(rechargeCgstAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>State GST (SGST @ {sgstRate}%)</span>
                        <span className="font-mono">₹{formatCurrency(rechargeSgstAmount)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-[#1E2930] dark:text-[#F3F4F6] pt-1 border-t border-[#E7E1DA]/60 dark:border-[#2B3540]/60">
                        <span>Total Payable (incl. {gstRate}% GST)</span>
                        <span className="font-mono text-[#DE8626] font-extrabold">₹{formatCurrency(rechargeAmount)}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#E7E1DA] dark:border-[#2B3540] text-[10px] space-y-1 text-[#667085] dark:text-[#94A3B8]">
                      <div className="flex items-center justify-between">
                        <span>Paying to: <strong>{platformGstInfo?.platformLegalName || 'Menza Technologies Pvt Ltd'}</strong></span>
                        <span className="font-mono font-bold text-[#DE8626]">GSTIN: {platformGstInfo?.platformGstin || '27AABCM8821F1ZX'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Billed to: <strong>{wallet?.restaurantName || activeRestaurant?.restaurantName || 'Restaurant Partner'}</strong></span>
                        {recipientGst ? (
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            GSTIN: {recipientGst}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3 text-[11px] text-[#667085] dark:text-[#94A3B8]">
                    <div className="flex items-center gap-1.5 font-bold text-[#DE8626] mb-1">
                      <ShieldCheck className="h-4 w-4" />
                      <span>{isRazorpayActive() ? 'Secure Razorpay Payment Gateway' : 'Instant Cashfree Gateway'}</span>
                    </div>
                    <span>Supports UPI (Google Pay, PhonePe, Paytm), Netbanking, and Debit/Credit Cards.</span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E7E1DA] dark:border-[#2B3540]">
                    <button
                      type="button"
                      onClick={() => setRechargeModalOpen(false)}
                      className="rounded-xl border border-[#E7E1DA] px-4 py-2 font-semibold text-[#667085]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isRecharging}
                      onClick={handleInitiateRecharge}
                      className="rounded-xl bg-[#DE8626] px-5 py-2 font-bold text-white shadow-md hover:bg-[#C4721C] disabled:opacity-50"
                    >
                      {isRecharging ? 'Redirecting to Gateway...' : `Proceed to Pay ₹${rechargeAmount}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* GST Tax Invoice Modal */}
        <TaxInvoiceModal
          isOpen={invoiceModalOpen}
          onClose={() => setInvoiceModalOpen(false)}
          invoice={selectedInvoice}
        />
      </AppShell>
    </AuthGuard>
  );
}
