import { IOrderRepository } from '../../domain/repositories/IOrderRepository';
import { OrderRemoteDataSource } from '../datasources/OrderRemoteDataSource';
import {
  OrderMaster,
  PlaceOrderRequest,
  RestaurantTodayRevenue,
  PaginatedOrdersResult,
  OrderStatusOption,
  SettleOrderRequest,
  SettleOrderResponse,
} from '../../domain/models/Order';

export class OrderRepositoryImpl implements IOrderRepository {
  constructor(private remoteDataSource: OrderRemoteDataSource) {}

  async getTodayRevenue(restaurantId: number): Promise<RestaurantTodayRevenue> {
    return await this.remoteDataSource.getTodayRevenue(restaurantId);
  }

  async getTodayOrders(
    restaurantId: number,
    status?: string,
    pageNumber: number = 1,
    pageSize: number = 20,
    search?: string
  ): Promise<PaginatedOrdersResult> {
    return await this.remoteDataSource.getTodayOrders(restaurantId, status, pageNumber, pageSize, search);
  }

  async getOrderStatuses(): Promise<OrderStatusOption[]> {
    return await this.remoteDataSource.getOrderStatuses();
  }

  async getKitchenOrders(restaurantId?: number): Promise<OrderMaster[]> {
    return await this.remoteDataSource.getKitchenOrders(restaurantId);
  }

  async getOrder(orderId: number): Promise<OrderMaster> {
    return await this.remoteDataSource.getOrder(orderId);
  }

  async placeOrder(order: PlaceOrderRequest | Partial<OrderMaster>): Promise<number> {
    return await this.remoteDataSource.placeOrder(order);
  }

  async addItemToOrder(orderId: number, itemId: number, quantity: number): Promise<boolean> {
    return await this.remoteDataSource.addItemToOrder(orderId, itemId, quantity);
  }

  async settleOrder(orderId: number, data?: SettleOrderRequest): Promise<SettleOrderResponse> {
    return await this.remoteDataSource.settleOrder(orderId, data);
  }

  async settleTable(tableId: number): Promise<boolean> {
    return await this.remoteDataSource.settleTable(tableId);
  }
}
