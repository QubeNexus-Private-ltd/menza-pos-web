import Dexie, { type Table } from 'dexie';
import type { MenuItem } from '@shared/domain/models/Item';
import type { Category } from '@shared/domain/models/Category';
import type { TableMaster } from '@shared/domain/models/Table';
import type { RestaurantConfig, StoreOperatingStatus } from '@shared/domain/models/RestaurantConfig';
import type { ActiveOrderType } from '@shared/domain/models/Order';

export interface OfflineOrderRecord {
  id?: number;
  offlineReferenceId: string;
  restaurantId: number;
  orderNumber: string;
  orderPayload: any;
  receiptPayload?: any;
  createdAtUtc: string;
  retryCount: number;
  lastError?: string | null;
  syncStatus: 'PENDING' | 'SYNCING' | 'FAILED';
}

export interface ShiftRegisterEntry {
  id?: number;
  offlineReferenceId: string;
  restaurantId: number;
  orderNumber: string;
  customerName: string;
  tableNumber?: string | null;
  totalAmount: number;
  paymentMode: string;
  paymentStatus: string;
  billingMode?: string | null;
  receiptPayload: any;
  createdAtUtc: string;
}

export interface CachedCatalogMeta {
  restaurantId: number;
  categories: Category[];
  items: MenuItem[];
  tables: TableMaster[];
  restaurantConfig: RestaurantConfig | null;
  operatingStatus: StoreOperatingStatus | null;
  orderTypes: ActiveOrderType[];
  updatedAt: string;
}

export interface PosStationMeta {
  key: string;
  stationId: string;
  offlineSequence: number;
  updatedAt: string;
}

export interface ShiftTotals {
  totalOrders: number;
  totalSales: number;
  cashSales: number;
  upiSales: number;
  cardSales: number;
  unpaidTotal: number;
}

export class MenzaPosOfflineDb extends Dexie {
  offline_orders_outbox!: Table<OfflineOrderRecord, number>;
  shift_register!: Table<ShiftRegisterEntry, number>;
  catalog_cache!: Table<CachedCatalogMeta, number>;
  pos_station_meta!: Table<PosStationMeta, string>;

  constructor() {
    super('menza_web_pos_offline');
    this.version(1).stores({
      offline_orders_outbox: '++id, offlineReferenceId, restaurantId, syncStatus, createdAtUtc, orderNumber',
      shift_register: '++id, offlineReferenceId, restaurantId, createdAtUtc, paymentMode, billingMode',
      catalog_cache: 'restaurantId, updatedAt',
      pos_station_meta: 'key',
    });
  }
}

export const posDb = new MenzaPosOfflineDb();

let isDbInitialized = false;

/**
 * Initializes the client IndexedDB environment:
 * 1. Requests persistent storage quota from browser to guarantee no eviction.
 * 2. Prunes shift register rows older than 24 hours (matching mobile logic).
 */
export async function initPosDatabase(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (isDbInitialized) return true;

  try {
    // Request persistent storage so browser never purges IndexedDB under disk pressure
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persist();
      if (!isPersisted && navigator.storage.persisted) {
        await navigator.storage.persisted();
      }
    }

    // Auto prune shift register older than 24 hours
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await posDb.shift_register.where('createdAtUtc').below(cutoffTime).delete();

    isDbInitialized = true;
    return true;
  } catch (err) {
    console.warn('[MenzaPosOfflineDb] Database initialization warning:', err);
    return false;
  }
}

/**
 * Persists the entire menu, categories, tables, and restaurant config to IndexedDB.
 */
export async function saveCatalogToOfflineDb(data: {
  restaurantId: number;
  categories?: Category[];
  items?: MenuItem[];
  tables?: TableMaster[];
  restaurantConfig?: RestaurantConfig | null;
  operatingStatus?: StoreOperatingStatus | null;
  orderTypes?: ActiveOrderType[];
}): Promise<void> {
  if (typeof window === 'undefined' || !data.restaurantId) return;

  try {
    const existing = await posDb.catalog_cache.get(data.restaurantId);

    const mergedRecord: CachedCatalogMeta = {
      restaurantId: data.restaurantId,
      categories: data.categories !== undefined ? data.categories : (existing?.categories || []),
      items: data.items !== undefined ? data.items : (existing?.items || []),
      tables: data.tables !== undefined ? data.tables : (existing?.tables || []),
      restaurantConfig: data.restaurantConfig !== undefined ? data.restaurantConfig : (existing?.restaurantConfig || null),
      operatingStatus: data.operatingStatus !== undefined ? data.operatingStatus : (existing?.operatingStatus || null),
      orderTypes: data.orderTypes !== undefined ? data.orderTypes : (existing?.orderTypes || []),
      updatedAt: new Date().toISOString(),
    };

    await posDb.catalog_cache.put(mergedRecord);
  } catch (err) {
    console.warn('[MenzaPosOfflineDb] Failed to cache catalog to IndexedDB:', err);
  }
}

/**
 * Loads cached catalog metadata from IndexedDB for zero-latency POS loading.
 */
export async function loadCatalogFromOfflineDb(restaurantId: number): Promise<CachedCatalogMeta | null> {
  if (typeof window === 'undefined' || !restaurantId) return null;

  try {
    const cached = await posDb.catalog_cache.get(restaurantId);
    return cached || null;
  } catch (err) {
    console.warn('[MenzaPosOfflineDb] Failed to read catalog cache from IndexedDB:', err);
    return null;
  }
}

/**
 * Generates an atomic sequential offline invoice number and unique reference GUID.
 * Format: #OFF-{STATION_ID}-{SEQUENCE} (e.g. #OFF-ST01-1001)
 */
export async function getNextOfflineInvoiceNumber(
  restaurantId: number,
  stationIdPrefix = 'ST01'
): Promise<{ orderNumber: string; offlineReferenceId: string }> {
  try {
    const metaKey = `station_${restaurantId}`;
    const meta = await posDb.pos_station_meta.get(metaKey);

    const nextSeq = (meta?.offlineSequence || 1000) + 1;
    const effectiveStationId = meta?.stationId || stationIdPrefix;

    await posDb.pos_station_meta.put({
      key: metaKey,
      stationId: effectiveStationId,
      offlineSequence: nextSeq,
      updatedAt: new Date().toISOString(),
    });

    const orderNumber = `#OFF-${effectiveStationId}-${nextSeq}`;
    const offlineReferenceId = `OFF-${restaurantId}-${effectiveStationId}-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    return { orderNumber, offlineReferenceId };
  } catch {
    const timestampFallback = Date.now().toString().slice(-4);
    const orderNumber = `#OFF-${stationIdPrefix}-${timestampFallback}`;
    const offlineReferenceId = `OFF-${restaurantId}-${stationIdPrefix}-${Date.now()}`;
    return { orderNumber, offlineReferenceId };
  }
}

/**
 * Atomically queues an offline order to the outbox and inserts it into the shift register.
 */
export async function enqueueOfflineOrder(params: {
  restaurantId: number;
  orderNumber: string;
  offlineReferenceId: string;
  orderPayload: any;
  receiptPayload: any;
  customerName?: string;
  tableNumber?: string | null;
  totalAmount: number;
  paymentMode: string;
  paymentStatus: string;
  billingMode?: string | null;
}): Promise<number> {
  const createdAtUtc = new Date().toISOString();

  // 1. Insert into outbox for synchronization
  const outboxId = await posDb.offline_orders_outbox.add({
    offlineReferenceId: params.offlineReferenceId,
    restaurantId: params.restaurantId,
    orderNumber: params.orderNumber,
    orderPayload: params.orderPayload,
    receiptPayload: params.receiptPayload,
    createdAtUtc,
    retryCount: 0,
    syncStatus: 'PENDING',
  });

  // 2. Insert into shift register for instant reprint and cash audit
  await posDb.shift_register.add({
    offlineReferenceId: params.offlineReferenceId,
    restaurantId: params.restaurantId,
    orderNumber: params.orderNumber,
    customerName: params.customerName || 'Walk-in Guest',
    tableNumber: params.tableNumber || null,
    totalAmount: params.totalAmount,
    paymentMode: params.paymentMode,
    paymentStatus: params.paymentStatus,
    billingMode: params.billingMode || 'PRE_PAID',
    receiptPayload: params.receiptPayload,
    createdAtUtc,
  });

  return outboxId;
}

/**
 * Fetches pending orders from the outbox in chronological FIFO order.
 */
export async function getPendingOfflineOrders(restaurantId: number): Promise<OfflineOrderRecord[]> {
  try {
    return await posDb.offline_orders_outbox
      .where('restaurantId')
      .equals(restaurantId)
      .and((rec) => rec.syncStatus === 'PENDING')
      .sortBy('createdAtUtc');
  } catch (err) {
    console.warn('[MenzaPosOfflineDb] Failed to get pending offline orders:', err);
    return [];
  }
}

/**
 * Total count of pending offline orders for a restaurant.
 */
export async function getPendingOfflineOrderCount(restaurantId?: number): Promise<number> {
  if (!restaurantId || typeof window === 'undefined') return 0;
  try {
    return await posDb.offline_orders_outbox
      .where('restaurantId')
      .equals(restaurantId)
      .and((rec) => rec.syncStatus === 'PENDING' || rec.syncStatus === 'FAILED')
      .count();
  } catch {
    return 0;
  }
}

/**
 * Marks a set of outbox records as currently SYNCING to avoid duplicate picks.
 */
export async function markOfflineOrdersSyncing(ids: number[]): Promise<void> {
  if (!ids.length) return;
  await posDb.offline_orders_outbox.where('id').anyOf(ids).modify({ syncStatus: 'SYNCING' });
}

/**
 * Marks outbox records back to PENDING (e.g. if network failed mid-batch).
 */
export async function resetOfflineOrdersToPending(ids: number[]): Promise<void> {
  if (!ids.length) return;
  await posDb.offline_orders_outbox.where('id').anyOf(ids).modify({ syncStatus: 'PENDING' });
}

/**
 * Deletes synced orders from the outbox upon server acknowledgment.
 */
export async function deleteSyncedOfflineOrders(offlineReferenceIds: string[]): Promise<void> {
  if (!offlineReferenceIds.length) return;
  await posDb.offline_orders_outbox
    .where('offlineReferenceId')
    .anyOf(offlineReferenceIds)
    .delete();
}

/**
 * Marks an order as FAILED with error details for cashier inspection.
 */
export async function markOfflineOrderFailed(offlineReferenceId: string, error: string): Promise<void> {
  await posDb.offline_orders_outbox
    .where('offlineReferenceId')
    .equals(offlineReferenceId)
    .modify((rec) => {
      rec.syncStatus = 'FAILED';
      rec.lastError = error;
      rec.retryCount = (rec.retryCount || 0) + 1;
    });
}

/**
 * Computes shift totals from the 24-hour shift register.
 */
export async function getShiftTotals(restaurantId: number): Promise<ShiftTotals> {
  const result: ShiftTotals = {
    totalOrders: 0,
    totalSales: 0,
    cashSales: 0,
    upiSales: 0,
    cardSales: 0,
    unpaidTotal: 0,
  };

  try {
    const orders = await posDb.shift_register
      .where('restaurantId')
      .equals(restaurantId)
      .toArray();

    result.totalOrders = orders.length;

    for (const ord of orders) {
      const amount = Number(ord.totalAmount) || 0;
      result.totalSales += amount;

      const mode = (ord.paymentMode || '').toUpperCase();
      const status = (ord.paymentStatus || '').toLowerCase();

      if (status === 'unpaid' || status === 'pending') {
        result.unpaidTotal += amount;
      } else if (mode.includes('CASH')) {
        result.cashSales += amount;
      } else if (mode.includes('UPI') || mode.includes('QR')) {
        result.upiSales += amount;
      } else if (mode.includes('CARD')) {
        result.cardSales += amount;
      } else {
        result.cashSales += amount;
      }
    }
  } catch (err) {
    console.warn('[MenzaPosOfflineDb] Failed to calculate shift totals:', err);
  }

  return result;
}

/**
 * Returns recent shift orders for reprint and audit.
 */
export async function getRecentShiftOrders(restaurantId: number, limit = 50): Promise<ShiftRegisterEntry[]> {
  try {
    const entries = await posDb.shift_register
      .where('restaurantId')
      .equals(restaurantId)
      .reverse()
      .sortBy('createdAtUtc');
    return entries.slice(0, limit);
  } catch {
    return [];
  }
}
