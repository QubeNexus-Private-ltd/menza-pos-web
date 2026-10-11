import { apiClient } from '@shared/core/network/apiClient';

export class WebMenuService {
  static async updateCategory(id: number, categoryName: string, categoryDescription: string, restaurantId: number, kitchenStationId?: number): Promise<boolean> {
    try {
      const response = await apiClient.put(`/CategoryMaster/${id}`, {
        restaurantId,
        categoryName,
        categoryDescription,
        kitchenStationId: kitchenStationId || null,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  static async deleteCategory(id: number): Promise<boolean> {
    try {
      const response = await apiClient.delete(`/CategoryMaster/${id}`);
      return response.status === 200;
    } catch {
      return false;
    }
  }

  static async deleteMenuItem(id: number, restaurantId?: number): Promise<boolean> {
    try {
      const response = await apiClient.delete(`/ItemMaster/${id}`, {
        params: restaurantId ? { restaurantId } : undefined,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
