'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table as TableIcon,
  Plus,
  Users,
  Clock,
  IndianRupee,
  ShoppingBag,
  ReceiptIndianRupee as Receipt,
  X,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Utensils,
  CheckCircle2,
  QrCode,
  Printer,
  Trash2,
  Loader2,
  AlertCircle,
  Phone,
  User,
  MoveRight,
  GitMerge,
  BellRing,
  Droplets,
  Search,
  Edit2,
  SlidersHorizontal,
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { TableQrModal } from '@/components/tables/TableQrModal';
import { StorefrontQrModal } from '@/components/tables/StorefrontQrModal';
import { OrderSettleModal } from '@/components/orders/OrderSettleModal';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { usePrinterStore } from '@shared/presentation/state/usePrinterStore';
import { TableRemoteDataSource } from '@shared/data/datasources/TableRemoteDataSource';
import { TablesFloorSkeleton } from '@/components/common/Skeleton';
import { OrderRemoteDataSource } from '@shared/data/datasources/OrderRemoteDataSource';
import { RestaurantConfigRemoteDataSource } from '@shared/data/datasources/RestaurantConfigRemoteDataSource';
import { TableMaster } from '@shared/domain/models/Table';
import { OrderMaster } from '@shared/domain/models/Order';
import { RestaurantConfig } from '@shared/domain/models/RestaurantConfig';
import { ReceiptData } from '@shared/core/printer/EscPosBuilder';
import { WebPrinterService } from '@/services/webPrinterService';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { usePosCatalogStore } from '@/stores/usePosCatalogStore';
import {
  startPosSignalRConnection,
  onPosOrderCreated,
  onPosOrderStatusChanged,
  onPosOrderSettled,
  onPosTableStatusChanged,
  onSignalRReconnected,
  onServiceRequestCreated,
  onServiceRequestResolved,
} from '@/lib/signalr/signalrService';

const tableDataSource = new TableRemoteDataSource();
const orderDataSource = new OrderRemoteDataSource();
const configDataSource = new RestaurantConfigRemoteDataSource();

export default function TablesPage() {
  const router = useRouter();
  const { activeRestaurant, restaurants } = useAuthStore();
  const { paperWidth, customFooter } = usePrinterStore();
  const currentRestId = activeRestaurant?.restaurantId || (restaurants.length > 0 ? restaurants[0].restaurantId : 0);


  const cachedCatalog = usePosCatalogStore.getState();
  const hasCachedTables = Boolean(
    cachedCatalog.restaurantId === currentRestId && cachedCatalog.tables.length > 0
  );

  const [tables, setTables] = useState<TableMaster[]>(() =>
    hasCachedTables ? cachedCatalog.tables : []
  );
  const [activeOrders, setActiveOrders] = useState<OrderMaster[]>([]);
  const [restaurantConfig, setRestaurantConfig] = useState<RestaurantConfig | null>(() =>
    cachedCatalog.restaurantId === currentRestId ? cachedCatalog.restaurantConfig : null
  );
  const [loading, setLoading] = useState(!hasCachedTables);
  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'OCCUPIED' | 'BILLED' | 'CLEANING'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Edit Table Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTable, setEditTable] = useState<TableMaster | null>(null);
  const [editTableNumber, setEditTableNumber] = useState('');
  const [editSeatingCapacity, setEditSeatingCapacity] = useState('4');
  const [editSectionName, setEditSectionName] = useState('Main Dining');
  const [savingEdit, setSavingEdit] = useState(false);

  // Add Table Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [seatingCapacity, setSeatingCapacity] = useState('4');
  const [sectionName, setSectionName] = useState('Main Dining');
  const [savingTable, setSavingTable] = useState(false);

  // Table Detail Action Sheet Modal
  const [actionTable, setActionTable] = useState<TableMaster | null>(null);
  const [activeTableOrder, setActiveTableOrder] = useState<OrderMaster | null>(null);
  const [loadingActiveOrder, setLoadingActiveOrder] = useState(false);
  const [qrTable, setQrTable] = useState<TableMaster | null>(null);
  const [storefrontQrOpen, setStorefrontQrOpen] = useState(false);
  const [tableQrPickerOpen, setTableQrPickerOpen] = useState(false);
  const [tableQrSearch, setTableQrSearch] = useState('');
  const [settlingOrder, setSettlingOrder] = useState<OrderMaster | null>(null);

  // Table Shift / Transfer Modal
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [shiftSourceTable, setShiftSourceTable] = useState<TableMaster | null>(null);
  const [shiftTargetTableId, setShiftTargetTableId] = useState<number | null>(null);
  const [shiftReason, setShiftReason] = useState('');
  const [isShifting, setIsShifting] = useState(false);

  // Table Merge Modal
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeTargetTable, setMergeTargetTable] = useState<TableMaster | null>(null);
  const [selectedMergeSourceIds, setSelectedMergeSourceIds] = useState<number[]>([]);
  const [mergeReason, setMergeReason] = useState('');
  const [isMerging, setIsMerging] = useState(false);

  // Real-time Table Service Requests (Waiter Call, Water, Bill Request)
  interface TableServiceRequestItem {
    requestId: any;
    tableId: number;
    tableName?: string;
    requestType: 'CALL_WAITER' | 'REQUEST_WATER' | 'REQUEST_BILL';
    timestamp: number;
    message?: string;
  }
  const [serviceRequests, setServiceRequests] = useState<TableServiceRequestItem[]>([]);

  // Clean slate and show skeleton immediately upon restaurant switch
  useEffect(() => {
    setTables([]);
    setActiveOrders([]);
    setActionTable(null);
    setQrTable(null);
    setSettlingOrder(null);
    setServiceRequests([]);
    setLoading(true);
  }, [currentRestId]);


  const handleResolveService = (tableId: number, requestId?: any) => {
    setServiceRequests((prev) =>
      prev.filter((r) => {
        if (requestId && (r.requestId === requestId || String(r.requestId) === String(requestId))) return false;
        if (r.tableId === tableId) return false;
        return true;
      })
    );
  };

  const inFlightRef = useRef(false);
  const queuedRefreshRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const loadData = useCallback(async (showLoading = false) => {
    if (!currentRestId) return;

    if (inFlightRef.current) {
      queuedRefreshRef.current = true;
      return;
    }
    inFlightRef.current = true;

    try {
      if (showLoading) {
        setLoading(true);
      }
      const [tablesRes, ordersRes, cfgRes] = await Promise.allSettled([
        tableDataSource.getTables(currentRestId),
        orderDataSource.getTodayOrders(currentRestId, 'ALL', 1, 100),
        configDataSource.getConfig(currentRestId),
      ]);

      if (tablesRes.status === 'fulfilled' && Array.isArray(tablesRes.value)) {
        setTables(tablesRes.value);
        usePosCatalogStore.getState().updateTables(tablesRes.value);
      }
      if (ordersRes.status === 'fulfilled' && ordersRes.value?.items) {
        setActiveOrders(ordersRes.value.items);
      }
      if (cfgRes.status === 'fulfilled' && cfgRes.value) {
        setRestaurantConfig(cfgRes.value);
      }
    } catch (err) {
      console.warn('Failed to load table floor', err);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
      inFlightRef.current = false;
      if (queuedRefreshRef.current) {
        queuedRefreshRef.current = false;
        loadData(false);
      }
    }
  }, [currentRestId]);

  // Debounced refresh for real-time SignalR notifications (collapses rapid-fire events into 1 fetch)
  const triggerRefresh = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      loadData(false);
    }, 400);
  }, [loadData]);

  useEffect(() => {
    loadData(tables.length === 0);

    if (currentRestId) {
      startPosSignalRConnection(currentRestId).catch(() => {});
      const unsub1 = onPosOrderCreated(triggerRefresh);
      const unsub2 = onPosOrderStatusChanged(triggerRefresh);
      const unsub3 = onPosOrderSettled(triggerRefresh);
      const unsub4 = onPosTableStatusChanged(triggerRefresh);
      const unsub5 = onSignalRReconnected(triggerRefresh);

      const unsub6 = onServiceRequestCreated((req) => {
        const tableId = Number(req?.tableId || req?.TableId || 0);
        const reqType = String(
          req?.requestType || req?.RequestType || req?.type || (req?.isBillRequest ? 'REQUEST_BILL' : 'CALL_WAITER')
        ).toUpperCase();
        const typeNormalized: 'CALL_WAITER' | 'REQUEST_WATER' | 'REQUEST_BILL' = reqType.includes('WATER')
          ? 'REQUEST_WATER'
          : reqType.includes('BILL')
          ? 'REQUEST_BILL'
          : 'CALL_WAITER';

        const newItem: TableServiceRequestItem = {
          requestId: req?.id || req?.Id || req?.requestId || Date.now(),
          tableId,
          tableName: req?.tableName || req?.TableName,
          requestType: typeNormalized,
          timestamp: Date.now(),
          message: req?.message || req?.Message,
        };

        setServiceRequests((prev) => {
          const filtered = prev.filter((r) => !(r.tableId === tableId && r.requestType === typeNormalized));
          return [newItem, ...filtered];
        });
        triggerRefresh();
      });

      const unsub7 = onServiceRequestResolved((res) => {
        const reqId = res?.requestId || res?.id;
        const tableId = Number(res?.tableId || 0);
        setServiceRequests((prev) =>
          prev.filter((r) => {
            if (reqId && (r.requestId === reqId || String(r.requestId) === String(reqId))) return false;
            if (tableId > 0 && r.tableId === tableId) return false;
            return true;
          })
        );
      });

      // Window tab visibility sync: refreshes once when staff switch back to the browser tab
      const handleVisibilityChange = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          triggerRefresh();
        }
      };
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleVisibilityChange);
      }

      return () => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        if (typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
        unsub1();
        unsub2();
        unsub3();
        unsub4();
        unsub5();
        unsub6();
        unsub7();
      };
    }
  }, [currentRestId, loadData, triggerRefresh]);

  // Unique sections list
  const sections = useMemo(() => {
    const list = Array.from(new Set(tables.map((t) => t.sectionName || 'Main Dining')));
    return ['ALL', ...list];
  }, [tables]);

  // Handle Add Table
  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNumber.trim()) return;

    try {
      setSavingTable(true);
      await tableDataSource.createTable({
        restaurantId: currentRestId,
        tableNumber: tableNumber.trim(),
        seatingCapacity: parseInt(seatingCapacity, 10) || 4,
        sectionName: sectionName.trim() || 'Main Dining',
        status: 'AVAILABLE',
      });
      await loadData();
      setTableNumber('');
      setAddModalOpen(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to create table');
    } finally {
      setSavingTable(false);
    }
  };

  // Handle Edit Table
  const handleOpenEditTable = (tbl: TableMaster) => {
    setEditTable(tbl);
    setEditTableNumber(String(tbl.tableNumber || tbl.tableName || ''));
    setEditSeatingCapacity(String(tbl.seatingCapacity || 4));
    setEditSectionName(tbl.sectionName || 'Main Dining');
    setEditModalOpen(true);
  };

  const handleUpdateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTable || !editTableNumber.trim()) return;

    try {
      setSavingEdit(true);
      await tableDataSource.updateTable(editTable.id, {
        tableNumber: editTableNumber.trim(),
        tableName: editTableNumber.trim(),
        seatingCapacity: parseInt(editSeatingCapacity, 10) || 4,
        sectionName: editSectionName.trim() || 'Main Dining',
      });
      setEditModalOpen(false);
      setEditTable(null);
      if (actionTable && actionTable.id === editTable.id) {
        setActionTable((prev) =>
          prev
            ? {
                ...prev,
                tableNumber: editTableNumber.trim(),
                tableName: editTableNumber.trim(),
                seatingCapacity: parseInt(editSeatingCapacity, 10) || 4,
                sectionName: editSectionName.trim() || 'Main Dining',
              }
            : null
        );
      }
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to update table');
    } finally {
      setSavingEdit(false);
    }
  };

  // Set of terminal (inactive) order statuses
  const TERMINAL_ORDER_STATUSES = useMemo(
    () => new Set(['COMPLETED', 'SETTLED', 'CANCELLED', 'REJECTED', 'VOID', 'PAID']),
    []
  );

  // Find active order for table
  const getOrderForTable = useCallback(
    (table: TableMaster) => {
      return activeOrders.find((o) => {
        const matchTable =
          (table.id && o.tableId === table.id) ||
          (table.tableNumber && (o.tableName === table.tableNumber || o.tableName === `T-${table.tableNumber}`)) ||
          (table.tableName && (o.tableName === table.tableName || o.tableName === `T-${table.tableName}`));
        if (!matchTable) return false;
        const statusUpper = (o.status || '').trim().toUpperCase();
        return !TERMINAL_ORDER_STATUSES.has(statusUpper);
      });
    },
    [activeOrders, TERMINAL_ORDER_STATUSES]
  );

  // Real-time Floor Telemetry Stats
  const floorStats = useMemo(() => {
    let totalSeats = 0;
    let available = 0;
    let occupied = 0;
    let billed = 0;
    let cleaning = 0;

    tables.forEach((t) => {
      totalSeats += t.seatingCapacity || 4;
      const activeOrder = getOrderForTable(t);
      const statusUpper = (t.status || '').toUpperCase();
      const isOcc = Boolean(activeOrder) || Boolean(t.activeOrderId) || statusUpper === 'OCCUPIED';
      const isBil = !isOcc && statusUpper === 'BILLED';
      const isCln = !isOcc && statusUpper === 'CLEANING';

      if (isOcc) occupied++;
      else if (isBil) billed++;
      else if (isCln) cleaning++;
      else available++;
    });

    return {
      totalTables: tables.length,
      totalSeats,
      available,
      occupied,
      billed,
      cleaning,
    };
  }, [tables, getOrderForTable]);

  // Multi-dimensional Filtered Tables (Section, Status & Search Query)
  const filteredTables = useMemo(() => {
    return tables.filter((tbl) => {
      // 1. Section Filter
      if (selectedSection !== 'ALL') {
        const sec = tbl.sectionName || 'Main Dining';
        if (sec.toLowerCase() !== selectedSection.toLowerCase()) return false;
      }

      // 2. Status Filter
      const activeOrder = getOrderForTable(tbl);
      const statusUpper = (tbl.status || '').toUpperCase();
      const isOccupied = Boolean(activeOrder) || Boolean(tbl.activeOrderId) || statusUpper === 'OCCUPIED';
      const isBilled = !isOccupied && statusUpper === 'BILLED';
      const isCleaning = !isOccupied && statusUpper === 'CLEANING';
      const isAvailable = !isOccupied && !isBilled && !isCleaning;

      if (selectedStatusFilter === 'AVAILABLE' && !isAvailable) return false;
      if (selectedStatusFilter === 'OCCUPIED' && !isOccupied) return false;
      if (selectedStatusFilter === 'BILLED' && !isBilled) return false;
      if (selectedStatusFilter === 'CLEANING' && !isCleaning) return false;

      // 3. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum =
          String(tbl.tableNumber || '').toLowerCase().includes(q) ||
          `t-${tbl.tableNumber}`.toLowerCase().includes(q);
        const matchSec = (tbl.sectionName || '').toLowerCase().includes(q);
        const matchCustomer = activeOrder?.customerName?.toLowerCase().includes(q);
        const matchOrderId = String(activeOrder?.id || '').includes(q);

        if (!matchNum && !matchSec && !matchCustomer && !matchOrderId) return false;
      }

      return true;
    });
  }, [tables, selectedSection, selectedStatusFilter, searchQuery, getOrderForTable]);

  const handleSelectTable = async (tbl: TableMaster) => {
    setActionTable(tbl);
    setActiveTableOrder(null);
    const existingOrder = getOrderForTable(tbl);
    const statusUpper = (tbl.status || '').toUpperCase();
    const hasActiveOrder = Boolean(existingOrder) || Boolean(tbl.activeOrderId);
    const isOccupied = hasActiveOrder || statusUpper === 'OCCUPIED' || statusUpper === 'BILLED';
    if (isOccupied) {
      try {
        setLoadingActiveOrder(true);
        const fetched = await orderDataSource.getActiveOrderByTable(tbl.id, currentRestId);
        const active = fetched || existingOrder || null;
        setActiveTableOrder(active);
        usePosCatalogStore.getState().setActiveTableOrder(tbl.id, active);
      } catch (err) {
        console.warn('Failed to load active table order:', err);
        const active = existingOrder || null;
        setActiveTableOrder(active);
        usePosCatalogStore.getState().setActiveTableOrder(tbl.id, active);
      } finally {
        setLoadingActiveOrder(false);
      }
    } else {
      usePosCatalogStore.getState().setActiveTableOrder(tbl.id, null);
    }
  };

  const handlePrintGuestCheck = (order: OrderMaster, table: TableMaster) => {
    const receiptData: ReceiptData = {
      orderId: order.id,
      orderNumber: String(order.orderNumber || order.id),
      pickupToken: String(order.pickupToken || order.id),
      restaurantName: restaurantConfig?.restaurantName || activeRestaurant?.restaurantName || 'Menza Restaurant',
      logoUrl: restaurantConfig?.logoUrl || activeRestaurant?.logoUrl || undefined,
      address: restaurantConfig?.address || activeRestaurant?.address || '',
      city: restaurantConfig?.city || activeRestaurant?.city || '',
      state: restaurantConfig?.state || activeRestaurant?.state || '',
      contactPhone: restaurantConfig?.contactNumber || (activeRestaurant as any)?.contactNumber || activeRestaurant?.ownerMobile || '',
      gstNumber: restaurantConfig?.gstNumber || undefined,
      customerName: order.customerName || 'Dine-In Guest',
      customerPhone: order.mobileNumber || undefined,
      orderType: 'DINE_IN',
      tableName: `Table ${table.tableNumber}`,
      sectionName: table.sectionName || undefined,
      items: (order.items || []).map((c: any) => ({
        itemName: c.itemName || 'Dish',
        quantity: c.quantity || 1,
        unitPrice: c.unitPrice || c.amount || 0,
        totalPrice: c.totalPrice || c.totalAmount || (c.quantity * (c.unitPrice || 0)) || 0,
      })),
      subtotal: order.subtotal || order.totalAmount || 0,
      discountAmount: order.discountAmount || 0,
      cgstAmount: order.cgst || undefined,
      sgstAmount: order.sgst || undefined,
      taxAmount: (order.cgst || 0) + (order.sgst || 0),
      grandTotal: Number(order.totalAmount || 0),
      paymentMode: 'PAY LATER (GUEST CHECK)',
      isProforma: true,
      date: new Date().toLocaleString('en-IN'),
      upiId: (
        restaurantConfig?.bankerUpiId ||
        (restaurantConfig as any)?.upiId ||
        (activeRestaurant as any)?.bankerUpiId ||
        (activeRestaurant as any)?.upiId ||
        ''
      ).trim(),
      upiPayeeName:
        restaurantConfig?.bankerAccountHolderName ||
        restaurantConfig?.restaurantName ||
        activeRestaurant?.restaurantName ||
        'Menza Restaurant',
      showUpiQr:
        restaurantConfig?.printUpiQrOnReceipts !== false &&
        (activeRestaurant as any)?.printUpiQrOnReceipts !== false,
      footerMessage: customFooter || 'Thank you! Please visit again.',
    };

    WebPrinterService.printReceipt(receiptData, paperWidth).catch((err) => {
      alert('Thermal printer notice: ' + (err?.message || err));
    });
  };

  const handleUpdateTableStatus = async (tableId: number, newStatus: string) => {
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, status: newStatus } : t)));
    if (actionTable && actionTable.id === tableId) {
      setActionTable((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    try {
      await tableDataSource.updateTableStatus(tableId, newStatus);
    } catch (e) {
      console.warn('Update table status error:', e);
    }
  };

  const handleFreeTable = async (tableId: number, transitionToCleaning: boolean = false) => {
    const newStatus = transitionToCleaning ? 'Cleaning' : 'Available';
    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId
          ? {
              ...t,
              status: newStatus,
              activeOrderId: undefined,
              currentOrderId: undefined,
              occupiedSince: undefined,
            }
          : t
      )
    );
    setActionTable(null);
    setActiveTableOrder(null);
    setActiveOrders((prev) => prev.filter((o) => o.tableId !== tableId));
    usePosCatalogStore.getState().freeTableInCatalog(tableId);
    try {
      await tableDataSource.freeTable(tableId, {
        restaurantId: currentRestId,
        transitionToCleaning,
        settleActiveOrder: true,
        releasedByRole: 'STAFF',
      });
      await loadData();
    } catch (e) {
      console.warn('Free table error:', e);
    }
  };

  const handleDeleteTable = async (table: TableMaster) => {
    if (!window.confirm(`Are you sure you want to delete Table T-${table.tableNumber}?`)) return;
    try {
      await tableDataSource.deleteTable(table.id);
      setActionTable(null);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete table');
    }
  };

  const handleTransferTable = async () => {
    if (!shiftSourceTable || !shiftTargetTableId || !currentRestId) {
      alert('Please select an available destination table to transfer the order to.');
      return;
    }
    try {
      setIsShifting(true);
      await tableDataSource.transferTable({
        restaurantId: currentRestId,
        sourceTableId: shiftSourceTable.id,
        targetTableId: shiftTargetTableId,
        reason: shiftReason.trim() || 'Guest requested table change',
      });
      setShiftModalOpen(false);
      setShiftSourceTable(null);
      setShiftTargetTableId(null);
      setShiftReason('');
      setActionTable(null);
      setActiveTableOrder(null);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to transfer table');
    } finally {
      setIsShifting(false);
    }
  };

  const handleMergeTables = async () => {
    if (!mergeTargetTable || selectedMergeSourceIds.length === 0 || !currentRestId) {
      alert('Please select at least one source table to merge.');
      return;
    }
    try {
      setIsMerging(true);
      await tableDataSource.mergeTables({
        restaurantId: currentRestId,
        sourceTableIds: selectedMergeSourceIds,
        targetTableId: mergeTargetTable.id,
        reason: mergeReason.trim() || 'Guest requested table merge / joint bill',
      });
      setMergeModalOpen(false);
      setMergeTargetTable(null);
      setSelectedMergeSourceIds([]);
      setMergeReason('');
      setActionTable(null);
      setActiveTableOrder(null);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to merge tables');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <AuthGuard>
      <AppShell>
        <FeatureGate feature="tableConfiguration" title="Table & Floor Layout Designer" planSuggestion="Dine-In Pro">
        <div className="p-3 sm:p-6 lg:p-8 space-y-5 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                  Floor & Table Management
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Live Floor Plan</span>
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-[#667085] dark:text-[#94A3B8]">
                Real-time dining room floor plan, table status tracking, and order assignment
              </p>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
              <button
                onClick={() => setStorefrontQrOpen(true)}
                className="flex items-center gap-1.5 shrink-0 rounded-xl border border-[#DE8626] bg-amber-500/10 px-3 py-2 text-xs font-bold text-[#DE8626] hover:bg-amber-500/20 shadow-2xs transition-colors"
                title="Generate, download or print Store Profile QR Standee"
              >
                <QrCode className="h-4 w-4" />
                <span className="whitespace-nowrap">Store Profile QR</span>
              </button>

              <button
                onClick={() => {
                  if (tables.length > 0) {
                    setTableQrPickerOpen(true);
                  } else {
                    alert('No tables configured yet. Please add a table first.');
                  }
                }}
                className="flex items-center gap-1.5 shrink-0 rounded-xl border border-[#DE8626]/50 bg-white dark:bg-[#1B2127] px-3 py-2 text-xs font-bold text-[#DE8626] hover:bg-amber-500/10 shadow-2xs transition-colors"
                title="Select a table to view, print or share its dine-in QR sticker"
              >
                <QrCode className="h-4 w-4" />
                <span className="whitespace-nowrap">Table QRs</span>
              </button>

              <button
                onClick={() => loadData(true)}
                disabled={loading}
                className="flex items-center gap-1.5 shrink-0 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3 py-2 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5 transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Sync</span>
              </button>

              <button
                onClick={() => setAddModalOpen(true)}
                className="flex items-center gap-1.5 shrink-0 rounded-xl bg-[#DE8626] px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span className="whitespace-nowrap">Add Table</span>
              </button>
            </div>
          </div>

          {/* Operational Status Telemetry Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
            {/* Total Floor */}
            <div
              onClick={() => setSelectedStatusFilter('ALL')}
              className={`cursor-pointer rounded-2xl border p-3 sm:p-4 transition-all ${
                selectedStatusFilter === 'ALL'
                  ? 'border-[#DE8626] bg-amber-500/10 shadow-sm ring-1 ring-[#DE8626]'
                  : 'border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] hover:border-[#DE8626]/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#667085] dark:text-[#94A3B8] uppercase tracking-wider">
                  Total Floor
                </span>
                <TableIcon className="h-4 w-4 text-[#DE8626]" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xl sm:text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6]">
                  {floorStats.totalTables}
                </span>
                <span className="text-[11px] font-bold text-[#667085] dark:text-[#94A3B8]">
                  {floorStats.totalSeats} seats
                </span>
              </div>
            </div>

            {/* Available */}
            <div
              onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'AVAILABLE' ? 'ALL' : 'AVAILABLE')}
              className={`cursor-pointer rounded-2xl border p-3 sm:p-4 transition-all ${
                selectedStatusFilter === 'AVAILABLE'
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-sm ring-1 ring-emerald-500'
                  : 'border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] hover:border-emerald-500/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Available
                </span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {floorStats.available}
                </span>
                <span className="text-[10px] font-medium text-emerald-700/80 dark:text-emerald-400/80">
                  Vacant
                </span>
              </div>
            </div>

            {/* Occupied */}
            <div
              onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'OCCUPIED' ? 'ALL' : 'OCCUPIED')}
              className={`cursor-pointer rounded-2xl border p-3 sm:p-4 transition-all ${
                selectedStatusFilter === 'OCCUPIED'
                  ? 'border-amber-500 bg-amber-500/10 shadow-sm ring-1 ring-amber-500'
                  : 'border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] hover:border-amber-500/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  Dining
                </span>
                <Utensils className="h-4 w-4 text-[#DE8626]" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xl sm:text-2xl font-black text-[#DE8626]">
                  {floorStats.occupied}
                </span>
                <span className="text-[10px] font-medium text-amber-700/80 dark:text-amber-400/80">
                  Active
                </span>
              </div>
            </div>

            {/* Billed */}
            <div
              onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'BILLED' ? 'ALL' : 'BILLED')}
              className={`cursor-pointer rounded-2xl border p-3 sm:p-4 transition-all ${
                selectedStatusFilter === 'BILLED'
                  ? 'border-yellow-500 bg-yellow-500/10 shadow-sm ring-1 ring-yellow-500'
                  : 'border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] hover:border-yellow-500/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-yellow-700 dark:text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-yellow-500" />
                  Billed
                </span>
                <Receipt className="h-4 w-4 text-yellow-600" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xl sm:text-2xl font-black text-yellow-600 dark:text-yellow-400">
                  {floorStats.billed}
                </span>
                <span className="text-[10px] font-medium text-yellow-700/80 dark:text-yellow-400/80">
                  Pending pay
                </span>
              </div>
            </div>

            {/* Cleaning */}
            <div
              onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'CLEANING' ? 'ALL' : 'CLEANING')}
              className={`cursor-pointer rounded-2xl border p-3 sm:p-4 col-span-2 sm:col-span-1 transition-all ${
                selectedStatusFilter === 'CLEANING'
                  ? 'border-blue-500 bg-blue-500/10 shadow-sm ring-1 ring-blue-500'
                  : 'border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] hover:border-blue-500/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Turnover
                </span>
                <Sparkles className="h-4 w-4 text-blue-600" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400">
                  {floorStats.cleaning}
                </span>
                <span className="text-[10px] font-medium text-blue-700/80 dark:text-blue-400/80">
                  Cleaning
                </span>
              </div>
            </div>
          </div>

          {/* Live Service Requests Action Center */}
          {serviceRequests.length > 0 && (
            <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-amber-500/5 p-4 shadow-sm animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md animate-bounce">
                    <BellRing className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#1E2930] dark:text-[#F3F4F6] flex items-center gap-2">
                      <span>Active Guest Calls ({serviceRequests.length})</span>
                      <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                    </h3>
                    <p className="text-xs text-[#667085] dark:text-[#94A3B8]">
                      Guests at dining tables have called for assistance or requested bills
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {serviceRequests.slice(0, 3).map((req, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-xl border border-white/60 dark:border-white/10 bg-white/80 dark:bg-[#1B2127]/90 px-3 py-1.5 text-xs font-bold shadow-2xs"
                    >
                      <span className="text-[#DE8626]">T-{req.tableName || req.tableId}</span>
                      <span className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                        {req.requestType === 'REQUEST_BILL' ? 'Pre-Bill' : req.requestType === 'REQUEST_WATER' ? 'Water' : 'Waiter'}
                      </span>
                      <button
                        onClick={() => handleResolveService(req.tableId, req.requestId)}
                        className="rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-extrabold transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  ))}
                  {serviceRequests.length > 3 && (
                    <span className="text-xs font-bold text-[#DE8626]">
                      +{serviceRequests.length - 3} more
                    </span>
                  )}
                  <button
                    onClick={() => setServiceRequests([])}
                    className="rounded-xl border border-[#DE8626]/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-[#DE8626] hover:bg-amber-500/20 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Controls: Search, Status Filters & Section Tabs */}
          <div className="rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-3 sm:p-4 shadow-2xs space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#667085]" />
                <input
                  type="text"
                  placeholder="Search table #, section or guest name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] pl-10 pr-9 py-2 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] placeholder:text-[#94A3B8] outline-none focus:border-[#DE8626] transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-[#667085] hover:bg-black/5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 md:pb-0">
                {(['ALL', 'AVAILABLE', 'OCCUPIED', 'BILLED', 'CLEANING'] as const).map((status) => {
                  const isActive = selectedStatusFilter === status;
                  const label =
                    status === 'ALL'
                      ? `All (${tables.length})`
                      : status === 'AVAILABLE'
                      ? `Available (${floorStats.available})`
                      : status === 'OCCUPIED'
                      ? `Dining (${floorStats.occupied})`
                      : status === 'BILLED'
                      ? `Billed (${floorStats.billed})`
                      : `Cleaning (${floorStats.cleaning})`;

                  return (
                    <button
                      key={status}
                      onClick={() => setSelectedStatusFilter(status)}
                      className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-[#DE8626] text-white shadow-xs'
                          : 'border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#667085] dark:text-[#94A3B8] hover:border-[#DE8626]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-2 border-t border-[#E7E1DA]/60 dark:border-[#2B3540]/60">
              <span className="text-[11px] font-bold text-[#667085] dark:text-[#94A3B8] uppercase mr-1 shrink-0 flex items-center gap-1">
                <SlidersHorizontal className="h-3 w-3" />
                <span>Sections:</span>
              </span>
              {sections.map((sec) => {
                const isSelected = selectedSection === sec;
                const count = sec === 'ALL' ? tables.length : tables.filter((t) => (t.sectionName || 'Main Dining') === sec).length;
                return (
                  <button
                    key={sec}
                    onClick={() => setSelectedSection(sec)}
                    className={`shrink-0 rounded-xl px-3 py-1 text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-amber-500/15 border border-[#DE8626] text-[#DE8626]'
                        : 'border border-transparent text-[#667085] dark:text-[#94A3B8] hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    {sec === 'ALL' ? `All Sections (${count})` : `${sec} (${count})`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tables Grid */}
          {loading ? (
            <TablesFloorSkeleton count={12} />
          ) : filteredTables.length === 0 ? (
            <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-12 sm:p-16 text-center space-y-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-[#DE8626] mx-auto">
                <TableIcon className="h-7 w-7" />
              </div>
              <h3 className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                {tables.length === 0 ? 'No Dining Tables Configured' : 'No Tables Match Filters'}
              </h3>
              <p className="text-xs text-[#667085] dark:text-[#94A3B8] max-w-sm mx-auto">
                {tables.length === 0
                  ? 'Set up your restaurant floor plan by adding tables with their seating capacities and dining sections.'
                  : `No tables found for status "${selectedStatusFilter}" or search "${searchQuery}".`}
              </p>
              <div className="pt-2 flex items-center justify-center gap-2">
                {searchQuery || selectedStatusFilter !== 'ALL' || selectedSection !== 'ALL' ? (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedStatusFilter('ALL');
                      setSelectedSection('ALL');
                    }}
                    className="rounded-xl border border-[#DE8626] bg-amber-500/10 px-4 py-2 text-xs font-bold text-[#DE8626] hover:bg-amber-500/20 transition-colors"
                  >
                    Reset Filters
                  </button>
                ) : null}
                <button
                  onClick={() => setAddModalOpen(true)}
                  className="rounded-xl bg-[#DE8626] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#C4721C] transition-colors flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Table</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
              {filteredTables.map((tbl) => {
                const activeOrder = getOrderForTable(tbl);
                const statusUpper = (tbl.status || '').toUpperCase();
                const hasActiveOrder = Boolean(activeOrder) || Boolean(tbl.activeOrderId);
                const isOccupied = hasActiveOrder || statusUpper === 'OCCUPIED';
                const isBilled = !isOccupied && statusUpper === 'BILLED';
                const isCleaning = !isOccupied && statusUpper === 'CLEANING';
                const isAvailable = !isOccupied && !isBilled && !isCleaning;

                const activeServiceReq = serviceRequests.find(
                  (r) => r.tableId === tbl.id || r.tableName === tbl.tableNumber || r.tableName === tbl.tableName
                );
                const hasBillRequest = activeServiceReq?.requestType === 'REQUEST_BILL';
                const hasWaterRequest = activeServiceReq?.requestType === 'REQUEST_WATER';
                const hasWaiterCall = activeServiceReq?.requestType === 'CALL_WAITER';

                const elapsedMins = activeOrder?.createdAt
                  ? Math.max(0, Math.floor((Date.now() - new Date(activeOrder.createdAt).getTime()) / 60000))
                  : 0;

                return (
                  <div
                    key={tbl.id}
                    onClick={() => handleSelectTable(tbl)}
                    className={`group relative flex flex-col justify-between rounded-3xl border p-3.5 sm:p-4 shadow-2xs hover:shadow-lg transition-all duration-200 cursor-pointer select-none bg-white dark:bg-[#1B2127] ${
                      hasBillRequest
                        ? 'border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/[0.04]'
                        : hasWaterRequest
                        ? 'border-sky-500 ring-2 ring-sky-500/30 bg-sky-500/[0.04]'
                        : hasWaiterCall
                        ? 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-500/[0.04]'
                        : isOccupied
                        ? 'border-amber-400/80 bg-gradient-to-b from-amber-500/[0.06] to-white dark:to-[#1B2127] hover:border-[#DE8626]'
                        : isBilled
                        ? 'border-yellow-400/80 bg-gradient-to-b from-yellow-500/[0.06] to-white dark:to-[#1B2127] hover:border-yellow-500'
                        : isCleaning
                        ? 'border-blue-400/80 bg-gradient-to-b from-blue-500/[0.06] to-white dark:to-[#1B2127] hover:border-blue-500'
                        : 'border-[#E7E1DA] dark:border-[#2B3540] hover:border-[#DE8626]'
                    }`}
                  >
                    {/* Top Header Row */}
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-2.5">
                        <span className="flex items-center gap-1 text-[11px] font-bold text-[#667085] dark:text-[#94A3B8]">
                          <Users className="h-3.5 w-3.5 text-[#DE8626]" />
                          <span>{tbl.seatingCapacity || 4}p</span>
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQrTable(tbl);
                            }}
                            title={`Generate & Print QR for Table T-${tbl.tableNumber}`}
                            className="flex items-center gap-1 rounded-lg border border-[#DE8626]/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-[#DE8626] hover:bg-amber-500/20 hover:border-[#DE8626] transition-colors"
                          >
                            <QrCode className="h-3 w-3" />
                            <span>QR</span>
                          </button>

                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                              isBilled
                                ? 'bg-yellow-500 text-white shadow-2xs'
                                : isCleaning
                                ? 'bg-blue-500 text-white shadow-2xs'
                                : isOccupied
                                ? 'bg-amber-500 text-white shadow-2xs'
                                : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isBilled
                                  ? 'bg-white'
                                  : isCleaning
                                  ? 'bg-white'
                                  : isOccupied
                                  ? 'bg-white animate-pulse'
                                  : 'bg-emerald-500'
                              }`}
                            />
                            {isBilled ? 'Billed' : isCleaning ? 'Cleaning' : isOccupied ? `${elapsedMins}m` : 'Available'}
                          </span>
                        </div>
                      </div>

                      {/* Main Table Identifier & Section */}
                      <div className="my-2">
                        <div className="flex items-baseline justify-between">
                          <h3 className="text-xl sm:text-2xl font-black text-[#1E2930] dark:text-[#F3F4F6] tracking-tight group-hover:text-[#DE8626] transition-colors">
                            T-{tbl.tableNumber}
                          </h3>

                          {isOccupied && activeOrder && (
                            <span className="text-[10px] font-extrabold text-[#DE8626] bg-amber-500/10 px-2 py-0.5 rounded-md">
                              #{activeOrder.id}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] font-semibold text-[#667085] dark:text-[#94A3B8] truncate mt-0.5">
                          {tbl.sectionName || 'Main Dining'}
                        </p>

                        {/* Customer Name or Order items preview */}
                        {isOccupied && activeOrder && (
                          <p className="text-[10px] text-[#667085] dark:text-[#94A3B8] truncate mt-1 font-medium">
                            {activeOrder.customerName ? `Guest: ${activeOrder.customerName}` : `${activeOrder.items?.length || 0} dishes ordered`}
                          </p>
                        )}

                        {/* Live Service Request Alert Badge */}
                        {activeServiceReq && (
                          <div
                            className={`mt-2 flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[10px] font-black border animate-pulse ${
                              hasBillRequest
                                ? 'border-rose-500/50 bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                : hasWaterRequest
                                ? 'border-sky-500/50 bg-sky-500/15 text-sky-600 dark:text-sky-400'
                                : 'border-amber-500/50 bg-amber-500/15 text-[#DE8626]'
                            }`}
                          >
                            {hasBillRequest ? (
                              <>
                                <Receipt className="h-3 w-3" />
                                <span className="truncate">Pre-Bill Requested</span>
                              </>
                            ) : hasWaterRequest ? (
                              <>
                                <Droplets className="h-3 w-3" />
                                <span className="truncate">Water Refill</span>
                              </>
                            ) : (
                              <>
                                <BellRing className="h-3 w-3" />
                                <span className="truncate">Waiter Called</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Status / Order Info & Actions */}
                    <div className="pt-2.5 border-t border-[#E7E1DA]/60 dark:border-[#2B3540]/60 mt-2">
                      {isOccupied && activeOrder ? (
                        <div className="flex items-center justify-between gap-1.5">
                          <div>
                            <span className="text-xs sm:text-sm font-black text-[#DE8626] block">
                              ₹{activeOrder.totalAmount || 0}
                            </span>
                            <span className="text-[9px] text-[#667085] block truncate">
                              {activeOrder.items?.length || 0} items
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const targetId = tbl.id;
                                const activeId = activeOrder?.id;
                                router.push(`/pos?tableId=${targetId}${activeId ? `&orderId=${activeId}` : ''}`);
                              }}
                              className="rounded-xl border border-[#DE8626] bg-amber-500/10 hover:bg-amber-500/20 text-[#DE8626] px-2 py-1 text-[10px] font-bold transition-colors"
                              title="Add more dishes in POS"
                            >
                              + POS
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSettlingOrder(activeOrder);
                              }}
                              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 text-[10px] font-bold shadow-xs transition-colors flex items-center gap-0.5"
                              title="Settle Bill and Free Table"
                            >
                              <Receipt className="h-3 w-3" />
                              <span>Settle</span>
                            </button>
                          </div>
                        </div>
                      ) : isBilled ? (
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <span className="text-xs font-bold text-yellow-600 block">
                              ₹{activeOrder?.totalAmount || 0}
                            </span>
                            <span className="text-[9px] text-[#667085] block">Awaiting Cashier</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activeOrder) setSettlingOrder(activeOrder);
                              else handleSelectTable(tbl);
                            }}
                            className="rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white px-2.5 py-1 text-[10px] font-bold transition-colors"
                          >
                            Settle
                          </button>
                        </div>
                      ) : isCleaning ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFreeTable(tbl.id, false);
                          }}
                          className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-1.5 text-[10px] font-bold transition-colors shadow-2xs"
                        >
                          <Sparkles className="h-3 w-3" />
                          <span>Mark Clean</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/pos?tableId=${tbl.id}`);
                          }}
                          className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#DE8626]/60 bg-amber-500/5 hover:bg-[#DE8626] text-[#DE8626] hover:text-white py-1.5 text-[10px] sm:text-[11px] font-bold transition-all"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Seat Guests (POS)</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 1. Table Action Sheet Modal */}
        {actionTable && (() => {
          const existingOrder = getOrderForTable(actionTable);
          const activeOrder = activeTableOrder || existingOrder;
          const statusUpper = (actionTable.status || '').toUpperCase();
          const hasActiveOrder = Boolean(activeOrder) || Boolean(actionTable.activeOrderId);
          const isOccupied = hasActiveOrder || statusUpper === 'OCCUPIED';
          const isBilled = !isOccupied && statusUpper === 'BILLED';
          const isCleaning = !isOccupied && statusUpper === 'CLEANING';
          const isAvailable = !isOccupied && !isBilled && !isCleaning;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="w-full max-w-md rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 shadow-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TableIcon className="h-5 w-5 text-[#DE8626]" />
                    <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                      Table T-{actionTable.tableNumber}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                        isBilled
                          ? 'bg-amber-500 text-white'
                          : isCleaning
                          ? 'bg-blue-500 text-white'
                          : isOccupied
                          ? 'bg-red-500 text-white'
                          : 'bg-emerald-500/10 text-emerald-600'
                      }`}
                    >
                      {actionTable.status || (isOccupied ? 'Occupied' : 'Available')}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setActionTable(null);
                      setActiveTableOrder(null);
                    }}
                    className="rounded-lg p-1 text-[#667085] hover:bg-black/5"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Live Service Request Bar (Waiter Call / Pre-Bill / Water) */}
                {(() => {
                  const activeServiceReq = serviceRequests.find(
                    (r) =>
                      r.tableId === actionTable.id ||
                      r.tableName === actionTable.tableNumber ||
                      r.tableName === actionTable.tableName
                  );
                  if (!activeServiceReq) return null;
                  const isBillReq = activeServiceReq.requestType === 'REQUEST_BILL';
                  const isWaterReq = activeServiceReq.requestType === 'REQUEST_WATER';

                  return (
                    <div
                      className={`mb-4 flex items-center justify-between rounded-2xl border p-3 ${
                        isBillReq
                          ? 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                          : isWaterReq
                          ? 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                          : 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {isBillReq ? (
                          <Receipt className="h-4 w-4 text-rose-600 dark:text-rose-400 animate-pulse" />
                        ) : isWaterReq ? (
                          <Droplets className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                        ) : (
                          <BellRing className="h-4 w-4 text-[#DE8626] animate-bounce" />
                        )}
                        <div>
                          <p className="text-xs font-bold">
                            {isBillReq
                              ? 'Guest Requested Pre-Bill'
                              : isWaterReq
                              ? 'Water Refill Requested'
                              : 'Guest Called Waiter'}
                          </p>
                          <p className="text-[10px] opacity-80">
                            {new Date(activeServiceReq.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {activeServiceReq.message ? ` • ${activeServiceReq.message}` : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleResolveService(actionTable.id, activeServiceReq.requestId)}
                        className="rounded-xl border border-current px-2.5 py-1 text-[11px] font-bold hover:bg-black/5 transition-colors"
                      >
                        Acknowledge
                      </button>
                    </div>
                  );
                })()}

                {/* Table Details & Active Order Card */}
                <div className="rounded-2xl bg-[#FAF7F2] dark:bg-[#151A20] p-4 space-y-2.5 text-xs mb-4 overflow-y-auto max-h-[45vh]">
                  <div className="flex justify-between">
                    <span className="text-[#667085]">Section:</span>
                    <span className="font-bold">{actionTable.sectionName || 'Main Dining'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#667085]">Capacity:</span>
                    <span className="font-bold">{actionTable.seatingCapacity || 4} Guests</span>
                  </div>

                  {loadingActiveOrder ? (
                    <div className="flex items-center justify-center py-4 gap-2 text-xs text-[#DE8626]">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Fetching live table tab & items...</span>
                    </div>
                  ) : activeOrder ? (
                    <>
                      <div className="pt-2 border-t border-[#E7E1DA] dark:border-[#2B3540] flex justify-between items-center">
                        <span className="text-[#667085]">Guest & Order:</span>
                        <span className="font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                          {activeOrder.customerName || 'Dine-In Guest'}
                          {activeOrder.mobileNumber ? ` • ${activeOrder.mobileNumber}` : ''}
                        </span>
                      </div>

                      {/* Dining Duration */}
                      {activeOrder.createdAt && (
                        <div className="flex justify-between items-center">
                          <span className="text-[#667085]">Dining Duration:</span>
                          <span className="font-bold flex items-center gap-1 text-[#DE8626]">
                            <Clock className="h-3 w-3" />
                            {Math.max(0, Math.floor((Date.now() - new Date(activeOrder.createdAt).getTime()) / 60000))}m seated
                          </span>
                        </div>
                      )}

                      {/* Itemized Order List */}
                      {activeOrder.items && activeOrder.items.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-[#E7E1DA]/60 dark:border-[#2B3540]/60 max-h-36 overflow-y-auto space-y-1.5 text-xs">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#667085] block mb-1">
                            Ordered Dishes ({activeOrder.items.length})
                          </span>
                          {activeOrder.items.map((it: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-[11px] text-[#1E2930] dark:text-[#F3F4F6]">
                              <span>{it.quantity}x {it.itemName}</span>
                              <span className="font-semibold">₹{(it.unitPrice || it.amount || 0) * (it.quantity || 1)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex justify-between text-sm font-extrabold text-[#DE8626] pt-2 border-t border-[#E7E1DA] dark:border-[#2B3540]">
                        <span>Total Bill Amount:</span>
                        <span>₹{activeOrder.totalAmount || 0}</span>
                      </div>
                    </>
                  ) : null}
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 mt-auto">
                  {/* Settle Bill Button */}
                  {activeOrder && (
                    <button
                      onClick={() => {
                        const o = activeOrder;
                        setActionTable(null);
                        setSettlingOrder(o);
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 py-3 text-xs font-bold text-white shadow-md transition-colors"
                    >
                      <Receipt className="h-4 w-4" />
                      <span>Settle Bill & Free Table (₹{activeOrder.totalAmount})</span>
                    </button>
                  )}

                  {/* Print Guest Check & Add Items Row */}
                  <div className="grid grid-cols-2 gap-2">
                    {activeOrder && (
                      <button
                        type="button"
                        onClick={() => handlePrintGuestCheck(activeOrder, actionTable)}
                        className="flex items-center justify-center gap-1.5 rounded-2xl border border-[#DE8626] bg-amber-500/10 py-2.5 text-xs font-bold text-[#DE8626] hover:bg-amber-500/20 transition-colors"
                        title="Print Guest Slip / Proforma Bill"
                      >
                        <Printer className="h-4 w-4" />
                        <span>Print Bill Slip</span>
                      </button>
                    )}

                    <button
                      onClick={async () => {
                        const subStore = useSubscriptionStore.getState();
                        if (!subStore.hasLoaded && currentRestId) {
                          await subStore.fetchSubscriptionStatus(currentRestId);
                        }
                        if (subStore.hasLoaded && !subStore.canTakeOrders()) {
                          subStore.openRenewalModal();
                          return;
                        }
                        const targetId = actionTable.id;
                        const activeId = activeOrder?.id || activeTableOrder?.id;
                        setActionTable(null);
                        router.push(`/pos?tableId=${targetId}${activeId ? `&orderId=${activeId}` : ''}`);
                      }}
                      className={`flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-bold transition-all ${
                        activeOrder
                          ? 'border border-[#DE8626] bg-amber-500/10 text-[#DE8626] hover:bg-[#DE8626] hover:text-white shadow-xs font-extrabold'
                          : 'col-span-2 bg-[#DE8626] text-white shadow-md hover:bg-[#C4721C]'
                      }`}
                    >
                      <ShoppingBag className="h-4 w-4" />
                      <span>{activeOrder ? '+ Add Dishes (POS)' : 'Seat Guests (Open POS)'}</span>
                    </button>
                  </div>

                  {/* Shift / Move Table & Merge Tables Row */}
                  {activeOrder && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShiftSourceTable(actionTable);
                          setShiftTargetTableId(null);
                          setShiftReason('');
                          setShiftModalOpen(true);
                        }}
                        className="flex items-center justify-center gap-1.5 rounded-2xl border border-indigo-400/60 bg-indigo-500/10 py-2.5 text-xs font-bold text-indigo-700 dark:text-indigo-400 hover:bg-indigo-500/20 transition-colors"
                        title="Move active order and guests to another table"
                      >
                        <MoveRight className="h-3.5 w-3.5" />
                        <span>Shift Table</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMergeTargetTable(actionTable);
                          setSelectedMergeSourceIds([]);
                          setMergeReason('');
                          setMergeModalOpen(true);
                        }}
                        className="flex items-center justify-center gap-1.5 rounded-2xl border border-purple-400/60 bg-purple-500/10 py-2.5 text-xs font-bold text-purple-700 dark:text-purple-400 hover:bg-purple-500/20 transition-colors"
                        title="Merge other occupied tables into this table"
                      >
                        <GitMerge className="h-3.5 w-3.5" />
                        <span>Merge Tables</span>
                      </button>
                    </div>
                  )}

                  {/* Table Lifecycle Status Controls */}
                  {isOccupied && !isBilled && (
                    <button
                      onClick={() => handleUpdateTableStatus(actionTable.id, 'Billed')}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-400 bg-amber-500/10 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors"
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      <span>Mark as Billed (Customer Asked for Bill)</span>
                    </button>
                  )}

                  {(isOccupied || isBilled) && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleFreeTable(actionTable.id, true)}
                        className="flex items-center justify-center gap-1.5 rounded-2xl border border-blue-400/50 bg-blue-500/10 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition-colors"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Mark for Cleaning</span>
                      </button>
                      <button
                        onClick={() => handleFreeTable(actionTable.id, false)}
                        className="flex items-center justify-center gap-1.5 rounded-2xl border border-red-400/50 bg-red-500/10 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Force Free Table</span>
                      </button>
                    </div>
                  )}

                  {isCleaning && (
                    <button
                      onClick={() => handleFreeTable(actionTable.id, false)}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition-colors"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Cleaning Done • Make Available</span>
                    </button>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => {
                        const target = actionTable;
                        setActionTable(null);
                        setQrTable(target);
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-[#DE8626] bg-amber-500/10 py-2.5 text-xs font-bold text-[#DE8626] hover:bg-amber-500/20 transition-colors shadow-2xs"
                      title="Generate dynamic 15-min rolling QR or physical table sticker"
                    >
                      <QrCode className="h-4 w-4" />
                      <span>Table QR</span>
                    </button>

                    {!isOccupied && !isBilled && (
                      <button
                        onClick={() => {
                          const target = actionTable;
                          setActionTable(null);
                          handleOpenEditTable(target);
                        }}
                        className="flex items-center justify-center gap-1.5 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] px-3.5 py-2 text-xs font-bold text-[#1E2930] dark:text-[#F3F4F6] hover:text-[#DE8626] hover:border-[#DE8626] transition-colors"
                        title="Edit Table Details"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-[#DE8626]" />
                        <span>Edit</span>
                      </button>
                    )}

                    {!isOccupied && !isBilled && (
                      <button
                        onClick={() => handleDeleteTable(actionTable)}
                        className="flex items-center justify-center gap-1.5 rounded-2xl border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Delete Table"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setActionTable(null);
                        setActiveTableOrder(null);
                      }}
                      className="flex-1 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] py-2 text-xs font-semibold text-[#667085] hover:bg-black/5"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 2. Add New Table Modal */}
        {addModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-xl bg-amber-500/15 p-2 text-[#DE8626]">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">Add Dining Table</h3>
                    <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                      Create a new table for guest dining & QR ordering
                    </p>
                  </div>
                </div>
                <button onClick={() => setAddModalOpen(false)} className="rounded-lg p-1 text-[#667085] hover:bg-black/5">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAddTable} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                    Table Number / Label *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder="e.g. 1, 2A, Rooftop-3"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                    Seating Capacity (Guests) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="50"
                    value={seatingCapacity}
                    onChange={(e) => setSeatingCapacity(e.target.value)}
                    placeholder="4"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                    Floor Section *
                  </label>
                  <input
                    type="text"
                    required
                    value={sectionName}
                    onChange={(e) => setSectionName(e.target.value)}
                    placeholder="e.g. Main Dining, AC Hall, Patio"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(false)}
                    className="flex-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] py-2.5 text-xs font-semibold text-[#667085]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingTable}
                    className="flex-1 rounded-xl bg-[#DE8626] py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#C4721C] disabled:opacity-50"
                  >
                    {savingTable ? 'Adding...' : 'Add Table'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 2b. Edit Dining Table Modal */}
        {editModalOpen && editTable && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-xl bg-amber-500/15 p-2 text-[#DE8626]">
                    <Edit2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                      Edit Table T-{editTable.tableNumber}
                    </h3>
                    <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                      Update table label, capacity or floor section
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditModalOpen(false);
                    setEditTable(null);
                  }}
                  className="rounded-lg p-1 text-[#667085] hover:bg-black/5"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateTable} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                    Table Number / Label *
                  </label>
                  <input
                    type="text"
                    required
                    value={editTableNumber}
                    onChange={(e) => setEditTableNumber(e.target.value)}
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                    Seating Capacity (Guests) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="50"
                    value={editSeatingCapacity}
                    onChange={(e) => setEditSeatingCapacity(e.target.value)}
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                    Floor Section *
                  </label>
                  <input
                    type="text"
                    required
                    value={editSectionName}
                    onChange={(e) => setEditSectionName(e.target.value)}
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditModalOpen(false);
                      setEditTable(null);
                    }}
                    className="flex-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] py-2.5 text-xs font-semibold text-[#667085]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="flex-1 rounded-xl bg-[#DE8626] py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#C4721C] disabled:opacity-50"
                  >
                    {savingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 3. Table QR Sticker Modal */}
        {qrTable && (
          <TableQrModal
            isOpen={Boolean(qrTable)}
            onClose={() => setQrTable(null)}
            tableId={qrTable.id}
            tableNumber={String(qrTable.tableNumber)}
            restaurantId={currentRestId}
            restaurantName={activeRestaurant?.restaurantName || 'Menza Restaurant'}
          />
        )}

        {/* 4. Storefront Standee QR Modal */}
        {storefrontQrOpen && (
          <StorefrontQrModal
            isOpen={storefrontQrOpen}
            onClose={() => setStorefrontQrOpen(false)}
            restaurantId={currentRestId}
            restaurantName={activeRestaurant?.restaurantName || 'Menza Restaurant'}
          />
        )}

        {/* 4b. Table QR Selector Modal (Header Quick Action) */}
        {tableQrPickerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-lg rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-6 shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between pb-3 border-b border-[#E7E1DA] dark:border-[#2B3540]">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-[#DE8626]">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                      Generate Dine-in Table QR
                    </h3>
                    <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                      Select a dining table to view, download, or print its QR ordering sticker
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setTableQrPickerOpen(false);
                    setTableQrSearch('');
                  }}
                  className="rounded-lg p-1.5 text-[#667085] hover:bg-black/5"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="my-3">
                <input
                  type="text"
                  placeholder="Filter tables by number or section..."
                  value={tableQrSearch}
                  onChange={(e) => setTableQrSearch(e.target.value)}
                  className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                />
              </div>

              {/* Table List / Grid */}
              <div className="overflow-y-auto max-h-80 space-y-2 py-1 pr-1">
                {(() => {
                  const q = tableQrSearch.toLowerCase().trim();
                  const matched = tables.filter(
                    (t) =>
                      !q ||
                      String(t.tableNumber).toLowerCase().includes(q) ||
                      (t.sectionName || '').toLowerCase().includes(q)
                  );

                  if (matched.length === 0) {
                    return (
                      <div className="rounded-2xl border border-dashed border-[#E7E1DA] dark:border-[#2B3540] p-8 text-center text-xs text-[#667085]">
                        No tables matched your search.
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {matched.map((tbl) => (
                        <button
                          key={tbl.id}
                          type="button"
                          onClick={() => {
                            setTableQrPickerOpen(false);
                            setTableQrSearch('');
                            setQrTable(tbl);
                          }}
                          className="group flex flex-col items-start justify-between rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] p-3 text-left hover:border-[#DE8626] hover:bg-amber-500/5 transition-all"
                        >
                          <div className="flex w-full items-center justify-between mb-1.5">
                            <span className="text-base font-extrabold text-[#1E2930] dark:text-[#F3F4F6] group-hover:text-[#DE8626]">
                              T-{tbl.tableNumber}
                            </span>
                            <span className="flex items-center gap-1 rounded-lg bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-[#DE8626]">
                              <QrCode className="h-3 w-3" />
                              <span>QR</span>
                            </span>
                          </div>
                          <div className="text-[10px] text-[#667085] dark:text-[#94A3B8]">
                            {tbl.sectionName || 'Main Dining'} • {tbl.seatingCapacity || 4} Seats
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Bottom Footer with Store QR Alternative */}
              <div className="mt-3 pt-3 border-t border-[#E7E1DA] dark:border-[#2B3540] flex items-center justify-between text-xs">
                <span className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                  Looking for the general store standee?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTableQrPickerOpen(false);
                    setStorefrontQrOpen(true);
                  }}
                  className="font-bold text-[#DE8626] hover:underline flex items-center gap-1 text-[11px]"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  <span>Generate Store Profile QR</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. Order Settlement Modal */}
        {settlingOrder && (
          <OrderSettleModal
            isOpen={Boolean(settlingOrder)}
            onClose={() => setSettlingOrder(null)}
            order={settlingOrder}
            onSettled={async () => {
              if (settlingOrder?.tableId) {
                usePosCatalogStore.getState().freeTableInCatalog(settlingOrder.tableId);
                setTables((prev) =>
                  prev.map((t) =>
                    t.id === settlingOrder.tableId
                      ? { ...t, status: 'Available', activeOrderId: undefined, currentOrderId: undefined, occupiedSince: undefined }
                      : t
                  )
                );
                setActiveOrders((prev) =>
                  prev.filter((o) => o.tableId !== settlingOrder.tableId && o.id !== settlingOrder.id)
                );
              }
              await loadData();
              setSettlingOrder(null);
            }}
          />
        )}

        {/* 6. Shift / Transfer Table Modal */}
        {shiftModalOpen && shiftSourceTable && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E7E1DA] dark:border-[#2B3540]">
                <div className="flex items-center gap-2">
                  <MoveRight className="h-5 w-5 text-[#DE8626]" />
                  <div>
                    <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                      Shift Table T-{shiftSourceTable.tableNumber}
                    </h3>
                    <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                      Move running order and guests to another available table
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShiftModalOpen(false)}
                  className="rounded-lg p-1 text-[#667085] hover:bg-black/5"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Destination Table Picker */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#667085] uppercase mb-2">
                    Select Target Available Table *
                  </label>
                  {(() => {
                    const availableTables = tables.filter(
                      (t) =>
                        t.id !== shiftSourceTable.id &&
                        (t.status || '').toUpperCase() === 'AVAILABLE' &&
                        !t.activeOrderId
                    );

                    if (availableTables.length === 0) {
                      return (
                        <div className="rounded-2xl border border-dashed border-[#E7E1DA] dark:border-[#2B3540] p-4 text-center text-xs text-[#667085]">
                          No other available tables currently on the floor. Please free or clean a table first.
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-1">
                        {availableTables.map((t) => {
                          const isSelected = shiftTargetTableId === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setShiftTargetTableId(t.id)}
                              className={`flex flex-col items-center justify-center rounded-2xl border p-3 text-center transition-all ${
                                isSelected
                                  ? 'border-[#DE8626] bg-[#DE8626] text-white shadow-md'
                                  : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626]'
                              }`}
                            >
                              <span className="text-base font-extrabold">T-{t.tableNumber}</span>
                              <span className="text-[10px] opacity-75">{t.seatingCapacity || 4} Seats</span>
                              <span className="text-[9px] opacity-60 truncate max-w-[80px]">
                                {t.sectionName || 'Main'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Transfer Reason */}
                <div>
                  <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                    Reason for Shift (Optional)
                  </label>
                  <input
                    type="text"
                    value={shiftReason}
                    onChange={(e) => setShiftReason(e.target.value)}
                    placeholder="e.g. Guest requested AC section / larger seating"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-[#DE8626]"
                  />
                </div>

                {/* Confirm & Cancel Buttons */}
                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShiftModalOpen(false)}
                    className="flex-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] py-2.5 text-xs font-semibold text-[#667085]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!shiftTargetTableId || isShifting}
                    onClick={handleTransferTable}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#DE8626] py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#C4721C] disabled:opacity-50"
                  >
                    {isShifting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Shifting...</span>
                      </>
                    ) : (
                      <>
                        <MoveRight className="h-4 w-4" />
                        <span>Confirm Shift</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 7. Merge Tables Modal */}
        {mergeModalOpen && mergeTargetTable && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-lg rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E7E1DA] dark:border-[#2B3540]">
                <div className="flex items-center gap-2">
                  <div className="rounded-xl bg-purple-500/10 p-2 text-purple-600 dark:text-purple-400">
                    <GitMerge className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">
                      Merge Tables into Table T-{mergeTargetTable.tableNumber}
                    </h3>
                    <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">
                      Combine running orders and guests from other occupied tables into this master tab
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setMergeModalOpen(false)}
                  className="rounded-lg p-1 text-[#667085] hover:bg-black/5"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Source Tables Selector */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-[#667085] uppercase">
                      Select Tables to Merge *
                    </label>
                    <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">
                      {selectedMergeSourceIds.length} Selected
                    </span>
                  </div>

                  {(() => {
                    const mergeableTables = tables.filter((t) => {
                      if (t.id === mergeTargetTable.id) return false;
                      const activeOrder = getOrderForTable(t);
                      const st = (t.status || '').toUpperCase();
                      return st === 'OCCUPIED' || st === 'BILLED' || Boolean(t.activeOrderId) || Boolean(activeOrder);
                    });

                    if (mergeableTables.length === 0) {
                      return (
                        <div className="rounded-2xl border border-dashed border-[#E7E1DA] dark:border-[#2B3540] p-6 text-center text-xs text-[#667085]">
                          No other occupied tables currently on the floor to merge into Table T-{mergeTargetTable.tableNumber}.
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1">
                        {mergeableTables.map((t) => {
                          const order = getOrderForTable(t);
                          const isSelected = selectedMergeSourceIds.includes(t.id);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                setSelectedMergeSourceIds((prev) =>
                                  isSelected ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                                );
                              }}
                              className={`relative flex flex-col items-start justify-between rounded-2xl border p-3 text-left transition-all ${
                                isSelected
                                  ? 'border-purple-500 bg-purple-500/10 text-[#1E2930] dark:text-[#F3F4F6] shadow-sm'
                                  : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] text-[#1E2930] dark:text-[#F3F4F6] hover:border-purple-400'
                              }`}
                            >
                              <div className="flex w-full items-center justify-between mb-1">
                                <span className="text-sm font-extrabold">T-{t.tableNumber}</span>
                                <span
                                  className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                    isSelected
                                      ? 'bg-purple-600 text-white'
                                      : 'border border-[#667085]/40 text-transparent'
                                  }`}
                                >
                                  ✓
                                </span>
                              </div>
                              <div className="text-[10px] text-[#667085] dark:text-[#94A3B8] truncate w-full">
                                {order?.customerName || 'Dine-In Guest'}
                              </div>
                              <div className="mt-1 text-xs font-bold text-[#DE8626]">
                                ₹{order?.totalAmount || 0}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Merge Reason */}
                <div>
                  <label className="block text-xs font-semibold text-[#667085] uppercase mb-1">
                    Reason / Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={mergeReason}
                    onChange={(e) => setMergeReason(e.target.value)}
                    placeholder="e.g. Guests joined tables for dinner party"
                    className="w-full rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FAF7F2] dark:bg-[#151A20] px-3.5 py-2 text-xs font-medium text-[#1E2930] dark:text-[#F3F4F6] outline-none focus:border-purple-500"
                  />
                </div>

                {/* Confirm & Cancel Buttons */}
                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMergeModalOpen(false)}
                    className="flex-1 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] py-2.5 text-xs font-semibold text-[#667085]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={selectedMergeSourceIds.length === 0 || isMerging}
                    onClick={handleMergeTables}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 py-2.5 text-xs font-bold text-white shadow-md disabled:opacity-50 transition-colors"
                  >
                    {isMerging ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Merging Tables...</span>
                      </>
                    ) : (
                      <>
                        <GitMerge className="h-4 w-4" />
                        <span>Confirm Merge ({selectedMergeSourceIds.length})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        </FeatureGate>
      </AppShell>
    </AuthGuard>
  );
}
