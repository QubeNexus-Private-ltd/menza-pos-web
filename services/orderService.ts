import { apiClient } from '@/lib/api/client';
import {
  OrderMaster,
  RestaurantTodayRevenue,
  TodayRevenueMetricsDTO,
  SettleOrderRequest,
  SettleOrderResponseDTO,
  OrderStatusDTO,
} from '@/types/order';

export interface PaginatedOrdersResponse {
  orders: OrderMaster[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

export class OrderService {
  static async placeOrder(payload: any): Promise<{ orderId: number; success: boolean; message: string }> {
    const res = await apiClient.post('/Order/PlaceOrder', payload);
    return res.data;
  }

  static async getTodayOrders(
    restaurantId: number,
    status: string = 'ALL',
    pageNumber: number = 1,
    pageSize: number = 50,
    search?: string
  ): Promise<OrderMaster[]> {
    const res = await apiClient.get<any>(`/Order/Restaurant/${restaurantId}/Orders/Today`, {
      params: {
        status: status === 'ALL' ? undefined : status,
        pageNumber,
        pageSize,
        search,
      },
    });

    if (Array.isArray(res.data)) {
      return res.data;
    }
    if (res.data && Array.isArray(res.data.orders)) {
      return res.data.orders;
    }
    if (res.data && Array.isArray(res.data.items)) {
      return res.data.items;
    }
    return [];
  }

  static async getTodayRevenueMetrics(restaurantId: number): Promise<RestaurantTodayRevenue> {
    try {
      const res = await apiClient.get<TodayRevenueMetricsDTO | RestaurantTodayRevenue>(
        `/Order/Restaurant/${restaurantId}/Metrics/Today`
      );
      return {
        todayRevenue: Number(res.data?.todayRevenue || 0),
        todayOrdersCount: Number(res.data?.todayOrdersCount || 0),
        settledOrdersCount: (res.data as any)?.settledOrdersCount || 0,
        pendingOrdersCount: (res.data as any)?.pendingOrdersCount || 0,
      };
    } catch {
      return { todayRevenue: 0, todayOrdersCount: 0 };
    }
  }

  static async getOrder(orderId: number): Promise<OrderMaster | null> {
    const res = await apiClient.get<OrderMaster>(`/Order/${orderId}`);
    return res.data;
  }

  static async settleOrder(orderId: number, model: SettleOrderRequest): Promise<SettleOrderResponseDTO> {
    const res = await apiClient.post<SettleOrderResponseDTO>(`/Order/${orderId}/Settle`, model);
    return res.data;
  }

  static async updateOrderStatus(orderId: number, status: string): Promise<boolean> {
    const res = await apiClient.put(`/Order/${orderId}/Status`, { status });
    return res.status === 200;
  }

  static async updateTableStatus(tableId: number, status: string): Promise<boolean> {
    const res = await apiClient.put(`/Order/Table/${tableId}/Status`, { status });
    return res.status === 200;
  }

  static async getActiveOrderByTable(tableId: number, restaurantId?: number): Promise<OrderMaster | null> {
    try {
      const res = await apiClient.get<OrderMaster>(`/Order/Table/${tableId}/Active`, {
        params: { restaurantId },
      });
      return res.data;
    } catch {
      return null;
    }
  }

  static async settleTable(tableId: number): Promise<boolean> {
    const res = await apiClient.post(`/Order/Table/${tableId}/Settle`);
    return res.status === 200;
  }

  static async getOrderTypes(): Promise<any[]> {
    const res = await apiClient.get<any[]>('/Order/Types');
    return res.data || [];
  }

  static async getOrderHistory(orderId: number): Promise<any[]> {
    try {
      const res = await apiClient.get<any[]>(`/Order/${orderId}/History`);
      return res.data || [];
    } catch {
      return [];
    }
  }

  static async getKitchenOrders(restaurantId?: number, stationId?: number): Promise<any[]> {
    const res = await apiClient.get<any[]>('/Order/Kitchen', {
      params: { restaurantId, stationId },
    });
    return res.data || [];
  }

  static async updateKitchenOrderStatus(orderId: number, status: string, version: number = 1): Promise<boolean> {
    const res = await apiClient.put(`/Order/${orderId}/Kitchen/Status`, { status, version });
    return res.status === 200;
  }

  static async getOrderStatuses(): Promise<OrderStatusDTO[]> {
    try {
      const res = await apiClient.get<OrderStatusDTO[]>('/Order/Statuses');
      return res.data || [];
    } catch {
      return [];
    }
  }
}
