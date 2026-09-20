import { ISuperAdminRepository, PaginatedRestaurantsResponse } from '../../domain/repositories/ISuperAdminRepository';
import { SuperAdminRemoteDataSource } from '../datasources/SuperAdminRemoteDataSource';
import { OnboardRestaurantRequest } from '../../domain/models/OnboardRestaurantRequest';
import { RestaurantOrderingConfig } from '../../domain/models/RestaurantConfig';

export class SuperAdminRepositoryImpl implements ISuperAdminRepository {
  constructor(private remoteDataSource: SuperAdminRemoteDataSource) {}

  async onboardRestaurant(request: OnboardRestaurantRequest): Promise<{ restaurantId: number; success: boolean }> {
    return await this.remoteDataSource.onboardRestaurant(request);
  }

  async assignOwnerToRestaurant(userId: number, restaurantId: number): Promise<boolean> {
    return await this.remoteDataSource.assignOwnerToRestaurant(userId, restaurantId);
  }

  async toggleRestaurantStatus(restaurantId: number, isActive: boolean): Promise<boolean> {
    return await this.remoteDataSource.toggleRestaurantStatus(restaurantId, isActive);
  }

  async getAllRestaurants(
    resName?: string,
    city?: string,
    state?: string,
    resId?: number,
    pageNumber: number = 1,
    pageSize: number = 10
  ): Promise<PaginatedRestaurantsResponse> {
    return await this.remoteDataSource.getAllRestaurants(resName, city, state, resId, pageNumber, pageSize);
  }

  async getOrderingSettings(restaurantId: number): Promise<RestaurantOrderingConfig> {
    return await this.remoteDataSource.getOrderingSettings(restaurantId);
  }

  async updateOrderingSettings(restaurantId: number, config: RestaurantOrderingConfig): Promise<boolean> {
    return await this.remoteDataSource.updateOrderingSettings(restaurantId, config);
  }
}
