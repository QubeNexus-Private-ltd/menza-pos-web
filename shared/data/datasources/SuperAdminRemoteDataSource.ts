import { apiClient } from '../../core/network/apiClient';
import { OnboardRestaurantRequest } from '../../domain/models/OnboardRestaurantRequest';
import { RestaurantDetail } from '../../domain/models/Restaurant';
import { RestaurantOrderingConfig } from '../../domain/models/RestaurantConfig';
import { OrderConfigDetailItem } from '../../domain/models/MasterData';
import { PaginatedRestaurantsResponse } from '../../domain/repositories/ISuperAdminRepository';
import { useAuthStore } from '../../presentation/state/useAuthStore';

export class SuperAdminRemoteDataSource {
  // 1. POST /api/RestaurantConfig/RestaurantConfig
  async onboardRestaurant(request: OnboardRestaurantRequest): Promise<{ restaurantId: number; success: boolean }> {
    const resName = request.restaurantName.trim();
    const city = (request.city || 'Bengaluru').trim();
    const address = (request.address || 'Address').trim();

    // Ensure stateCode (e.g. 'KA', 'MH', 'DL') is sent to backend (max length 10)
    let stateCode = (request.state || 'KA').trim();
    if (stateCode.length > 10) {
      // Look up matching state code from state description if full name was passed
      const match = [
        { code: 'AP', name: 'Andhra Pradesh' },
        { code: 'AR', name: 'Arunachal Pradesh' },
        { code: 'AS', name: 'Assam' },
        { code: 'BR', name: 'Bihar' },
        { code: 'CG', name: 'Chhattisgarh' },
        { code: 'GA', name: 'Goa' },
        { code: 'GJ', name: 'Gujarat' },
        { code: 'HR', name: 'Haryana' },
        { code: 'HP', name: 'Himachal Pradesh' },
        { code: 'JH', name: 'Jharkhand' },
        { code: 'KA', name: 'Karnataka' },
        { code: 'KL', name: 'Kerala' },
        { code: 'MP', name: 'Madhya Pradesh' },
        { code: 'MH', name: 'Maharashtra' },
        { code: 'MN', name: 'Manipur' },
        { code: 'ML', name: 'Meghalaya' },
        { code: 'MZ', name: 'Mizoram' },
        { code: 'NL', name: 'Nagaland' },
        { code: 'OD', name: 'Odisha' },
        { code: 'PB', name: 'Punjab' },
        { code: 'RJ', name: 'Rajasthan' },
        { code: 'SK', name: 'Sikkim' },
        { code: 'TN', name: 'Tamil Nadu' },
        { code: 'TG', name: 'Telangana' },
        { code: 'TR', name: 'Tripura' },
        { code: 'UP', name: 'Uttar Pradesh' },
        { code: 'UK', name: 'Uttarakhand' },
        { code: 'WB', name: 'West Bengal' },
        { code: 'DL', name: 'Delhi' },
      ].find((s) => s.name.toLowerCase() === stateCode.toLowerCase() || s.code.toLowerCase() === stateCode.toLowerCase());
      stateCode = match ? match.code : stateCode.substring(0, 10);
    }

    const restResponse = await apiClient.post('/RestaurantConfig/RestaurantConfig', {
      restaurantName: resName,
      address,
      city,
      state: stateCode,
      imageUrl: request.imageUrl || '',
      logoUrl: request.logoUrl || '',
    });

    let restaurantId = restResponse.data?.id || restResponse.data?.Id || restResponse.data?.restaurantId || 0;

    // Fetch newly created restaurant ID from DB if not directly in response body
    if (!restaurantId || restaurantId <= 0) {
      try {
        const getRes = await apiClient.get(`/RestaurantConfig/RestaurantConfig?resName=${encodeURIComponent(resName)}&pageSize=10`);
        const data = getRes.data;
        const list = Array.isArray(data) ? data : (data?.items || data?.data || []);
        const matched = list.find((r: any) => (r.restaurantName || r.RestName || r.restName || r.name || '').toLowerCase() === resName.toLowerCase()) || list[0];
        if (matched) {
          restaurantId = matched.id || matched.Id || matched.restaurantId || matched.resId || 0;
        }
      } catch (err) {
        console.warn('Failed to query created restaurant ID from DB', err);
      }
    }

    // Lookup or Create Owner User via /api/UserMaster
    let userId = 0;
    const cleanOwnerMobile = (request.ownerMobile || '').replace(/\D/g, '').slice(-10);
    const cleanOwnerName = (request.ownerName || '').trim();

    if (cleanOwnerMobile) {
      try {
        const userCheck = await apiClient.get(`/UserMaster/by-mobile/${cleanOwnerMobile}`);
        const data = userCheck.data;
        if (data) {
          userId = Number(data.id ?? data.Id ?? data.userId ?? 0);
        }
      } catch {
        // User not found by mobile
      }

      if ((!userId || userId <= 0) && cleanOwnerName.length >= 2) {
        const createUser = await apiClient.post('/UserMaster', {
          name: cleanOwnerName,
          mobile: cleanOwnerMobile,
          Name: cleanOwnerName,
          Mobile: cleanOwnerMobile,
        });

        const resData = createUser.data;
        if (typeof resData === 'number') {
          userId = resData;
        } else if (resData && typeof resData === 'object') {
          userId = Number(resData.id ?? resData.Id ?? resData.userId ?? 0);
        }

        if (!userId || userId <= 0) {
          try {
            const createdCheck = await apiClient.get(`/UserMaster/by-mobile/${cleanOwnerMobile}`);
            userId = Number(createdCheck.data?.id ?? createdCheck.data?.Id ?? 0);
          } catch {
            // Fallback
          }
        }
      }
    }

    // Assign Owner Role (RoleId 2 = Owner) via POST /api/Role/Assign
    if (userId > 0 && restaurantId > 0) {
      await apiClient.post('/Role/Assign', {
        userId,
        roleId: 2,
        restId: restaurantId,
        restaurantId: restaurantId,
        isDefault: true,
      });
    }

    return { restaurantId, success: true };
  }

  async assignOwnerToRestaurant(userId: number, restaurantId: number): Promise<boolean> {
    const response = await apiClient.post('/Role/Assign', {
      userId,
      roleId: 2,
      restId: restaurantId,
      restaurantId: restaurantId,
      isDefault: true,
    });
    return response.status === 200 || response.status === 201;
  }

  // 3. PUT /api/RestaurantConfig/RestaurantConfig/ActiveDiactive?restId=X&isActive=Y
  async toggleRestaurantStatus(restaurantId: number, isActive: boolean): Promise<boolean> {
    const response = await apiClient.put(
      `/RestaurantConfig/RestaurantConfig/ActiveDiactive?restId=${restaurantId}&isActive=${isActive}`
    );
    return response.status === 200 || response.status === 204;
  }

  // 2. GET /api/RestaurantConfig/RestaurantConfig?resName=...&city=...&state=...&resId=...&pageNumber=1&pageSize=10
  async getAllRestaurants(
    resName?: string,
    city?: string,
    state?: string,
    resId?: number,
    pageNumber: number = 1,
    pageSize: number = 10
  ): Promise<PaginatedRestaurantsResponse> {
    const params: string[] = [];

    if (resName && resName.trim()) {
      params.push(`resName=${encodeURIComponent(resName.trim())}`);
    }
    if (city && city.trim()) {
      params.push(`city=${encodeURIComponent(city.trim())}`);
    }
    if (state && state.trim()) {
      params.push(`state=${encodeURIComponent(state.trim())}`);
    }
    if (resId && resId > 0) {
      params.push(`resId=${resId}`);
    }
    params.push(`pageNumber=${pageNumber}`);
    params.push(`pageSize=${pageSize}`);

    const queryString = params.join('&');
    const url = `/RestaurantConfig/RestaurantConfig?${queryString}`;

    const response = await apiClient.get(url);
    const data = response.data;
    
    const rawItems = Array.isArray(data) ? data : (data?.items || data?.data || []);
    const totalCount = data?.totalCount ?? rawItems.length;
    const currPageNumber = data?.pageNumber ?? pageNumber;
    const currPageSize = data?.pageSize ?? pageSize;

    const loggedUser = useAuthStore.getState().user;

    const mappedItems: RestaurantDetail[] = rawItems.map((r: any) => ({
      restaurantId: r.id ?? r.Id ?? r.restaurantId ?? r.resId ?? 101,
      restaurantName: r.restName ?? r.RestName ?? r.restaurantName ?? r.RestaurantName ?? r.name ?? 'Menza Store',
      logoUrl: r.logo ?? r.Logo ?? r.logoUrl ?? r.LogoUrl ?? '',
      imageUrl: r.imageUrl ?? r.ImageUrl ?? '',
      city: r.city ?? r.City ?? '',
      state: r.state ?? r.State ?? '',
      address: r.address ?? r.Address ?? '',
      role: r.role ?? r.Role ?? 'Owner',
      isDefault: r.isActive ?? r.IsActive ?? true,
      isActive: r.isActive ?? r.IsActive ?? true,
      ownerName: r.ownerName ?? r.OwnerName ?? r.userName ?? r.UserName ?? loggedUser?.name ?? 'Assigned Owner',
      ownerMobile: r.ownerMobile ?? r.OwnerMobile ?? r.mobile ?? r.Mobile ?? loggedUser?.mobile ?? '',
    }));

    return {
      items: mappedItems,
      totalCount,
      pageNumber: currPageNumber,
      pageSize: currPageSize,
    };
  }

  // 4. GET Channel / Ordering Settings derived from Restaurant Subscription Configuration
  async getOrderingSettings(restaurantId: number): Promise<RestaurantOrderingConfig> {
    try {
      let activeItem: any = null;
      try {
        const activeRes = await apiClient.get(`/Subscription/ActivePlan/Restaurant/${restaurantId}`);
        if (activeRes.status === 200 && activeRes.data) {
          activeItem = activeRes.data;
        }
      } catch {
        // ActivePlan returns 404 if no active sub exists
      }

      if (!activeItem) {
        try {
          const response = await apiClient.get(`/Subscription/RestaurantSubscription/Restaurant/${restaurantId}`);
          const data = response.data;
          const list = Array.isArray(data) ? data : (data?.items || (data && typeof data === 'object' ? [data] : []));
          if (Array.isArray(list) && list.length > 0) {
            activeItem = list.find((x: any) => (x.status || x.Status || '').toUpperCase() === 'ACTIVE') || list[0];
          }
        } catch {
          // Empty fallback if no subscriptions exist
        }
      }

      const entitlements = activeItem?.entitlements || activeItem?.Entitlements || [];

      const getVal = (key: string, defVal: boolean = true): boolean => {
        if (!Array.isArray(entitlements) || entitlements.length === 0) return defVal;
        const e = entitlements.find((item: any) => (item.configKey || item.ConfigKey || '').toLowerCase() === key.toLowerCase());
        return e ? Boolean(e.isAllowed ?? e.IsAllowed) : defVal;
      };

      return {
        isTableOrderingEnabled: getVal('IsTableOrderingEnabled', true),
        isSelfPickupEnabled: getVal('IsSelfPickupEnabled', true),
        isDeliveryEnabled: getVal('IsDeliveryEnabled', true),
        isCounterOrderingEnabled: getVal('IsCounterOrderingEnabled', true),
        isPaymentRequiredForTableOrder: getVal('IsPaymentRequiredForTableOrder', false),
        isPaymentRequiredForPickupOrder: getVal('IsPaymentRequiredForPickupOrder', false),
        isPaymentRequiredForDeliveryOrder: getVal('IsPaymentRequiredForDeliveryOrder', true),
        allowCashOnDelivery: getVal('AllowCashOnDelivery', true),
        allowPayAtTable: getVal('AllowPayAtTable', true),
        allowOnlinePayment: getVal('AllowOnlinePayment', true),
        autoAcceptOrders: getVal('AutoAcceptOrders', false),
        isKdsEnabled: getVal('IsKdsEnabled', true),
        isSmsNotificationsEnabled: getVal('IsSmsNotificationsEnabled', true),
      };
    } catch {
      return {
        isTableOrderingEnabled: true,
        isSelfPickupEnabled: true,
        isDeliveryEnabled: true,
        isCounterOrderingEnabled: true,
        isPaymentRequiredForTableOrder: false,
        isPaymentRequiredForPickupOrder: false,
        isPaymentRequiredForDeliveryOrder: true,
        allowCashOnDelivery: true,
        allowPayAtTable: true,
        allowOnlinePayment: true,
        autoAcceptOrders: false,
        isKdsEnabled: true,
        isSmsNotificationsEnabled: true,
      };
    }
  }

  // 5. Subscription driven channel configuration update
  async updateOrderingSettings(_restaurantId: number, _config: RestaurantOrderingConfig): Promise<boolean> {
    return true;
  }

  // 6. GET /api/OrderConfigMaster/RestaurantDetails/{restaurantId}
  async getOrderConfigMasterDetails(restaurantId: number): Promise<OrderConfigDetailItem[]> {
    try {
      const response = await apiClient.get(`/OrderConfigMaster/RestaurantDetails/${restaurantId}`);
      const data = response.data;
      const list = Array.isArray(data) ? data : (data?.items || []);
      return list.map((item: any) => ({
        id: item.id || item.Id,
        masterId: item.masterId || item.MasterId || 1,
        restaurantId: item.restaurantId || item.RestaurantId || restaurantId,
        configKey: item.configKey || item.ConfigKey || '',
        configValue: String(item.configValue ?? item.ConfigValue ?? 'true'),
        dataType: item.dataType || item.DataType || 'BIT',
        category: item.category || item.Category || 'General',
        description: item.description || item.Description || '',
        displayOrder: item.displayOrder || item.DisplayOrder || 0,
        isActive: item.isActive ?? item.IsActive ?? true,
        isLockedBySubscription: Boolean(item.isLockedBySubscription ?? item.IsLockedBySubscription ?? false),
      }));
    } catch {
      return [];
    }
  }

  // 7. PUT /api/OrderConfigMaster/RestaurantDetails/{restaurantId}
  async updateOrderConfigMasterDetails(restaurantId: number, detailsList: OrderConfigDetailItem[]): Promise<boolean> {
    try {
      const response = await apiClient.put(`/OrderConfigMaster/RestaurantDetails/${restaurantId}`, detailsList);
      return response.status === 200 || response.status === 204;
    } catch {
      return false;
    }
  }
}
