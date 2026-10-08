import { apiClient } from '@/lib/api/client';
import { RestaurantConfig, StoreOperatingStatus, RestaurantBankDetails } from '@/types/restaurant';

export class ConfigService {
  static async getRestaurantConfig(restaurantId: number): Promise<RestaurantConfig | null> {
    try {
      const res = await apiClient.get<RestaurantConfig>('/RestaurantConfig', {
        params: { restaurantId },
      });
      return res.data;
    } catch {
      return null;
    }
  }

  static async updateRestaurantConfig(id: number, config: Partial<RestaurantConfig>): Promise<boolean> {
    const res = await apiClient.put(`/RestaurantConfig/${id}`, config);
    return res.status === 200;
  }

  static async getOperatingStatus(restaurantId: number): Promise<StoreOperatingStatus | null> {
    try {
      const res = await apiClient.get<StoreOperatingStatus>(
        `/RestaurantConfig/${restaurantId}/OperatingStatus`
      );
      return res.data;
    } catch {
      return null;
    }
  }

  static async toggleOrdering(
    restaurantId: number,
    payload: { isOpen: boolean; temporaryClosureReason?: string }
  ): Promise<StoreOperatingStatus | null> {
    try {
      const res = await apiClient.post<any>(
        `/RestaurantConfig/${restaurantId}/ToggleOrdering`,
        payload
      );
      return res.data?.operatingStatus || res.data;
    } catch (err) {
      console.warn('[ConfigService] Failed to toggle ordering:', err);
      return null;
    }
  }

  static async updateOperatingHours(
    restaurantId: number,
    payload: { openingTime?: string; closingTime?: string; orderingMode?: string }
  ): Promise<boolean> {
    try {
      const res = await apiClient.post(`/RestaurantConfig/${restaurantId}/OperatingHours`, payload);
      return res.status === 200 || res.status === 204;
    } catch {
      return false;
    }
  }

  static async getRestaurantBank(restaurantId: number): Promise<RestaurantBankDetails | null> {
    try {
      const res = await apiClient.get<RestaurantBankDetails>(
        `/RestaurantBank/restaurant/${restaurantId}`
      );
      return res.data;
    } catch {
      return null;
    }
  }

  static async updateRestaurantBank(
    restaurantId: number,
    payload: Partial<RestaurantBankDetails>
  ): Promise<boolean> {
    try {
      const res = await apiClient.post(`/RestaurantBank/restaurant/${restaurantId}`, payload);
      return res.status === 200 || res.status === 201;
    } catch {
      return false;
    }
  }
}
