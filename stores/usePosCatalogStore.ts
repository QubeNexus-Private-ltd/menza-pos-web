import { create } from 'zustand';
import { MenuItem } from '@shared/domain/models/Item';
import { Category } from '@shared/domain/models/Category';
import { TableMaster } from '@shared/domain/models/Table';
import { RestaurantConfig, StoreOperatingStatus } from '@shared/domain/models/RestaurantConfig';
import { ActiveOrderType, OrderMaster } from '@shared/domain/models/Order';
import { saveCatalogToOfflineDb, loadCatalogFromOfflineDb, initPosDatabase } from '@/lib/offline/webPosDatabase';

interface ActiveTableOrderCache {
  order: OrderMaster | null;
  fetchedAt: number;
}

interface PosCatalogState {
  restaurantId: number | null;
  categories: Category[];
  items: MenuItem[];
  tables: TableMaster[];
  restaurantConfig: RestaurantConfig | null;
  operatingStatus: StoreOperatingStatus | null;
  orderTypes: ActiveOrderType[];
  hasLoaded: boolean;
  lastFetchedAt: number;
  activeTableOrders: Record<number, ActiveTableOrderCache>;

  setCatalogData: (data: {
    restaurantId: number;
    categories?: Category[];
    items?: MenuItem[];
    tables?: TableMaster[];
    restaurantConfig?: RestaurantConfig | null;
    operatingStatus?: StoreOperatingStatus | null;
    orderTypes?: ActiveOrderType[];
  }) => void;
  hydrateFromOfflineDb: (restaurantId: number) => Promise<boolean>;
  updateTables: (tables: TableMaster[]) => void;
  updateOperatingStatus: (status: StoreOperatingStatus | null) => void;
  updateRestaurantConfig: (config: RestaurantConfig | null) => void;
  setActiveTableOrder: (tableId: number, order: OrderMaster | null) => void;
  getActiveTableOrder: (tableId: number, maxAgeMs?: number) => OrderMaster | null | undefined;
  invalidateActiveTableOrder: (tableId: number) => void;
  freeTableInCatalog: (tableId: number) => void;
  invalidateCatalog: () => void;
}

export const usePosCatalogStore = create<PosCatalogState>((set, get) => ({
  restaurantId: null,
  categories: [],
  items: [],
  tables: [],
  restaurantConfig: null,
  operatingStatus: null,
  orderTypes: [],
  hasLoaded: false,
  lastFetchedAt: 0,
  activeTableOrders: {},

  hydrateFromOfflineDb: async (restaurantId: number) => {
    if (!restaurantId) return false;
    try {
      await initPosDatabase();
      const cached = await loadCatalogFromOfflineDb(restaurantId);
      if (cached && cached.items && cached.items.length > 0) {
        set({
          restaurantId,
          categories: cached.categories || [],
          items: cached.items || [],
          tables: cached.tables || [],
          restaurantConfig: cached.restaurantConfig || null,
          operatingStatus: cached.operatingStatus || null,
          orderTypes: cached.orderTypes || [],
          hasLoaded: true,
          lastFetchedAt: Date.now(),
        });
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[usePosCatalogStore] Failed to hydrate catalog from IndexedDB:', err);
      return false;
    }
  },

  setCatalogData: (data) => {
    set((state) => {
      const nextState = {
        restaurantId: data.restaurantId,
        categories: data.categories !== undefined ? data.categories : state.categories,
        items: data.items !== undefined ? data.items : state.items,
        tables: data.tables !== undefined ? data.tables : state.tables,
        restaurantConfig: data.restaurantConfig !== undefined ? data.restaurantConfig : state.restaurantConfig,
        operatingStatus: data.operatingStatus !== undefined ? data.operatingStatus : state.operatingStatus,
        orderTypes: data.orderTypes !== undefined ? data.orderTypes : state.orderTypes,
        hasLoaded: true,
        lastFetchedAt: Date.now(),
      };

      // Asynchronously cache updated catalog in IndexedDB for offline resilience
      saveCatalogToOfflineDb(nextState).catch(() => {});

      return nextState;
    });
  },

  updateTables: (tables) => {
    set({ tables });
    const currentRestId = get().restaurantId;
    if (currentRestId) {
      saveCatalogToOfflineDb({ restaurantId: currentRestId, tables }).catch(() => {});
    }
  },

  updateOperatingStatus: (operatingStatus) => {
    set({ operatingStatus });
    const currentRestId = get().restaurantId;
    if (currentRestId) {
      saveCatalogToOfflineDb({ restaurantId: currentRestId, operatingStatus }).catch(() => {});
    }
  },

  updateRestaurantConfig: (restaurantConfig) => {
    set({ restaurantConfig });
    const currentRestId = get().restaurantId;
    if (currentRestId) {
      saveCatalogToOfflineDb({ restaurantId: currentRestId, restaurantConfig }).catch(() => {});
    }
  },

  setActiveTableOrder: (tableId, order) =>
    set((state) => ({
      activeTableOrders: {
        ...state.activeTableOrders,
        [tableId]: { order, fetchedAt: Date.now() },
      },
    })),

  getActiveTableOrder: (tableId, maxAgeMs = 60000) => {
    const entry = get().activeTableOrders[tableId];
    if (!entry) return undefined;
    if (Date.now() - entry.fetchedAt > maxAgeMs) return undefined;
    return entry.order;
  },

  invalidateActiveTableOrder: (tableId) =>
    set((state) => {
      const copy = { ...state.activeTableOrders };
      delete copy[tableId];
      return { activeTableOrders: copy };
    }),

  freeTableInCatalog: (tableId) =>
    set((state) => {
      const copy = { ...state.activeTableOrders };
      delete copy[tableId];
      return {
        tables: state.tables.map((t) =>
          t.id === tableId ? { ...t, status: 'Available', activeOrderId: undefined } : t
        ),
        activeTableOrders: copy,
      };
    }),

  invalidateCatalog: () =>
    set({
      restaurantId: null,
      categories: [],
      items: [],
      tables: [],
      restaurantConfig: null,
      operatingStatus: null,
      orderTypes: [],
      hasLoaded: false,
      lastFetchedAt: 0,
      activeTableOrders: {},
    }),
}));
