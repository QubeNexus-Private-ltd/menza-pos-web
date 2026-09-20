import { OnboardRestaurantRequest } from '../models/OnboardRestaurantRequest';
import { RestaurantDetail } from '../models/Restaurant';
import { RestaurantOrderingConfig } from '../models/RestaurantConfig';

export interface PaginatedRestaurantsResponse {
  items: RestaurantDetail[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

export interface ISuperAdminRepository {
  onboardRestaurant(request: OnboardRestaurantRequest): Promise<{ restaurantId: number; success: boolean }>;
  assignOwnerToRestaurant(userId: number, restaurantId: number): Promise<boolean>;
  toggleRestaurantStatus(restaurantId: number, isActive: boolean): Promise<boolean>;
  getAllRestaurants(
    resName?: string,
    city?: string,
    state?: string,
    resId?: number,
    pageNumber?: number,
    pageSize?: number
  ): Promise<PaginatedRestaurantsResponse>;
  getOrderingSettings(restaurantId: number): Promise<RestaurantOrderingConfig>;
  updateOrderingSettings(restaurantId: number, config: RestaurantOrderingConfig): Promise<boolean>;
}
