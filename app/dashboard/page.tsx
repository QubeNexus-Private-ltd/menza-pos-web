'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingBag,
  IndianRupee,
  UtensilsCrossed,
  Table,
  BarChart3,
  Users,
  Store,
  Clock,
  TrendingUp,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Printer,
  Calendar,
  Layers,
  ChevronRight,
  AlertTriangle,
  ChefHat,
  CalendarDays,
  Wallet,
  MessageSquare,
  Receipt,
  Search,
  Eye,
  X,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { TermsConsentCard } from '@/components/common/TermsConsentCard';
import { OrderSettleModal } from '@/components/orders/OrderSettleModal';
import { OrderStatusPipeline } from '@/components/dashboard/OrderStatusPipeline';
import { DashboardOrderDetailDrawer } from '@/components/dashboard/DashboardOrderDetailDrawer';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { useNotificationStore } from '@shared/presentation/state/useNotificationStore';
import { OrderRemoteDataSource } from '@shared/data/datasources/OrderRemoteDataSource';
import { SuperAdminRemoteDataSource } from '@shared/data/datasources/SuperAdminRemoteDataSource';
import { SuperAdminRepositoryImpl } from '@shared/data/repositories/SuperAdminRepositoryImpl';
import { RestaurantConfigRemoteDataSource } from '@shared/data/datasources/RestaurantConfigRemoteDataSource';
import { TableRemoteDataSource } from '@shared/data/datasources/TableRemoteDataSource';
import { RestaurantTodayRevenue, OrderMaster } from '@shared/domain/models/Order';
import { StoreOperatingStatus } from '@shared/domain/models/RestaurantConfig';
import {
  PipelineStageKey,
  DashboardPipelineStages,
  normalizeOrderStatus,
  OrderStatuses,
  getOrderStatusBadge,
  getNextRecommendedStatus,
  isOrderSettled,
} from '@/lib/utils/orderStatusEngine';
import {
  startPosSignalRConnection,
  onPosOrderCreated,
  onPosOrderStatusChanged,
  onPosOrderSettled,
  onKitchenStatusChanged,
  onSignalRReconnected,
} from '@/lib/signalr/signalrService';

export default function DashboardPage() {
  const router = useRouter();
  const { user, activeRestaurant, restaurants } = useAuthStore();
  const { unreadCount } = useNotificationStore();

  const roleName = user?.roles?.[0] || 'Owner';
  const isSuperAdmin =
    user?.roles?.some((r) =>
      ['SUPERADMIN', 'SUPER_ADMIN', 'SUPERADMINONLY'].includes(r.toUpperCase().replace(/[^A-Z]/g, ''))
    ) || Boolean(roleName && roleName.toLowerCase().includes('superadmin'));

  const orderRemoteDataSource = useMemo(() => new OrderRemoteDataSource(), []);
  const configRemoteDataSource = useMemo(() => new RestaurantConfigRemoteDataSource(), []);
  const tableRemoteDataSource = useMemo(() => new TableRemoteDataSource(), []);
  const superAdminRepo = useMemo(() => new SuperAdminRepositoryImpl(new SuperAdminRemoteDataSource()), []);

  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<RestaurantTodayRevenue | null>(null);
  const [recentOrders, setRecentOrders] = useState<OrderMaster[]>([]);
  const [operatingStatus, setOperatingStatus] = useState<StoreOperatingStatus | null>(null);
  const [tableCount, setTableCount] = useState({ total: 0, occupied: 0 });
  const [superAdminMetrics, setSuperAdminMetrics] = useState({ totalStores: 0, totalRevenue: 0 });

  // Pipeline Filter & Order Selection State
  const [activePipelineStage, setActivePipelineStage] = useState<PipelineStageKey>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<OrderMaster | null>(null);
  const [settlingOrder, setSettlingOrder] = useState<OrderMaster | null>(null);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);

  const loadDashboardData = useCallback(async () => {
    if (isSuperAdmin) {
      try {
        setLoading(true);
        const stores = await superAdminRepo.getAllRestaurants(undefined, undefined, undefined, undefined, 1, 100);
        setSuperAdminMetrics({
          totalStores: stores.totalCount || stores.items.length,
          totalRevenue: 0,
        });
      } catch (err) {
        console.warn('SuperAdmin fetch failed', err);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!currentRestId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [rev, orders, op, tables] = await Promise.allSettled([
        orderRemoteDataSource.getTodayRevenue(currentRestId),
        orderRemoteDataSource.getTodayOrders(currentRestId, 'ALL', 1, 100),
        configRemoteDataSource.getOperatingStatus(currentRestId),
        tableRemoteDataSource.getTables(currentRestId),
      ]);

      if (rev.status === 'fulfilled' && rev.value) {
        setRevenueData(rev.value);
      }
      if (orders.status === 'fulfilled' && orders.value?.items) {
        setRecentOrders(orders.value.items);
      }
      if (op.status === 'fulfilled' && op.value) {
        setOperatingStatus(op.value);
      }
      if (tables.status === 'fulfilled' && Array.isArray(tables.value)) {
        const total = tables.value.length;
        const occupied = tables.value.filter((t) => t.status?.toUpperCase() === 'OCCUPIED' || Boolean(t.activeOrderId)).length;
        setTableCount({ total, occupied });
      }
    } catch (err) {
      console.warn('Dashboard telemetry error', err);
    } finally {
      setLoading(false);
    }
  }, [currentRestId, isSuperAdmin, orderRemoteDataSource, configRemoteDataSource, tableRemoteDataSource, superAdminRepo]);

  useEffect(() => {
    loadDashboardData();

    if (currentRestId && !isSuperAdmin) {
      // Connect real-time SignalR listeners
      startPosSignalRConnection(currentRestId).catch(() => {});
      const unsub1 = onPosOrderCreated(() => loadDashboardData());
      const unsub2 = onPosOrderStatusChanged(() => loadDashboardData());
      const unsub3 = onPosOrderSettled((settledData: any) => {
        const settledId = Number(settledData?.orderId || settledData?.id || 0);
        if (settledId > 0) {
          setRecentOrders((prev) =>
            prev.map((o) =>
              o.id === settledId
                ? {
                    ...o,
                    status: OrderStatuses.Settled,
                    paymentStatus: 'PAID',
                    settledDateUtc: new Date().toISOString(),
                  }
                : o
            )
          );
        }
        loadDashboardData();
      });
      const unsub4 = onKitchenStatusChanged(() => loadDashboardData());
      const unsub5 = onSignalRReconnected(() => loadDashboardData());

      // Polling fallback
      const interval = setInterval(loadDashboardData, 30000);

      return () => {
        clearInterval(interval);
        unsub1();
        unsub2();
        unsub3();
        unsub4();
        unsub5();
      };
    }
  }, [currentRestId, isSuperAdmin, loadDashboardData]);

  // Status progression action from drawer or row
  const handleUpdateOrderStatus = async (orderId: number, nextStatus: string) => {
    try {
      await orderRemoteDataSource.updateOrderStatus(orderId, nextStatus);
      await loadDashboardData();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: nextStatus as any } : null));
      }
    } catch (err: any) {
      alert(`Failed to update status: ${err?.message || 'Server error'}`);
    }
  };

  // Void order action
  const handleCancelOrder = async (orderId: number, reason: string, tableId?: number) => {
    try {
      await orderRemoteDataSource.cancelOrder(orderId, reason);
      if (tableId && currentRestId) {
        await tableRemoteDataSource
          .freeTable(tableId, {
            restaurantId: currentRestId,
            settleActiveOrder: false,
            remarks: `Order #${orderId} voided from dashboard: ${reason}`,
          })
          .catch((err) => console.warn('Free table warning:', err));
      }
      await loadDashboardData();
      setSelectedOrder(null);
      alert(`Order #${orderId} voided successfully.`);
    } catch (err: any) {
      alert(`Failed to void order: ${err?.message || 'Server error'}`);
    }
  };

  // Format token
  const formatTokenDisplay = (order: OrderMaster) => {
    const raw = order.pickupToken || order.tokenNumber || String(order.id);
    if (/^TK-/i.test(String(raw))) return String(raw).toUpperCase();
    const num = parseInt(String(raw), 10);
    if (!isNaN(num) && num > 0) return `TK-${String(num).padStart(3, '0')}`;
    return `TK-${String(order.id).slice(-3).padStart(3, '0')}`;
  };

  // Filtered orders based on pipeline stage and search
  const filteredOrders = useMemo(() => {
    return recentOrders.filter((order) => {
      const norm = normalizeOrderStatus(order.status);
      const isSettled = isOrderSettled(order);
      const isCancelled = norm === OrderStatuses.Cancelled;

      // 1. Pipeline stage filtering
      if (activePipelineStage === 'ALL') {
        // 'ALL' shows all active (unsettled & non-cancelled) orders
        if (isSettled || isCancelled) return false;
      } else if (activePipelineStage === 'NEW') {
        if (norm !== OrderStatuses.PendingPayment && norm !== OrderStatuses.Placed && norm !== OrderStatuses.Confirmed) {
          return false;
        }
      } else if (activePipelineStage === 'COOKING') {
        if (norm !== OrderStatuses.Preparing) return false;
      } else if (activePipelineStage === 'READY') {
        if (norm !== OrderStatuses.Ready) return false;
      } else if (activePipelineStage === 'SERVED') {
        if (norm !== OrderStatuses.Served && norm !== OrderStatuses.Delivered) return false;
      } else if (activePipelineStage === 'SETTLED') {
        if (!isSettled) return false;
      } else if (activePipelineStage === 'CANCELLED') {
        if (!isCancelled) return false;
      }

      // 2. Search query filtering
      if (orderSearchQuery.trim()) {
        const q = orderSearchQuery.toLowerCase().trim();
        const matchId = String(order.id).includes(q);
        const matchToken = formatTokenDisplay(order).toLowerCase().includes(q);
        const matchTable = (order.tableName || '').toLowerCase().includes(q);
        const matchCust = (order.customerName || '').toLowerCase().includes(q);
        const matchPhone = (order.mobileNumber || '').includes(q);
        const matchItems = Array.isArray(order.items) && order.items.some((i) => i.itemName.toLowerCase().includes(q));

        if (!matchId && !matchToken && !matchTable && !matchCust && !matchPhone && !matchItems) {
          return false;
        }
      }

      return true;
    });
  }, [recentOrders, activePipelineStage, orderSearchQuery]);

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
          {/* Welcome Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                  {isSuperAdmin ? 'SuperAdmin Overview' : activeRestaurant?.restaurantName || 'Restaurant Overview'}
                </h1>
                <span className="rounded-full bg-amber-500/10 px-3 py-0.5 text-xs font-bold text-[#DE8626] uppercase">
                  {roleName}
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-[#667085] dark:text-[#94A3B8]">
                {isSuperAdmin
                  ? 'Monitor multi-tenant platform health, active stores, and enterprise accounts'
                  : 'Live restaurant operations, daily revenue telemetry, and order flow'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadDashboardData}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] px-3.5 py-2 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              {!isSuperAdmin && (
                <button
                  onClick={() => router.push('/pos')}
                  className="flex items-center gap-2 rounded-xl bg-[#DE8626] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] transition-colors"
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span>Punch Order (POS)</span>
                </button>
              )}
            </div>
          </div>

          {/* KPI Metrics Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Today's Net Revenue */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider">
                  Today's Sales
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-[#DE8626]">
                  <IndianRupee className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  ₹{Number(revenueData?.todayRevenue || 0).toLocaleString('en-IN')}
                </h3>
                <div className="mt-1 flex items-center gap-2 text-xs text-[#667085] dark:text-[#94A3B8]">
                  <span>Total {revenueData?.todayOrdersCount || recentOrders.length} bills punched</span>
                </div>
              </div>
            </div>

            {/* KPI 2: Live Kitchen / Active Orders */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider">
                  Active Queue
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Clock className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  {
                    recentOrders.filter(
                      (o) => !isOrderSettled(o) && normalizeOrderStatus(o.status) !== OrderStatuses.Cancelled
                    ).length
                  }
                </h3>
                <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8]">
                  Orders in kitchen, counter & tables
                </p>
              </div>
            </div>

            {/* KPI 3: Floor Tables Occupancy */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider">
                  Floor Occupancy
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                  <Table className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                  {tableCount.occupied} / {tableCount.total}
                </h3>
                <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8]">
                  {tableCount.total > 0
                    ? `${Math.round((tableCount.occupied / tableCount.total) * 100)}% dining capacity in use`
                    : 'No tables configured'}
                </p>
              </div>
            </div>

            {/* KPI 4: Store Service Status */}
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider">
                  Operating Shift
                </span>
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    operatingStatus?.isOpen ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                  }`}
                >
                  <Store className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      operatingStatus?.isOpen ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                  />
                  <h3 className="text-lg font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                    {operatingStatus?.isOpen ? 'Active Service' : 'Store Closed'}
                  </h3>
                </div>
                <p className="mt-1 text-xs text-[#667085] dark:text-[#94A3B8]">
                  {operatingStatus?.isOpen ? 'Online orders & dining open' : 'Shift currently closed'}
                </p>
              </div>
            </div>
          </div>

          {/* Canonical Order Status Pipeline Widget */}
          {!isSuperAdmin && (
            <OrderStatusPipeline
              orders={recentOrders}
              activeStage={activePipelineStage}
              onSelectStage={(stage) => setActivePipelineStage(stage)}
            />
          )}

          {/* Quick Access Operational Grid */}
          <div>
            <h2 className="text-sm font-bold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider mb-3">
              Daily Service Shortcuts
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div
                onClick={() => router.push('/pos')}
                className="group cursor-pointer rounded-2xl border border-[#DE8626]/30 bg-gradient-to-br from-[#FFF4E5] to-[#FFFFFF] dark:from-[#2A1E11] dark:to-[#1B2127] p-5 shadow-sm hover:shadow-md hover:border-[#DE8626] transition-all"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#DE8626] text-white shadow-md shadow-[#DE8626]/30 mb-3 group-hover:scale-105 transition-transform">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <h4 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">POS Terminal</h4>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1">
                  High-speed billing, KOT ticketing, and instant payment settlement
                </p>
              </div>

              <div
                onClick={() => router.push('/menu')}
                className="group cursor-pointer rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-5 shadow-sm hover:shadow-md hover:border-[#DE8626] transition-all"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-[#DE8626] mb-3 group-hover:scale-105 transition-transform">
                  <UtensilsCrossed className="h-5 w-5" />
                </div>
                <h4 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">Menu & Catalog</h4>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1">
                  Categories, dish pricing, availability toggles, and stock
                </p>
              </div>

              <div
                onClick={() => router.push('/tables')}
                className="group cursor-pointer rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-5 shadow-sm hover:shadow-md hover:border-[#DE8626] transition-all"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 mb-3 group-hover:scale-105 transition-transform">
                  <Table className="h-5 w-5" />
                </div>
                <h4 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">Floor Tables</h4>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1">
                  Dine-in floor plan, active occupancy, and open order linking
                </p>
              </div>

              <div
                onClick={() => router.push('/kitchen')}
                className="group cursor-pointer rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-5 shadow-sm hover:shadow-md hover:border-[#DE8626] transition-all"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 mb-3 group-hover:scale-105 transition-transform">
                  <ChefHat className="h-5 w-5" />
                </div>
                <h4 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">Kitchen (KDS)</h4>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1">
                  Live preparation queue, station routing, and kitchen ticket dispatch
                </p>
              </div>

              <div
                onClick={() => router.push('/reports')}
                className="group cursor-pointer rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-5 shadow-sm hover:shadow-md hover:border-[#DE8626] transition-all"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 mb-3 group-hover:scale-105 transition-transform">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <h4 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">Business Reports</h4>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1">
                  Daily revenue summaries, top items, and hourly sales heatmaps
                </p>
              </div>

              <div
                onClick={() => router.push('/reservations')}
                className="group cursor-pointer rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-5 shadow-sm hover:shadow-md hover:border-[#DE8626] transition-all"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 mb-3 group-hover:scale-105 transition-transform">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <h4 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">Reservations</h4>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1">
                  Guest bookings, slot timings, seating allocations, and walk-ins
                </p>
              </div>

              <div
                onClick={() => router.push('/wallet')}
                className="group cursor-pointer rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-5 shadow-sm hover:shadow-md hover:border-[#DE8626] transition-all"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 mb-3 group-hover:scale-105 transition-transform">
                  <Wallet className="h-5 w-5" />
                </div>
                <h4 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">Prepaid Wallet</h4>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1">
                  Commission ledger, instant gateway top-ups, and SMS balances
                </p>
              </div>

              <div
                onClick={() => router.push('/settings/whatsapp')}
                className="group cursor-pointer rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-5 shadow-sm hover:shadow-md hover:border-[#DE8626] transition-all"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-500/10 text-green-600 mb-3 group-hover:scale-105 transition-transform">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <h4 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">WhatsApp Alerts</h4>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1">
                  Customer receipt delivery, Gupshup templates, and test messaging
                </p>
              </div>
            </div>
          </div>

          {/* Today's Live Orders Feed with Quick Filter & Search */}
          <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E7E1DA] dark:border-[#2B3540]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                    Today's Live Orders
                  </h3>
                  <span className="rounded-full bg-[#DE8626]/10 px-2.5 py-0.5 text-xs font-black text-[#DE8626]">
                    {filteredOrders.length}
                  </span>
                </div>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-0.5">
                  Showing {activePipelineStage === 'ALL' ? 'all active queue' : `${activePipelineStage} orders`} across counter, dine-in, and online
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search Box */}
                <div className="relative min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#667085]" />
                  <input
                    type="text"
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    placeholder="Search token, table, guest..."
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF8F5] dark:bg-[#151A1E] pl-8 pr-7 py-1.5 text-xs text-[#1E2930] dark:text-[#F3F4F6] placeholder-[#667085] focus:outline-hidden focus:border-[#DE8626]"
                  />
                  {orderSearchQuery && (
                    <button
                      onClick={() => setOrderSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#667085]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => router.push('/orders')}
                  className="flex items-center gap-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] px-3 py-1.5 text-xs font-semibold text-[#667085] hover:text-[#DE8626] transition-colors"
                >
                  <span>Orders & History</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>

                <button
                  onClick={() => router.push('/pos')}
                  className="flex items-center gap-1 rounded-xl bg-[#DE8626] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#C4721C] transition-colors"
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span>Open POS</span>
                </button>
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#667085] dark:text-[#94A3B8]">
                {orderSearchQuery || activePipelineStage !== 'ALL'
                  ? 'No orders match the current filter or search. Try clearing filters.'
                  : 'No orders punched yet today. Click "Punch Order (POS)" to create the first sale!'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E7E1DA] dark:border-[#2B3540] text-[#667085] dark:text-[#94A3B8]">
                    <tr>
                      <th className="pb-3 font-semibold">Token / Order</th>
                      <th className="pb-3 font-semibold">Table / Service</th>
                      <th className="pb-3 font-semibold">Customer</th>
                      <th className="pb-3 font-semibold">Items</th>
                      <th className="pb-3 font-semibold">Total Amount</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold">Time</th>
                      <th className="pb-3 font-semibold text-right">Quick Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60">
                    {filteredOrders.map((order) => {
                      const badge = getOrderStatusBadge(order.status);
                      const norm = normalizeOrderStatus(order.status);
                      const isSettled = isOrderSettled(order);
                      const token = formatTokenDisplay(order);
                      const nextProg = getNextRecommendedStatus(order.status, order.orderTypeName, order.tableId);

                      return (
                        <tr
                          key={order.id}
                          onClick={() => setSelectedOrder(order)}
                          className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                        >
                          <td className="py-3 font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-[#DE8626] bg-[#DE8626]/10 px-1.5 py-0.5 rounded-md text-[11px]">
                                {token}
                              </span>
                              <span className="text-[#667085] text-[10px]">#{order.id}</span>
                            </div>
                          </td>
                          <td className="py-3 text-[#1E2930] dark:text-[#F3F4F6]">
                            <span className="font-medium">
                              {order.tableName ? `Table ${order.tableName}` : order.orderTypeName || 'Counter'}
                            </span>
                          </td>
                          <td className="py-3 text-[#667085] dark:text-[#94A3B8]">
                            {order.customerName || order.mobileNumber || 'Walk-in Guest'}
                          </td>
                          <td className="py-3 text-[#667085] dark:text-[#94A3B8] max-w-[200px] truncate">
                            {Array.isArray(order.items)
                              ? order.items.map((i) => `${i.quantity}x ${i.itemName}`).join(', ')
                              : 'Items'}
                          </td>
                          <td className="py-3 font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                            ₹{Number(order.totalAmount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase border inline-flex items-center gap-1 ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
                            >
                              <span className={`inline-block h-1.5 w-1.5 rounded-full ${badge.dotClass}`} />
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-3 text-[#667085] dark:text-[#94A3B8]">
                            {order.createdAt
                              ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : '-'}
                          </td>
                          <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {/* If unsettled, show progression or settle */}
                              {!isSettled && norm !== OrderStatuses.Cancelled ? (
                                <>
                                  {nextProg && nextProg.nextStatus !== OrderStatuses.Settled && (
                                    <button
                                      onClick={() => handleUpdateOrderStatus(order.id, nextProg.nextStatus)}
                                      className="inline-flex items-center gap-1 rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] hover:border-[#DE8626] px-2 py-1 text-[11px] font-bold text-[#1E2930] dark:text-[#F3F4F6] shadow-2xs transition-colors"
                                      title={nextProg.actionLabel}
                                    >
                                      <Sparkles className="h-3 w-3 text-[#DE8626]" />
                                      <span>{nextProg.nextStatus}</span>
                                    </button>
                                  )}

                                  <button
                                    onClick={() => setSettlingOrder(order)}
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-[11px] font-bold shadow-xs transition-colors"
                                    title="Settle Bill & Free Table"
                                  >
                                    <Receipt className="h-3 w-3" />
                                    <span>Settle</span>
                                  </button>
                                </>
                              ) : (
                                <span className="text-[10px] font-bold uppercase text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                  {isSettled ? 'Paid' : 'Void'}
                                </span>
                              )}

                              <button
                                onClick={() => setSelectedOrder(order)}
                                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#667085]"
                                title="Inspect Order Details"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </AppShell>
      <TermsConsentCard />

      {/* Slide-over Order Details Drawer */}
      <DashboardOrderDetailDrawer
        isOpen={Boolean(selectedOrder)}
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onStatusUpdate={handleUpdateOrderStatus}
        onSettleOrder={(order) => {
          setSelectedOrder(null);
          setSettlingOrder(order);
        }}
        onCancelOrder={handleCancelOrder}
      />

      {/* Cashier Settlement Modal */}
      {settlingOrder && (
        <OrderSettleModal
          isOpen={Boolean(settlingOrder)}
          onClose={() => setSettlingOrder(null)}
          order={settlingOrder}
          onSettled={async (settledId: any) => {
            const idNum = Number(settledId || settlingOrder?.id || 0);
            if (idNum > 0) {
              setRecentOrders((prev) =>
                prev.map((o) =>
                  o.id === idNum
                    ? {
                        ...o,
                        status: OrderStatuses.Settled,
                        paymentStatus: 'PAID',
                        settledDateUtc: new Date().toISOString(),
                      }
                    : o
                )
              );
            }
            await loadDashboardData();
            setSettlingOrder(null);
          }}
        />
      )}
    </AuthGuard>
  );
}
