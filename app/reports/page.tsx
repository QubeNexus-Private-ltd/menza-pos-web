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
import { useAuthStore } from '@/stores/useAuthStore';
import { ReportService } from '@/services/reportService';
import { OrderService } from '@/services/orderService';
import { apiCacheManager } from '@/lib/api/client';
import {
  ExecutiveDashboardDTO as ExecutiveDashboard,
  DatewiseSalesSummaryDTO as DatewiseSalesSummary,
  TopSellingItemsReportDTO as TopSellingItemsReport,
  HourlySalesHeatmapDTO as HourlySalesHeatmap,
} from '@/types/report';
import { OrderMaster } from '@/types/order';
import { RevenueTrendChart } from '@/components/analytics/RevenueTrendChart';
import { OrdersTrendChart } from '@/components/analytics/OrdersTrendChart';
import { TopSellingDishesChart } from '@/components/analytics/TopSellingDishesChart';
import { CategoryBreakdownChart } from '@/components/analytics/CategoryBreakdownChart';
import { HourlyRushChart } from '@/components/analytics/HourlyRushChart';
import { PaymentBreakdownChart, PaymentModeMetric } from '@/components/analytics/PaymentBreakdownChart';

export default function ReportsPage() {
  const { activeRestaurant, restaurants } = useAuthStore();
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
      const toDateStr = now.toISOString().split('T')[0];

      if (dateRange === 'week') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        fromDateStr = d.toISOString().split('T')[0];
      } else if (dateRange === 'month') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        fromDateStr = d.toISOString().split('T')[0];
      } else {
        fromDateStr = toDateStr;
      }

      const [dashRes, salesRes, topRes, heatRes, ordersRes] = await Promise.allSettled([
        ReportService.getExecutiveDashboard(currentRestId),
        ReportService.getDatewiseSales(currentRestId, fromDateStr, toDateStr),
        ReportService.getTopSellingItems(currentRestId, fromDateStr, toDateStr, 15),
        ReportService.getHourlySalesHeatmap(currentRestId, toDateStr),
        OrderService.getTodayOrders(currentRestId, 'ALL', 1, 50),
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value) setDashboard(dashRes.value);
      if (salesRes.status === 'fulfilled' && salesRes.value) setSalesSummary(salesRes.value);
      if (topRes.status === 'fulfilled' && topRes.value) setTopItems(topRes.value);
      if (heatRes.status === 'fulfilled' && heatRes.value) setHeatmap(heatRes.value);
      if (ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value)) setOrders(ordersRes.value);
    } catch (err) {
      console.warn('Failed to load business reports', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentRestId, dateRange]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  // Compute Payment Modes Breakdown from orders
  const paymentBreakdown = useMemo(() => {
    const modesMap: Record<string, { count: number; total: number }> = {};
    let grandTotal = 0;

    orders.forEach((o) => {
      const mode = (o.paymentMode || 'CASH').toUpperCase();
      if (!modesMap[mode]) {
        modesMap[mode] = { count: 0, total: 0 };
      }
      const amt = Number(o.totalAmount || 0);
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

  const handlePrint = () => {
    window.print();
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

              <button
                onClick={handlePrint}
                className="flex items-center gap-2 rounded-xl border border-[#DE8626] bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-[#DE8626] hover:bg-amber-500/20 transition-colors shadow-xs"
              >
                <Printer className="h-4 w-4" />
                <span>Print Ledger</span>
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

              {/* View Switcher: Revenue vs Orders */}
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
            </div>

            {/* Chart Body */}
            {trendTab === 'revenue' ? (
              <RevenueTrendChart
                data={(salesSummary?.dailyBreakdown || []).map((d: any) => ({
                  date: d.date,
                  grossSales: Number(d.grossSales ?? d.totalSales ?? 0),
                  netSales: Number(d.netSales ?? d.totalSales ?? 0),
                  taxAmount: Number(d.taxAmount ?? d.totalTax ?? 0),
                  discountAmount: Number(d.discountAmount ?? d.totalDiscount ?? 0),
                }))}
                height={260}
              />
            ) : (
              <OrdersTrendChart
                data={(salesSummary?.dailyBreakdown || []).map((d: any) => ({
                  date: d.date,
                  totalOrders: Number(d.totalOrders ?? d.orderCount ?? d.ordersCount ?? 0),
                  completedOrders: Number(d.completedOrders ?? d.orderCount ?? d.ordersCount ?? 0),
                  cancelledOrders: Number(d.cancelledOrders ?? 0),
                  averageOrderValue: Number(d.averageOrderValue ?? 0),
                }))}
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-[#DE8626]" />
                  <h3 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                    Hourly Rush Telemetry
                  </h3>
                </div>
                <span className="text-xs text-[#667085] dark:text-[#94A3B8]">Today's hourly peak</span>
              </div>

              <HourlyRushChart
                slots={(heatmap?.hourlySlots || heatmap?.buckets || []).map((s: any, idx: number) => ({
                  hour: Number(s.hour ?? idx),
                  hourLabel: s.hourLabel || s.timeSlot || `${s.hour ?? idx}:00`,
                  ordersCount: Number(s.ordersCount ?? s.orderCount ?? 0),
                  totalSales: Number(s.totalSales ?? s.revenue ?? 0),
                  completedOrders: Number(s.completedOrders ?? 0),
                }))}
                peakHourLabel={heatmap?.peakHourLabel}
                peakHourOrders={heatmap?.peakHourOrdersCount}
                height={210}
              />
            </div>

            {/* Payment Modes Breakdown */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-[#DE8626]" />
                  <h3 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                    Payment Mode Breakdown
                  </h3>
                </div>
                <span className="text-xs text-[#667085] dark:text-[#94A3B8]">Settled receipts</span>
              </div>

              <PaymentBreakdownChart
                data={paymentBreakdown.metrics}
                totalCollected={paymentBreakdown.grandTotal}
              />
            </div>
          </div>

          {/* SECTION 4: Top Revenue Dishes Detailed Table */}
          <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-[#DE8626]" />
                <h3 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  Menu Item Revenue Ledger
                </h3>
              </div>
              <span className="text-xs text-[#667085]">Full item performance details</span>
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

