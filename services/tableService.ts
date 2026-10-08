import { apiClient } from '@/lib/api/client';
import { TableMaster } from '@/types/table';

export class TableService {
  static async getTables(restaurantId: number): Promise<TableMaster[]> {
    const res = await apiClient.get<TableMaster[]>(`/TableMaster/restaurant/${restaurantId}`);
    return res.data || [];
  }

  static async getTableById(id: number, restaurantId?: number): Promise<TableMaster | null> {
    try {
      const res = await apiClient.get<TableMaster>(`/TableMaster/${id}`, {
        params: restaurantId ? { restaurantId } : undefined,
      });
      return res.data;
    } catch {
      return null;
    }
  }

  static async createTable(payload: {
    restaurantId: number;
    tableName: string;
    seatingCapacity: number;
    sectionId?: number | null;
  }): Promise<boolean> {
    const res = await apiClient.post('/TableMaster', payload);
    return res.status === 200 || res.status === 201;
  }

  static async updateTable(
    id: number,
    payload: {
      restaurantId: number;
      tableName: string;
      seatingCapacity: number;
      sectionId?: number | null;
    }
  ): Promise<boolean> {
    const res = await apiClient.put(`/TableMaster/${id}`, payload);
    return res.status === 200;
  }

  static async deleteTable(id: number, restaurantId?: number): Promise<boolean> {
    const res = await apiClient.delete(`/TableMaster/${id}`, {
      params: restaurantId ? { restaurantId } : undefined,
    });
    return res.status === 200;
  }
}
