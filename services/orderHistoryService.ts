import { apiClient } from '@/lib/api/client';

export interface OrderTimelineItem {
  id?: number;
  orderId: number;
  action: string;
  description: string;
  createdDateUtc?: string;
  createdBy?: number;
}

export class WebOrderHistoryService {
  static async getOrderHistory(orderId: number): Promise<OrderTimelineItem[]> {
    if (!orderId || orderId <= 0) return [];
    try {
      const response = await apiClient.get(`/Order/${orderId}/History`);
      const data = response.data;
      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      return list.map((item: any) => ({
        id: item.id ?? item.Id,
        orderId: Number(item.orderId ?? item.OrderId ?? orderId),
        action: String(item.action ?? item.Action ?? 'Status Update'),
        description: String(item.description ?? item.Description ?? ''),
        createdDateUtc: item.createdDateUtc ?? item.CreatedDateUtc ?? item.createdAt ?? item.CreatedAt,
        createdBy: item.createdBy ?? item.CreatedBy,
      }));
    } catch (err) {
      console.warn(`Failed to fetch history for order ${orderId}:`, err);
      return [];
    }
  }
}
