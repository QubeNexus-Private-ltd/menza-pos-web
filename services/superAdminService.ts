import { apiClient } from '@/lib/api/client';
import { RestaurantDetail } from '@/types/auth';

export interface PaginatedRestaurantsResponse {
  items: RestaurantDetail[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

export interface OnboardRestaurantPayload {
  restaurantName: string;
  ownerName?: string;
  ownerMobile?: string;
  contactNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  imageUrl?: string;
  logoUrl?: string;
}

export class SuperAdminService {
  static async getAllRestaurants(
    resName?: string,
    city?: string,
    state?: string,
    resId?: number,
    pageNumber: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedRestaurantsResponse> {
    const params: Record<string, any> = {
      pageNumber,
      pageSize,
    };
    if (resName && resName.trim()) params.resName = resName.trim();
    if (city && city.trim()) params.city = city.trim();
    if (state && state.trim()) params.state = state.trim();
    if (resId && resId > 0) params.resId = resId;

    try {
      const response = await apiClient.get('/RestaurantConfig/RestaurantConfig', { params });
      const data = response.data;
      const rawItems = Array.isArray(data) ? data : (data?.items || data?.data || []);
      const totalCount = data?.totalCount ?? rawItems.length;

      const items: RestaurantDetail[] = rawItems.map((r: any) => ({
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
        ownerName: r.ownerName ?? r.OwnerName ?? r.userName ?? r.UserName ?? 'Assigned Owner',
        ownerMobile: r.ownerMobile ?? r.OwnerMobile ?? r.mobile ?? r.Mobile ?? '',
      }));

      return {
        items,
        totalCount,
        pageNumber: data?.pageNumber ?? pageNumber,
        pageSize: data?.pageSize ?? pageSize,
      };
    } catch (err) {
      console.warn('[SuperAdminService] Failed to load restaurants:', err);
      return { items: [], totalCount: 0, pageNumber, pageSize };
    }
  }

  static async getRestaurants(
    search?: string,
    pageNumber: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedRestaurantsResponse> {
    return this.getAllRestaurants(search, undefined, undefined, undefined, pageNumber, pageSize);
  }

  static async onboardRestaurant(
    request: OnboardRestaurantPayload
  ): Promise<{ restaurantId: number; success: boolean }> {
    const resName = request.restaurantName.trim();
    const city = (request.city || 'Bengaluru').trim();
    const address = (request.address || 'Address').trim();
    const stateCode = (request.state || 'KA').trim().substring(0, 10);

    const restResponse = await apiClient.post('/RestaurantConfig/RestaurantConfig', {
      restaurantName: resName,
      address,
      city,
      state: stateCode,
      imageUrl: request.imageUrl || '',
      logoUrl: request.logoUrl || '',
    });

    let restaurantId = restResponse.data?.id || restResponse.data?.Id || restResponse.data?.restaurantId || 0;

    if (!restaurantId || restaurantId <= 0) {
      try {
        const getRes = await apiClient.get('/RestaurantConfig/RestaurantConfig', {
          params: { resName, pageSize: 10 },
        });
        const data = getRes.data;
        const list = Array.isArray(data) ? data : (data?.items || data?.data || []);
        const matched = list.find((r: any) =>
          (r.restaurantName || r.RestName || r.restName || r.name || '').toLowerCase() === resName.toLowerCase()
        ) || list[0];
        if (matched) {
          restaurantId = matched.id || matched.Id || matched.restaurantId || matched.resId || 0;
        }
      } catch (err) {
        console.warn('[SuperAdminService] Failed to query created restaurant ID', err);
      }
    }

    const cleanOwnerMobile = (request.ownerMobile || '').replace(/\D/g, '').slice(-10);
    const cleanOwnerName = (request.ownerName || '').trim();

    if (cleanOwnerMobile) {
      let userId = 0;
      try {
        const userCheck = await apiClient.get(`/UserMaster/by-mobile/${cleanOwnerMobile}`);
        if (userCheck.data) {
          userId = Number(userCheck.data.id ?? userCheck.data.Id ?? userCheck.data.userId ?? 0);
        }
      } catch {
        // Not found
      }

      if ((!userId || userId <= 0) && cleanOwnerName.length >= 2) {
        try {
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
        } catch {
          // ignore
        }
      }

      if (userId > 0 && restaurantId > 0) {
        try {
          await apiClient.post('/Role/Assign', {
            userId,
            roleId: 2,
            restId: restaurantId,
            restaurantId,
            isDefault: true,
          });
        } catch {
          // ignore
        }
      }
    }

    return { restaurantId, success: true };
  }

  static async toggleRestaurantStatus(restaurantId: number, isActive: boolean): Promise<boolean> {
    const res = await apiClient.put(
      `/RestaurantConfig/RestaurantConfig/ActiveDiactive?restId=${restaurantId}&isActive=${isActive}`
    );
    return res.status === 200 || res.status === 204;
  }

  static async toggleRestaurantActive(restaurantId: number, isActive: boolean): Promise<boolean> {
    return this.toggleRestaurantStatus(restaurantId, isActive);
  }
}
