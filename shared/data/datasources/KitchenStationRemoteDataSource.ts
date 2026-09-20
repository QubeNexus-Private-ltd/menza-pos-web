import { apiClient } from '../../core/network/apiClient';
import {
  KitchenStation,
  CreateKitchenStationRequest,
  UpdateKitchenStationRequest,
  ToggleKitchenStationStatusRequest,
} from '../../domain/models/KitchenStation';

export class KitchenStationRemoteDataSource {
  async getStations(restaurantId: number, activeOnly: boolean = false): Promise<KitchenStation[]> {
    if (!restaurantId || restaurantId <= 0) return [];
    try {
      const response = await apiClient.get(`/KitchenStation/Restaurant/${restaurantId}`, {
        params: activeOnly ? { activeOnly: true } : undefined,
        headers: { 'X-Restaurant-Id': restaurantId.toString() },
      });
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.items)) return data.items;
      if (data && Array.isArray(data.data)) return data.data;
      return [];
    } catch (err: any) {
      console.warn('Failed to fetch kitchen stations:', err?.message);
      return [];
    }
  }

  async getStationById(id: number): Promise<KitchenStation | null> {
    if (!id || id <= 0) return null;
    try {
      const response = await apiClient.get(`/KitchenStation/${id}`);
      return response.data?.data ?? response.data ?? null;
    } catch (err: any) {
      console.warn(`Failed to fetch kitchen station #${id}:`, err?.message);
      return null;
    }
  }

  async createStation(data: CreateKitchenStationRequest): Promise<KitchenStation | null> {
    try {
      const response = await apiClient.post('/KitchenStation', data, {
        headers: { 'X-Restaurant-Id': data.restaurantId.toString() },
      });
      return response.data?.station ?? response.data?.data ?? response.data ?? null;
    } catch (err: any) {
      console.warn('Failed to create kitchen station:', err?.message);
      throw err;
    }
  }

  async updateStation(id: number, data: UpdateKitchenStationRequest): Promise<KitchenStation | null> {
    try {
      const response = await apiClient.put(`/KitchenStation/${id}`, data);
      return response.data?.station ?? response.data?.data ?? response.data ?? null;
    } catch (err: any) {
      console.warn(`Failed to update kitchen station #${id}:`, err?.message);
      throw err;
    }
  }

  async toggleStationStatus(id: number, data: ToggleKitchenStationStatusRequest): Promise<KitchenStation | null> {
    try {
      const response = await apiClient.put(`/KitchenStation/${id}/Status`, data);
      return response.data?.station ?? response.data?.data ?? response.data ?? null;
    } catch (err: any) {
      console.warn(`Failed to toggle station status #${id}:`, err?.message);
      throw err;
    }
  }

  async initializeDefaults(restaurantId: number): Promise<KitchenStation[]> {
    try {
      const response = await apiClient.post(`/KitchenStation/Restaurant/${restaurantId}/InitializeDefaults`, {}, {
        headers: { 'X-Restaurant-Id': restaurantId.toString() },
      });
      const data = response.data?.stations ?? response.data?.data ?? response.data;
      return Array.isArray(data) ? data : [];
    } catch (err: any) {
      console.warn('Failed to initialize default stations:', err?.message);
      throw err;
    }
  }

  async deleteStation(id: number): Promise<boolean> {
    try {
      const response = await apiClient.delete(`/KitchenStation/${id}`);
      return response.status === 200 || response.status === 204;
    } catch (err: any) {
      console.warn(`Failed to delete kitchen station #${id}:`, err?.message);
      return false;
    }
  }
}
