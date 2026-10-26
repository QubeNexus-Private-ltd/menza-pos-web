'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChefHat,
  Plus,
  Flame,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Power,
  Settings2,
  X,
  Trash2,
  UtensilsCrossed,
  Sparkles,
  Printer,
  Volume2,
  VolumeX,
  Zap,
  Keyboard,
  Search,
  Check,
  Bell,
  Tag,
  Maximize2,
  Minimize2,
  LayoutGrid,
  Columns,
  CheckSquare,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { usePrinterStore } from '@shared/presentation/state/usePrinterStore';
import { WebKitchenService, KitchenStationDTO, CreateKitchenStationModel } from '@/services/kitchenService';
import { WebPrinterService } from '@/services/webPrinterService';
import { OrderRemoteDataSource } from '@shared/data/datasources/OrderRemoteDataSource';
import { OrderMaster } from '@shared/domain/models/Order';
import { parseUtcDate, formatToIstTime } from '@shared/core/utils/formatters';
import {
  startPosSignalRConnection,
  onPosOrderCreated,
  onPosOrderStatusChanged,
  onKitchenStatusChanged,
  onPosOrderSettled,
  onSignalRReconnected,
} from '@/lib/signalr/signalrService';
import {
  getNextRecommendedStatus,
  OrderStatuses,
  isOrderSettled as isOrderCanonicalSettled,
} from '@/lib/utils/orderStatusEngine';

const orderDataSource = new OrderRemoteDataSource();

type KdsStageFilter = 'ACTIVE_KITCHEN' | 'NEW' | 'PREPARING' | 'READY' | 'SERVED';
type KdsDensity = 'comfortable' | 'compact' | 'focus';

/** High-Fidelity Kitchen Order Ticket Skeleton for fluid loading transitions */
const KdsTicketSkeleton: React.FC = () => {
  return (
    <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] overflow-hidden flex flex-col justify-between bg-white dark:bg-[#1B2127] shadow-xs animate-pulse">
      {/* Header Skeleton */}
      <div className="px-4 py-3.5 border-b border-[#E7E1DA]/70 dark:border-[#2B3540]/70 bg-[#FAF7F2] dark:bg-[#151A20]">
        {/* Row 1: Destination Badge & SLA Timer Pill */}
        <div className="flex items-center justify-between gap-2">
          <div className="h-6 w-32 rounded-lg bg-black/10 dark:bg-white/10" />
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-14 rounded-full bg-black/10 dark:bg-white/10" />
            <div className="h-5 w-16 rounded-full bg-black/10 dark:bg-white/10" />
          </div>
        </div>

        {/* Row 2: Token Pill & Station Badges */}
        <div className="mt-2.5 pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-6 w-18 rounded-lg bg-[#DE8626]/20" />
            <div className="h-4 w-16 rounded bg-black/10 dark:bg-white/10" />
          </div>
          <div className="flex items-center gap-1">
            <div className="h-4 w-11 rounded-md bg-black/10 dark:bg-white/10" />
            <div className="h-4 w-9 rounded-md bg-black/10 dark:bg-white/10" />
          </div>
        </div>
      </div>

      {/* Items List Skeleton */}
      <div className="p-4 space-y-3.5 flex-1 divide-y divide-[#E7E1DA]/40 dark:divide-[#2B3540]/40">
        {[1, 2, 3].map((i) => (
          <div key={i} className="pt-3 first:pt-0 flex items-start gap-2.5">
            <div className="h-5 w-5 rounded-lg bg-black/10 dark:bg-white/10 shrink-0" />
            <div className="h-5 w-6 rounded bg-[#DE8626]/20 shrink-0" />
            <div className="flex-1 space-y-2">
              <div
                className="h-4 rounded bg-black/10 dark:bg-white/10"
                style={{ width: i === 1 ? '78%' : i === 2 ? '90%' : '65%' }}
              />
              {i === 2 && (
                <div className="h-3.5 w-1/2 rounded-md bg-amber-500/15" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Skeleton */}
      <div className="p-3.5 border-t border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/80 dark:bg-[#151A20]/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="h-4 w-28 rounded bg-black/10 dark:bg-white/10" />
          <div className="h-6 w-20 rounded-xl bg-black/10 dark:bg-white/10" />
        </div>
        <div className="h-11 w-full rounded-2xl bg-black/10 dark:bg-white/10" />
      </div>
    </div>
  );
};

export default function KitchenKdsPage() {
  const { activeRestaurant, restaurants } = useAuthStore();
  const { paperWidth } = usePrinterStore();
  const currentRestId =
    activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);


  const [stations, setStations] = useState<KitchenStationDTO[]>([]);
  const [allOpenOrders, setAllOpenOrders] = useState<OrderMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStationCode, setSelectedStationCode] = useState<string>('ALL');
  const [stageFilter, setStageFilter] = useState<KdsStageFilter>('ACTIVE_KITCHEN');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [printingOrderId, setPrintingOrderId] = useState<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [manageStationsOpen, setManageStationsOpen] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [density, setDensity] = useState<KdsDensity>('comfortable');

  // Clean slate and show skeleton immediately upon restaurant switch
  useEffect(() => {
    setStations([]);
    setAllOpenOrders([]);
    setCheckedItems({});
    setSelectedStationCode('ALL');
    setLoading(true);
  }, [currentRestId]);


  // Load saved density preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('menza_kds_density') as KdsDensity;
      if (saved && ['comfortable', 'compact', 'focus'].includes(saved)) {
        setDensity(saved);
      }
    } catch {}
  }, []);

  const changeDensity = (newDensity: KdsDensity) => {
    setDensity(newDensity);
    try {
      localStorage.setItem('menza_kds_density', newDensity);
    } catch {}
  };

  // Fullscreen listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    } catch {}
  }, []);

  // Update elapsed timer every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Play two-tone Web Audio chime when a new order arrives
  const playKitchenChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.12);
      gain2.gain.setValueAtTime(0.2, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.45);
    } catch {
      // Audio playback best-effort
    }
  }, []);

  // Add Station Modal state
  const [stationModalOpen, setStationModalOpen] = useState(false);
  const [stationCode, setStationCode] = useState('');
  const [stationName, setStationName] = useState('');
  const [description, setDescription] = useState('');
  const [colorHex, setColorHex] = useState('#DE8626');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentRestId) return;
    try {
      setLoading(true);
      const [stList, ordList] = await Promise.allSettled([
        WebKitchenService.getStations(currentRestId),
        orderDataSource.getTodayOrders(currentRestId, 'ALL', 1, 100),
      ]);

      if (stList.status === 'fulfilled') {
        setStations(stList.value);
      }
      if (ordList.status === 'fulfilled' && ordList.value?.items) {
        const openOrders = ordList.value.items.filter((o) => {
          const st = (o.status || '').toUpperCase();
          return !isOrderCanonicalSettled(o) && st !== 'CANCELLED' && st !== 'COMPLETED';
        });
        setAllOpenOrders(openOrders);
      }
    } catch (err) {
      console.warn('Failed to load kitchen data', err);
    } finally {
      setLoading(false);
    }
  }, [currentRestId]);

  useEffect(() => {
    loadData();

    if (currentRestId) {
      startPosSignalRConnection(currentRestId).catch(() => {});
      const unsub1 = onPosOrderCreated(() => {
        if (soundEnabled) playKitchenChime();
        loadData();
      });
      const unsub2 = onPosOrderStatusChanged(() => loadData());
      const unsub3 = onKitchenStatusChanged(() => loadData());
      const unsub4 = onPosOrderSettled(() => loadData());
      const unsub5 = onSignalRReconnected(() => loadData());

      const interval = setInterval(loadData, 20000);
      return () => {
        clearInterval(interval);
        unsub1();
        unsub2();
        unsub3();
        unsub4();
        unsub5();
      };
    }
  }, [currentRestId, loadData, playKitchenChime, soundEnabled]);

  const handleUpdateStatus = async (orderId: number, nextStatus: string) => {
    try {
      setUpdatingOrderId(orderId);
      await orderDataSource.updateOrderStatus(orderId, nextStatus);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to update order status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handlePrintKot = async (order: OrderMaster) => {
    try {
      setPrintingOrderId(order.id);
      const items = Array.isArray(order.items) ? order.items : [];
      await WebPrinterService.printStationKots(
        {
          orderId: order.id,
          orderNumber: String(order.orderNumber || order.id),
          pickupToken: String(order.pickupToken || order.tokenNumber || order.id),
          restaurantName: activeRestaurant?.restaurantName || 'Menza Kitchen',
          tableName: order.tableName,
          orderType: order.orderTypeName,
          customerName: order.customerName,
          items: items.map((i) => ({
            itemName: i.itemName,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            cookingInstruction: i.cookingInstruction,
            stationName: i.stationName,
            stationCode: i.stationCode,
          })),
          grandTotal: order.totalAmount,
          date: order.createdAt || new Date(),
        },
        paperWidth
      );
    } catch (err: any) {
      alert(err?.message || 'Failed to print KOT');
    } finally {
      setPrintingOrderId(null);
    }
  };

  // Helper to normalize station code for an item
  const getItemStationCode = useCallback((it: any): string => {
    return String(it?.stationCode || 'MAIN').trim().toUpperCase();
  }, []);

  // Classify order stage
  const getOrderStage = useCallback((status?: string): 'NEW' | 'PREPARING' | 'READY' | 'SERVED' => {
    const st = (status || '').toUpperCase();
    if (st === 'SERVED' || st === 'DELIVERED') return 'SERVED';
    if (st === 'READY') return 'READY';
    if (st === 'PREPARING' || st === 'COOKING') return 'PREPARING';
    return 'NEW';
  }, []);

  // Format token cleanly (e.g. TK-01, TK-12, or #14)
  const formatTokenNumber = useCallback((order: OrderMaster): string => {
    const raw = order.pickupToken || order.tokenNumber || String(order.id);
    const rawStr = String(raw).trim();
    if (/^TK-/i.test(rawStr)) return rawStr.toUpperCase();
    const num = parseInt(rawStr, 10);
    if (!isNaN(num) && num > 0) return `TK-${String(num).padStart(2, '0')}`;
    return rawStr.toUpperCase();
  }, []);

  // Orders currently in kitchen preparation (excluding already served/delivered unless SERVED filter is selected)
  const kitchenQueueOrders = useMemo(
    () => allOpenOrders.filter((o) => getOrderStage(o.status) !== 'SERVED'),
    [allOpenOrders, getOrderStage]
  );

  // Stage counts
  const stageCounts = useMemo(() => {
    let newCount = 0;
    let preparingCount = 0;
    let readyCount = 0;
    let servedCount = 0;
    allOpenOrders.forEach((o) => {
      const stage = getOrderStage(o.status);
      if (stage === 'NEW') newCount++;
      else if (stage === 'PREPARING') preparingCount++;
      else if (stage === 'READY') readyCount++;
      else if (stage === 'SERVED') servedCount++;
    });
    return {
      activeKitchen: newCount + preparingCount + readyCount,
      newCount,
      preparingCount,
      readyCount,
      servedCount,
    };
  }, [allOpenOrders, getOrderStage]);

  // Dynamically group stations from active orders & configured master
  const availableStations = useMemo(() => {
    const baseOrders = stageFilter === 'SERVED' ? allOpenOrders : kitchenQueueOrders;
    const list: Array<{ code: string; name: string; color: string; count: number }> = [
      { code: 'ALL', name: 'All Stations', color: '#DE8626', count: baseOrders.length },
    ];
    const stationMap = new Map<string, { code: string; name: string; color: string }>();

    stations.forEach((st) => {
      if (st.isActive === false) return;
      const c = st.stationCode.trim().toUpperCase();
      stationMap.set(c, {
        code: c,
        name: st.stationName,
        color: st.colorHex || '#DE8626',
      });
    });

    baseOrders.forEach((o) => {
      (o.items || []).forEach((it) => {
        const c = getItemStationCode(it);
        if (!stationMap.has(c)) {
          stationMap.set(c, {
            code: c,
            name: it.stationName || (c === 'MAIN' ? 'Main Kitchen' : c),
            color: it.stationBadgeColor || '#DE8626',
          });
        }
      });
    });

    stationMap.forEach((meta) => {
      const count = baseOrders.filter((o) =>
        (o.items || []).some(
          (it) =>
            getItemStationCode(it) === meta.code ||
            (it.stationName || '').trim().toUpperCase() === meta.name.trim().toUpperCase()
        )
      ).length;
      list.push({ ...meta, count });
    });

    return list;
  }, [allOpenOrders, kitchenQueueOrders, stageFilter, stations, getItemStationCode]);

  // Filter orders by stage, chosen kitchen station, and search query
  const filteredOrders = useMemo(() => {
    return allOpenOrders.filter((order) => {
      const stage = getOrderStage(order.status);
      if (stageFilter === 'ACTIVE_KITCHEN' && stage === 'SERVED') return false;
      if (stageFilter !== 'ACTIVE_KITCHEN' && stage !== stageFilter) return false;

      const items = Array.isArray(order.items) ? order.items : [];
      if (selectedStationCode !== 'ALL') {
        const matchesStation = items.some(
          (it) =>
            getItemStationCode(it) === selectedStationCode.toUpperCase() ||
            (it.stationName || '').trim().toUpperCase() === selectedStationCode.toUpperCase()
        );
        if (!matchesStation) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchOrder =
          String(order.id).includes(q) ||
          (order.orderNumber || '').toLowerCase().includes(q) ||
          (order.tableName || '').toLowerCase().includes(q) ||
          (order.customerName || '').toLowerCase().includes(q) ||
          formatTokenNumber(order).toLowerCase().includes(q) ||
          items.some((it) => (it.itemName || '').toLowerCase().includes(q));
        if (!matchOrder) return false;
      }

      return true;
    });
  }, [allOpenOrders, stageFilter, selectedStationCode, searchQuery, getOrderStage, getItemStationCode, formatTokenNumber]);

  const getNextStatus = (order: OrderMaster) => {
    const recommended = getNextRecommendedStatus(order.status, order.orderTypeName, order.tableId);
    if (recommended) {
      if (recommended.nextStatus === OrderStatuses.Settled) {
        const isDineIn =
          Boolean(order.tableId) ||
          (order.orderTypeName &&
            ['DINE-IN', 'DINE_IN', 'TABLE'].includes(order.orderTypeName.toUpperCase()));
        return isDineIn ? OrderStatuses.Served : OrderStatuses.Delivered;
      }
      return recommended.nextStatus;
    }
    return OrderStatuses.Preparing;
  };

  const handleBumpOrder = useCallback(
    async (order: OrderMaster) => {
      const nextStatus = getNextStatus(order);
      await handleUpdateStatus(order.id, nextStatus);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // KDS Bump Bar Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') return;

      if (e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key, 10) - 1;
        if (filteredOrders[index]) {
          e.preventDefault();
          handleBumpOrder(filteredOrders[index]);
        }
        return;
      }

      if (e.code === 'Space' || e.key === 'Enter') {
        if (filteredOrders[0]) {
          e.preventDefault();
          handleBumpOrder(filteredOrders[0]);
        }
        return;
      }

      if (e.key.toLowerCase() === 'p') {
        if (filteredOrders[0]) {
          e.preventDefault();
          handlePrintKot(filteredOrders[0]);
        }
        return;
      }

      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        loadData();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredOrders, handleBumpOrder, loadData, toggleFullscreen]);

  const handleCreateStation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stationName.trim() || !stationCode.trim()) {
      alert('Please fill in Station Name and Code.');
      return;
    }

    try {
      setIsSubmitting(true);
      const model: CreateKitchenStationModel = {
        restaurantId: currentRestId,
        stationCode: stationCode.trim().toUpperCase(),
        stationName: stationName.trim(),
        description: description.trim() || undefined,
        colorHex,
        isKdsEnabled: true,
      };

      await WebKitchenService.createStation(model);
      await loadData();
      setStationCode('');
      setStationName('');
      setDescription('');
      setStationModalOpen(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to create kitchen station');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInitDefaults = async () => {
    if (
      confirm(
        'Initialize standard kitchen stations (Main Kitchen, Tandoor & Grill, Bakery, Bar, Pantry)?'
      )
    ) {
      try {
        setLoading(true);
        await WebKitchenService.initializeDefaults(currentRestId);
        await loadData();
      } catch (err: any) {
        alert(err?.message || 'Failed to initialize default stations');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleToggleStatus = async (station: KitchenStationDTO) => {
    try {
      const newActive = !station.isActive;
      await WebKitchenService.toggleStationStatus(station.id, newActive);
      setStations((prev) =>
        prev.map((s) => (s.id === station.id ? { ...s, isActive: newActive } : s))
      );
    } catch (err: any) {
      alert(err?.message || 'Failed to toggle station');
    }
  };

  const handleDeleteStation = async (id: number) => {
    if (confirm('Are you sure you want to delete this kitchen station?')) {
      try {
        await WebKitchenService.deleteStation(id);
        setStations((prev) => prev.filter((s) => s.id !== id));
      } catch (err: any) {
        alert(err?.message || 'Failed to delete station');
      }
    }
  };

  const toggleItemChecked = (orderId: number, itemIdx: number) => {
    const key = `${orderId}_${itemIdx}`;
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Responsive Grid Class based on density preference
  const gridLayoutClass = useMemo(() => {
    switch (density) {
      case 'focus':
        return 'grid grid-cols-1 md:grid-cols-2 gap-5';
      case 'compact':
        return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5';
      case 'comfortable':
      default:
        return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
    }
  }, [density]);

  return (
    <AuthGuard>
      <AppShell>
        <FeatureGate feature="kitchenRouting" title="Kitchen Display System (KDS)" planSuggestion="Enterprise or KDS Add-On">
          <div className="p-3 sm:p-5 lg:p-7 space-y-4 max-w-[1600px] mx-auto min-h-screen">
            {/* 1. Header Toolbar */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 bg-white dark:bg-[#1B2127] rounded-3xl p-4 sm:p-5 border border-[#E7E1DA] dark:border-[#2B3540] shadow-xs">
              <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#DE8626]/10 text-[#DE8626] border border-[#DE8626]/20 shadow-xs">
                  <ChefHat className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                      Kitchen Display System
                    </h1>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 text-xs font-bold text-[#DE8626] whitespace-nowrap">
                      <span className="h-2 w-2 rounded-full bg-[#DE8626] animate-pulse" />
                      {stageCounts.activeKitchen} Active Tickets
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-black/5 dark:bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-[#667085] dark:text-[#94A3B8]">
                      {stations.length || availableStations.length - 1} Stations
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs sm:text-sm text-[#667085] dark:text-[#94A3B8] truncate">
                    Real-time KOT preparation queue, station routing & bump-bar line control
                  </p>
                </div>
              </div>

              {/* Controls & Quick Actions */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {/* Density Switcher */}
                <div className="hidden sm:flex items-center rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-0.5">
                  <button
                    type="button"
                    onClick={() => changeDensity('focus')}
                    title="Focus View (2 Columns - Large display / Tablet)"
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      density === 'focus'
                        ? 'bg-white dark:bg-[#1B2127] text-[#DE8626] shadow-xs'
                        : 'text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
                    }`}
                  >
                    Large
                  </button>
                  <button
                    type="button"
                    onClick={() => changeDensity('comfortable')}
                    title="Comfortable View (3 Columns - Recommended)"
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      density === 'comfortable'
                        ? 'bg-white dark:bg-[#1B2127] text-[#DE8626] shadow-xs'
                        : 'text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
                    }`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => changeDensity('compact')}
                    title="Compact View (4 Columns - Dense high volume)"
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      density === 'compact'
                        ? 'bg-white dark:bg-[#1B2127] text-[#DE8626] shadow-xs'
                        : 'text-[#667085] hover:text-[#1E2930] dark:hover:text-[#F3F4F6]'
                    }`}
                  >
                    Compact
                  </button>
                </div>

                {/* Sound Chime Toggle & Test */}
                <div className="flex items-center rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setSoundEnabled((prev) => !prev);
                      if (!soundEnabled) playKitchenChime();
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-all ${
                      soundEnabled
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'text-[#667085] hover:bg-black/5'
                    }`}
                    title={soundEnabled ? 'Kitchen Chime Active (Click to Mute)' : 'Kitchen Chime Muted (Click to Unmute)'}
                  >
                    {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                    <span>{soundEnabled ? 'Chime ON' : 'Muted'}</span>
                  </button>
                  {soundEnabled && (
                    <button
                      type="button"
                      onClick={playKitchenChime}
                      title="Test Audio Chime"
                      className="px-2 py-2 border-l border-[#E7E1DA] dark:border-[#2B3540] text-[10px] font-bold text-[#667085] hover:text-[#DE8626] hover:bg-black/5"
                    >
                      Test
                    </button>
                  )}
                </div>

                {/* Fullscreen Button */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? 'Exit Fullscreen (Press F)' : 'Enter Fullscreen (Press F)'}
                  className="flex items-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3 py-2 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4 text-[#DE8626]" /> : <Maximize2 className="h-4 w-4 text-[#DE8626]" />}
                  <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Full'}</span>
                </button>

                {/* Stations Drawer */}
                <button
                  type="button"
                  onClick={() => setManageStationsOpen((prev) => !prev)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                    manageStationsOpen
                      ? 'border-[#DE8626] bg-[#DE8626]/10 text-[#DE8626]'
                      : 'border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <Settings2 className="h-4 w-4 text-[#DE8626]" />
                  <span>Stations ({stations.length})</span>
                </button>

                {/* Refresh */}
                <button
                  type="button"
                  onClick={loadData}
                  disabled={loading}
                  title="Refresh Queue (Press R)"
                  className="flex items-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3 py-2 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>

                {/* Add Station */}
                <button
                  type="button"
                  onClick={() => setStationModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-[#DE8626] px-3.5 py-2 text-xs font-black text-white shadow-sm hover:bg-[#C4721C] transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>New Station</span>
                </button>
              </div>
            </div>

            {/* 2. Live Kitchen Stage Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {loading && allOpenOrders.length === 0 ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-4 animate-pulse space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="h-3 w-28 rounded bg-black/10 dark:bg-white/10" />
                      <div className="h-8 w-8 rounded-xl bg-black/10 dark:bg-white/10" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <div className="h-8 w-14 rounded-lg bg-black/10 dark:bg-white/10" />
                      <div className="h-3 w-16 rounded bg-black/10 dark:bg-white/10" />
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setStageFilter('ACTIVE_KITCHEN')}
                    className={`text-left rounded-3xl border p-4 transition-all ${
                      stageFilter === 'ACTIVE_KITCHEN'
                        ? 'border-[#DE8626] bg-[#DE8626]/[0.08] ring-1 ring-[#DE8626]/40 shadow-sm'
                        : 'border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] hover:border-[#DE8626]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-wider text-[#667085] dark:text-[#94A3B8]">
                        Active Kitchen Queue
                      </span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-[#DE8626]">
                        <ChefHat className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl sm:text-3xl font-black text-[#1E2930] dark:text-[#F3F4F6]">
                        {stageCounts.activeKitchen}
                      </span>
                      <span className="text-xs font-semibold text-[#667085]">tickets in prep</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStageFilter('NEW')}
                    className={`text-left rounded-3xl border p-4 transition-all ${
                      stageFilter === 'NEW'
                        ? 'border-rose-500 bg-rose-500/[0.08] ring-1 ring-rose-500/40 shadow-sm'
                        : 'border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] hover:border-rose-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-wider text-[#667085] dark:text-[#94A3B8]">
                        New / Placed
                      </span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                        <Bell className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl sm:text-3xl font-black text-[#1E2930] dark:text-[#F3F4F6]">
                        {stageCounts.newCount}
                      </span>
                      <span className="text-xs text-rose-600 dark:text-rose-400 font-bold">
                        awaiting fire
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStageFilter('PREPARING')}
                    className={`text-left rounded-3xl border p-4 transition-all ${
                      stageFilter === 'PREPARING'
                        ? 'border-amber-500 bg-amber-500/[0.08] ring-1 ring-amber-500/40 shadow-sm'
                        : 'border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] hover:border-amber-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-wider text-[#667085] dark:text-[#94A3B8]">
                        Cooking Now
                      </span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
                        <Flame className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl sm:text-3xl font-black text-[#1E2930] dark:text-[#F3F4F6]">
                        {stageCounts.preparingCount}
                      </span>
                      <span className="text-xs text-amber-600 font-bold">on ranges/grills</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStageFilter('READY')}
                    className={`text-left rounded-3xl border p-4 transition-all ${
                      stageFilter === 'READY'
                        ? 'border-emerald-500 bg-emerald-500/[0.08] ring-1 ring-emerald-500/40 shadow-sm'
                        : 'border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] hover:border-emerald-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-wider text-[#667085] dark:text-[#94A3B8]">
                        Ready on Pass
                      </span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl sm:text-3xl font-black text-[#1E2930] dark:text-[#F3F4F6]">
                        {stageCounts.readyCount}
                      </span>
                      <span className="text-xs text-emerald-600 font-bold">ready for pickup</span>
                    </div>
                  </button>
                </>
              )}
            </div>

            {/* 3. Collapsible Station Management Drawer */}
            {manageStationsOpen && (
              <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-5 shadow-sm space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-[#1E2930] dark:text-[#F3F4F6]">
                      Configured Kitchen Stations ({stations.length})
                    </h3>
                    <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                      Configure station codes, color routing accents, and manage active line stations
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {stations.length === 0 && (
                      <button
                        type="button"
                        onClick={handleInitDefaults}
                        className="flex items-center gap-1.5 rounded-xl border border-[#DE8626] bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-[#DE8626] hover:bg-amber-500/20"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Initialize Default Stations</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setStationModalOpen(true)}
                      className="flex items-center gap-1 rounded-xl bg-[#DE8626] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#C4721C]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Station</span>
                    </button>
                  </div>
                </div>

                {stations.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#E7E1DA] dark:border-[#2B3540] p-6 text-center text-xs text-[#667085]">
                    No custom stations configured yet. Click <strong>Initialize Default Stations</strong> to create Main Kitchen, Tandoor &amp; Grill, Bakery, Bar, and Pantry.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                    {stations.map((st) => (
                      <div
                        key={st.id}
                        className={`rounded-2xl border p-3 transition-all ${
                          st.isActive
                            ? 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20]'
                            : 'border-gray-200 dark:border-gray-800 bg-gray-100/60 dark:bg-gray-900/40 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: st.colorHex || '#DE8626' }}
                            />
                            <span className="text-[10px] font-mono font-black uppercase text-[#667085]">
                              {st.stationCode}
                            </span>
                          </span>
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(st)}
                              title={st.isActive ? 'Pause Station' : 'Activate Station'}
                              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5"
                            >
                              <Power
                                className={`h-3 w-3 ${
                                  st.isActive ? 'text-emerald-500' : 'text-gray-400'
                                }`}
                              />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStation(st.id)}
                              title="Delete Station"
                              className="p-1 rounded text-[#667085] hover:text-red-500 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <h4 className="text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] truncate">
                          {st.stationName}
                        </h4>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 4. Unified Station Filter Tabs + Search & Stage Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-[#1B2127] rounded-3xl p-3 sm:p-4 border border-[#E7E1DA] dark:border-[#2B3540] shadow-xs">
              {/* Station Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
                {loading && stations.length === 0 ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-8 w-24 rounded-2xl bg-black/10 dark:bg-white/10 shrink-0 animate-pulse"
                    />
                  ))
                ) : (
                  availableStations.map((st) => {
                    const isSelected = selectedStationCode.toUpperCase() === st.code.toUpperCase();
                    return (
                      <button
                        key={st.code}
                        type="button"
                        onClick={() => setSelectedStationCode(st.code)}
                        className={`flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                          isSelected
                            ? 'bg-[#1E2930] dark:bg-[#F3F4F6] text-white dark:text-[#1E2930] shadow-xs'
                            : 'border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#667085] hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: st.color }}
                        />
                        <span>{st.name}</span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                            isSelected
                              ? 'bg-white/20 dark:bg-black/20 text-white dark:text-[#1E2930]'
                              : 'bg-black/5 dark:bg-white/5 text-[#667085]'
                          }`}
                        >
                          {st.count}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Search + Served Toggle */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#667085]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Token, Order #, Table, Dish..."
                    className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] pl-8 pr-7 py-2 text-xs text-[#1E2930] dark:text-[#F3F4F6] placeholder-[#667085] outline-none focus:border-[#DE8626]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#667085] hover:text-[#1E2930]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setStageFilter((prev) => (prev === 'SERVED' ? 'ACTIVE_KITCHEN' : 'SERVED'))
                  }
                  className={`rounded-2xl border px-3.5 py-2 text-xs font-bold whitespace-nowrap transition-colors ${
                    stageFilter === 'SERVED'
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#667085] hover:bg-black/5'
                  }`}
                >
                  Served History ({stageCounts.servedCount})
                </button>
              </div>
            </div>

            {/* 5. Bump Bar Shortcuts & SLA Legend Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white/70 dark:bg-[#1B2127]/70 px-4 py-2.5 text-xs backdrop-blur-sm">
              <div className="flex flex-wrap items-center gap-1.5 text-[#667085] dark:text-[#94A3B8]">
                <Keyboard className="h-4 w-4 text-[#DE8626] mr-0.5" />
                <span className="font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">Shortcuts:</span>
                <kbd className="rounded-md border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-1.5 py-0.5 font-mono text-[10px] font-black text-[#1E2930] dark:text-[#F3F4F6]">
                  Space
                </kbd>
                <span>Bump Next</span>
                <span className="mx-1 opacity-30">•</span>
                <kbd className="rounded-md border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-1.5 py-0.5 font-mono text-[10px] font-black text-[#1E2930] dark:text-[#F3F4F6]">
                  P
                </kbd>
                <span>Print KOT</span>
                <span className="mx-1 opacity-30">•</span>
                <kbd className="rounded-md border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-1.5 py-0.5 font-mono text-[10px] font-black text-[#1E2930] dark:text-[#F3F4F6]">
                  F
                </kbd>
                <span>Fullscreen</span>
                <span className="mx-1 opacity-30">•</span>
                <kbd className="rounded-md border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-1.5 py-0.5 font-mono text-[10px] font-black text-[#1E2930] dark:text-[#F3F4F6]">
                  R
                </kbd>
                <span>Refresh</span>
              </div>

              <div className="flex items-center gap-3 text-[11px] font-bold text-[#667085] dark:text-[#94A3B8]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> &lt;10m Fresh
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> 10–20m Warning
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" /> &gt;20m Delayed
                </span>
              </div>
            </div>

            {/* 6. Live Kitchen Order Tickets Grid */}
            {loading && allOpenOrders.length === 0 ? (
              <div className={gridLayoutClass}>
                {Array.from({ length: density === 'compact' ? 8 : 6 }).map((_, idx) => (
                  <KdsTicketSkeleton key={idx} />
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-12 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-3xl bg-[#DE8626]/10 text-[#DE8626] border border-[#DE8626]/20">
                  <ChefHat className="h-7 w-7" />
                </div>
                <h3 className="text-base font-black text-[#1E2930] dark:text-[#F3F4F6]">
                  {selectedStationCode === 'ALL'
                    ? 'Kitchen queue is all clear!'
                    : `No tickets queued for ${selectedStationCode}`}
                </h3>
                <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1.5 max-w-md mx-auto leading-relaxed">
                  {selectedStationCode === 'ALL'
                    ? 'No orders are waiting in this preparation stage. New POS counter or QR dine-in tickets will arrive automatically with an audio chime.'
                    : `No active tickets contain dishes routed to station ${selectedStationCode}. Switch station tabs above or check All Stations.`}
                </p>
              </div>
            ) : (
              <div className={gridLayoutClass}>
                {filteredOrders.map((order, orderIdx) => {
                  const items = Array.isArray(order.items) ? order.items : [];
                  const parsedCreated = order.createdAt ? parseUtcDate(order.createdAt) : new Date();
                  const timeFormatted = order.createdAt ? formatToIstTime(order.createdAt) : '';
                  const elapsedMins = Math.max(
                    0,
                    Math.floor((nowTick - parsedCreated.getTime()) / 60000)
                  );

                  const stage = getOrderStage(order.status);
                  const isPreparing = stage === 'PREPARING';
                  const isReady = stage === 'READY';
                  const isServed = stage === 'SERVED';

                  const isOverdue = !isReady && !isServed && elapsedMins >= 20;
                  const isWarning = !isReady && !isServed && elapsedMins >= 10 && elapsedMins < 20;
                  const nextStatus = getNextStatus(order);
                  const totalQty = items.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);

                  // Distinct Token formatting
                  const tokenDisplay = formatTokenNumber(order);

                  // Fulfillment Mode Detection
                  const isDineIn =
                    Boolean(order.tableId) ||
                    (order.orderTypeName &&
                      ['DINE-IN', 'DINE_IN', 'TABLE'].includes(order.orderTypeName.toUpperCase()));
                  const isTakeaway =
                    order.orderTypeName &&
                    ['TAKEAWAY', 'SELF_PICKUP', 'PICKUP', 'COUNTER'].includes(
                      order.orderTypeName.toUpperCase()
                    );
                  const isDelivery =
                    order.orderTypeName &&
                    ['DELIVERY', 'ONLINE'].includes(order.orderTypeName.toUpperCase());

                  // Station Breakdown for this ticket (Zero overlap with token!)
                  const orderStations = (() => {
                    const map = new Map<string, { code: string; name: string; color: string }>();
                    items.forEach((it) => {
                      const code = getItemStationCode(it);
                      const name = it.stationName || (code === 'MAIN' ? 'Main Kitchen' : code);
                      const color = it.stationBadgeColor || '#DE8626';
                      if (!map.has(code)) {
                        map.set(code, { code, name, color });
                      }
                    });
                    return Array.from(map.values());
                  })();

                  // Items checked tally
                  const checkedCount = items.filter((_, idx) =>
                    Boolean(checkedItems[`${order.id}_${idx}`])
                  ).length;
                  const isAllChecked = items.length > 0 && checkedCount === items.length;

                  return (
                    <div
                      key={order.id}
                      className={`rounded-3xl border overflow-hidden flex flex-col justify-between transition-all shadow-sm hover:shadow-md bg-white dark:bg-[#1B2127] ${
                        isOverdue
                          ? 'border-rose-500/80 ring-2 ring-rose-500/25'
                          : isReady
                          ? 'border-emerald-500/70 ring-1 ring-emerald-500/25'
                          : isPreparing
                          ? 'border-amber-500/70 ring-1 ring-amber-500/20'
                          : 'border-[#E7E1DA] dark:border-[#2B3540]'
                      }`}
                    >
                      {/* TICKET HEADER: Two Un-crowded, High-Contrast Rows */}
                      <div
                        className={`px-4 py-3.5 border-b transition-colors ${
                          isOverdue
                            ? 'bg-rose-500/10 border-rose-500/20'
                            : isReady
                            ? 'bg-emerald-500/10 border-emerald-500/20'
                            : isPreparing
                            ? 'bg-amber-500/10 border-amber-500/20'
                            : 'bg-[#FAF7F2] dark:bg-[#151A20] border-[#E7E1DA] dark:border-[#2B3540]'
                        }`}
                      >
                        {/* Row 1: Service Destination Badge and SLA Status Pill */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span
                              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider ${
                                isDineIn
                                  ? 'bg-amber-500/15 text-[#DE8626] border border-amber-500/30'
                                  : isTakeaway
                                  ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30'
                                  : isDelivery
                                  ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                                  : 'bg-gray-500/15 text-gray-700 dark:text-gray-300 border border-gray-500/30'
                              }`}
                            >
                              <UtensilsCrossed className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[140px]">
                                {order.tableName || order.orderTypeName || 'Counter'}
                              </span>
                            </span>
                          </div>

                          {/* SLA Elapsed Timer Pill + Order Status */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                                isOverdue
                                  ? 'bg-rose-600 text-white animate-pulse shadow-xs shadow-rose-600/30'
                                  : isWarning
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {isOverdue ? (
                                <AlertTriangle className="h-3 w-3" />
                              ) : (
                                <Clock className="h-3 w-3" />
                              )}
                              <span>{elapsedMins < 1 ? 'Just now' : `${elapsedMins}m`}</span>
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                                isReady
                                  ? 'bg-emerald-600 text-white'
                                  : isPreparing
                                  ? 'bg-amber-500 text-white'
                                  : isServed
                                  ? 'bg-gray-500 text-white'
                                  : 'bg-[#1E2930] dark:bg-[#F3F4F6] text-white dark:text-[#1E2930]'
                              }`}
                            >
                              {order.status}
                            </span>
                          </div>
                        </div>

                        {/* Row 2: Distinct High-Contrast Token Badge, Order ID, and Dedicated Station Badges */}
                        <div className="mt-2.5 pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-2">
                          {/* Token Badge & Order Number */}
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="inline-flex items-center gap-1 rounded-lg bg-[#DE8626]/15 dark:bg-[#DE8626]/25 border border-[#DE8626]/35 px-2 py-0.5 shadow-2xs">
                              <Tag className="h-3 w-3 text-[#DE8626]" />
                              <span className="font-mono font-black text-xs text-[#DE8626] tracking-tight">
                                {tokenDisplay}
                              </span>
                            </div>
                            <span className="text-[11px] font-bold text-[#667085] dark:text-[#94A3B8] truncate">
                              Order #{order.id}
                            </span>
                            <span className="text-[10px] text-[#667085] dark:text-[#94A3B8] hidden sm:inline">
                              • {timeFormatted}
                            </span>
                          </div>

                          {/* Routed Stations - Clean, Dedicated Badges with zero overlap */}
                          <div className="flex items-center gap-1 flex-wrap justify-end">
                            {orderStations.map((st) => (
                              <span
                                key={st.code}
                                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide border shadow-2xs"
                                style={{
                                  backgroundColor: `${st.color}15`,
                                  borderColor: `${st.color}35`,
                                  color: st.color,
                                }}
                                title={`Routed to: ${st.name}`}
                              >
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ backgroundColor: st.color }}
                                />
                                {st.code}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* TICKET BODY: Items List with Inline Station Tags */}
                      <div className="p-4 space-y-2.5 flex-1 divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60 max-h-80 overflow-y-auto">
                        {items.length === 0 ? (
                          <div className="py-6 text-center text-xs text-[#667085] italic">
                            Order #{order.id} • Standard Kitchen Preparation
                          </div>
                        ) : (
                          items.map((it, idx) => {
                            const itemStation = getItemStationCode(it);
                            const matchesCurrentStation =
                              selectedStationCode === 'ALL' ||
                              itemStation === selectedStationCode.toUpperCase() ||
                              (it.stationName || '').trim().toUpperCase() ===
                                selectedStationCode.toUpperCase();
                            const isChecked = Boolean(checkedItems[`${order.id}_${idx}`]);

                            return (
                              <div
                                key={idx}
                                onClick={() => toggleItemChecked(order.id, idx)}
                                className={`pt-2.5 first:pt-0 flex items-start gap-2.5 cursor-pointer select-none transition-opacity ${
                                  !matchesCurrentStation ? 'opacity-35' : ''
                                }`}
                              >
                                {/* Tactile Checkbox */}
                                <span
                                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold transition-all ${
                                    isChecked
                                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                                      : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-transparent hover:border-[#DE8626]'
                                  }`}
                                >
                                  <Check className="h-3 w-3 stroke-[3]" />
                                </span>

                                {/* Big Multiplier */}
                                <span className="font-black text-[#DE8626] text-sm min-w-[28px] pt-0.5">
                                  {it.quantity}×
                                </span>

                                {/* Item Name, Inline Station Badge & Note */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p
                                      className={`text-xs sm:text-sm font-bold leading-snug ${
                                        isChecked
                                          ? 'line-through text-[#667085] dark:text-[#94A3B8]'
                                          : 'text-[#1E2930] dark:text-[#F3F4F6]'
                                      }`}
                                    >
                                      {it.itemName}
                                    </p>
                                    {(it.stationName || itemStation) && (
                                      <span
                                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider"
                                        style={{
                                          backgroundColor: `${it.stationBadgeColor || '#DE8626'}18`,
                                          color: it.stationBadgeColor || '#DE8626',
                                        }}
                                      >
                                        <span
                                          className="h-1 w-1 rounded-full"
                                          style={{ backgroundColor: it.stationBadgeColor || '#DE8626' }}
                                        />
                                        {it.stationName || itemStation}
                                      </span>
                                    )}
                                  </div>

                                  {/* Custom Cooking Instruction / Chef Note */}
                                  {it.cookingInstruction && (
                                    <div className="mt-1 flex items-start gap-1 rounded-lg bg-amber-500/10 border border-amber-500/25 px-2 py-1 text-[11px] font-bold text-amber-900 dark:text-amber-200">
                                      <Sparkles className="h-3 w-3 shrink-0 text-amber-600 mt-0.5" />
                                      <span>Note: {it.cookingInstruction}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* TICKET FOOTER: Summary Bar & Large Tactile Bump Button */}
                      <div className="p-3.5 border-t border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/80 dark:bg-[#151A20]/80 space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[#667085] dark:text-[#94A3B8] font-medium truncate max-w-[130px]">
                              {order.customerName || 'Walk-in Guest'}
                            </span>
                            <span className="text-[#667085] dark:text-[#94A3B8]">•</span>
                            <span
                              className={`text-[11px] font-bold ${
                                isAllChecked
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-[#667085] dark:text-[#94A3B8]'
                              }`}
                            >
                              {checkedCount > 0
                                ? `${checkedCount}/${items.length} plated`
                                : `${totalQty} ${totalQty === 1 ? 'item' : 'items'}`}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handlePrintKot(order)}
                            disabled={printingOrderId === order.id}
                            title="Print KOT Slip (Press P)"
                            className="flex items-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-2.5 py-1 text-[11px] font-bold text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626] hover:text-[#DE8626] disabled:opacity-50 transition-colors shadow-2xs"
                          >
                            <Printer className="h-3.5 w-3.5 text-[#DE8626]" />
                            <span>{printingOrderId === order.id ? 'Printing...' : 'Print KOT'}</span>
                          </button>
                        </div>

                        {/* Large Full-Width Bump Button */}
                        {!isServed && (
                          <button
                            type="button"
                            onClick={() => handleBumpOrder(order)}
                            disabled={updatingOrderId === order.id}
                            className={`w-full flex items-center justify-center gap-1.5 rounded-2xl py-3 px-3 text-xs font-black text-white shadow-sm transition-all disabled:opacity-50 active:scale-[0.98] ${
                              isReady
                                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25'
                                : isPreparing
                                ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/25'
                                : 'bg-[#DE8626] hover:bg-[#C4721C] shadow-amber-600/25'
                            }`}
                          >
                            <Zap className="h-3.5 w-3.5 fill-current" />
                            <span>
                              {updatingOrderId === order.id
                                ? 'Updating...'
                                : isReady
                                ? `MARK ${nextStatus.toUpperCase()}`
                                : isPreparing
                                ? 'MARK READY ON PASS'
                                : `START COOKING (${nextStatus.toUpperCase()})`}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Station Modal */}
          {stationModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="w-full max-w-md rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-[#DE8626]">
                      <ChefHat className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-[#1E2930] dark:text-[#F3F4F6]">
                        New Kitchen Station
                      </h3>
                      <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                        Route specific category/dishes to this kitchen prep area
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStationModalOpen(false)}
                    className="rounded-xl p-1 text-[#667085] hover:bg-black/5"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateStation} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-[#1E2930] dark:text-[#F3F4F6] mb-1">
                      Station Code (e.g. TAN, BAR, CURRY, PAN) *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={10}
                      value={stationCode}
                      onChange={(e) => setStationCode(e.target.value.toUpperCase())}
                      placeholder="TAN"
                      className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-3 font-mono uppercase font-black outline-none focus:border-[#DE8626]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#1E2930] dark:text-[#F3F4F6] mb-1">
                      Station Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={stationName}
                      onChange={(e) => setStationName(e.target.value)}
                      placeholder="e.g. Tandoor & Grill Station"
                      className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-3 font-bold outline-none focus:border-[#DE8626]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#1E2930] dark:text-[#F3F4F6] mb-1">
                      Description (Optional)
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Handles rotis, kebabs, tandoori starters"
                      className="w-full rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-3 outline-none focus:border-[#DE8626]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#1E2930] dark:text-[#F3F4F6] mb-1">
                      Color Theme Accent
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={colorHex}
                        onChange={(e) => setColorHex(e.target.value)}
                        className="h-10 w-16 rounded-xl cursor-pointer border border-[#E7E1DA]"
                      />
                      <span className="text-xs font-mono font-bold">{colorHex}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E7E1DA] dark:border-[#2B3540]">
                    <button
                      type="button"
                      onClick={() => setStationModalOpen(false)}
                      className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] px-4 py-2 text-xs font-bold text-[#667085]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-2xl bg-[#DE8626] px-5 py-2 text-xs font-black text-white shadow-md hover:bg-[#C4721C] disabled:opacity-50"
                    >
                      {isSubmitting ? 'Creating...' : 'Create Station'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </FeatureGate>
      </AppShell>
    </AuthGuard>
  );
}
