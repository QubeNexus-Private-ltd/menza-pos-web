import NetInfo from '@react-native-community/netinfo';
import { OrderRemoteDataSource } from '../../data/datasources/OrderRemoteDataSource';
import { OrderRepositoryImpl } from '../../data/repositories/OrderRepositoryImpl';
import {
  getPendingOfflineOrders,
  markOfflineOrdersSyncing,
  deleteSyncedOfflineOrders,
  markOfflineOrderFailed,
  pruneExpiredShiftRecords,
} from './posDatabase';
import { useNetworkStore } from './useNetworkStore';
import { useAuthStore } from '../../presentation/state/useAuthStore';
import { WalletEvents } from '../utils/walletEvents';

const orderRemoteDataSource = new OrderRemoteDataSource();
const orderRepository = new OrderRepositoryImpl(orderRemoteDataSource);

let isSyncInProgress = false;
let syncTimer: any = null;

/**
 * Drains the SQLite offline outbox queue and posts batch to the backend.
 * Immediately deletes synced orders from SQLite upon server acknowledgment.
 */
export async function syncPendingOfflineOrders(restaurantId?: number): Promise<{
  synced: number;
  failed: number;
  remaining: number;
}> {
  if (isSyncInProgress) {
    return { synced: 0, failed: 0, remaining: useNetworkStore.getState().pendingOfflineCount };
  }

  const isOnline = useNetworkStore.getState().isOnline;
  if (!isOnline) {
    return { synced: 0, failed: 0, remaining: useNetworkStore.getState().pendingOfflineCount };
  }

  const effectiveRestId = restaurantId || useAuthStore.getState().activeRestaurant?.restaurantId || 0;
  if (effectiveRestId <= 0) {
    return { synced: 0, failed: 0, remaining: 0 };
  }

  try {
    isSyncInProgress = true;
    useNetworkStore.getState().setIsSyncing(true);

    // 1. Fetch pending orders in FIFO sequence
    const pendingItems = await getPendingOfflineOrders(effectiveRestId);
    if (!pendingItems.length) {
      useNetworkStore.getState().setPendingCount(0);
      useNetworkStore.getState().setIsSyncing(false);
      return { synced: 0, failed: 0, remaining: 0 };
    }

    // 2. Mark as syncing
    const offlineIds = pendingItems.map((p) => p.offline_id);
    await markOfflineOrdersSyncing(offlineIds);

    // 3. Parse payloads
    const ordersPayload = pendingItems
      .map((p) => {
        try {
          return JSON.parse(p.order_payload);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    // 4. Send batch to backend POST /api/Order/BatchSync
    const response = await orderRepository.batchSyncOrders(effectiveRestId, ordersPayload);

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
      // Entire batch succeeded
      syncedCount = offlineIds.length;
      successfullySyncedIds.push(...offlineIds);
    }

    // 5. IMMEDIATELY DELETE synced orders from SQLite outbox queue
    if (successfullySyncedIds.length > 0) {
      await deleteSyncedOfflineOrders(successfullySyncedIds);
    }

    // 6. Refresh remaining count
    const remainingCount = await useNetworkStore.getState().refreshPendingCount(effectiveRestId);

    // 7. Align shadow wallet if authoritative server balance was returned
    if (response?.currentWalletBalance !== undefined && response.currentWalletBalance !== null) {
      WalletEvents.emit();
    }

    // 8. Passive cleanup of shift register
    pruneExpiredShiftRecords().catch(() => {});

    useNetworkStore.getState().setLastSyncResult(
      failedCount === 0,
      `Synced ${syncedCount} offline order(s)${failedCount > 0 ? `, ${failedCount} failed` : ''}.`
    );

    return { synced: syncedCount, failed: failedCount, remaining: remainingCount };
  } catch (error: any) {
    console.warn('[offlineSyncWorker] Batch sync failed:', error?.message);
    const remaining = await useNetworkStore.getState().refreshPendingCount(effectiveRestId);
    useNetworkStore.getState().setLastSyncResult(false, error?.message || 'Sync error');
    return { synced: 0, failed: 0, remaining };
  } finally {
    isSyncInProgress = false;
    useNetworkStore.getState().setIsSyncing(false);
  }
}

/**
 * Initializes background sync workers:
 * 1. Network reconnection trigger (fires immediately when offline -> online).
 * 2. 30-second periodic heartbeat while online.
 */
export function startOfflineSyncWorker(restaurantIdProvider: () => number | undefined) {
  // Listen for NetInfo reconnect
  NetInfo.addEventListener((state) => {
    const isOnline = Boolean(state.isConnected && state.isInternetReachable);
    if (isOnline) {
      const restId = restaurantIdProvider();
      if (restId && restId > 0) {
        syncPendingOfflineOrders(restId).catch(() => {});
      }
    }
  });

  // Periodic heartbeat (30 seconds)
  if (syncTimer) {
    clearInterval(syncTimer);
  }

  syncTimer = setInterval(() => {
    const isOnline = useNetworkStore.getState().isOnline;
    if (isOnline) {
      const restId = restaurantIdProvider();
      if (restId && restId > 0 && useNetworkStore.getState().pendingOfflineCount > 0) {
        syncPendingOfflineOrders(restId).catch(() => {});
      }
    }
  }, 30000);
}

export function stopOfflineSyncWorker() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}
