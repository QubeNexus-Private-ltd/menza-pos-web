import { CartSummary } from '../models/Cart';
import { AddToCartPayload } from '../../data/datasources/CartRemoteDataSource';

export interface ICartRepository {
  getCart(deviceId?: string): Promise<CartSummary>;
  addItem(
    restaurantIdOrPayload: number | AddToCartPayload,
    itemId?: number,
    quantity?: number,
    instruction?: string,
    deviceId?: string
  ): Promise<boolean>;
  updateItem(itemId: number, quantity: number, instruction?: string, deviceId?: string): Promise<boolean>;
  removeItem(itemId: number, deviceId?: string): Promise<boolean>;
  clearCart(deviceId?: string): Promise<boolean>;
}
