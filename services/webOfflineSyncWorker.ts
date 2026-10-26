import { OrderRemoteDataSource } from '@shared/data/datasources/OrderRemoteDataSource';
import {
  getPendingOfflineOrders,
  markOfflineOrdersSyncing,
  resetOfflineOrdersToPending,
  deleteSyncedOfflineOrders,
  markOfflineOrderFailed,
} from '@/lib/offline/webPosDatabase';
import { useWebNetworkStore } from '@/lib/offline/useWebNetworkStore';
import { WalletEvents } from '@shared/core/utils/walletEvents';

const orderRemoteDataSource = new OrderRemoteDataSource();

let isSyncInProgress = false;
let syncTimer: any = null;

export interface SyncResult {
  synced: number;
  failed: number;
  remaining: number;
}

/**
 * Drains the IndexedDB offline outbox queue and posts the batch to the backend.
 * Uses POST /api/Order/BatchSync with idempotency by offlineReferenceId.
 * Automatically deletes synced orders from IndexedDB upon server acknowledgment.
 */
export async function syncPendingOfflineOrders(restaurantId: number): Promise<SyncResult> {
  if (isSyncInProgress) {
    return { synced: 0, failed: 0, remaining: useWebNetworkStore.getState().pendingOfflineCount };
  }

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : useWebNetworkStore.getState().isOnline;
  if (!isOnline || !restaurantId || restaurantId <= 0) {
    return { synced: 0, failed: 0, remaining: useWebNetworkStore.getState().pendingOfflineCount };
  }

  try {
    isSyncInProgress = true;
    useWebNetworkStore.getState().setIsSyncing(true);

    // 1. Fetch pending orders in chronological FIFO order
    const pendingItems = await getPendingOfflineOrders(restaurantId);
    if (!pendingItems || pendingItems.length === 0) {
      useWebNetworkStore.getState().setPendingCount(0);
      return { synced: 0, failed: 0, remaining: 0 };
    }

    // 2. Mark as SYNCING to prevent duplicate pickup
    const itemIds = pendingItems.map((p) => p.id!).filter(Boolean);
    await markOfflineOrdersSyncing(itemIds);

    // 3. Assemble backend batch payload
    const ordersPayload = pendingItems.map((p) => ({
      ...p.orderPayload,
      offlineReferenceId: p.offlineReferenceId,
      originalCreatedAtUtc: p.createdAtUtc,
      isOfflineSync: true,
    }));

    // 4. Send batch to backend POST /api/Order/BatchSync
    const response = await orderRemoteDataSource.batchSyncOrders(restaurantId, ordersPayload);

    let syncedCount = 0;
    let failedCount = 0;
    const successfullySyncedIds: string[] = [];

    if (response?.results && Array.isArray(response.results)) {
      for (const res of response.results) {
        if (res.status === 'SUCCESS' || res.status === 'ALREADY_SYNCED') {
          syncedCount++;
          if (res.offlineReferenceId) {
            successfullySyncedIds.push(res.offlineReferenceId);
          }
        } else {
          failedCount++;
          if (res.offlineReferenceId) {
            await markOfflineOrderFailed(res.offlineReferenceId, res.message || 'Sync failed');
          }
        }
      }
    } else if (response?.success) {
      syncedCount = pendingItems.length;
      successfullySyncedIds.push(...pendingItems.map((p) => p.offlineReferenceId));
    }

    // 5. Delete successfully synced orders from IndexedDB outbox
    if (successfullySyncedIds.length > 0) {
      await deleteSyncedOfflineOrders(successfullySyncedIds);
    }

    // 6. Refresh pending count
    const remainingCount = await useWebNetworkStore.getState().refreshPendingCount(restaurantId);

    // 7. Reconcile restaurant wallet if balance was returned
    if (response?.currentWalletBalance !== undefined && response.currentWalletBalance !== null) {
      WalletEvents.emit();
    }

    useWebNetworkStore.getState().setLastSyncResult(
      failedCount === 0,
      `Synced ${syncedCount} offline order(s)${failedCount > 0 ? `, ${failedCount} failed` : ''}.`
    );

    return { synced: syncedCount, failed: failedCount, remaining: remainingCount };
  } catch (error: any) {
    console.warn('[webOfflineSyncWorker] Batch sync error:', error?.message);

    // Revert items from SYNCING back to PENDING so they can retry
    try {
      const pendingItems = await getPendingOfflineOrders(restaurantId);
      const itemIds = pendingItems.map((p) => p.id!).filter(Boolean);
      await resetOfflineOrdersToPending(itemIds);
    } catch {}

    const remaining = await useWebNetworkStore.getState().refreshPendingCount(restaurantId);
    useWebNetworkStore.getState().setLastSyncResult(false, error?.message || 'Sync error');
    return { synced: 0, failed: 0, remaining };
  } finally {
    isSyncInProgress = false;
    useWebNetworkStore.getState().setIsSyncing(false);
  }
}

/**
 * Starts the background sync worker:
 * - 30-second periodic heartbeat while online.
 */
export function startWebOfflineSyncWorker(restaurantIdProvider: () => number | undefined): () => void {
  if (syncTimer) {
    clearInterval(syncTimer);
  }

  syncTimer = setInterval(() => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : useWebNetworkStore.getState().isOnline;
    if (isOnline) {
      const restId = restaurantIdProvider();
      if (restId && restId > 0 && useWebNetworkStore.getState().pendingOfflineCount > 0) {
        syncPendingOfflineOrders(restId).catch(() => {});
      }
    }
  }, 30000);

  return () => {
    stopWebOfflineSyncWorker();
  };
}

export function stopWebOfflineSyncWorker(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}
