import { apiClient } from '../../core/network/apiClient';
import { Category } from '../../domain/models/Category';
import { MenuItem } from '../../domain/models/Item';

export class CatalogRemoteDataSource {
  async getCategories(restaurantId?: number): Promise<Category[]> {
    try {
      const url = restaurantId ? `/CategoryMaster?restaurantId=${restaurantId}` : '/CategoryMaster';
      const response = await apiClient.get(url);
      const data = response?.data;
      console.log('📌 [API RESPONSE] getCategories:', JSON.stringify(data));
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.items)) return data.items;
      if (data && Array.isArray(data.data)) return data.data;
      return [];
    } catch (err) {
      console.warn('❌ [API ERROR] getCategories:', err);
      return [];
    }
  }

  async createCategory(categoryName: string, categoryDescription: string, restaurantId: number, imageUrl?: string, kitchenStationId?: number): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.post('/CategoryMaster', {
        restaurantId,
        categoryName,
        categoryDescription,
        imageUrl: imageUrl || '',
        kitchenStationId: kitchenStationId || null,
      });
      return { success: response.status === 200 || response.status === 201, message: response.data?.message };
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || err.message || 'Failed to create category';
      return { success: false, message: typeof msg === 'string' ? msg : JSON.stringify(msg) };
    }
  }

  async getMenuItems(restaurantId?: number, pageNumber?: number, pageSize?: number): Promise<MenuItem[]> {
    try {
      let url = restaurantId ? `/ItemMaster?restaurantId=${restaurantId}` : '/ItemMaster';
      if (pageNumber && pageSize) {
        url += `${url.includes('?') ? '&' : '?'}pageNumber=${pageNumber}&pageSize=${pageSize}`;
      }
      const response = await apiClient.get(url);
      const data = response?.data;
      console.log('📌 [API RESPONSE] getMenuItems for url:', url);
      let resultItems: any[] = [];
      if (Array.isArray(data)) resultItems = data;
      else if (data && Array.isArray(data.items)) resultItems = data.items;
      else if (data && Array.isArray(data.data)) resultItems = data.data;
      else if (data && Array.isArray(data.result)) resultItems = data.result;

      return resultItems.map((item: any) => ({
        ...item,
        id: Number(item.id ?? item.Id ?? 0),
        itemName: String(item.itemName ?? item.ItemName ?? item.name ?? item.Name ?? 'Dish'),
        description: item.description ?? item.Description ?? item.itemDescription ?? item.ItemDescription ?? '',
        price: Number(item.price ?? item.Price ?? 0),
        categoryId: item.categoryId ?? item.CategoryId,
        categoryName: item.categoryName ?? item.CategoryName,
        isVeg: item.isVeg !== undefined ? Boolean(item.isVeg) : item.IsVeg !== undefined ? Boolean(item.IsVeg) : true,
        isAvailable: item.isAvailable !== undefined ? Boolean(item.isAvailable) : item.IsAvailable !== undefined ? Boolean(item.IsAvailable) : Boolean(item.isActive ?? item.IsActive ?? true),
        imageUrl: item.imageUrl || item.ImageUrl || item.image || item.Image || item.itemImage || item.ItemImage || item.photoUrl || item.PhotoUrl || '',
      }));
    } catch (err) {
      console.warn('❌ [API ERROR] getMenuItems:', err);
      return [];
    }
  }

  async updateItemStatus(itemId: number, isAvailable: boolean): Promise<boolean> {
    try {
      const response = await apiClient.put(`/ItemMaster/${itemId}/status?isActive=${isAvailable}`);
      return response.status === 200;
    } catch {
      try {
        const response = await apiClient.put(`/RestaurantItemRelationship/${itemId}/status?isActive=${isAvailable}`);
        return response.status === 200;
      } catch {
        return false;
      }
    }
  }

  async createMenuItem(item: {
    itemName: string;
    itemDescription: string;
    price: number;
    quantity?: number;
    unitId?: number;
    isVeg: boolean;
    isSpicy?: boolean;
    preparationTimeMinutes?: number;
    hsnCode?: string;
    categoryId: number;
    restaurantId: number;
    imageUrl?: string;
    kitchenStationId?: number;
  }): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.post('/ItemMaster', {
        restaurantId: item.restaurantId,
        itemName: item.itemName,
        itemDescription: item.itemDescription,
        imageUrl: item.imageUrl || '',
        categoryId: item.categoryId,
        price: item.price,
        quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
        unitId: item.unitId,
        isVeg: item.isVeg,
        isSpicy: item.isSpicy,
        preparationTimeMinutes: item.preparationTimeMinutes,
        hsnCode: item.hsnCode,
        kitchenStationId: item.kitchenStationId || null,
      });
      return { success: response.status === 200 || response.status === 201, message: response.data?.message };
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || err.message || 'Failed to create menu item';
      return { success: false, message: typeof msg === 'string' ? msg : JSON.stringify(msg) };
    }
  }

  async updateCategory(id: number, categoryName: string, categoryDescription: string, restaurantId: number, imageUrl?: string, kitchenStationId?: number): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.put(`/CategoryMaster/${id}?restaurantId=${restaurantId}`, {
        restaurantId,
        categoryName,
        categoryDescription,
        imageUrl: imageUrl || '',
        kitchenStationId: kitchenStationId || null,
      });
      return { success: response.status === 200, message: response.data?.message };
    } catch (err: any) {
      return { success: false, message: err.response?.data?.message || 'Failed to update category' };
    }
  }

  async deleteCategory(id: number, restaurantId: number): Promise<boolean> {
    try {
      const response = await apiClient.delete(`/CategoryMaster/${id}?restaurantId=${restaurantId}`);
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async updateMenuItem(
    id: number,
    item: {
      itemName: string;
      itemDescription: string;
      price: number;
      quantity?: number;
      unitId?: number;
      isVeg: boolean;
      isSpicy?: boolean;
      preparationTimeMinutes?: number;
      hsnCode?: string;
      categoryId: number;
      restaurantId: number;
      imageUrl?: string;
      kitchenStationId?: number;
    }
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.put(`/ItemMaster/${id}?restaurantId=${item.restaurantId}`, {
        restaurantId: item.restaurantId,
        itemName: item.itemName,
        itemDescription: item.itemDescription,
        imageUrl: item.imageUrl || '',
        categoryId: item.categoryId,
        price: item.price,
        quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
        unitId: item.unitId,
        isVeg: item.isVeg,
        isSpicy: item.isSpicy,
        preparationTimeMinutes: item.preparationTimeMinutes,
        hsnCode: item.hsnCode,
        kitchenStationId: item.kitchenStationId || null,
      });
      return { success: response.status === 200, message: response.data?.message };
    } catch (err: any) {
      return { success: false, message: err.response?.data?.message || 'Failed to update item' };
    }
  }

  async uploadImage(fileData: { uri: string; name: string; type: string }): Promise<{ success: boolean; imageUrl?: string; message?: string }> {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: fileData.uri,
        name: fileData.name || 'item_image.jpg',
        type: fileData.type || 'image/jpeg',
      } as any);

      const response = await apiClient.post('/Image/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const url = response.data?.url || response.data?.imageUrl || response.data?.data?.url || response.data;
      return { success: true, imageUrl: typeof url === 'string' ? url : '' };
    } catch (err: any) {
      return { success: false, message: err.response?.data?.message || 'Failed to upload image' };
    }
  }

  async deleteMenuItem(id: number, restaurantId: number): Promise<boolean> {
    try {
      const response = await apiClient.delete(`/ItemMaster/${id}?restaurantId=${restaurantId}`);
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async addItemVariant(itemId: number, variantName: string, additionalPrice: number): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.post(`/ItemMaster/${itemId}/variants`, {
        itemId,
        variantName,
        additionalPrice,
      });
      return { success: response.status === 200 || response.status === 201, message: response.data?.message };
    } catch (err: any) {
      return { success: false, message: err.response?.data?.message || 'Failed to add variant' };
    }
  }

  async getItemVariants(itemId: number): Promise<any[]> {
    try {
      const response = await apiClient.get(`/ItemMaster/${itemId}/variants`);
      return response.data || [];
    } catch {
      return [];
    }
  }

  async deleteItemVariant(variantId: number): Promise<boolean> {
    try {
      const response = await apiClient.delete(`/ItemMaster/variants/${variantId}`);
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async addItemModifierGroup(itemId: number, groupName: string): Promise<{ success: boolean; id?: number }> {
    try {
      const response = await apiClient.post(`/ItemMaster/${itemId}/modifier-groups`, {
        itemId,
        groupName,
      });
      return { success: response.status === 200 || response.status === 201, id: response.data?.id };
    } catch {
      return { success: false };
    }
  }

  async addItemModifier(groupId: number, modifierName: string, extraPrice: number): Promise<{ success: boolean }> {
    try {
      const response = await apiClient.post(`/ItemMaster/modifier-groups/${groupId}/modifiers`, {
        modifierGroupId: groupId,
        modifierName,
        extraPrice,
      });
      return { success: response.status === 200 || response.status === 201 };
    } catch {
      return { success: false };
    }
  }

  async getItemModifierGroups(itemId: number): Promise<any[]> {
    try {
      const response = await apiClient.get(`/ItemMaster/${itemId}/modifier-groups`);
      return response.data || [];
    } catch {
      return [];
    }
  }
}
