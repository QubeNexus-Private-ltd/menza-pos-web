import {
  OrderMaster,
  PlaceOrderRequest,
  RestaurantTodayRevenue,
  PaginatedOrdersResult,
  OrderStatusOption,
  SettleOrderRequest,
  SettleOrderResponse,
} from '../models/Order';

export interface IOrderRepository {
  getTodayRevenue(restaurantId: number): Promise<RestaurantTodayRevenue>;
  getTodayOrders(
    restaurantId: number,
    status?: string,
    pageNumber?: number,
    pageSize?: number,
    search?: string
  ): Promise<PaginatedOrdersResult>;
  getOrderStatuses(): Promise<OrderStatusOption[]>;
  getKitchenOrders(restaurantId?: number): Promise<OrderMaster[]>;
  getOrder(orderId: number): Promise<OrderMaster>;
  placeOrder(order: PlaceOrderRequest | Partial<OrderMaster>): Promise<number>;
  addItemToOrder(orderId: number, itemId: number, quantity: number): Promise<boolean>;
  settleOrder(orderId: number, data?: SettleOrderRequest): Promise<SettleOrderResponse>;
  settleTable(tableId: number): Promise<boolean>;
  getActiveOrderByTable(tableId: number, restaurantId?: number): Promise<OrderMaster | null>;
  cancelOrder(orderId: number, reason?: string): Promise<boolean>;
}
