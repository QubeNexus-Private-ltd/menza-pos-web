import { apiClient } from '@/lib/api/client';

export interface KitchenStationDTO {
  id: number;
  restaurantId: number;
  stationCode: string;
  stationName: string;
  description?: string;
  colorHex?: string;
  sortOrder: number;
  isActive: boolean;
  isPaused?: boolean;
  remainingPauseMinutes?: number;
  isKdsEnabled?: boolean;
}

export interface CreateKitchenStationModel {
  restaurantId: number;
  stationCode: string;
  stationName: string;
  description?: string;
  colorHex?: string;
  sortOrder?: number;
  isKdsEnabled?: boolean;
}

export interface UpdateKitchenStationModel {
  stationCode?: string;
  stationName?: string;
  description?: string;
  colorHex?: string;
  sortOrder?: number;
  isKdsEnabled?: boolean;
}

export class WebKitchenService {
  static async getStations(restaurantId: number, activeOnly: boolean = false): Promise<KitchenStationDTO[]> {
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

  static async createStation(model: CreateKitchenStationModel): Promise<KitchenStationDTO | null> {
    const response = await apiClient.post('/KitchenStation', model, {
      headers: { 'X-Restaurant-Id': model.restaurantId.toString() },
    });
    return response.data?.station || response.data?.data || response.data || null;
  }

  static async updateStation(id: number, model: UpdateKitchenStationModel): Promise<KitchenStationDTO | null> {
    const response = await apiClient.put(`/KitchenStation/${id}`, model);
    return response.data?.station || response.data?.data || response.data || null;
  }

  static async toggleStationStatus(id: number, isActive: boolean, pauseMinutes?: number): Promise<boolean> {
    const response = await apiClient.put(`/KitchenStation/${id}/Status`, {
      isActive,
      pauseMinutes: pauseMinutes || 0,
    });
    return response.status === 200;
  }

  static async initializeDefaults(restaurantId: number): Promise<KitchenStationDTO[]> {
    const response = await apiClient.post(`/KitchenStation/Restaurant/${restaurantId}/InitializeDefaults`, {}, {
      headers: { 'X-Restaurant-Id': restaurantId.toString() },
    });
    const data = response.data?.stations || response.data?.data || response.data;
    return Array.isArray(data) ? data : [];
  }

  static async deleteStation(id: number): Promise<boolean> {
    const response = await apiClient.delete(`/KitchenStation/${id}`);
    return response.status === 200 || response.status === 204;
  }
}
