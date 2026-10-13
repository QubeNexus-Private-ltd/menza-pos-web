import { create } from 'zustand';
import { MenuItem } from '@shared/domain/models/Item';
import { Category } from '@shared/domain/models/Category';
import { TableMaster } from '@shared/domain/models/Table';
import { RestaurantConfig, StoreOperatingStatus } from '@shared/domain/models/RestaurantConfig';
import { ActiveOrderType, OrderMaster } from '@shared/domain/models/Order';

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
  updateTables: (tables: TableMaster[]) => void;
  updateOperatingStatus: (status: StoreOperatingStatus | null) => void;
  updateRestaurantConfig: (config: RestaurantConfig | null) => void;
  setActiveTableOrder: (tableId: number, order: OrderMaster | null) => void;
  getActiveTableOrder: (tableId: number, maxAgeMs?: number) => OrderMaster | null | undefined;
  invalidateActiveTableOrder: (tableId: number) => void;
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

  setCatalogData: (data) =>
    set((state) => ({
      restaurantId: data.restaurantId,
      categories: data.categories !== undefined ? data.categories : state.categories,
      items: data.items !== undefined ? data.items : state.items,
      tables: data.tables !== undefined ? data.tables : state.tables,
      restaurantConfig: data.restaurantConfig !== undefined ? data.restaurantConfig : state.restaurantConfig,
      operatingStatus: data.operatingStatus !== undefined ? data.operatingStatus : state.operatingStatus,
      orderTypes: data.orderTypes !== undefined ? data.orderTypes : state.orderTypes,
      hasLoaded: true,
      lastFetchedAt: Date.now(),
    })),

  updateTables: (tables) => set({ tables }),
  updateOperatingStatus: (operatingStatus) => set({ operatingStatus }),
  updateRestaurantConfig: (restaurantConfig) => set({ restaurantConfig }),

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

  invalidateCatalog: () => set({ hasLoaded: false, lastFetchedAt: 0, activeTableOrders: {} }),
}));
