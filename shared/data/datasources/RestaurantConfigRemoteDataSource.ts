import { apiClient } from '../../core/network/apiClient';
import { RestaurantConfig } from '../../domain/models/RestaurantConfig';
import { useAuthStore } from '../../presentation/state/useAuthStore';

export class RestaurantConfigRemoteDataSource {
  async getConfig(restaurantId?: number): Promise<RestaurantConfig> {
    try {
      const url = restaurantId && restaurantId > 0
        ? `/RestaurantConfig?resId=${restaurantId}`
        : '/RestaurantConfig';

      const response = await apiClient.get(url, {
        headers: restaurantId && restaurantId > 0 ? { 'X-Restaurant-Id': restaurantId.toString() } : {},
      });
      const data = response.data;
      const item = Array.isArray(data)
        ? data[0]
        : (data?.items?.[0] || data?.Items?.[0] || data?.data?.[0] || data?.data || data || {});

      const activeRest = useAuthStore.getState().activeRestaurant;
      const sgst = Number(item.sgstPercentage ?? item.SgstPercentage ?? 2.5);
      const cgst = Number(item.cgstPercentage ?? item.CgstPercentage ?? 2.5);
      const totalGst = Number(item.totalGstPercentage ?? item.TotalGstPercentage ?? (sgst + cgst));

      return {
        id: Number(item.id || item.Id || restaurantId || activeRest?.restaurantId || 1),
        restaurantName: String(item.restName || item.restaurantName || item.RestName || item.RestaurantName || activeRest?.restaurantName || 'Menza Restaurant'),
        address: String(item.address || item.Address || activeRest?.address || ''),
        city: String(item.city || item.City || activeRest?.city || ''),
        state: String(item.state || item.State || activeRest?.state || ''),
        imageUrl: String(item.imageUrl || item.ImageUrl || activeRest?.imageUrl || ''),
        logoUrl: String(item.logo || item.logoUrl || item.Logo || item.LogoUrl || activeRest?.logoUrl || ''),
        contactNumber: String(item.contactNumber || item.ContactNumber || item.phone || item.Phone || (activeRest as any)?.contactNumber || activeRest?.ownerMobile || ''),
        email: String(item.email || item.Email || ''),
        gstNumber: String(item.gstNumber || item.GstNumber || item.gstin || ''),
        sgstPercentage: sgst,
        cgstPercentage: cgst,
        totalGstPercentage: totalGst,
        currencySymbol: '₹',
        taxPercentage: totalGst,
        walletBalance: Number(item.walletBalance || item.WalletBalance || 0),
        businessProfile: (item.businessProfile || item.BusinessProfile || 'HYBRID') as any,
        kitchenMode: (item.kitchenMode || item.KitchenMode || 'SINGLE_KITCHEN') as any,
        isKitchenActive: Boolean(item.isKitchenActive ?? item.IsKitchenActive ?? true),
        kitchenPausedUntilUtc: item.kitchenPausedUntilUtc ?? item.KitchenPausedUntilUtc ?? null,
        kitchenPauseReason: item.kitchenPauseReason ?? item.KitchenPauseReason ?? null,
        isActive: Boolean(item.isActive ?? item.IsActive ?? true),
      };
    } catch {
      const activeRest = useAuthStore.getState().activeRestaurant;
      return {
        id: restaurantId || activeRest?.restaurantId || 1,
        restaurantName: activeRest?.restaurantName || 'Menza Restaurant',
        address: activeRest?.address || '',
        city: activeRest?.city || '',
        state: activeRest?.state || '',
        imageUrl: activeRest?.imageUrl || '',
        logoUrl: activeRest?.logoUrl || '',
        contactNumber: (activeRest as any)?.contactNumber || activeRest?.ownerMobile || '',
        email: '',
        gstNumber: '',
        sgstPercentage: 2.5,
        cgstPercentage: 2.5,
        totalGstPercentage: 5.0,
        currencySymbol: '₹',
        taxPercentage: 5,
        walletBalance: 0,
        businessProfile: 'HYBRID',
        kitchenMode: 'SINGLE_KITCHEN',
        isKitchenActive: true,
        isActive: true,
      };
    }
  }

  async updateConfig(restaurantId: number, config: Partial<RestaurantConfig>): Promise<boolean> {
    try {
      const targetId = restaurantId > 0 ? restaurantId : (config.id || 1);
      const payload = {
        restaurantName: config.restaurantName?.trim() || '',
        address: config.address?.trim() || '',
        city: config.city?.trim() || '',
        state: config.state?.trim() || 'KA',
        imageUrl: config.imageUrl?.trim() || '',
        logoUrl: config.logoUrl?.trim() || '',
        contactNumber: config.contactNumber?.trim() || '',
        email: config.email?.trim() || '',
        gstNumber: config.gstNumber?.trim() || '',
        sgstPercentage: typeof config.sgstPercentage === 'number' ? config.sgstPercentage : 2.5,
        cgstPercentage: typeof config.cgstPercentage === 'number' ? config.cgstPercentage : 2.5,
        kitchenMode: config.kitchenMode || 'SINGLE_KITCHEN',
        isKitchenActive: config.isKitchenActive !== undefined ? config.isKitchenActive : true,
      };

      const response = await apiClient.put(`/RestaurantConfig/${targetId}`, payload, {
        headers: { 'X-Restaurant-Id': targetId.toString() },
      });
      return response.status === 200 || response.status === 204;
    } catch (err: any) {
      console.warn('Update restaurant profile error:', err?.message);
      return false;
    }
  }

  async uploadImage(fileUri: string): Promise<string> {
    try {
      const formData = new FormData();
      const filename = fileUri.split('/').pop() || 'store_image.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      formData.append('File', {
        uri: fileUri,
        name: filename,
        type,
      } as any);

      const response = await apiClient.post('/Image/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data?.url || response.data?.Url || '';
    } catch {
      return '';
    }
  }

  async getOperatingStatus(restaurantId: number): Promise<import('../../domain/models/RestaurantConfig').StoreOperatingStatus | null> {
    try {
      if (!restaurantId || restaurantId <= 0) return null;
      const response = await apiClient.get(`/RestaurantConfig/${restaurantId}/OperatingStatus`, {
        headers: { 'X-Restaurant-Id': restaurantId.toString() },
      });
      return this.unwrapStoreStatus(response.data, restaurantId);
    } catch (err: any) {
      console.warn('Failed to fetch operating status:', err?.message);
      return null;
    }
  }

  async toggleOrdering(
    restaurantId: number,
    request: import('../../domain/models/RestaurantConfig').ToggleOrderingRequest
  ): Promise<import('../../domain/models/RestaurantConfig').StoreOperatingStatus | null> {
    try {
      if (!restaurantId || restaurantId <= 0) return null;
      const response = await apiClient.post(`/RestaurantConfig/${restaurantId}/ToggleOrdering`, request, {
        headers: { 'X-Restaurant-Id': restaurantId.toString() },
      });
      const result = this.unwrapStoreStatus(response.data, restaurantId);
      if (result && request.isKitchenActive !== undefined) {
        result.isKitchenActive = request.isKitchenActive;
      }
      return result;
    } catch (err: any) {
      console.warn('Failed to toggle ordering status:', err?.message);
      throw err;
    }
  }

  async updateOperatingHours(
    restaurantId: number,
    model: import('../../domain/models/RestaurantConfig').OperatingHoursRequest
  ): Promise<import('../../domain/models/RestaurantConfig').StoreOperatingStatus | null> {
    try {
      if (!restaurantId || restaurantId <= 0) return null;
      const response = await apiClient.put(`/RestaurantConfig/${restaurantId}/OperatingHours`, model, {
        headers: { 'X-Restaurant-Id': restaurantId.toString() },
      });
      return this.unwrapStoreStatus(response.data, restaurantId);
    } catch (err: any) {
      console.warn('Failed to update operating hours:', err?.message);
      throw err;
    }
  }

  private unwrapStoreStatus(raw: any, restaurantId: number): import('../../domain/models/RestaurantConfig').StoreOperatingStatus | null {
    if (!raw) return null;
    let obj: any = raw;
    if (obj && typeof obj.status === 'object' && obj.status !== null) {
      obj = obj.status;
    } else if (obj && typeof obj.data === 'object' && obj.data !== null) {
      obj = obj.data;
    }

    if (typeof obj === 'string') {
      return {
        restaurantId,
        restaurantName: '',
        isOpen: obj === 'OPEN',
        orderingMode: 'MANUAL',
        status: obj as any,
        statusMessage: '',
        openingTime: '',
        closingTime: '',
        lastOrderTime: '',
        lastOrderBufferMinutes: 0,
        canPlaceOrder: obj === 'OPEN',
        isKitchenActive: true,
      };
    }

    if (obj && typeof obj === 'object') {
      const isKitchenActive =
        typeof obj.isKitchenActive === 'boolean'
          ? obj.isKitchenActive
          : typeof obj.IsKitchenActive === 'boolean'
          ? obj.IsKitchenActive
          : obj.isKitchenActive !== false;

      return {
        ...obj,
        restaurantId: obj.restaurantId || restaurantId,
        isKitchenActive,
        isOpen: Boolean(obj.isOpen ?? obj.IsOpen ?? false),
        canPlaceOrder: Boolean(obj.canPlaceOrder ?? obj.CanPlaceOrder ?? obj.isOpen ?? false),
        status: typeof obj.status === 'string' ? obj.status : (obj.isOpen ? 'OPEN' : 'CLOSED'),
      };
    }

    return null;
  }

  async getOperatingHistory(
    restaurantId: number,
    limit = 20
  ): Promise<import('../../domain/models/RestaurantConfig').RestaurantOperatingHistoryEntry[]> {
    try {
      if (!restaurantId || restaurantId <= 0) return [];
      const response = await apiClient.get(`/RestaurantConfig/${restaurantId}/OperatingHistory?limit=${limit}`, {
        headers: { 'X-Restaurant-Id': restaurantId.toString() },
      });
      const data = response.data?.data ?? response.data;
      return Array.isArray(data) ? data : [];
    } catch (err: any) {
      console.warn('Failed to fetch operating status history:', err?.message);
      return [];
    }
  }

  async getAuditLogs(restaurantId: number, date?: string): Promise<any[]> {
    try {
      if (!restaurantId || restaurantId <= 0) return [];
      const query = date ? `?date=${encodeURIComponent(date)}` : '';
      const response = await apiClient.get(`/RestaurantConfig/${restaurantId}/AuditLogs${query}`, {
        headers: { 'X-Restaurant-Id': restaurantId.toString() },
      });
      return response.data?.logs ?? response.data?.data ?? response.data ?? [];
    } catch (err: any) {
      console.warn('Failed to fetch audit logs:', err?.message);
      return [];
    }
  }
}
