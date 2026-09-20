import {
  KitchenStation,
  CreateKitchenStationRequest,
  UpdateKitchenStationRequest,
  ToggleKitchenStationStatusRequest,
} from '../../domain/models/KitchenStation';
import { IKitchenStationRepository } from '../../domain/repositories/IKitchenStationRepository';
import { KitchenStationRemoteDataSource } from '../datasources/KitchenStationRemoteDataSource';

export class KitchenStationRepositoryImpl implements IKitchenStationRepository {
  constructor(private readonly dataSource: KitchenStationRemoteDataSource) {}

  async getStations(restaurantId: number, activeOnly: boolean = false): Promise<KitchenStation[]> {
    return this.dataSource.getStations(restaurantId, activeOnly);
  }

  async getStationById(id: number): Promise<KitchenStation | null> {
    return this.dataSource.getStationById(id);
  }

  async createStation(data: CreateKitchenStationRequest): Promise<KitchenStation | null> {
    return this.dataSource.createStation(data);
  }

  async updateStation(id: number, data: UpdateKitchenStationRequest): Promise<KitchenStation | null> {
    return this.dataSource.updateStation(id, data);
  }

  async toggleStationStatus(id: number, data: ToggleKitchenStationStatusRequest): Promise<KitchenStation | null> {
    return this.dataSource.toggleStationStatus(id, data);
  }

  async initializeDefaults(restaurantId: number): Promise<KitchenStation[]> {
    return this.dataSource.initializeDefaults(restaurantId);
  }

  async deleteStation(id: number): Promise<boolean> {
    return this.dataSource.deleteStation(id);
  }
}
