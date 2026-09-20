import {
  RestaurantConfig,
  StoreOperatingStatus,
  ToggleOrderingRequest,
  OperatingHoursRequest,
  RestaurantOperatingHistoryEntry,
} from '../models/RestaurantConfig';

export interface IRestaurantConfigRepository {
  getConfig(restaurantId?: number): Promise<RestaurantConfig>;
  updateConfig(restaurantId: number, config: Partial<RestaurantConfig>): Promise<boolean>;
  getOperatingStatus(restaurantId: number): Promise<StoreOperatingStatus | null>;
  toggleOrdering(restaurantId: number, request: ToggleOrderingRequest): Promise<StoreOperatingStatus | null>;
  updateOperatingHours(restaurantId: number, model: OperatingHoursRequest): Promise<StoreOperatingStatus | null>;
  getOperatingHistory(restaurantId: number, limit?: number): Promise<RestaurantOperatingHistoryEntry[]>;
  getAuditLogs(restaurantId: number, date?: string): Promise<any[]>;
}
