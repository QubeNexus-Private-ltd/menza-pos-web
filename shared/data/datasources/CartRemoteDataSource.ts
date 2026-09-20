import { apiClient } from '../../core/network/apiClient';
import { CartSummary } from '../../domain/models/Cart';

export interface AddToCartPayload {
  restaurantId: number;
  itemId: number;
  quantity: number;
  variantId?: number;
  modifierIds?: number[];
  cookingInstruction?: string;
  deviceId?: string;
}

export class CartRemoteDataSource {
  async getCart(deviceId?: string): Promise<CartSummary> {
    const url = deviceId ? `/Cart?deviceId=${encodeURIComponent(deviceId)}` : '/Cart';
    const response = await apiClient.get(url);
    return response.data;
  }

  async addItem(
    restaurantIdOrPayload: number | AddToCartPayload,
    itemId?: number,
    quantity?: number,
    instruction?: string,
    deviceId?: string
  ): Promise<boolean> {
    let payload: AddToCartPayload;
    if (typeof restaurantIdOrPayload === 'object') {
      payload = restaurantIdOrPayload;
    } else {
      payload = {
        restaurantId: restaurantIdOrPayload,
        itemId: itemId || 0,
        quantity: quantity || 1,
        cookingInstruction: instruction,
        deviceId: deviceId,
      };
    }

    const response = await apiClient.post('/Cart/add', payload);
    return response.status === 200;
  }

  async updateItem(itemId: number, quantity: number, instruction?: string, deviceId?: string): Promise<boolean> {
    const response = await apiClient.put('/Cart/update-quantity', {
      itemId,
      quantity,
      cookingInstruction: instruction,
      deviceId,
    });
    return response.status === 200;
  }

  async removeItem(itemId: number, deviceId?: string): Promise<boolean> {
    const url = deviceId ? `/Cart/remove/${itemId}?deviceId=${encodeURIComponent(deviceId)}` : `/Cart/remove/${itemId}`;
    const response = await apiClient.delete(url);
    return response.status === 200;
  }

  async clearCart(deviceId?: string): Promise<boolean> {
    const url = deviceId ? `/Cart/clear?deviceId=${encodeURIComponent(deviceId)}` : '/Cart/clear';
    const response = await apiClient.delete(url);
    return response.status === 200;
  }
}
