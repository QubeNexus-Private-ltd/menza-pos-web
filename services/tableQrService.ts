import { apiClient } from '@/lib/api/client';

export interface TableQrResponseDTO {
  tableId: number;
  tableNumber: string;
  tableName: string;
  restaurantId: number;
  restaurantName: string;
  qrCodeBase64: string; // Base64 PNG image string
  qrUrl: string; // Customer direct order URL
  generatedAt: string;
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
      return response.data || null;
    } catch (err: any) {
      console.warn(`Failed to fetch QR for table #${tableId}:`, err?.message);
      return null;
    }
  }

  static async getStorefrontQr(restaurantId: number): Promise<RestaurantQrResponseDTO | null> {
    try {
      const response = await apiClient.get(`/TableMaster/restaurant/${restaurantId}/qr-download`);
      return response.data || null;
    } catch (err: any) {
      console.warn(`Failed to fetch storefront QR for restaurant #${restaurantId}:`, err?.message);
      return null;
    }
  }
}
