import { create } from 'zustand';
import {
  KitchenStation,
  CreateKitchenStationRequest,
  UpdateKitchenStationRequest,
  ToggleKitchenStationStatusRequest,
} from '../../domain/models/KitchenStation';
import { KitchenStationRemoteDataSource } from '../../data/datasources/KitchenStationRemoteDataSource';
import { KitchenStationRepositoryImpl } from '../../data/repositories/KitchenStationRepositoryImpl';

const dataSource = new KitchenStationRemoteDataSource();
const repository = new KitchenStationRepositoryImpl(dataSource);

interface KitchenStationState {
  stations: KitchenStation[];
  activeStations: KitchenStation[];
  loading: boolean;
  actionLoading: string | null;
  error: string | null;
  kitchenMode: 'SINGLE_KITCHEN' | 'MULTI_STATION';
  isKitchenActive: boolean;

  // Actions
  fetchStations: (restaurantId: number, activeOnly?: boolean) => Promise<KitchenStation[]>;
  createStation: (data: CreateKitchenStationRequest) => Promise<KitchenStation | null>;
  updateStation: (id: number, data: UpdateKitchenStationRequest) => Promise<KitchenStation | null>;
  toggleStationStatus: (id: number, data: ToggleKitchenStationStatusRequest) => Promise<KitchenStation | null>;
  initializeDefaults: (restaurantId: number) => Promise<KitchenStation[]>;
  deleteStation: (id: number) => Promise<boolean>;
  setKitchenMode: (mode: 'SINGLE_KITCHEN' | 'MULTI_STATION') => void;
  setIsKitchenActive: (isActive: boolean) => void;
  handleSignalRStationUpdate: (stationData: any) => void;
}

export const useKitchenStationStore = create<KitchenStationState>((set, get) => ({
  stations: [],
  activeStations: [],
  loading: false,
  actionLoading: null,
  error: null,
  kitchenMode: 'SINGLE_KITCHEN',
  isKitchenActive: true,

  fetchStations: async (restaurantId: number, activeOnly: boolean = false) => {
    if (!restaurantId || restaurantId <= 0) return [];
    try {
      set({ loading: true, error: null });
      const stations = await repository.getStations(restaurantId, activeOnly);
      const active = stations.filter((s) => s.isActive && !s.isPaused);
      set({
        stations,
        activeStations: active,
        loading: false,
      });
      return stations;
    } catch (err: any) {
      set({ loading: false, error: err?.message || 'Failed to load stations' });
      return [];
    }
  },

  createStation: async (data: CreateKitchenStationRequest) => {
    try {
      set({ actionLoading: 'create', error: null });
      const newStation = await repository.createStation(data);
      if (newStation) {
        set((state) => {
          const updated = [...state.stations.filter((s) => s.id !== newStation.id), newStation];
          return {
            stations: updated,
            activeStations: updated.filter((s) => s.isActive && !s.isPaused),
            actionLoading: null,
          };
        });
      }
      return newStation;
    } catch (err: any) {
      set({ actionLoading: null, error: err?.message || 'Failed to create station' });
      throw err;
    }
  },

  updateStation: async (id: number, data: UpdateKitchenStationRequest) => {
    try {
      set({ actionLoading: `update_${id}`, error: null });
      const updated = await repository.updateStation(id, data);
      if (updated) {
        set((state) => {
          const list = state.stations.map((s) => (s.id === id ? updated : s));
          return {
            stations: list,
            activeStations: list.filter((s) => s.isActive && !s.isPaused),
            actionLoading: null,
          };
        });
      }
      return updated;
    } catch (err: any) {
      set({ actionLoading: null, error: err?.message || 'Failed to update station' });
      throw err;
    }
  },

  toggleStationStatus: async (id: number, data: ToggleKitchenStationStatusRequest) => {
    try {
      set({ actionLoading: `toggle_${id}`, error: null });
      const updated = await repository.toggleStationStatus(id, data);
      if (updated) {
        set((state) => {
          const list = state.stations.map((s) => (s.id === id ? updated : s));
          return {
            stations: list,
            activeStations: list.filter((s) => s.isActive && !s.isPaused),
            actionLoading: null,
          };
        });
      }
      return updated;
    } catch (err: any) {
      set({ actionLoading: null, error: err?.message || 'Failed to toggle station status' });
      throw err;
    }
  },

  initializeDefaults: async (restaurantId: number) => {
    try {
      set({ actionLoading: 'init_defaults', error: null });
      const defaults = await repository.initializeDefaults(restaurantId);
      if (defaults.length > 0) {
        set({
          stations: defaults,
          activeStations: defaults.filter((s) => s.isActive && !s.isPaused),
          actionLoading: null,
        });
      }
      return defaults;
    } catch (err: any) {
      set({ actionLoading: null, error: err?.message || 'Failed to initialize default stations' });
      throw err;
    }
  },

  deleteStation: async (id: number) => {
    try {
      set({ actionLoading: `delete_${id}`, error: null });
      const success = await repository.deleteStation(id);
      if (success) {
        set((state) => {
          const list = state.stations.filter((s) => s.id !== id);
          return {
            stations: list,
            activeStations: list.filter((s) => s.isActive && !s.isPaused),
            actionLoading: null,
          };
        });
      }
      return success;
    } catch (err: any) {
      set({ actionLoading: null, error: err?.message || 'Failed to delete station' });
      return false;
    }
  },

  setKitchenMode: (kitchenMode) => set({ kitchenMode }),
  setIsKitchenActive: (isKitchenActive) => set({ isKitchenActive }),

  handleSignalRStationUpdate: (stationData: any) => {
    if (!stationData || !stationData.id) return;
    set((state) => {
      const exists = state.stations.some((s) => s.id === stationData.id);
      let updatedList: KitchenStation[];
      if (exists) {
        if (stationData.status === 'DELETED' || stationData.isDeleted) {
          updatedList = state.stations.filter((s) => s.id !== stationData.id);
        } else {
          updatedList = state.stations.map((s) => (s.id === stationData.id ? { ...s, ...stationData } : s));
        }
      } else {
        updatedList = [...state.stations, stationData];
      }
      return {
        stations: updatedList,
        activeStations: updatedList.filter((s) => s.isActive && !s.isPaused),
      };
    });
  },
}));
