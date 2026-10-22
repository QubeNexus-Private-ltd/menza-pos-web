import { apiClient } from '@shared/core/network/apiClient';

export interface TableQrResponseDTO {
  tableId: number;
  tableNumber: string;
  tableName: string;
  restaurantId: number;
  restaurantName: string;
  qrCodeBase64: string; // Base64 PNG image string
  qrUrl: string; // Customer direct order URL
  generatedAt: string;
  isTimeBound?: boolean;
  ttlSeconds?: number;
  expiresAtUtc?: string;
}

export interface RestaurantQrResponseDTO {
  restaurantId: number;
  restaurantName: string;
  qrCodeBase64: string;
  qrUrl: string;
  generatedAt: string;
}

export class WebTableQrService {
  static async getTableQr(tableId: number, restaurantId?: number): Promise<TableQrResponseDTO | null> {
    try {
      const response = await apiClient.get(`/TableMaster/${tableId}/qr-download`, {
        params: restaurantId ? { restaurantId } : undefined,
      });
      const data = response.data;
      if (!data) return null;
      return {
        tableId: data.tableId,
        tableNumber: data.tableName || String(tableId),
        tableName: data.tableName,
        restaurantId: data.restaurantId,
        restaurantName: data.restaurantName,
        qrCodeBase64: data.qrCodeBase64Png || data.qrCodeBase64,
        qrUrl: data.dineInUrl || data.qrUrl,
        generatedAt: new Date().toISOString(),
        isTimeBound: false,
      };
    } catch (err: any) {
      console.warn(`Failed to fetch QR for table #${tableId}:`, err?.message);
      return null;
    }
  }

  static async getRollingTableQr(tableId: number, ttlMinutes: number = 15): Promise<TableQrResponseDTO | null> {
    try {
      const response = await apiClient.get(`/TableMaster/${tableId}/rolling-qr`, {
        params: { ttlMinutes },
      });
      const data = response.data;
      if (!data) return null;
      return {
        tableId: data.tableId,
        tableNumber: data.tableName || String(tableId),
        tableName: data.tableName,
        restaurantId: data.restaurantId,
        restaurantName: data.restaurantName,
        qrCodeBase64: data.qrCodeBase64Png || data.qrCodeBase64,
        qrUrl: data.dineInUrl || data.qrUrl,
        generatedAt: new Date().toISOString(),
        isTimeBound: true,
        ttlSeconds: data.ttlSeconds ?? ttlMinutes * 60,
        expiresAtUtc: data.expiresAtUtc,
      };
    } catch (err: any) {
      console.warn(`Failed to fetch rolling QR for table #${tableId}:`, err?.message);
      return null;
    }
  }

  static async getStorefrontQr(restaurantId: number): Promise<RestaurantQrResponseDTO | null> {
    try {
      const response = await apiClient.get(`/TableMaster/restaurant/${restaurantId}/qr-download`);
      const data = response.data;
      if (!data) return null;
      return {
        restaurantId: data.restaurantId,
        restaurantName: data.restaurantName,
        qrCodeBase64: data.qrCodeBase64Png || data.qrCodeBase64,
        qrUrl: data.dineInUrl || data.qrUrl,
        generatedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      console.warn(`Failed to fetch storefront QR for restaurant #${restaurantId}:`, err?.message);
      return null;
    }
  }
}
