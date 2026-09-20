import { IRestaurantConfigRepository } from '../../domain/repositories/IRestaurantConfigRepository';
import { RestaurantConfigRemoteDataSource } from '../datasources/RestaurantConfigRemoteDataSource';
import {
  RestaurantConfig,
  StoreOperatingStatus,
  ToggleOrderingRequest,
  OperatingHoursRequest,
  RestaurantOperatingHistoryEntry,
} from '../../domain/models/RestaurantConfig';

export class RestaurantConfigRepositoryImpl implements IRestaurantConfigRepository {
  constructor(private remoteDataSource: RestaurantConfigRemoteDataSource) {}

  async getConfig(restaurantId?: number): Promise<RestaurantConfig> {
    return await this.remoteDataSource.getConfig(restaurantId);
  }

  async updateConfig(restaurantId: number, config: Partial<RestaurantConfig>): Promise<boolean> {
    return await this.remoteDataSource.updateConfig(restaurantId, config);
  }

  async getOperatingStatus(restaurantId: number): Promise<StoreOperatingStatus | null> {
    return await this.remoteDataSource.getOperatingStatus(restaurantId);
  }

  async toggleOrdering(
    restaurantId: number,
    request: ToggleOrderingRequest
  ): Promise<StoreOperatingStatus | null> {
    return await this.remoteDataSource.toggleOrdering(restaurantId, request);
  }

  async updateOperatingHours(
    restaurantId: number,
    model: OperatingHoursRequest
  ): Promise<StoreOperatingStatus | null> {
    return await this.remoteDataSource.updateOperatingHours(restaurantId, model);
  }

  async getOperatingHistory(
    restaurantId: number,
    limit = 20
  ): Promise<RestaurantOperatingHistoryEntry[]> {
    return await this.remoteDataSource.getOperatingHistory(restaurantId, limit);
  }

  async getAuditLogs(restaurantId: number, date?: string): Promise<any[]> {
    return await this.remoteDataSource.getAuditLogs(restaurantId, date);
  }
}
