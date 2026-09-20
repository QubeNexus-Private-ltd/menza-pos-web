import { ICartRepository } from '../../domain/repositories/ICartRepository';
import { CartRemoteDataSource, AddToCartPayload } from '../datasources/CartRemoteDataSource';
import { CartSummary } from '../../domain/models/Cart';

export class CartRepositoryImpl implements ICartRepository {
  constructor(private remoteDataSource: CartRemoteDataSource) {}

  async getCart(deviceId?: string): Promise<CartSummary> {
    return await this.remoteDataSource.getCart(deviceId);
  }

  async addItem(
    restaurantIdOrPayload: number | AddToCartPayload,
    itemId?: number,
    quantity?: number,
    instruction?: string,
    deviceId?: string
  ): Promise<boolean> {
    return await this.remoteDataSource.addItem(restaurantIdOrPayload, itemId, quantity, instruction, deviceId);
  }

  async updateItem(itemId: number, quantity: number, instruction?: string, deviceId?: string): Promise<boolean> {
    return await this.remoteDataSource.updateItem(itemId, quantity, instruction, deviceId);
  }

  async removeItem(itemId: number, deviceId?: string): Promise<boolean> {
    return await this.remoteDataSource.removeItem(itemId, deviceId);
  }

  async clearCart(deviceId?: string): Promise<boolean> {
    return await this.remoteDataSource.clearCart(deviceId);
  }
}
