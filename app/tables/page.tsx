'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table as TableIcon,
  Plus,
  Users,
  Clock,
  IndianRupee,
  ShoppingBag,
  Receipt,
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
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppShell } from '@/components/layout/AppShell';
import { TableQrModal } from '@/components/tables/TableQrModal';
import { StorefrontQrModal } from '@/components/tables/StorefrontQrModal';
import { OrderSettleModal } from '@/components/orders/OrderSettleModal';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { usePrinterStore } from '@shared/presentation/state/usePrinterStore';
import { TableRemoteDataSource } from '@shared/data/datasources/TableRemoteDataSource';
import { OrderRemoteDataSource } from '@shared/data/datasources/OrderRemoteDataSource';
import { RestaurantConfigRemoteDataSource } from '@shared/data/datasources/RestaurantConfigRemoteDataSource';
import { TableMaster } from '@shared/domain/models/Table';
import { OrderMaster } from '@shared/domain/models/Order';
import { RestaurantConfig } from '@shared/domain/models/RestaurantConfig';
import { ReceiptData } from '@shared/core/printer/EscPosBuilder';
import { WebPrinterService } from '@/services/webPrinterService';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
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

  const [tables, setTables] = useState<TableMaster[]>([]);
  const [activeOrders, setActiveOrders] = useState<OrderMaster[]>([]);
  const [restaurantConfig, setRestaurantConfig] = useState<RestaurantConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState<string>('ALL');

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

  const handleResolveService = (tableId: number, requestId?: any) => {
    setServiceRequests((prev) =>
      prev.filter((r) => {
        if (requestId && (r.requestId === requestId || String(r.requestId) === String(requestId))) return false;
        if (r.tableId === tableId) return false;
        return true;
      })
    );
  };

  const loadData = useCallback(async () => {
    if (!currentRestId) return;
    try {
      setLoading(true);
      const [tablesRes, ordersRes, cfgRes] = await Promise.allSettled([
        tableDataSource.getTables(currentRestId),
        orderDataSource.getTodayOrders(currentRestId, 'ALL', 1, 50),
        configDataSource.getConfig(currentRestId),
      ]);

      if (tablesRes.status === 'fulfilled' && Array.isArray(tablesRes.value)) {
        setTables(tablesRes.value);
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
      setLoading(false);
    }
  }, [currentRestId]);

  useEffect(() => {
    loadData();

    if (currentRestId) {
      startPosSignalRConnection(currentRestId).catch(() => {});
      const unsub1 = onPosOrderCreated(() => loadData());
      const unsub2 = onPosOrderStatusChanged(() => loadData());
      const unsub3 = onPosOrderSettled(() => loadData());
      const unsub4 = onPosTableStatusChanged(() => loadData());
      const unsub5 = onSignalRReconnected(() => loadData());

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
        loadData();
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

      const interval = setInterval(loadData, 20000);
      return () => {
        clearInterval(interval);
        unsub1();
        unsub2();
        unsub3();
        unsub4();
        unsub5();
        unsub6();
        unsub7();
      };
    }
  }, [currentRestId, loadData]);

  // Unique sections list
  const sections = useMemo(() => {
    const list = Array.from(new Set(tables.map((t) => t.sectionName || 'Main Dining')));
    return ['ALL', ...list];
  }, [tables]);

  // Filtered tables
  const filteredTables = useMemo(() => {
    if (selectedSection === 'ALL') return tables;
    return tables.filter((t) => (t.sectionName || 'Main Dining') === selectedSection);
  }, [tables, selectedSection]);

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

  // Find active order for table
  const getOrderForTable = (table: TableMaster) => {
    return activeOrders.find(
      (o) =>
        (o.tableId === table.id || o.tableName === table.tableNumber || o.tableName === table.tableName) &&
        o.status !== 'SETTLED' &&
        o.status !== 'CANCELLED'
    );
  };

  const handleSelectTable = async (tbl: TableMaster) => {
    setActionTable(tbl);
    setActiveTableOrder(null);
    const existingOrder = getOrderForTable(tbl);
    const statusUpper = (tbl.status || '').toUpperCase();
    const isOccupied = statusUpper === 'OCCUPIED' || statusUpper === 'BILLED' || Boolean(tbl.activeOrderId) || Boolean(existingOrder);
    if (isOccupied) {
      try {
        setLoadingActiveOrder(true);
        const fetched = await orderDataSource.getActiveOrderByTable(tbl.id, currentRestId);
        setActiveTableOrder(fetched || existingOrder || null);
      } catch (err) {
        console.warn('Failed to load active table order:', err);
        setActiveTableOrder(existingOrder || null);
      } finally {
        setLoadingActiveOrder(false);
      }
    }
  };

  const handlePrintGuestCheck = (order: OrderMaster, table: TableMaster) => {
    const receiptData: ReceiptData = {
      orderId: order.id,
      orderNumber: String(order.orderNumber || order.id),
      pickupToken: String(order.pickupToken || order.id),
      restaurantName: restaurantConfig?.restaurantName || activeRestaurant?.restaurantName || 'Menza Restaurant',
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
      date: new Date().toLocaleString('en-IN'),
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
          ? { ...t, status: newStatus, activeOrderId: undefined }
          : t
      )
    );
    setActionTable(null);
    setActiveTableOrder(null);
    try {
      await tableDataSource.freeTable(tableId, {
        restaurantId: currentRestId,
        transitionToCleaning,
        settleActiveOrder: false,
        releasedByRole: 'STAFF',
      });
      loadData();
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

  const occupiedCount = tables.filter((t) => {
    const st = (t.status || '').toUpperCase();
    return st === 'OCCUPIED' || st === 'BILLED' || Boolean(t.activeOrderId);
  }).length;

  return (
    <AuthGuard>
      <AppShell>
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E2930] dark:text-[#F3F4F6]">
                  Floor & Table Management
                </h1>
                <span className="rounded-full bg-emerald-500/10 px-3 py-0.5 text-xs font-bold text-emerald-600">
                  {occupiedCount} Occupied / {tables.length} Total
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-[#667085] dark:text-[#94A3B8]">
                Real-time dining room floor plan, table status tracking, and order assignment
              </p>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setStorefrontQrOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-[#DE8626] bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-[#DE8626] hover:bg-amber-500/20 transition-colors"
              >
                <QrCode className="h-4 w-4" />
                <span>Store Standee QR</span>
              </button>

              <button
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] px-3.5 py-2 text-xs font-semibold text-[#1E2930] dark:text-[#F3F4F6] hover:bg-black/5"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Sync</span>
              </button>

              <button
                onClick={() => setAddModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-[#DE8626] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#DE8626]/20 hover:bg-[#C4721C] transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Add Table</span>
              </button>
            </div>
          </div>

          {/* Section Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {sections.map((sec) => (
              <button
                key={sec}
                onClick={() => setSelectedSection(sec)}
                className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  selectedSection === sec
                    ? 'bg-[#DE8626] text-white shadow-sm shadow-[#DE8626]/20'
                    : 'border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] text-[#667085] dark:text-[#94A3B8] hover:border-[#DE8626]'
                }`}
              >
                {sec === 'ALL' ? `All Floor (${tables.length})` : sec}
              </button>
            ))}
          </div>

          {/* Tables Grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                <div
                  key={n}
                  className="h-40 rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] animate-pulse"
                />
              ))}
            </div>
          ) : filteredTables.length === 0 ? (
            <div className="rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-white dark:bg-[#1B2127] p-16 text-center text-xs text-[#667085]">
              No tables configured in this section. Click "Add Table" to set up your floor plan.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredTables.map((tbl) => {
                const activeOrder = getOrderForTable(tbl);
                const statusUpper = (tbl.status || '').toUpperCase();
                const isBilled = statusUpper === 'BILLED';
                const isCleaning = statusUpper === 'CLEANING';
                const isOccupied = statusUpper === 'OCCUPIED' || Boolean(tbl.activeOrderId) || Boolean(activeOrder);

                const activeServiceReq = serviceRequests.find(
                  (r) => r.tableId === tbl.id || r.tableName === tbl.tableNumber || r.tableName === tbl.tableName
                );
                const hasBillRequest = activeServiceReq?.requestType === 'REQUEST_BILL';
                const hasWaterRequest = activeServiceReq?.requestType === 'REQUEST_WATER';
                const hasWaiterCall = activeServiceReq?.requestType === 'CALL_WAITER';

                return (
                  <div
                    key={tbl.id}
                    onClick={() => handleSelectTable(tbl)}
                    className={`group relative flex flex-col justify-between rounded-3xl border p-4 shadow-sm transition-all cursor-pointer select-none ${
                      hasBillRequest
                        ? 'border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/[0.03] hover:shadow-md'
                        : hasWaterRequest
                        ? 'border-sky-500 ring-2 ring-sky-500/30 bg-sky-500/[0.03] hover:shadow-md'
                        : hasWaiterCall
                        ? 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-500/[0.03] hover:shadow-md'
                        : isOccupied
                        ? 'border-amber-400/80 bg-gradient-to-br from-amber-500/10 to-[#FFFFFF] dark:to-[#1B2127] hover:border-[#DE8626] hover:shadow-md'
                        : isBilled
                        ? 'border-amber-500/80 bg-amber-500/5 hover:border-amber-500 hover:shadow-md'
                        : isCleaning
                        ? 'border-blue-400/80 bg-blue-500/5 hover:border-blue-500 hover:shadow-md'
                        : 'border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] hover:border-[#DE8626] hover:shadow-md'
                    }`}
                  >
                    <div>
                      {/* Top Header: Seating & Status */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-[#667085] dark:text-[#94A3B8]">
                          <Users className="h-3 w-3" />
                          <span>{tbl.seatingCapacity || 4}p</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQrTable(tbl);
                            }}
                            title="Print Table QR Sticker"
                            className="rounded-lg p-1 text-[#667085] hover:bg-amber-500/10 hover:text-[#DE8626] transition-colors"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                          </button>
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
                            {tbl.status || (isOccupied ? 'Occupied' : 'Available')}
                          </span>
                        </div>
                      </div>

                      {/* Large Table Number & Live Service Request Badge */}
                      <div className="my-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-extrabold text-[#1E2930] dark:text-[#F3F4F6]">
                            T-{tbl.tableNumber}
                          </h3>
                          {isOccupied && activeOrder && (
                            (() => {
                              const elapsedMins = activeOrder.createdAt
                                ? Math.max(0, Math.floor((Date.now() - new Date(activeOrder.createdAt).getTime()) / 60000))
                                : 0;
                              return (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                    elapsedMins < 20
                                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                      : elapsedMins < 45
                                      ? 'bg-amber-500/10 text-[#DE8626] border-amber-500/20'
                                      : 'bg-red-500/10 text-red-600 border-red-500/20 animate-pulse'
                                  }`}
                                  title={`Seated ${elapsedMins} mins ago`}
                                >
                                  <Clock className="h-2.5 w-2.5" />
                                  <span>{elapsedMins}m</span>
                                </span>
                              );
                            })()
                          )}
                        </div>

                        {activeServiceReq && (
                          <div
                            className={`my-1.5 flex items-center gap-1.5 rounded-xl px-2 py-0.5 text-[10px] font-extrabold border animate-pulse ${
                              hasBillRequest
                                ? 'border-rose-500/40 bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                : hasWaterRequest
                                ? 'border-sky-500/40 bg-sky-500/15 text-sky-600 dark:text-sky-400'
                                : 'border-amber-500/40 bg-amber-500/15 text-[#DE8626]'
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

                        <p className="text-[10px] text-[#667085] dark:text-[#94A3B8] truncate">
                          {tbl.sectionName || 'Main Dining'}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Status / Order Info */}
                    <div className="pt-3 border-t border-[#E7E1DA]/60 dark:border-[#2B3540]/60 mt-2">
                      {isOccupied && activeOrder ? (
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <span className="font-extrabold text-[#DE8626] block">
                              ₹{activeOrder.totalAmount || 0}
                            </span>
                            <span className="text-[10px] text-[#667085] truncate block">
                              #{activeOrder.id} • {activeOrder.status || 'Active'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSettlingOrder(activeOrder);
                            }}
                            className="flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 text-[11px] font-bold shadow-xs transition-colors"
                            title="Settle Bill and Free Table"
                          >
                            <Receipt className="h-3 w-3" />
                            <span>Settle</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-xs text-[#667085] dark:text-[#94A3B8] group-hover:text-[#DE8626]">
                          <span className="text-[11px] font-semibold">Seat Guests</span>
                          <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                        </div>
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
          const isOccupied = statusUpper === 'OCCUPIED' || Boolean(actionTable.activeOrderId) || Boolean(activeOrder);
          const isBilled = statusUpper === 'BILLED';
          const isCleaning = statusUpper === 'CLEANING';

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
                      onClick={() => {
                        if (!useSubscriptionStore.getState().canTakeOrders()) {
                          useSubscriptionStore.getState().openRenewalModal();
                          return;
                        }
                        const targetId = actionTable.id;
                        setActionTable(null);
                        router.push(`/pos?tableId=${targetId}`);
                      }}
                      className={`flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-bold transition-colors ${
                        activeOrder
                          ? 'border border-[#E7E1DA] dark:border-[#2B3540] text-[#1E2930] dark:text-[#F3F4F6] hover:border-[#DE8626]'
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
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-[#E7E1DA] dark:border-[#2B3540] py-2 text-xs font-semibold text-[#667085] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      <span>QR Sticker</span>
                    </button>

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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-3xl border border-[#E7E1DA] dark:border-[#2B3540] bg-[#FFFFFF] dark:bg-[#1B2127] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[#1E2930] dark:text-[#F3F4F6]">Add Dining Table</h3>
                <button onClick={() => setAddModalOpen(false)} className="rounded-lg p-1 text-[#667085]">
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

        {/* 5. Order Settlement Modal */}
        {settlingOrder && (
          <OrderSettleModal
            isOpen={Boolean(settlingOrder)}
            onClose={() => setSettlingOrder(null)}
            order={settlingOrder}
            onSettled={async () => {
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
      </AppShell>
    </AuthGuard>
  );
}
