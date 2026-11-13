'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Calendar,
  IndianRupee,
  ShoppingBag,
  Printer,
  Sparkles,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Clock,
  Layers,
  CreditCard,
  Zap,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardMetricsSkeleton, DashboardChartsSkeleton } from '@/components/common/Skeleton';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { ReportRemoteDataSource } from '@shared/data/datasources/ReportRemoteDataSource';
import { OrderRemoteDataSource } from '@shared/data/datasources/OrderRemoteDataSource';
import { apiCacheManager } from '@shared/core/network/apiClient';
import {
  ExecutiveDashboard,
  DatewiseSalesSummary,
  TopSellingItemsReport,
  HourlySalesHeatmap,
} from '@shared/domain/models/Report';
import { OrderMaster } from '@shared/domain/models/Order';
import { RevenueTrendChart } from '@/components/analytics/RevenueTrendChart';
import { OrdersTrendChart } from '@/components/analytics/OrdersTrendChart';
import { TopSellingDishesChart } from '@/components/analytics/TopSellingDishesChart';
import { CategoryBreakdownChart } from '@/components/analytics/CategoryBreakdownChart';
import { HourlyRushChart } from '@/components/analytics/HourlyRushChart';
import { PaymentBreakdownChart, PaymentModeMetric } from '@/components/analytics/PaymentBreakdownChart';
import {
  printConsolidatedLedger,
  printDailySalesLedger,
  printHourlyRushReport,
  printPaymentSettlementSlip,
  printMenuItemLedger,
} from '@/services/reportPrintService';

const reportDataSource = new ReportRemoteDataSource();
const orderDataSource = new OrderRemoteDataSource();

function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ReportsPage() {
  const { activeRestaurant, restaurants, user, activeStaffName } = useAuthStore();
  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);


  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState<ExecutiveDashboard | null>(null);
  const [salesSummary, setSalesSummary] = useState<DatewiseSalesSummary | null>(null);
  const [topItems, setTopItems] = useState<TopSellingItemsReport | null>(null);
  const [heatmap, setHeatmap] = useState<HourlySalesHeatmap | null>(null);
  const [orders, setOrders] = useState<OrderMaster[]>([]);

  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('week');
  const [trendTab, setTrendTab] = useState<'revenue' | 'orders'>('revenue');
  const [hourlyDate, setHourlyDate] = useState<string>(() => getLocalDateString());
  const [hourlyLoading, setHourlyLoading] = useState(false);

  // Clean slate and show skeleton immediately upon restaurant switch
  useEffect(() => {
    setDashboard(null);
    setSalesSummary(null);
    setTopItems(null);
    setHeatmap(null);
    setOrders([]);
    setLoading(true);
  }, [currentRestId]);


  const loadReportData = useCallback(async (isManualRefresh = false) => {
    if (!currentRestId) return;

    try {
      if (isManualRefresh) {
        setRefreshing(true);
        apiCacheManager.invalidate('/Reports');
        apiCacheManager.invalidate('/Order');
      } else {
        setLoading(true);
      }

      const now = new Date();
      let fromDateStr: string | undefined;
      const toDateStr = getLocalDateString(now);

      if (dateRange === 'week') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        fromDateStr = getLocalDateString(d);
      } else if (dateRange === 'month') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        fromDateStr = getLocalDateString(d);
      } else {
        fromDateStr = toDateStr;
      }

      const [dashRes, salesRes, topRes, heatRes, ordersRes] = await Promise.allSettled([
        reportDataSource.getExecutiveDashboard(currentRestId),
        reportDataSource.getDatewiseSalesSummary(currentRestId, fromDateStr, toDateStr),
        reportDataSource.getTopSellingItems(currentRestId, fromDateStr, toDateStr, 15),
        reportDataSource.getHourlySalesHeatmap(currentRestId, hourlyDate),
        orderDataSource.getTodayOrders(currentRestId, 'ALL', 1, 250, undefined, fromDateStr, toDateStr),
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value) setDashboard(dashRes.value);
      if (salesRes.status === 'fulfilled' && salesRes.value) setSalesSummary(salesRes.value);
      if (topRes.status === 'fulfilled' && topRes.value) setTopItems(topRes.value);
      if (heatRes.status === 'fulfilled' && heatRes.value) setHeatmap(heatRes.value);
      if (ordersRes.status === 'fulfilled' && ordersRes.value?.items) setOrders(ordersRes.value.items);
    } catch (err) {
      console.warn('Failed to load business reports', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentRestId, dateRange, hourlyDate]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  // Dedicated loader when user picks a different date for Hourly Rush Telemetry
  const loadHourlyTelemetry = useCallback(async (dateStr: string) => {
    if (!currentRestId) return;
    setHourlyLoading(true);
    try {
      const res = await reportDataSource.getHourlySalesHeatmap(currentRestId, dateStr);
      if (res) setHeatmap(res);
    } catch (err) {
      console.warn('Failed to load hourly telemetry for date', dateStr, err);
    } finally {
      setHourlyLoading(false);
    }
  }, [currentRestId]);

  const handleHourlyDateChange = (newDate: string) => {
    setHourlyDate(newDate);
    loadHourlyTelemetry(newDate);
  };

  // Live order aggregation fallback: if server returns 0 orders for today, aggregate loaded orders
  const effectiveHeatmap = useMemo(() => {
    const hasServerOrders = (heatmap?.hourlySlots || []).some((s) => (s.ordersCount || 0) > 0);
    if (hasServerOrders) return heatmap;

    const todayStr = getLocalDateString();
    if (hourlyDate !== todayStr || !orders || orders.length === 0) return heatmap;

    // Create 24 slots
    const slots = Array.from({ length: 24 }, (_, hour) => {
      const nextHour = (hour + 1) % 24;
      return {
        hour,
        hourLabel: `${String(hour).padStart(2, '0')}:00 - ${String(nextHour).padStart(2, '0')}:00`,
        ordersCount: 0,
        totalSales: 0,
        completedOrders: 0,
      };
    });

    let totalSales = 0;
    let totalOrders = 0;

    orders.forEach((o) => {
      const rawDate = o.createdAt || o.settledDateUtc;
      if (!rawDate) return;
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return;

      if (getLocalDateString(d) === todayStr) {
        const h = d.getHours();
        if (h >= 0 && h < 24) {
          const amt = Number(o.totalAmount || 0);
          slots[h].ordersCount += 1;
          slots[h].totalSales += amt;
          totalSales += amt;
          totalOrders += 1;

          const st = (o.status || '').toLowerCase();
          if (['completed', 'served', 'settled', 'delivered'].includes(st)) {
            slots[h].completedOrders += 1;
          }
        }
      }
    });

    if (totalOrders === 0) return heatmap;

    const sorted = [...slots].sort((a, b) => b.totalSales - a.totalSales || b.ordersCount - a.ordersCount);
    const peak = sorted[0];

    return {
      restaurantId: currentRestId,
      date: todayStr,
      totalDaySales: totalSales,
      totalDayOrders: totalOrders,
      peakHourLabel: peak && peak.ordersCount > 0 ? peak.hourLabel : '',
      peakHourOrdersCount: peak ? peak.ordersCount : 0,
      peakHourSales: peak ? peak.totalSales : 0,
      hourlySlots: slots,
    };
  }, [heatmap, orders, hourlyDate, currentRestId]);

  // Compute Payment Modes Breakdown from orders
  const paymentBreakdown = useMemo(() => {
    const modesMap: Record<string, { count: number; total: number }> = {};
    let grandTotal = 0;

    orders.forEach((o) => {
      // Exclude void / cancelled orders from settled payment collections
      const st = (o.status || '').toLowerCase();
      if (st === 'cancelled' || st === 'void') return;

      const rawMode = o.paymentMode || (o as any).PaymentMode || 'CASH';
      const mode = rawMode.trim().toUpperCase() || 'CASH';
      if (!modesMap[mode]) {
        modesMap[mode] = { count: 0, total: 0 };
      }
      const amt = Number(o.totalAmount || o.paidAmount || o.subtotal || 0);
      modesMap[mode].count += 1;
      modesMap[mode].total += amt;
      grandTotal += amt;
    });

    const metrics: PaymentModeMetric[] = Object.entries(modesMap).map(([mode, d]) => ({
      mode,
      total: d.total,
      count: d.count,
      percentage: grandTotal > 0 ? Math.round((d.total / grandTotal) * 100) : 0,
    }));

    return {
      metrics,
      grandTotal,
    };
  }, [orders]);

  const [printingDoc, setPrintingDoc] = useState<string | null>(null);

  // Restaurant metadata for printing
  const restaurantMeta = useMemo(() => {
    const rest = activeRestaurant || (restaurants.length > 0 ? restaurants[0] : null);
    return {
      name: rest?.restaurantName || 'Menza Restaurant',
      address: rest?.address || undefined,
      city: rest?.city || undefined,
      state: rest?.state || undefined,
      phone: (rest as any)?.contactNumber || (rest as any)?.ownerMobile || undefined,
      gstin: (rest as any)?.gstNumber || (rest as any)?.gstin || undefined,
      logoUrl: (rest as any)?.logoUrl || undefined,
    };
  }, [activeRestaurant, restaurants]);

  // Current calculated date range labels
  const { currentFromDate, currentToDate, currentPeriodLabel } = useMemo(() => {
    const now = new Date();
    const toDate = getLocalDateString(now);
    let fromDate = toDate;
    let label = 'Today';

    if (dateRange === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      fromDate = getLocalDateString(d);
      label = 'Last 7 Days';
    } else if (dateRange === 'month') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      fromDate = getLocalDateString(d);
      label = 'Last 30 Days';
    }

    return {
      currentFromDate: fromDate,
      currentToDate: toDate,
      currentPeriodLabel: label,
    };
  }, [dateRange]);

  const staffName = user?.name || (user as any)?.fullName || activeStaffName || 'Store Manager';

  // 1. Overall Consolidated Print
  const handlePrintConsolidatedLedger = async () => {
    setPrintingDoc('consolidated');
    try {
      await printConsolidatedLedger({
        restaurant: restaurantMeta,
        periodLabel: currentPeriodLabel,
        fromDate: currentFromDate,
        toDate: currentToDate,
        generatedBy: staffName,
        dashboard,
        salesSummary,
        topItems,
        heatmap: effectiveHeatmap,
        paymentBreakdown: {
          metrics: paymentBreakdown.metrics,
          grandTotal: paymentBreakdown.grandTotal,
          totalCount: paymentBreakdown.metrics.reduce((acc, m) => acc + m.count, 0),
        },
      });
    } catch (e) {
      console.warn('Print error', e);
    } finally {
      setPrintingDoc(null);
    }
  };

  // 2. Section 1: Daily Sales & Revenue Ledger Print
  const handlePrintDailySales = async () => {
    setPrintingDoc('sales');
    try {
      await printDailySalesLedger({
        restaurant: restaurantMeta,
        periodLabel: currentPeriodLabel,
        fromDate: currentFromDate,
        toDate: currentToDate,
        generatedBy: staffName,
        salesSummary,
        dashboard,
      });
    } catch (e) {
      console.warn('Print error', e);
    } finally {
      setPrintingDoc(null);
    }
  };

  // 3. Section 2: Hourly Rush & Shift Telemetry Print
  const handlePrintHourlyRush = async () => {
    setPrintingDoc('hourly');
    try {
      await printHourlyRushReport({
        restaurant: restaurantMeta,
        dateLabel: hourlyDate === getLocalDateString() ? 'Today' : hourlyDate,
        generatedBy: staffName,
        heatmap: effectiveHeatmap,
      });
    } catch (e) {
      console.warn('Print error', e);
    } finally {
      setPrintingDoc(null);
    }
  };

  // 4. Section 3: Cashier Payment Settlement Slip (A4 or Thermal)
  const handlePrintPaymentSettlement = async (isThermal: boolean = false) => {
    setPrintingDoc(isThermal ? 'payment-thermal' : 'payment-a4');
    try {
      await printPaymentSettlementSlip({
        restaurant: restaurantMeta,
        dateLabel: currentPeriodLabel,
        generatedBy: staffName,
        metrics: paymentBreakdown.metrics,
        grandTotal: paymentBreakdown.grandTotal,
        totalCount: paymentBreakdown.metrics.reduce((acc, m) => acc + m.count, 0),
        isThermal,
      });
    } catch (e) {
      console.warn('Print error', e);
    } finally {
      setPrintingDoc(null);
    }
  };

  // 5. Section 4: Menu Item & Dish Performance Ledger
  const handlePrintMenuItemLedger = async () => {
    setPrintingDoc('menu');
    try {
      await printMenuItemLedger({
        restaurant: restaurantMeta,
        periodLabel: currentPeriodLabel,
        fromDate: currentFromDate,
        toDate: currentToDate,
        generatedBy: staffName,
        topItems,
      });
    } catch (e) {
      console.warn('Print error', e);
    } finally {
      setPrintingDoc(null);
    }
  };

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                  Business Analytics & Telemetry
                </h1>
                <span className="rounded-full bg-[#DE8626]/10 px-3 py-0.5 text-xs font-bold text-[#DE8626]">
                  Real-Time Engine
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-[#667085] dark:text-[#94A3B8]">
                Executive revenue trends, order throughput, top-selling dishes, category distribution, and peak rush telemetry.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Date Filter Buttons */}
              <div className="flex items-center rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-1 text-xs shadow-xs">
                {(['today', 'week', 'month'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setDateRange(r)}
                    className={`rounded-lg px-3 py-1.5 font-semibold capitalize transition-all ${
                      dateRange === r
                        ? 'bg-[#DE8626] text-white shadow-sm'
                        : 'text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
                    }`}
                  >
                    {r === 'today' ? 'Today' : r === 'week' ? 'Last 7 Days' : 'Last 30 Days'}
                  </button>
                ))}
              </div>

              {/* Refresh Button */}
              <button
                onClick={() => loadReportData(true)}
                disabled={loading || refreshing}
                className="flex items-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3 py-2 text-xs font-bold text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6] transition-colors"
                title="Refresh Analytics Data"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-[#DE8626]' : ''}`} />
                <span>{refreshing ? 'Syncing...' : 'Sync'}</span>
              </button>

              {/* OVERALL PRINT: Consolidated Executive Business Ledger */}
              <button
                onClick={handlePrintConsolidatedLedger}
                disabled={printingDoc === 'consolidated'}
                className="flex items-center gap-2 rounded-xl border border-[#DE8626] bg-amber-500/10 px-3.5 py-2 text-xs font-extrabold text-[#DE8626] hover:bg-amber-500/20 transition-all shadow-xs disabled:opacity-50"
                title="Print Full Audit & Business Ledger (A4 Statement)"
              >
                {printingDoc === 'consolidated' ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-[#DE8626]" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                <span>Print Consolidated Ledger</span>
              </button>
            </div>
          </div>

          {/* KPI Metrics Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Gross Sales */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-2">
              <span className="text-xs font-bold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider">
                Gross Revenue
              </span>
              <h3 className="text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6]">
                ₹{Number(dashboard?.todayGrossSales || salesSummary?.totalGrossSales || 0).toLocaleString('en-IN')}
              </h3>
              <div className="flex items-center justify-between text-xs text-[#667085] dark:text-[#94A3B8] pt-1 border-t border-[#E7E1DA]/40 dark:border-[#2B3540]/40">
                <span>Net: ₹{Number(dashboard?.todayNetSales || salesSummary?.totalNetSales || 0).toLocaleString('en-IN')}</span>
                {dashboard?.salesGrowthPercentage ? (
                  <span className={`font-bold flex items-center ${dashboard.salesGrowthPercentage >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {dashboard.salesGrowthPercentage >= 0 ? '+' : ''}{dashboard.salesGrowthPercentage}%
                  </span>
                ) : null}
              </div>
            </div>

            {/* KPI 2: Total Orders */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-2">
              <span className="text-xs font-bold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider">
                Orders Settled
              </span>
              <h3 className="text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6]">
                {dashboard?.todayCompletedOrders || salesSummary?.completedOrders || dashboard?.todayTotalOrders || 0}
              </h3>
              <div className="flex items-center justify-between text-xs text-[#667085] dark:text-[#94A3B8] pt-1 border-t border-[#E7E1DA]/40 dark:border-[#2B3540]/40">
                <span>Active Pipeline: {dashboard?.todayActiveOrders || 0}</span>
                <span>Cancelled: {dashboard?.todayCancelledOrders || salesSummary?.cancelledOrders || 0}</span>
              </div>
            </div>

            {/* KPI 3: Average Order Value (AOV) */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-2">
              <span className="text-xs font-bold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider">
                Avg Ticket Size (AOV)
              </span>
              <h3 className="text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6]">
                ₹{Math.round(Number(dashboard?.todayAverageOrderValue || salesSummary?.overallAverageOrderValue || 0))}
              </h3>
              <p className="text-xs text-[#667085] dark:text-[#94A3B8] pt-1 border-t border-[#E7E1DA]/40 dark:border-[#2B3540]/40">
                Average spend per bill
              </p>
            </div>

            {/* KPI 4: GST & Taxes */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-2">
              <span className="text-xs font-bold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider">
                GST Collected
              </span>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                ₹{Number(dashboard?.todayTax || salesSummary?.totalTax || 0).toLocaleString('en-IN')}
              </h3>
              <div className="flex items-center justify-between text-xs text-[#667085] dark:text-[#94A3B8] pt-1 border-t border-[#E7E1DA]/40 dark:border-[#2B3540]/40">
                <span>Discounts: ₹{Number(dashboard?.todayDiscounts || salesSummary?.totalDiscount || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* SECTION 1: Revenue & Orders Trends Chart */}
          <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-[#DE8626]" />
                  <h3 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                    Sales &amp; Volume Trends
                  </h3>
                </div>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-0.5">
                  Day-by-day revenue trajectory and order volume throughput across the selected timeframe
                </p>
              </div>

              {/* View Switcher & Section Print Button */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] p-1 bg-[#FAF7F2] dark:bg-[#151A20] text-xs">
                  <button
                    type="button"
                    onClick={() => setTrendTab('revenue')}
                    className={`px-3 py-1.5 font-bold rounded-lg transition-all ${
                      trendTab === 'revenue'
                        ? 'bg-white dark:bg-[#1B2127] text-[#DE8626] shadow-xs'
                        : 'text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
                    }`}
                  >
                    Revenue Trends (₹)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrendTab('orders')}
                    className={`px-3 py-1.5 font-bold rounded-lg transition-all ${
                      trendTab === 'orders'
                        ? 'bg-white dark:bg-[#1B2127] text-[#DE8626] shadow-xs'
                        : 'text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
                    }`}
                  >
                    Order Tickets (Qty)
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handlePrintDailySales}
                  disabled={printingDoc === 'sales'}
                  className="flex items-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3 py-2 text-xs font-bold text-[#667085] hover:text-[#DE8626] dark:hover:text-[#DE8626] transition-colors shadow-2xs disabled:opacity-50"
                  title="Print Datewise Sales & Tax Ledger (A4 Statement)"
                >
                  {printingDoc === 'sales' ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#DE8626]" />
                  ) : (
                    <Printer className="h-3.5 w-3.5" />
                  )}
                  <span>Print Sales Ledger</span>
                </button>
              </div>
            </div>

            {/* Chart Body */}
            {trendTab === 'revenue' ? (
              <RevenueTrendChart
                data={salesSummary?.dailyBreakdown || []}
                height={260}
              />
            ) : (
              <OrdersTrendChart
                data={salesSummary?.dailyBreakdown || []}
                height={260}
              />
            )}
          </div>

          {/* SECTION 2: Top Selling Dishes & Category Distribution (2 Cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Revenue Dishes */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-[#DE8626]" />
                  <h3 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                    Top-Selling Dishes
                  </h3>
                </div>
                <span className="text-xs text-[#667085] dark:text-[#94A3B8]">Ranked by revenue</span>
              </div>

              <TopSellingDishesChart items={topItems?.items || []} />
            </div>

            {/* Category Sales Distribution */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-[#DE8626]" />
                  <h3 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                    Category Revenue Distribution
                  </h3>
                </div>
                <span className="text-xs text-[#667085] dark:text-[#94A3B8]">By sales volume</span>
              </div>

              <CategoryBreakdownChart items={topItems?.items || []} />
            </div>
          </div>

          {/* SECTION 3: Hourly Peak Rush & Payment Method Breakdown (2 Cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hourly Rush Heatmap */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-[#DE8626]" />
                  <div>
                    <h3 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                      Hourly Rush Telemetry
                    </h3>
                    <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                      24-hour traffic & shift patterns
                    </p>
                  </div>
                </div>

                {/* Day selector & quick pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-[#F5F2EB] dark:bg-[#1E252B] p-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] text-xs">
                    <button
                      type="button"
                      onClick={() => handleHourlyDateChange(getLocalDateString())}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        hourlyDate === getLocalDateString()
                          ? 'bg-white dark:bg-[#2B3540] text-[#DE8626] shadow-xs'
                          : 'text-[#667085] dark:text-[#94A3B8] hover:text-[#1E2930]'
                      }`}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const y = new Date();
                        y.setDate(y.getDate() - 1);
                        handleHourlyDateChange(getLocalDateString(y));
                      }}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        hourlyDate === getLocalDateString(new Date(Date.now() - 86400000))
                          ? 'bg-white dark:bg-[#2B3540] text-[#DE8626] shadow-xs'
                          : 'text-[#667085] dark:text-[#94A3B8] hover:text-[#1E2930]'
                      }`}
                    >
                      Yesterday
                    </button>
                    <div className="h-4 w-[1px] bg-[#E7E1DA] dark:bg-[#2B3540]" />
                    <input
                      type="date"
                      value={hourlyDate}
                      max={getLocalDateString()}
                      onChange={(e) => e.target.value && handleHourlyDateChange(e.target.value)}
                      className="bg-transparent border-0 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] focus:outline-hidden px-1.5 cursor-pointer"
                      title="Select custom date for hourly telemetry"
                    />
                    {hourlyLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#DE8626] mr-1" />}
                  </div>

                  <button
                    type="button"
                    onClick={handlePrintHourlyRush}
                    disabled={printingDoc === 'hourly'}
                    className="flex items-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-2.5 py-1.5 text-xs font-bold text-[#667085] hover:text-[#DE8626] dark:hover:text-[#DE8626] transition-colors shadow-2xs disabled:opacity-50"
                    title="Print Hourly Shift Telemetry (A4 Statement)"
                  >
                    {printingDoc === 'hourly' ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#DE8626]" />
                    ) : (
                      <Printer className="h-3.5 w-3.5" />
                    )}
                    <span>Print Rush</span>
                  </button>
                </div>
              </div>

              <HourlyRushChart
                slots={effectiveHeatmap?.hourlySlots || []}
                peakHourLabel={effectiveHeatmap?.peakHourLabel}
                peakHourOrders={effectiveHeatmap?.peakHourOrdersCount}
                peakHourSales={effectiveHeatmap?.peakHourSales}
                dateLabel={hourlyDate === getLocalDateString() ? 'Today' : hourlyDate}
                height={210}
              />
            </div>

            {/* Payment Modes Breakdown */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-[#DE8626]" />
                  <div>
                    <h3 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                      Payment Mode Breakdown
                    </h3>
                    <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                      Settled receipts & register reconciliation
                    </p>
                  </div>
                </div>

                {/* Print options: A4 statement or 80mm POS slip */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePrintPaymentSettlement(false)}
                    disabled={printingDoc === 'payment-a4'}
                    className="flex items-center gap-1 rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF8F5] dark:bg-[#1E252B] px-2.5 py-1 text-xs font-bold text-[#667085] hover:text-[#DE8626] dark:hover:text-[#DE8626] transition-colors shadow-2xs disabled:opacity-50"
                    title="Print A4 Cashier Settlement Statement"
                  >
                    {printingDoc === 'payment-a4' ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#DE8626]" />
                    ) : (
                      <Printer className="h-3.5 w-3.5" />
                    )}
                    <span>Print Slip</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintPaymentSettlement(true)}
                    disabled={printingDoc === 'payment-thermal'}
                    className="flex items-center gap-1 rounded-lg border border-amber-300 dark:border-amber-900/40 bg-amber-500/10 px-2 py-1 text-[11px] font-bold text-[#DE8626] hover:bg-amber-500/20 transition-colors shadow-2xs disabled:opacity-50"
                    title="Print 80mm Thermal Receipt Slip (POS Counter)"
                  >
                    <span>80mm</span>
                  </button>
                </div>
              </div>

              <PaymentBreakdownChart
                data={paymentBreakdown.metrics}
                totalCollected={paymentBreakdown.grandTotal}
              />
            </div>
          </div>

          {/* SECTION 4: Top Revenue Dishes Detailed Table */}
          <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-[#DE8626]" />
                <div>
                  <h3 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                    Menu Item Revenue Ledger
                  </h3>
                  <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                    Full dish volume & category contribution details
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePrintMenuItemLedger}
                disabled={printingDoc === 'menu'}
                className="flex items-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3 py-1.5 text-xs font-bold text-[#667085] hover:text-[#DE8626] dark:hover:text-[#DE8626] transition-colors shadow-2xs disabled:opacity-50"
                title="Print Menu Item & Dish Performance Ledger (A4 Statement)"
              >
                {printingDoc === 'menu' ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#DE8626]" />
                ) : (
                  <Printer className="h-3.5 w-3.5" />
                )}
                <span>Print Dish Ledger</span>
              </button>
            </div>

            {!topItems?.items || topItems.items.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#667085]">
                No menu item sales recorded for the selected date range.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E7E1DA] dark:border-[#2B3540] text-[#667085] dark:text-[#94A3B8]">
                    <tr>
                      <th className="pb-3 font-semibold">Rank</th>
                      <th className="pb-3 font-semibold">Dish Name</th>
                      <th className="pb-3 font-semibold">Category</th>
                      <th className="pb-3 font-semibold text-center">Quantity Sold</th>
                      <th className="pb-3 font-semibold text-right">Total Revenue</th>
                      <th className="pb-3 font-semibold text-right">Sales Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60">
                    {topItems.items.map((item, idx) => (
                      <tr key={item.itemId || idx} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <td className="py-3 font-extrabold text-[#DE8626]">
                          #{idx + 1}
                        </td>
                        <td className="py-3 font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                          {item.itemName}
                        </td>
                        <td className="py-3 text-[#667085] dark:text-[#94A3B8]">
                          <span className="rounded-md bg-black/5 dark:bg-white/5 px-2 py-0.5 text-[11px] font-medium">
                            {item.categoryName || 'General'}
                          </span>
                        </td>
                        <td className="py-3 text-center font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                          {item.quantitySold || 0}
                        </td>
                        <td className="py-3 text-right font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                          ₹{Number(item.totalRevenue || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {item.contributionPercentage ? `${item.contributionPercentage}%` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}

