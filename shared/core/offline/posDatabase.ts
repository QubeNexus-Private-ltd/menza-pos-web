import * as SQLite from 'expo-sqlite';

export interface OfflineOrderQueueItem {
  id: number;
  offline_id: string;
  restaurant_id: number;
  order_payload: string; // JSON of PlaceOrderRequest
  created_at_utc: string;
  retry_count: number;
  last_error: string | null;
  sync_status: 'PENDING' | 'SYNCING' | 'FAILED';
}

export interface ShiftRegisterEntry {
  id?: number;
  offline_id: string;
  restaurant_id: number;
  order_number: string; // e.g. "#OFF-01"
  customer_name: string;
  table_number?: string | null;
  total_amount: number;
  payment_mode: string;
  payment_status: string;
  billing_mode?: string | null;
  receipt_payload: string; // JSON for instant reprint
  created_at_utc: string;
}

export interface ShiftTotals {
  totalOrders: number;
  totalSales: number;
  cashSales: number;
  upiSales: number;
  cardSales: number;
  unpaidTotal: number;
}

export interface CachedMenuItemRecord {
  id: number;
  restaurant_id: number;
  category_id?: number | null;
  category_name: string;
  item_name: string;
  price: number;
  item_json: string;
  updated_at_utc: string;
}

const DB_NAME = 'menza_pos_offline.db';
let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Initializes the Menza SQLite database with WAL mode and schema definitions.
 * Automatically runs the rolling 24-hour cleanup for shift register rows.
 */
export async function getPosDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const db = await SQLite.openDatabaseAsync(DB_NAME);

      // Performance & integrity pragmas
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;

        -- 1. Transient Outbox Queue (synced orders are DELETED IMMEDIATELY)
        CREATE TABLE IF NOT EXISTS offline_orders_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          offline_id TEXT UNIQUE NOT NULL,
          restaurant_id INTEGER NOT NULL,
          order_payload TEXT NOT NULL,
          created_at_utc TEXT NOT NULL,
          retry_count INTEGER DEFAULT 0,
          last_error TEXT,
          sync_status TEXT DEFAULT 'PENDING'
        );

        CREATE INDEX IF NOT EXISTS idx_offline_queue_rest_status 
        ON offline_orders_queue (restaurant_id, sync_status);

        -- 2. Daily Shift Register (24-hour rolling cache for bill reprints & shift balancing)
        CREATE TABLE IF NOT EXISTS daily_shift_register (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          offline_id TEXT NOT NULL,
          restaurant_id INTEGER NOT NULL,
          order_number TEXT NOT NULL,
          customer_name TEXT,
          table_number TEXT,
          total_amount REAL NOT NULL,
          payment_mode TEXT NOT NULL,
          payment_status TEXT NOT NULL,
          billing_mode TEXT,
          receipt_payload TEXT NOT NULL,
          created_at_utc TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_daily_shift_created 
        ON daily_shift_register (created_at_utc);

        CREATE INDEX IF NOT EXISTS idx_daily_shift_rest 
        ON daily_shift_register (restaurant_id);

        -- 3. Offline Menu Catalog Cache
        CREATE TABLE IF NOT EXISTS cached_menu_items (
          id INTEGER PRIMARY KEY,
          restaurant_id INTEGER NOT NULL,
          category_id INTEGER,
          category_name TEXT NOT NULL,
          item_name TEXT NOT NULL,
          price REAL NOT NULL,
          item_json TEXT NOT NULL,
          updated_at_utc TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_cached_menu_rest 
        ON cached_menu_items (restaurant_id);

        -- 4. Daily Local Token Counter (resets daily)
        CREATE TABLE IF NOT EXISTS offline_token_counters (
          restaurant_id INTEGER NOT NULL,
          date_key TEXT NOT NULL,
          last_token_number INTEGER NOT NULL,
          PRIMARY KEY (restaurant_id, date_key)
        );
      `);

      // Passive rolling 24-hour purge on initialization
      await pruneExpiredShiftRecords(db);

      dbInstance = db;
      return db;
    } catch (error) {
      initPromise = null;
      console.error('[posDatabase] Failed to initialize SQLite database:', error);
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Passive Rolling 24-Hour Expiration Query.
 * Automatically purges shift register rows older than 24 hours.
 */
export async function pruneExpiredShiftRecords(database?: SQLite.SQLiteDatabase): Promise<number> {
  try {
    const db = database || (await getPosDatabase());
    const result = await db.runAsync(
      `DELETE FROM daily_shift_register WHERE created_at_utc < datetime('now', '-24 hours')`
    );
    // Also prune counters older than 2 days
    await db.runAsync(
      `DELETE FROM offline_token_counters WHERE date_key < date('now', '-2 days')`
    );
    if (result.changes > 0) {
      console.log(`[posDatabase] Pruned ${result.changes} expired shift register rows (> 24h old).`);
    }
    return result.changes;
  } catch (error) {
    console.warn('[posDatabase] Failed to prune expired shift records:', error);
    return 0;
  }
}

/**
 * Generates the next sequential offline token for the day (e.g. #OFF-01)
 * and generates a unique offline reference ID.
 */
export async function getNextOfflineToken(restaurantId: number): Promise<{
  tokenNumber: number;
  tokenString: string;
  offlineId: string;
}> {
  const db = await getPosDatabase();
  const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  let result = {
    tokenNumber: 1,
    tokenString: '#OFF-01',
    offlineId: `OFF_${restaurantId}_${todayKey.replace(/-/g, '')}_1_${Date.now().toString(36)}`,
  };

  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ last_token_number: number }>(
      `SELECT last_token_number FROM offline_token_counters WHERE restaurant_id = ? AND date_key = ?`,
      [restaurantId, todayKey]
    );

    const nextNumber = (row?.last_token_number ?? 0) + 1;

    await db.runAsync(
      `INSERT INTO offline_token_counters (restaurant_id, date_key, last_token_number)
       VALUES (?, ?, ?)
       ON CONFLICT(restaurant_id, date_key) DO UPDATE SET last_token_number = ?`,
      [restaurantId, todayKey, nextNumber, nextNumber]
    );

    const tokenString = `#OFF-${String(nextNumber).padStart(2, '0')}`;
    const timestamp = Date.now().toString(36);
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const offlineId = `OFF_${restaurantId}_${todayKey.replace(/-/g, '')}_${nextNumber}_${timestamp}${randomSuffix}`;

    result = {
      tokenNumber: nextNumber,
      tokenString,
      offlineId,
    };
  });

  return result;
}

/**
 * Enqueues an offline order into the transient outbox queue.
 */
export async function enqueueOfflineOrder(params: {
  offlineId: string;
  restaurantId: number;
  orderPayload: any;
  createdAtUtc?: string;
}): Promise<void> {
  const db = await getPosDatabase();
  const createdUtc = params.createdAtUtc || new Date().toISOString();
  const payloadJson = JSON.stringify(params.orderPayload);

  await db.runAsync(
    `INSERT INTO offline_orders_queue (offline_id, restaurant_id, order_payload, created_at_utc, sync_status)
     VALUES (?, ?, ?, ?, 'PENDING')`,
    [params.offlineId, params.restaurantId, payloadJson, createdUtc]
  );
}

/**
 * Fetches all pending offline orders in chronological FIFO sequence.
 */
export async function getPendingOfflineOrders(restaurantId?: number): Promise<OfflineOrderQueueItem[]> {
  const db = await getPosDatabase();
  if (restaurantId && restaurantId > 0) {
    return await db.getAllAsync<OfflineOrderQueueItem>(
      `SELECT * FROM offline_orders_queue 
       WHERE restaurant_id = ? AND sync_status IN ('PENDING', 'FAILED')
       ORDER BY created_at_utc ASC`,
      [restaurantId]
    );
  }

  return await db.getAllAsync<OfflineOrderQueueItem>(
    `SELECT * FROM offline_orders_queue 
     WHERE sync_status IN ('PENDING', 'FAILED')
     ORDER BY created_at_utc ASC`
  );
}

/**
 * Returns count of pending offline orders awaiting sync.
 */
export async function getPendingOfflineOrderCount(restaurantId?: number): Promise<number> {
  try {
    const db = await getPosDatabase();
    if (restaurantId && restaurantId > 0) {
      const row = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM offline_orders_queue 
         WHERE restaurant_id = ? AND sync_status IN ('PENDING', 'FAILED')`,
        [restaurantId]
      );
      return row?.count ?? 0;
    }
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM offline_orders_queue WHERE sync_status IN ('PENDING', 'FAILED')`
    );
    return row?.count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Marks a batch of offline orders as currently syncing.
 */
export async function markOfflineOrdersSyncing(offlineIds: string[]): Promise<void> {
  if (!offlineIds.length) return;
  const db = await getPosDatabase();
  const placeholders = offlineIds.map(() => '?').join(',');
  await db.runAsync(
    `UPDATE offline_orders_queue 
     SET sync_status = 'SYNCING' 
     WHERE offline_id IN (${placeholders})`,
    offlineIds
  );
}

/**
 * IMMEDIATELY deletes synced orders from the SQLite outbox queue.
 * Guarantees zero outbox bloat and prevents split-brain order state.
 */
export async function deleteSyncedOfflineOrders(offlineIds: string[]): Promise<number> {
  if (!offlineIds.length) return 0;
  const db = await getPosDatabase();
  const placeholders = offlineIds.map(() => '?').join(',');
  const result = await db.runAsync(
    `DELETE FROM offline_orders_queue WHERE offline_id IN (${placeholders})`,
    offlineIds
  );
  console.log(`[posDatabase] Immediately purged ${result.changes} synced orders from outbox.`);
  return result.changes;
}

/**
 * Records a sync failure for an order and increments its retry counter.
 */
export async function markOfflineOrderFailed(offlineId: string, errorMessage: string): Promise<void> {
  const db = await getPosDatabase();
  await db.runAsync(
    `UPDATE offline_orders_queue 
     SET sync_status = 'FAILED', 
         retry_count = retry_count + 1, 
         last_error = ? 
     WHERE offline_id = ?`,
    [errorMessage, offlineId]
  );
}

/**
 * Records an order in the rolling 24-hour shift register for bill reprints and cash reconciliation.
 * Automatically runs the rolling 24-hour cleanup as a passive side-effect.
 */
export async function recordShiftRegisterOrder(entry: ShiftRegisterEntry): Promise<void> {
  const db = await getPosDatabase();
  const createdUtc = entry.created_at_utc || new Date().toISOString();

  await db.runAsync(
    `INSERT INTO daily_shift_register (
      offline_id, restaurant_id, order_number, customer_name, table_number,
      total_amount, payment_mode, payment_status, billing_mode, receipt_payload, created_at_utc
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.offline_id,
      entry.restaurant_id,
      entry.order_number,
      entry.customer_name || 'Walk-in Customer',
      entry.table_number || null,
      entry.total_amount,
      entry.payment_mode,
      entry.payment_status,
      entry.billing_mode || null,
      entry.receipt_payload,
      createdUtc,
    ]
  );

  // Passive rolling purge to keep register capped under 24 hours
  pruneExpiredShiftRecords(db).catch(() => {});
}

/**
 * Fetches all orders in the current rolling 24-hour shift register (newest first).
 */
export async function getShiftRegisterOrders(restaurantId: number): Promise<ShiftRegisterEntry[]> {
  const db = await getPosDatabase();
  return await db.getAllAsync<ShiftRegisterEntry>(
    `SELECT * FROM daily_shift_register 
     WHERE restaurant_id = ? 
     ORDER BY created_at_utc DESC`,
    [restaurantId]
  );
}

/**
 * Calculates cash drawer and payment mode totals for the current rolling 24-hour register.
 */
export async function getShiftSummary(restaurantId: number): Promise<ShiftTotals> {
  const db = await getPosDatabase();
  const rows = await db.getAllAsync<{
    total_amount: number;
    payment_mode: string;
    payment_status: string;
  }>(
    `SELECT total_amount, payment_mode, payment_status 
     FROM daily_shift_register 
     WHERE restaurant_id = ?`,
    [restaurantId]
  );

  let totalOrders = 0;
  let totalSales = 0;
  let cashSales = 0;
  let upiSales = 0;
  let cardSales = 0;
  let unpaidTotal = 0;

  for (const row of rows) {
    totalOrders++;
    const amt = row.total_amount || 0;
    const isPaid = row.payment_status?.toUpperCase() === 'PAID';

    if (isPaid) {
      totalSales += amt;
      const mode = row.payment_mode?.toUpperCase();
      if (mode === 'CASH') {
        cashSales += amt;
      } else if (mode === 'UPI' || mode === 'QR') {
        upiSales += amt;
      } else if (mode === 'CARD') {
        cardSales += amt;
      } else {
        cashSales += amt;
      }
    } else {
      unpaidTotal += amt;
    }
  }

  return {
    totalOrders,
    totalSales,
    cashSales,
    upiSales,
    cardSales,
    unpaidTotal,
  };
}

/**
 * Caches active menu items in SQLite so POS catalog is available offline.
 */
export async function cacheMenuCatalog(restaurantId: number, items: any[]): Promise<void> {
  if (!items?.length) return;
  const db = await getPosDatabase();
  const nowUtc = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    // Replace cached items for this restaurant
    await db.runAsync(`DELETE FROM cached_menu_items WHERE restaurant_id = ?`, [restaurantId]);

    for (const item of items) {
      const id = item.id || item.itemId;
      if (!id) continue;
      const catId = item.categoryId || null;
      const catName = item.categoryName || 'General';
      const itemName = item.itemName || item.name || '';
      const price = item.price || item.unitPrice || 0;
      const json = JSON.stringify(item);

      await db.runAsync(
        `INSERT INTO cached_menu_items (id, restaurant_id, category_id, category_name, item_name, price, item_json, updated_at_utc)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, restaurantId, catId, catName, itemName, price, json, nowUtc]
      );
    }
  });

  console.log(`[posDatabase] Cached ${items.length} menu items for offline POS catalog.`);
}

/**
 * Retrieves the cached menu items from SQLite when offline.
 */
export async function getCachedMenuCatalog(restaurantId: number): Promise<any[]> {
  try {
    const db = await getPosDatabase();
    const rows = await db.getAllAsync<{ item_json: string }>(
      `SELECT item_json FROM cached_menu_items WHERE restaurant_id = ? ORDER BY category_name, item_name`,
      [restaurantId]
    );

    return rows.map((r) => {
      try {
        return JSON.parse(r.item_json);
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch (error) {
    console.warn('[posDatabase] Failed to retrieve cached menu items:', error);
    return [];
  }
}
