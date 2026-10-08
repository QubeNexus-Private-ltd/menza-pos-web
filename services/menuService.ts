import { apiClient } from '@/lib/api/client';
import { Category, MenuItem, StoreMenuCatalogTree } from '@/types/menu';

export class MenuService {
  static async getCatalogTree(restaurantId: number): Promise<Category[]> {
    const res = await apiClient.get<StoreMenuCatalogTree | Category[]>(
      `/MenuCatalog/restaurant/${restaurantId}`
    );
    if (Array.isArray(res.data)) {
      return res.data;
    }
    if (res.data && Array.isArray((res.data as any).categories)) {
      return (res.data as any).categories;
    }
    return [];
  }

  static async createCategory(restaurantId: number, categoryName: string, categoryDescription?: string): Promise<boolean> {
    const res = await apiClient.post('/CategoryMaster', {
      restaurantId,
      categoryName: categoryName.trim(),
      categoryDescription: categoryDescription?.trim() || '',
    });
    return res.status === 200 || res.status === 201;
  }

  static async updateCategory(id: number, categoryName: string, categoryDescription: string, restaurantId: number): Promise<boolean> {
    try {
      const response = await apiClient.put(`/CategoryMaster/${id}`, {
        restaurantId,
        categoryName,
        categoryDescription,
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

  static async createMenuItem(payload: Partial<MenuItem> & { restaurantId: number }): Promise<boolean> {
    const res = await apiClient.post('/ItemMaster', payload);
    return res.status === 200 || res.status === 201;
  }

  static async updateMenuItem(id: number, payload: Partial<MenuItem>): Promise<boolean> {
    const res = await apiClient.put(`/ItemMaster/${id}`, payload);
    return res.status === 200;
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

// Alias for backward compatibility
export const WebMenuService = MenuService;
