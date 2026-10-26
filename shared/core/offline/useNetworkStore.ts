import { create } from 'zustand';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { getPendingOfflineOrderCount } from './posDatabase';

interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
  isOnline: boolean;
  connectionType: string;
  pendingOfflineCount: number;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  lastSyncMessage: string | null;

  // Actions
  setNetworkState: (state: Partial<NetInfoState>) => void;
  setPendingCount: (count: number) => void;
  refreshPendingCount: (restaurantId?: number) => Promise<number>;
  setIsSyncing: (syncing: boolean) => void;
  setLastSyncResult: (success: boolean, message: string) => void;
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  isConnected: true,
  isInternetReachable: true,
  isOnline: true,
  connectionType: 'unknown',
  pendingOfflineCount: 0,
  isSyncing: false,
  lastSyncTime: null,
  lastSyncMessage: null,

  setNetworkState: (state: Partial<NetInfoState>) => {
    const isConnected = state.isConnected ?? true;
    const isInternetReachable = state.isInternetReachable ?? isConnected;
    const isOnline = isConnected && isInternetReachable;

    set({
      isConnected,
      isInternetReachable,
      isOnline,
      connectionType: state.type || 'unknown',
    });
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
      isSyncing: false,
      lastSyncTime: new Date(),
      lastSyncMessage: message,
    });
  },
}));

// Initialize NetInfo listener automatically
let isListenerSubscribed = false;

export function initializeNetworkMonitoring() {
  if (isListenerSubscribed) return;
  isListenerSubscribed = true;

  // Fetch initial state
  NetInfo.fetch().then((state) => {
    useNetworkStore.getState().setNetworkState(state);
  });

  // Subscribe to network changes
  NetInfo.addEventListener((state) => {
    useNetworkStore.getState().setNetworkState(state);
  });
}
