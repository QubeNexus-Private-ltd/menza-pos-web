'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Receipt,
  Search,
  Filter,
  RefreshCw,
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  CreditCard,
  IndianRupee,
  Printer,
  MessageCircle,
  ChefHat,
  Table as TableIcon,
  ChevronRight,
  Eye,
  X,
  Sparkles,
  ArrowRight,
  Check,
  History as HistoryIcon,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { OrderSettleModal } from '@/components/orders/OrderSettleModal';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { usePrinterStore } from '@shared/presentation/state/usePrinterStore';
import { OrderRemoteDataSource } from '@shared/data/datasources/OrderRemoteDataSource';
import { OrderMaster, OrderItem } from '@shared/domain/models/Order';
import { WebPrinterService } from '@/services/webPrinterService';
import { WebWhatsAppService } from '@/services/whatsAppService';
import { WebOrderHistoryService } from '@/services/orderHistoryService';
import { ReceiptData } from '@shared/core/printer/EscPosBuilder';

const orderDataSource = new OrderRemoteDataSource();

type ActiveTab = 'LIVE' | 'HISTORY';

export default function OrdersPage() {
  const router = useRouter();
  const { user, activeRestaurant, restaurants } = useAuthStore();
  const { paperWidth, customFooter } = usePrinterStore();

  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);

  // Active Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('LIVE');
  const [loading, setLoading] = useState(true);

  // Live Orders State
  const [liveOrders, setLiveOrders] = useState<OrderMaster[]>([]);
  const [liveStatusFilter, setLiveStatusFilter] = useState<string>('ALL');
  const [liveSearchQuery, setLiveSearchQuery] = useState('');

  // History State
  const [historyOrders, setHistoryOrders] = useState<OrderMaster[]>([]);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyPaymentFilter, setHistoryPaymentFilter] = useState<string>('ALL');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);

  // Settlement & Modals
  const [settlingOrder, setSettlingOrder] = useState<OrderMaster | null>(null);
  const [viewingOrder, setViewingOrder] = useState<OrderMaster | null>(null);
  const [receiptModalOrder, setReceiptModalOrder] = useState<OrderMaster | null>(null);
  const [orderTimeline, setOrderTimeline] = useState<Array<{ id?: number; action: string; description: string; createdDateUtc?: string }> | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [printingOrderId, setPrintingOrderId] = useState<number | null>(null);

  // Load Data
  const loadOrders = useCallback(async () => {
    if (!currentRestId) return;
    try {
      setLoading(true);

      // Fetch live & recent orders today
      const todayRes = await orderDataSource.getTodayOrders(currentRestId, 'ALL', 1, 100);
      const allToday = todayRes?.items || [];

      // Partition into live (unsettled, non-cancelled) and settled
      const active = allToday.filter(
        (o) => o.status?.toUpperCase() !== 'SETTLED' && o.status?.toUpperCase() !== 'CANCELLED'
      );
      const settled = allToday.filter(
        (o) => o.status?.toUpperCase() === 'SETTLED' || o.status?.toUpperCase() === 'CANCELLED'
      );

      setLiveOrders(active);
      setHistoryOrders(settled);
      setHistoryTotalCount(settled.length);
      setHistoryTotalPages(Math.ceil(settled.length / 20) || 1);
    } catch (err) {
      console.warn('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  }, [currentRestId]);

  useEffect(() => {
    loadOrders();
    // Auto-refresh every 30 seconds for live updates
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  // Load Timeline for selected order
  const handleViewTimeline = async (order: OrderMaster) => {
    try {
      setViewingOrder(order);
      setLoadingTimeline(true);
      const history = await WebOrderHistoryService.getOrderHistory(order.id);
      setOrderTimeline(history);
    } catch (err) {
      console.warn('Failed to load timeline:', err);
      setOrderTimeline([]);
    } finally {
      setLoadingTimeline(false);
    }
  };

  // Quick Print Receipt
  const handlePrintReceipt = async (order: OrderMaster) => {
    try {
      setPrintingOrderId(order.id);
      const receiptData: ReceiptData = {
        restaurantName: activeRestaurant?.restaurantName || order.restaurantName || 'Menza Restaurant',
        address: activeRestaurant?.address,
        contactPhone: (activeRestaurant as any)?.contactNumber || activeRestaurant?.ownerMobile || '',
        gstNumber: (activeRestaurant as any)?.gstNumber || (activeRestaurant as any)?.gstin,
        orderId: order.id,
        orderNumber: order.orderNumber,
        tableName: order.tableName,
        orderType: order.orderTypeName,
        date: order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
        customerName: order.customerName,
        customerPhone: order.mobileNumber,
        items: Array.isArray(order.items)
          ? order.items.map((i) => ({
              itemName: i.itemName,
              quantity: i.quantity,
              unitPrice: Number(i.unitPrice || 0),
              totalPrice: Number(i.totalPrice || (i.quantity * (i.unitPrice || 0))),
            }))
          : [],
        subtotal: Number(order.subtotal || order.totalAmount),
        taxAmount: Number(order.cgst || 0) + Number(order.sgst || 0),
        discountAmount: Number(order.discountAmount || 0),
        grandTotal: Number(order.totalAmount),
        paymentMode: order.paymentMode || 'CASH',
        tenderedAmount: Number(order.tenderedAmount || 0),
        changeAmount: Number(order.changeAmount || 0),
        footerMessage: customFooter || 'Thank you for dining with us! Please visit again.',
      };

      await WebPrinterService.printReceipt(receiptData, paperWidth);
    } catch (err: any) {
      alert(`Printing failed: ${err?.message || 'Check printer connection'}`);
    } finally {
      setPrintingOrderId(null);
    }
  };

  // WhatsApp share
  const handleShareWhatsApp = (order: OrderMaster) => {
    const phone = order.mobileNumber || '';
    const receiptData = {
      restaurantName: activeRestaurant?.restaurantName || 'Menza Restaurant',
      orderId: order.id,
      customerName: order.customerName,
      items: Array.isArray(order.items)
        ? order.items.map((i) => ({
            itemName: i.itemName,
            quantity: i.quantity,
            price: Number(i.unitPrice || 0),
          }))
        : [],
      grandTotal: Number(order.totalAmount || 0),
      paymentMode: order.paymentMode || 'CASH',
    };

    const url = WebWhatsAppService.getWhatsAppReceiptUrl(phone, receiptData);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Filtered Live Orders
  const filteredLiveOrders = useMemo(() => {
    return liveOrders.filter((order) => {
      // Status filter
      if (liveStatusFilter !== 'ALL') {
        if (liveStatusFilter === 'SERVED' && order.status?.toUpperCase() !== 'SERVED') return false;
        if (liveStatusFilter === 'COOKING' && !['COOKING', 'PREPARING'].includes(order.status?.toUpperCase() || '')) return false;
        if (liveStatusFilter === 'READY' && order.status?.toUpperCase() !== 'READY') return false;
        if (liveStatusFilter === 'PLACED' && !['PLACED', 'CONFIRMED'].includes(order.status?.toUpperCase() || '')) return false;
      }

      // Search query
      if (liveSearchQuery.trim()) {
        const q = liveSearchQuery.toLowerCase();
        const matchId = String(order.id).includes(q);
        const matchTable = (order.tableName || '').toLowerCase().includes(q);
        const matchCustomer = (order.customerName || '').toLowerCase().includes(q);
        const matchPhone = (order.mobileNumber || '').includes(q);
        const matchItems = Array.isArray(order.items) && order.items.some((i) => i.itemName.toLowerCase().includes(q));
        if (!matchId && !matchTable && !matchCustomer && !matchPhone && !matchItems) return false;
      }

      return true;
    });
  }, [liveOrders, liveStatusFilter, liveSearchQuery]);

  // Filtered History Orders
  const filteredHistoryOrders = useMemo(() => {
    return historyOrders.filter((order) => {
      // Payment filter
      if (historyPaymentFilter !== 'ALL') {
        if ((order.paymentMode || 'CASH').toUpperCase() !== historyPaymentFilter.toUpperCase()) return false;
      }

      // Search query
      if (historySearchQuery.trim()) {
        const q = historySearchQuery.toLowerCase();
        const matchId = String(order.id).includes(q);
        const matchTable = (order.tableName || '').toLowerCase().includes(q);
        const matchCustomer = (order.customerName || '').toLowerCase().includes(q);
        const matchPhone = (order.mobileNumber || '').includes(q);
        if (!matchId && !matchTable && !matchCustomer && !matchPhone) return false;
      }

      return true;
    });
  }, [historyOrders, historyPaymentFilter, historySearchQuery]);

  // Metrics
  const servedAwaitingCount = useMemo(
    () => liveOrders.filter((o) => o.status?.toUpperCase() === 'SERVED').length,
    [liveOrders]
  );
  const servedAwaitingAmount = useMemo(
    () =>
      liveOrders
        .filter((o) => o.status?.toUpperCase() === 'SERVED')
        .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0),
    [liveOrders]
  );
  const totalSettledTodayAmount = useMemo(
    () =>
      historyOrders
        .filter((o) => o.status?.toUpperCase() === 'SETTLED')
        .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0),
    [historyOrders]
  );

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
          {/* Header & KPI Summary */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-[#DE8626]">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                    Orders & Settlement Hub
                  </h1>
                  <p className="text-xs sm:text-sm text-[#667085] dark:text-[#94A3B8]">
                    Real-time ticket stream, Menza Serve order bill settlement, and transaction history
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={loadOrders}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3.5 py-2 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={() => router.push('/pos')}
                className="flex items-center gap-1.5 rounded-xl bg-[#DE8626] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#C4721C] transition-colors"
              >
                <ShoppingBag className="h-4 w-4" />
                <span>Open POS Terminal</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* KPI 1: Served & Ready for Bill */}
            <div className="rounded-2xl border border-amber-300 dark:border-amber-500/30 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-[#1B2127] p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  Served • Ready to Settle
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-[#DE8626]">
                  <Receipt className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6]">
                  {servedAwaitingCount} Orders
                </span>
                <span className="text-sm font-extrabold text-[#DE8626]">
                  (₹{servedAwaitingAmount.toLocaleString('en-IN')})
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#667085] dark:text-[#94A3B8]">
                Dishes served by waitstaff / Menza Serve awaiting cashier payment
              </p>
            </div>

            {/* KPI 2: Live In-Progress Queue */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider">
                  Total Active Queue
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                  <Clock className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6]">
                  {liveOrders.length}
                </span>
                <span className="text-xs text-[#667085]">tickets running</span>
              </div>
              <p className="mt-1 text-[11px] text-[#667085] dark:text-[#94A3B8]">
                Kitchen, takeaway & dine-in orders currently open
              </p>
            </div>

            {/* KPI 3: Settled Today */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider">
                  Settled Today
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6]">
                  ₹{totalSettledTodayAmount.toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-emerald-600 font-bold">
                  ({historyOrders.filter((o) => o.status === 'SETTLED').length} bills)
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#667085] dark:text-[#94A3B8]">
                Completed payments collected across all terminals
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-[#E7E1DA] dark:border-[#2B3540] gap-4">
            <button
              onClick={() => setActiveTab('LIVE')}
              className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-bold transition-colors ${
                activeTab === 'LIVE'
                  ? 'border-[#DE8626] text-[#DE8626]'
                  : 'border-transparent text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>Live & Served Orders</span>
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-[#DE8626] font-bold">
                {liveOrders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-bold transition-colors ${
                activeTab === 'HISTORY'
                  ? 'border-[#DE8626] text-[#DE8626]'
                  : 'border-transparent text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
              }`}
            >
              <HistoryIcon className="h-4 w-4" />
              <span>Order History & Settled Bills</span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 font-bold">
                {historyOrders.length}
              </span>
            </button>
          </div>

          {/* TAB 1: LIVE & SERVED ORDERS */}
          {activeTab === 'LIVE' && (
            <div className="space-y-4">
              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#667085]" />
                  <input
                    type="text"
                    value={liveSearchQuery}
                    onChange={(e) => setLiveSearchQuery(e.target.value)}
                    placeholder="Search Order ID, Table #, Phone, Dish..."
                    className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] pl-10 pr-4 py-2.5 text-xs text-[#1E2930] dark:text-[#F3F4F6] placeholder-[#667085] focus:border-[#DE8626] focus:outline-none"
                  />
                  {liveSearchQuery && (
                    <button
                      onClick={() => setLiveSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#667085]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Status Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {[
                    { id: 'ALL', label: 'All Active' },
                    { id: 'SERVED', label: 'Served (Needs Bill)', highlight: true },
                    { id: 'READY', label: 'Ready' },
                    { id: 'COOKING', label: 'Cooking' },
                    { id: 'PLACED', label: 'Placed' },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setLiveStatusFilter(filter.id)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
                        liveStatusFilter === filter.id
                          ? filter.highlight
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-[#1E2930] dark:bg-[#F3F4F6] text-white dark:text-[#1E2930]'
                          : 'border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#667085] hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notice when Served orders exist */}
              {servedAwaitingCount > 0 && liveStatusFilter !== 'SERVED' && (
                <div className="flex items-center justify-between rounded-2xl border border-amber-400/80 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#DE8626]" />
                    <span>
                      <strong>{servedAwaitingCount} orders</strong> are marked <strong>SERVED</strong> by Menza Serve waitstaff and are waiting for bill settlement!
                    </span>
                  </div>
                  <button
                    onClick={() => setLiveStatusFilter('SERVED')}
                    className="font-bold underline text-[#DE8626] hover:text-[#C4721C]"
                  >
                    View Served Orders
                  </button>
                </div>
              )}

              {/* Live Orders List */}
              {filteredLiveOrders.length === 0 ? (
                <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-16 text-center text-xs text-[#667085]">
                  No active orders match your search or filter criteria.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredLiveOrders.map((order) => {
                    const isServed = order.status?.toUpperCase() === 'SERVED';
                    const items = Array.isArray(order.items) ? order.items : [];

                    return (
                      <div
                        key={order.id}
                        className={`flex flex-col justify-between rounded-3xl border p-5 shadow-xs transition-all ${
                          isServed
                            ? 'border-emerald-400 bg-gradient-to-br from-emerald-500/5 to-white dark:to-[#1B2127] ring-1 ring-emerald-500/20 shadow-md'
                            : 'border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127]'
                        }`}
                      >
                        {/* Top: Order ID, Table, Status */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-base text-[#1E2930] dark:text-[#F3F4F6]">
                                #{order.id}
                              </span>
                              {order.orderNumber && order.orderNumber !== String(order.id) && (
                                <span className="text-[10px] text-[#667085] bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-md">
                                  {order.orderNumber}
                                </span>
                              )}
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                                isServed
                                  ? 'bg-emerald-600 text-white animate-pulse'
                                  : order.status === 'READY'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-amber-500/15 text-[#DE8626] border border-amber-500/30'
                              }`}
                            >
                              {isServed ? 'Served • Ready for Bill' : order.status || 'Active'}
                            </span>
                          </div>

                          {/* Table / Customer Details */}
                          <div className="flex items-center gap-3 text-xs text-[#667085] dark:text-[#94A3B8] mb-3">
                            <span className="flex items-center gap-1 font-semibold text-[#1E2930] dark:text-[#F3F4F6]">
                              <TableIcon className="h-3.5 w-3.5 text-[#DE8626]" />
                              <span>{order.tableName || order.orderTypeName || 'Counter'}</span>
                            </span>
                            <span>•</span>
                            <span>{order.customerName || 'Walk-in Guest'}</span>
                            {order.mobileNumber && (
                              <>
                                <span>•</span>
                                <span>{order.mobileNumber}</span>
                              </>
                            )}
                          </div>

                          {/* Items Summary Preview */}
                          <div className="rounded-2xl bg-[#FAF7F2] dark:bg-[#151A20] p-3 space-y-1.5 mb-4">
                            <div className="flex items-center justify-between text-[11px] font-bold text-[#667085] pb-1 border-b border-[#E7E1DA]/60 dark:border-[#2B3540]/60">
                              <span>Items ({items.length})</span>
                              <span>Qty</span>
                            </div>
                            {items.slice(0, 3).map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs">
                                <span className="text-[#1E2930] dark:text-[#F3F4F6] truncate max-w-[190px]">
                                  {item.itemName}
                                </span>
                                <span className="font-extrabold text-[#667085]">
                                  {item.quantity}x
                                </span>
                              </div>
                            ))}
                            {items.length > 3 && (
                              <div className="text-[10px] text-[#667085] italic pt-0.5">
                                + {items.length - 3} more items...
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Bottom: Total & Action Buttons */}
                        <div className="pt-3 border-t border-[#E7E1DA]/80 dark:border-[#2B3540]/80">
                          <div className="flex items-baseline justify-between mb-3">
                            <span className="text-xs text-[#667085]">Total Bill:</span>
                            <span className="text-xl font-black text-[#DE8626]">
                              ₹{order.totalAmount}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleViewTimeline(order)}
                              className="flex items-center justify-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] py-2 text-xs font-semibold text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Details</span>
                            </button>

                            <button
                              onClick={() => setSettlingOrder(order)}
                              className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2 text-xs font-bold text-white shadow-xs transition-colors"
                            >
                              <Receipt className="h-3.5 w-3.5" />
                              <span>Settle Bill</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ORDER HISTORY & SETTLED BILLS */}
          {activeTab === 'HISTORY' && (
            <div className="space-y-4">
              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#667085]" />
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Search settled bills by Order ID, Mobile, Table, Name..."
                    className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] pl-10 pr-4 py-2.5 text-xs text-[#1E2930] dark:text-[#F3F4F6] placeholder-[#667085] focus:border-[#DE8626] focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-1 text-xs">
                    {['ALL', 'CASH', 'UPI', 'CARD', 'DUE'].map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setHistoryPaymentFilter(mode)}
                        className={`rounded-xl px-3 py-1.5 font-bold transition-colors ${
                          historyPaymentFilter === mode
                            ? 'bg-[#DE8626] text-white shadow-xs'
                            : 'text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* History Table */}
              {filteredHistoryOrders.length === 0 ? (
                <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-16 text-center text-xs text-[#667085]">
                  No settled orders recorded yet today. When orders are settled at the counter or floor, they appear here.
                </div>
              ) : (
                <div className="overflow-hidden rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#667085] dark:text-[#94A3B8]">
                        <tr>
                          <th className="py-3.5 px-4 font-bold">Order ID</th>
                          <th className="py-3.5 px-4 font-bold">Time</th>
                          <th className="py-3.5 px-4 font-bold">Table / Type</th>
                          <th className="py-3.5 px-4 font-bold">Customer</th>
                          <th className="py-3.5 px-4 font-bold">Items Count</th>
                          <th className="py-3.5 px-4 font-bold">Payment Mode</th>
                          <th className="py-3.5 px-4 font-bold">Total Bill</th>
                          <th className="py-3.5 px-4 font-bold">Status</th>
                          <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60">
                        {filteredHistoryOrders.map((order) => (
                          <tr
                            key={order.id}
                            className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          >
                            <td className="py-3 px-4 font-black text-[#1E2930] dark:text-[#F3F4F6]">
                              #{order.id}
                            </td>
                            <td className="py-3 px-4 text-[#667085] dark:text-[#94A3B8] whitespace-nowrap">
                              {order.createdAt
                                ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : '-'}
                            </td>
                            <td className="py-3 px-4 font-semibold text-[#1E2930] dark:text-[#F3F4F6]">
                              {order.tableName || order.orderTypeName || 'Counter'}
                            </td>
                            <td className="py-3 px-4 text-[#667085] dark:text-[#94A3B8]">
                              <div>{order.customerName || 'Guest'}</div>
                              {order.mobileNumber && (
                                <div className="text-[10px] text-[#667085]">{order.mobileNumber}</div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-[#667085] dark:text-[#94A3B8]">
                              {Array.isArray(order.items) ? `${order.items.length} items` : '1 item'}
                            </td>
                            <td className="py-3 px-4">
                              <span className="rounded-lg bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold text-blue-600 uppercase">
                                {order.paymentMode || 'CASH'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-black text-base text-[#1E2930] dark:text-[#F3F4F6]">
                              ₹{order.totalAmount}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  order.status === 'SETTLED'
                                    ? 'bg-emerald-500/10 text-emerald-600'
                                    : 'bg-red-500/10 text-red-600'
                                }`}
                              >
                                {order.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                {/* View Receipt */}
                                <button
                                  onClick={() => setReceiptModalOrder(order)}
                                  title="View Digital Receipt"
                                  className="rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] p-1.5 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                >
                                  <Receipt className="h-3.5 w-3.5" />
                                </button>

                                {/* Print Thermal Receipt */}
                                <button
                                  onClick={() => handlePrintReceipt(order)}
                                  disabled={printingOrderId === order.id}
                                  title="Reprint Receipt"
                                  className="rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] p-1.5 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                </button>

                                {/* WhatsApp Share */}
                                {order.mobileNumber && (
                                  <button
                                    onClick={() => handleShareWhatsApp(order)}
                                    title="Send WhatsApp Bill"
                                    className="rounded-lg bg-green-500/10 p-1.5 text-green-600 hover:bg-green-500/20 transition-colors"
                                  >
                                    <MessageCircle className="h-3.5 w-3.5" />
                                  </button>
                                )}

                                {/* Audit Timeline */}
                                <button
                                  onClick={() => handleViewTimeline(order)}
                                  title="Audit Timeline"
                                  className="rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] p-1.5 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 1. ORDER DETAILS & TIMELINE MODAL */}
        {viewingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-[#DE8626]" />
                  <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                    Order #{viewingOrder.id} Details
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setViewingOrder(null);
                    setOrderTimeline(null);
                  }}
                  className="rounded-lg p-1 text-[#667085] hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Order Meta Info */}
              <div className="rounded-2xl bg-[#FAF7F2] dark:bg-[#151A20] p-4 text-xs space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-[#667085]">Table / Order Type:</span>
                  <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                    {viewingOrder.tableName || viewingOrder.orderTypeName || 'Counter'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">Customer:</span>
                  <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                    {viewingOrder.customerName || 'Walk-in'} ({viewingOrder.mobileNumber || 'No phone'})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">Status:</span>
                  <span className="font-bold text-[#DE8626] uppercase">
                    {viewingOrder.status}
                  </span>
                </div>
                {viewingOrder.paymentMode && (
                  <div className="flex justify-between">
                    <span className="text-[#667085]">Payment Mode:</span>
                    <span className="font-bold text-blue-600 uppercase">
                      {viewingOrder.paymentMode}
                    </span>
                  </div>
                )}
              </div>

              {/* Order Items Table */}
              <div className="mb-4">
                <h4 className="text-xs font-bold uppercase text-[#667085] mb-2 tracking-wider">
                  Ordered Items
                </h4>
                <div className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] overflow-hidden">
                  {(Array.isArray(viewingOrder.items) ? viewingOrder.items : []).map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 text-xs">
                      <div>
                        <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                          {it.itemName}
                        </span>
                        <div className="text-[10px] text-[#667085]">
                          ₹{it.unitPrice} × {it.quantity}
                        </div>
                      </div>
                      <span className="font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                        ₹{it.totalPrice || (it.quantity * it.unitPrice)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-right text-sm font-black text-[#DE8626]">
                  Total: ₹{viewingOrder.totalAmount}
                </div>
              </div>

              {/* Event Timeline */}
              <div className="mb-5">
                <h4 className="text-xs font-bold uppercase text-[#667085] mb-2 tracking-wider">
                  Audit Lifecycle Timeline
                </h4>
                {loadingTimeline ? (
                  <div className="py-4 text-center text-xs text-[#667085] animate-pulse">
                    Loading lifecycle history...
                  </div>
                ) : orderTimeline && orderTimeline.length > 0 ? (
                  <div className="space-y-2 border-l-2 border-amber-500/30 pl-3 ml-2">
                    {orderTimeline.map((item, idx) => (
                      <div key={idx} className="relative text-xs">
                        <div className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                          {item.action}
                        </div>
                        {item.description && (
                          <div className="text-[#667085] text-[11px]">{item.description}</div>
                        )}
                        {item.createdDateUtc && (
                          <div className="text-[10px] text-[#667085]/80">
                            {new Date(item.createdDateUtc).toLocaleString('en-IN')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-[#667085] italic">
                    Order created at {viewingOrder.createdAt ? new Date(viewingOrder.createdAt).toLocaleTimeString() : 'today'}.
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                {viewingOrder.status !== 'SETTLED' && viewingOrder.status !== 'CANCELLED' && (
                  <button
                    onClick={() => {
                      const o = viewingOrder;
                      setViewingOrder(null);
                      setSettlingOrder(o);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 py-3 text-xs font-bold text-white shadow-md transition-colors"
                  >
                    <Receipt className="h-4 w-4" />
                    <span>Settle Bill (₹{viewingOrder.totalAmount})</span>
                  </button>
                )}
                <button
                  onClick={() => setViewingOrder(null)}
                  className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] py-2.5 text-xs font-semibold text-[#667085] hover:bg-black/5"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. DIGITAL RECEIPT PREVIEW MODAL */}
        {receiptModalOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                  Receipt Preview
                </h3>
                <button
                  onClick={() => setReceiptModalOrder(null)}
                  className="rounded-lg p-1 text-[#667085]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Printable Receipt Card */}
              <div className="rounded-2xl border border-dashed border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-4 text-xs font-mono mb-4 space-y-2">
                <div className="text-center pb-2 border-b border-dashed border-[#E7E1DA] dark:border-[#2B3540]">
                  <h4 className="font-bold text-sm uppercase">
                    {activeRestaurant?.restaurantName || 'Menza Restaurant'}
                  </h4>
                  <p className="text-[10px] text-[#667085]">{activeRestaurant?.address}</p>
                  <p className="text-[10px] text-[#667085]">Phone: {(activeRestaurant as any)?.contactNumber || activeRestaurant?.ownerMobile || '-'}</p>
                </div>

                <div className="flex justify-between text-[11px]">
                  <span>Order: #{receiptModalOrder.id}</span>
                  <span>{receiptModalOrder.tableName || receiptModalOrder.orderTypeName || 'Counter'}</span>
                </div>
                <div className="flex justify-between text-[10px] text-[#667085]">
                  <span>Date: {receiptModalOrder.createdAt ? new Date(receiptModalOrder.createdAt).toLocaleDateString() : '-'}</span>
                  <span>Time: {receiptModalOrder.createdAt ? new Date(receiptModalOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                </div>

                <div className="py-2 border-t border-b border-dashed border-[#E7E1DA] dark:border-[#2B3540] space-y-1">
                  {(Array.isArray(receiptModalOrder.items) ? receiptModalOrder.items : []).map((it, idx) => (
                    <div key={idx} className="flex justify-between text-[11px]">
                      <span>{it.quantity}x {it.itemName}</span>
                      <span>₹{it.totalPrice || (it.quantity * it.unitPrice)}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1 pt-1 text-[11px]">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₹{receiptModalOrder.subtotal || receiptModalOrder.totalAmount}</span>
                  </div>
                  {Number(receiptModalOrder.discountAmount || 0) > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount:</span>
                      <span>-₹{receiptModalOrder.discountAmount}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm border-t border-dashed border-[#E7E1DA] dark:border-[#2B3540] pt-1.5">
                    <span>GRAND TOTAL:</span>
                    <span>₹{receiptModalOrder.totalAmount}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-[#667085]">
                    <span>Payment Mode:</span>
                    <span className="uppercase font-bold">{receiptModalOrder.paymentMode || 'CASH'}</span>
                  </div>
                </div>

                <div className="text-center pt-2 text-[10px] text-[#667085] italic border-t border-dashed border-[#E7E1DA] dark:border-[#2B3540]">
                  {customFooter || 'Thank you for your visit!'}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button
                  onClick={() => handlePrintReceipt(receiptModalOrder)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#DE8626] py-3 text-xs font-bold text-white shadow-md hover:bg-[#C4721C] transition-colors"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print Receipt</span>
                </button>
                {receiptModalOrder.mobileNumber && (
                  <button
                    onClick={() => handleShareWhatsApp(receiptModalOrder)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-green-600 bg-green-500/10 py-2.5 text-xs font-bold text-green-700 dark:text-green-400 hover:bg-green-500/20 transition-colors"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>Share on WhatsApp</span>
                  </button>
                )}
                <button
                  onClick={() => setReceiptModalOrder(null)}
                  className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] py-2.5 text-xs font-semibold text-[#667085] hover:bg-black/5"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. ORDER SETTLE MODAL */}
        {settlingOrder && (
          <OrderSettleModal
            isOpen={Boolean(settlingOrder)}
            onClose={() => setSettlingOrder(null)}
            order={settlingOrder}
            onSettled={async () => {
              await loadOrders();
              setSettlingOrder(null);
            }}
          />
        )}
      </AppShell>
    </AuthGuard>
  );
}
