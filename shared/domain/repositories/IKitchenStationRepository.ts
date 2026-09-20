import {
  KitchenStation,
  CreateKitchenStationRequest,
  UpdateKitchenStationRequest,
  ToggleKitchenStationStatusRequest,
} from '../models/KitchenStation';

export interface IKitchenStationRepository {
  getStations(restaurantId: number, activeOnly?: boolean): Promise<KitchenStation[]>;
  getStationById(id: number): Promise<KitchenStation | null>;
  createStation(data: CreateKitchenStationRequest): Promise<KitchenStation | null>;
  updateStation(id: number, data: UpdateKitchenStationRequest): Promise<KitchenStation | null>;
  toggleStationStatus(id: number, data: ToggleKitchenStationStatusRequest): Promise<KitchenStation | null>;
  initializeDefaults(restaurantId: number): Promise<KitchenStation[]>;
  deleteStation(id: number): Promise<boolean>;
}
