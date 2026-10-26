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
          items.some((it) => (it.itemName || '').toLowerCase().includes(q));
        if (!matchOrder) return false;
      }

      return true;
    });
  }, [allOpenOrders, stageFilter, selectedStationCode, searchQuery, getOrderStage, getItemStationCode]);

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

      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        loadData();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredOrders, handleBumpOrder, loadData]);

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

  return (
    <AuthGuard>
      <AppShell>
        <FeatureGate feature="kitchenRouting" title="Kitchen Display System (KDS)" planSuggestion="Enterprise or KDS Add-On">
        <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-7xl mx-auto">
          {/* 1. Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-[#DE8626] border border-amber-500/20">
                <ChefHat className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                    Kitchen Display System (KDS)
                  </h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-[#DE8626] whitespace-nowrap">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#DE8626] animate-pulse" />
                    {stageCounts.activeKitchen} Active • {stations.length || availableStations.length - 1} Stations
                  </span>
                </div>
                <p className="mt-0.5 text-xs sm:text-sm text-[#667085] dark:text-[#94A3B8]">
                  Live KOT preparation queue, station-wise dish routing, and bump-bar workflow
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSoundEnabled((prev) => !prev);
                  if (!soundEnabled) playKitchenChime();
                }}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                  soundEnabled
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#667085]'
                }`}
                title={soundEnabled ? 'Kitchen Chime Active (Click to Mute)' : 'Kitchen Chime Muted (Click to Unmute)'}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                <span>{soundEnabled ? 'Chime ON' : 'Muted'}</span>
              </button>

              <button
                type="button"
                onClick={() => setManageStationsOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                  manageStationsOpen
                    ? 'border-[#DE8626] bg-amber-500/10 text-[#DE8626]'
                    : 'border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <Settings2 className="h-4 w-4 text-[#DE8626]" />
                <span>Stations ({stations.length})</span>
              </button>

              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3 py-2 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={() => setStationModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-[#DE8626] px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#C4721C] transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>New Station</span>
              </button>
            </div>
          </div>

          {/* 2. Live Kitchen Stage Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setStageFilter('ACTIVE_KITCHEN')}
              className={`text-left rounded-2xl border p-3.5 transition-all ${
                stageFilter === 'ACTIVE_KITCHEN'
                  ? 'border-[#DE8626] bg-amber-500/[0.06] ring-1 ring-[#DE8626]/30 shadow-sm'
                  : 'border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] hover:border-[#DE8626]/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#667085] dark:text-[#94A3B8]">
                  Active Kitchen Queue
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/15 text-[#DE8626]">
                  <ChefHat className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6]">
                  {stageCounts.activeKitchen}
                </span>
                <span className="text-xs text-[#667085]">tickets on line</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStageFilter('NEW')}
              className={`text-left rounded-2xl border p-3.5 transition-all ${
                stageFilter === 'NEW'
                  ? 'border-rose-500 bg-rose-500/[0.06] ring-1 ring-rose-500/30 shadow-sm'
                  : 'border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] hover:border-rose-500/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#667085] dark:text-[#94A3B8]">
                  New / Placed
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <Bell className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6]">
                  {stageCounts.newCount}
                </span>
                <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                  awaiting fire
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStageFilter('PREPARING')}
              className={`text-left rounded-2xl border p-3.5 transition-all ${
                stageFilter === 'PREPARING'
                  ? 'border-amber-500 bg-amber-500/[0.06] ring-1 ring-amber-500/30 shadow-sm'
                  : 'border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] hover:border-amber-500/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#667085] dark:text-[#94A3B8]">
                  Cooking Now
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
                  <Flame className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6]">
                  {stageCounts.preparingCount}
                </span>
                <span className="text-xs text-amber-600 font-semibold">in preparation</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStageFilter('READY')}
              className={`text-left rounded-2xl border p-3.5 transition-all ${
                stageFilter === 'READY'
                  ? 'border-emerald-500 bg-emerald-500/[0.06] ring-1 ring-emerald-500/30 shadow-sm'
                  : 'border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] hover:border-emerald-500/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#667085] dark:text-[#94A3B8]">
                  Ready on Pass
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6]">
                  {stageCounts.readyCount}
                </span>
                <span className="text-xs text-emerald-600 font-semibold">ready for pickup</span>
              </div>
            </button>
          </div>

          {/* 3. Collapsible Station Management Drawer */}
          {manageStationsOpen && (
            <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1E2930] dark:text-[#F3F4F6]">
                    Configured Kitchen Stations ({stations.length})
                  </h3>
                  <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                    Toggle station availability or remove unused stations
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
                <div className="rounded-xl border border-dashed border-[#E7E1DA] dark:border-[#2B3540] p-6 text-center text-xs text-[#667085]">
                  No custom stations configured yet. Click <strong>Initialize Default Stations</strong> to create Main Kitchen, Tandoor &amp; Grill, Bakery, Bar, and Pantry.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                  {stations.map((st) => (
                    <div
                      key={st.id}
                      className={`rounded-xl border p-2.5 transition-all ${
                        st.isActive
                          ? 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20]'
                          : 'border-gray-200 dark:border-gray-800 bg-gray-100/60 dark:bg-gray-900/40 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: st.colorHex || '#DE8626' }}
                          />
                          <span className="text-[10px] font-mono font-bold uppercase text-[#667085]">
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
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#E7E1DA] dark:border-[#2B3540] pb-3">
            {/* Station Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
              {availableStations.map((st) => {
                const isSelected = selectedStationCode.toUpperCase() === st.code.toUpperCase();
                return (
                  <button
                    key={st.code}
                    type="button"
                    onClick={() => setSelectedStationCode(st.code)}
                    className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                      isSelected
                        ? 'bg-[#1E2930] dark:bg-[#F3F4F6] text-white dark:text-[#1E2930] shadow-sm'
                        : 'border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#667085] hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: st.color }}
                    />
                    <span>{st.name}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                        isSelected
                          ? 'bg-white/20 dark:bg-black/20 text-white dark:text-[#1E2930]'
                          : 'bg-black/5 dark:bg-white/5 text-[#667085]'
                      }`}
                    >
                      {st.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search + Served Toggle */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#667085]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Order #, Table, Dish..."
                  className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] pl-8 pr-7 py-2 text-xs text-[#1E2930] dark:text-[#F3F4F6] placeholder-[#667085] outline-none focus:border-[#DE8626]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#667085]"
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
                className={`rounded-xl border px-3 py-2 text-xs font-bold whitespace-nowrap transition-colors ${
                  stageFilter === 'SERVED'
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#667085] hover:bg-black/5'
                }`}
              >
                Served ({stageCounts.servedCount})
              </button>
            </div>
          </div>

          {/* 5. Compact KDS Bump Bar & SLA Legend Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white/80 dark:bg-[#1B2127]/80 px-4 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-1.5 text-[#667085] dark:text-[#94A3B8]">
              <Keyboard className="h-4 w-4 text-[#DE8626] mr-0.5" />
              <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">Shortcuts:</span>
              <kbd className="rounded border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                1-9
              </kbd>
              <span>Bump Ticket</span>
              <span className="mx-1 opacity-40">•</span>
              <kbd className="rounded border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                Space
              </kbd>
              <span>Bump Oldest</span>
              <span className="mx-1 opacity-40">•</span>
              <kbd className="rounded border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                P
              </kbd>
              <span>Print KOT</span>
              <span className="mx-1 opacity-40">•</span>
              <kbd className="rounded border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                R
              </kbd>
              <span>Refresh</span>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-semibold text-[#667085] dark:text-[#94A3B8]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> &lt;10m On-Time
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> 10–20m Warning
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> &gt;20m Delayed
              </span>
            </div>
          </div>

          {/* 6. Live Kitchen Order Tickets Grid */}
          {filteredOrders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-[#DE8626]">
                <ChefHat className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                {selectedStationCode === 'ALL'
                  ? 'Kitchen queue is all clear!'
                  : 'No tickets queued for this station'}
              </h3>
              <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1 max-w-md mx-auto">
                {selectedStationCode === 'ALL'
                  ? 'No active orders are waiting in this stage. New POS or QR orders will appear here automatically with a chime.'
                  : `No active tickets have dishes routed to ${selectedStationCode}. Switch station tabs above to view other queues.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-stretch">
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

                return (
                  <div
                    key={order.id}
                    className={`rounded-3xl border overflow-hidden flex flex-col justify-between transition-all shadow-sm hover:shadow-md bg-white dark:bg-[#1B2127] ${
                      isOverdue
                        ? 'border-rose-500/80 ring-1 ring-rose-500/25'
                        : isReady
                        ? 'border-emerald-500/70 ring-1 ring-emerald-500/20'
                        : isPreparing
                        ? 'border-amber-500/70'
                        : 'border-[#E7E1DA] dark:border-[#2B3540]'
                    }`}
                  >
                    {/* Ticket Header */}
                    <div
                      className={`px-4 py-3 border-b flex items-start justify-between gap-2 ${
                        isOverdue
                          ? 'bg-rose-500/10 border-rose-500/20'
                          : isReady
                          ? 'bg-emerald-500/10 border-emerald-500/20'
                          : isPreparing
                          ? 'bg-amber-500/10 border-amber-500/20'
                          : 'bg-[#FAF7F2] dark:bg-[#151A20] border-[#E7E1DA] dark:border-[#2B3540]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {orderIdx < 9 && (
                            <span className="rounded-md bg-[#1E2930] dark:bg-[#F3F4F6] px-1.5 py-0.5 font-mono text-[10px] font-black text-white dark:text-[#1E2930]">
                              Key {orderIdx + 1}
                            </span>
                          )}
                          <span className="rounded-md bg-[#DE8626]/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#DE8626]">
                            {order.tableName || order.orderTypeName || 'Counter'}
                          </span>
                        </div>
                        <div className="mt-1 flex items-baseline gap-2">
                          <h3 className="text-base font-black text-[#1E2930] dark:text-[#F3F4F6]">
                            Order #{order.id}
                          </h3>
                          {order.pickupToken && String(order.pickupToken) !== String(order.id) && (
                            <span className="text-[11px] font-bold text-[#667085]">
                              Token #{order.pickupToken}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex items-center justify-end gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                              isOverdue
                                ? 'bg-rose-600 text-white'
                                : isWarning
                                ? 'bg-amber-500 text-white'
                                : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {isOverdue ? (
                              <AlertTriangle className="h-3 w-3" />
                            ) : (
                              <Clock className="h-3 w-3" />
                            )}
                            <span>{elapsedMins < 1 ? 'Just now' : `${elapsedMins}m`}</span>
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-end gap-1.5">
                          <span className="text-[10px] text-[#667085] dark:text-[#94A3B8]">
                            {timeFormatted}
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
                    </div>

                    {/* Items List */}
                    <div className="p-4 space-y-2.5 flex-1 divide-y divide-[#E7E1DA]/60 dark:divide-[#2B3540]/60 max-h-72 overflow-y-auto">
                      {items.length === 0 ? (
                        <div className="py-4 text-center text-xs text-[#667085] italic">
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
                              className={`pt-2.5 first:pt-0 flex items-start justify-between gap-2 cursor-pointer select-none transition-opacity ${
                                !matchesCurrentStation ? 'opacity-40' : ''
                              }`}
                            >
                              <div className="flex items-start gap-2.5 min-w-0">
                                <span
                                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold transition-colors ${
                                    isChecked
                                      ? 'border-emerald-600 bg-emerald-600 text-white'
                                      : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-transparent'
                                  }`}
                                >
                                  <Check className="h-3 w-3" />
                                </span>
                                <span className="font-black text-[#DE8626] text-xs sm:text-sm min-w-[24px]">
                                  {it.quantity}×
                                </span>
                                <div className="min-w-0">
                                  <p
                                    className={`text-xs sm:text-sm font-bold leading-snug ${
                                      isChecked
                                        ? 'line-through text-[#667085]'
                                        : 'text-[#1E2930] dark:text-[#F3F4F6]'
                                    }`}
                                  >
                                    {it.itemName}
                                  </p>
                                  {it.cookingInstruction && (
                                    <p className="mt-0.5 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                                      Note: {it.cookingInstruction}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {(it.stationName || itemStation) && (
                                <span
                                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider"
                                  style={{
                                    backgroundColor: `${it.stationBadgeColor || '#DE8626'}18`,
                                    color: it.stationBadgeColor || '#DE8626',
                                  }}
                                >
                                  {it.stationName || itemStation}
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Footer & Bump Action */}
                    <div className="p-3.5 border-t border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2]/70 dark:bg-[#151A20]/70 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#667085] dark:text-[#94A3B8] font-medium truncate max-w-[150px]">
                          {order.customerName || 'Walk-in Guest'} • {totalQty} {totalQty === 1 ? 'item' : 'items'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handlePrintKot(order)}
                          disabled={printingOrderId === order.id}
                          title="Print KOT Slip (Shortcut: P)"
                          className="flex items-center gap-1 rounded-lg border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-2.5 py-1 text-[11px] font-bold text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626] hover:text-[#DE8626] disabled:opacity-50 transition-colors"
                        >
                          <Printer className="h-3 w-3 text-[#DE8626]" />
                          <span>{printingOrderId === order.id ? 'Printing...' : 'Print KOT'}</span>
                        </button>
                      </div>

                      {!isServed && (
                        <button
                          type="button"
                          onClick={() => handleBumpOrder(order)}
                          disabled={updatingOrderId === order.id}
                          className={`w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-3 text-xs font-black text-white shadow-sm transition-all disabled:opacity-50 ${
                            isReady
                              ? 'bg-emerald-600 hover:bg-emerald-700'
                              : isPreparing
                              ? 'bg-amber-600 hover:bg-amber-700'
                              : 'bg-[#DE8626] hover:bg-[#C4721C]'
                          }`}
                        >
                          <Zap className="h-3.5 w-3.5 fill-current" />
                          <span>
                            {updatingOrderId === order.id
                              ? 'Updating...'
                              : isReady
                              ? `MARK ${nextStatus.toUpperCase()} ${orderIdx < 9 ? `[${orderIdx + 1}]` : ''}`
                              : isPreparing
                              ? `MARK READY ON PASS ${orderIdx < 9 ? `[${orderIdx + 1}]` : ''}`
                              : `START COOKING (${nextStatus.toUpperCase()}) ${orderIdx < 9 ? `[${orderIdx + 1}]` : ''}`}
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
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-[#DE8626]">
                    <ChefHat className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                    New Kitchen Station
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setStationModalOpen(false)}
                  className="rounded-lg p-1 text-[#667085] hover:bg-black/5"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateStation} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold mb-1">
                    Station Code (e.g. TAN, BAR, CURRY) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={stationCode}
                    onChange={(e) => setStationCode(e.target.value.toUpperCase())}
                    placeholder="TAN"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-2.5 font-mono uppercase font-bold outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Station Name *</label>
                  <input
                    type="text"
                    required
                    value={stationName}
                    onChange={(e) => setStationName(e.target.value)}
                    placeholder="e.g. Tandoor & Grill Station"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-2.5 outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Handles rotis, kebabs, tandoori starters"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-2.5 outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Color Theme</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={colorHex}
                      onChange={(e) => setColorHex(e.target.value)}
                      className="h-10 w-14 rounded-lg cursor-pointer border border-[#E7E1DA]"
                    />
                    <span className="text-xs font-mono font-semibold">{colorHex}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E7E1DA] dark:border-[#2B3540]">
                  <button
                    type="button"
                    onClick={() => setStationModalOpen(false)}
                    className="rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] px-4 py-2 text-xs font-semibold text-[#667085]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-[#DE8626] px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-[#C4721C] disabled:opacity-50"
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
