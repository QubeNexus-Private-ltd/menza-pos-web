import { create } from 'zustand';
import { getPendingOfflineOrderCount } from './webPosDatabase';

interface WebNetworkState {
  isOnline: boolean;
  isServerReachable: boolean;
  pendingOfflineCount: number;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  lastSyncMessage: string | null;

  // Actions
  setOnline: (isOnline: boolean) => void;
  setServerReachable: (isReachable: boolean) => void;
  setPendingCount: (count: number) => void;
  refreshPendingCount: (restaurantId?: number) => Promise<number>;
  setIsSyncing: (isSyncing: boolean) => void;
  setLastSyncResult: (success: boolean, message: string) => void;
}

export const useWebNetworkStore = create<WebNetworkState>((set, get) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isServerReachable: true,
  pendingOfflineCount: 0,
  isSyncing: false,
  lastSyncTime: null,
  lastSyncMessage: null,

  setOnline: (isOnline: boolean) => {
    set({
      isOnline,
      // If browser says offline, server is unreachable
      isServerReachable: isOnline ? get().isServerReachable : false,
    });
  },

  setServerReachable: (isServerReachable: boolean) => {
    set({ isServerReachable });
  },

  setPendingCount: (count: number) => {
    set({ pendingOfflineCount: Math.max(0, count) });
  },

  refreshPendingCount: async (restaurantId?: number) => {
    try {
      const count = await getPendingOfflineOrderCount(restaurantId);
      set({ pendingOfflineCount: count });
      return count;
    } catch {
      return get().pendingOfflineCount;
    }
  },

  setIsSyncing: (isSyncing: boolean) => {
    set({ isSyncing });
  },

  setLastSyncResult: (success: boolean, message: string) => {
    set({
      lastSyncTime: new Date(),
      lastSyncMessage: message,
    });
  },
}));

let isNetworkListenerSetup = false;

/**
 * Initializes browser network status listeners:
 * - Listens for window 'online' and 'offline' events.
 * - Triggers an immediate pending count refresh and sync attempt on reconnect.
 */
export function setupWebNetworkListeners(onReconnect?: () => void): () => void {
  if (typeof window === 'undefined' || isNetworkListenerSetup) {
    return () => {};
  }

  const handleOnline = () => {
    useWebNetworkStore.getState().setOnline(true);
    useWebNetworkStore.getState().setServerReachable(true);
    if (onReconnect) {
      onReconnect();
    }
  };

  const handleOffline = () => {
    useWebNetworkStore.getState().setOnline(false);
    useWebNetworkStore.getState().setServerReachable(false);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  isNetworkListenerSetup = true;

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    isNetworkListenerSetup = false;
  };
}
