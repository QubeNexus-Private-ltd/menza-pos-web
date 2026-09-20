import { apiClient } from '../../core/network/apiClient';
import { AuthResponse } from '../../domain/models/AuthResponse';
import { RestaurantDetail } from '../../domain/models/Restaurant';
import { useAuthStore } from '../../presentation/state/useAuthStore';

function decodeJwtClaims(token: string): Record<string, any> {
  try {
    if (!token || typeof token !== 'string') return {};
    const parts = token.split('.');
    if (parts.length < 2) return {};
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    if (typeof atob !== 'undefined') {
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    }
    return {};
  } catch {
    return {};
  }
}

export class AuthRemoteDataSource {
  async generateOtp(mobile: string, deviceId?: string): Promise<{ message: string; otpCode?: string }> {
    const cleanMobile = String(mobile || '').replace(/[^0-9]/g, '').slice(-10);
    const response = await apiClient.post('/Auth/GenerateOtp', {
      mobileNumber: cleanMobile,
      mobile: cleanMobile,
      deviceId,
    });
    return response.data;
  }

  async resendOtp(mobile: string, deviceId?: string): Promise<{ message: string; otpCode?: string }> {
    const cleanMobile = String(mobile || '').replace(/[^0-9]/g, '').slice(-10);
    const response = await apiClient.post('/Auth/GenerateOtp', {
      mobileNumber: cleanMobile,
      mobile: cleanMobile,
      deviceId,
    });
    return response.data;
  }

  private mapAuthResponse(data: any): AuthResponse {
    if (!data) return data;
    const token = data.token || data.Token || data.accessToken || data.AccessToken || '';
    const tokenClaims = decodeJwtClaims(token);

    const rawRoles = data.roles || data.Roles || (data.role ? [data.role] : data.Role ? [data.Role] : (data.roleName ? [data.roleName] : []));
    const rolesList = Array.isArray(rawRoles) ? rawRoles : typeof rawRoles === 'string' ? [rawRoles] : [];

    const topLogo = data.logoUrl || data.LogoUrl || data.logo || data.Logo || tokenClaims.logoUrl || tokenClaims.storeLogoUrl || tokenClaims.logo || '';
    const topImage = data.imageUrl || data.ImageUrl || data.bannerUrl || data.BannerUrl || data.image || data.Image || data.banner || data.Banner || tokenClaims.imageUrl || tokenClaims.bannerUrl || tokenClaims.bannerImageUrl || tokenClaims.storeImageUrl || '';

    const rawRestaurants = data.restaurants || data.Restaurants || [];
    const mappedRestaurants: RestaurantDetail[] = Array.isArray(rawRestaurants)
      ? rawRestaurants.map((r: any) => ({
          restaurantId: r.restaurantId || r.RestaurantId || r.id || r.Id || 0,
          restaurantName: r.restaurantName || r.RestaurantName || r.name || r.Name || 'Restaurant',
          logoUrl: r.logoUrl || r.LogoUrl || r.logo || r.Logo || topLogo || '',
          imageUrl: r.imageUrl || r.ImageUrl || r.bannerUrl || r.BannerUrl || r.image || r.Image || r.banner || r.Banner || topImage || '',
          bannerUrl: r.bannerUrl || r.BannerUrl || r.imageUrl || r.ImageUrl || r.banner || r.Banner || r.image || r.Image || topImage || '',
          city: r.city || r.City || '',
          state: r.state || r.State || '',
          address: r.address || r.Address || '',
          role: r.role || r.Role || (rolesList.length > 0 ? rolesList[0] : 'Owner'),
          isDefault: Boolean(r.isDefault || r.IsDefault),
        }))
      : [];

    return {
      token,
      refreshToken: data.refreshToken || data.RefreshToken || data.refresh_token || '',
      userId: data.userId || data.UserId || (tokenClaims.userId ? Number(tokenClaims.userId) : 0),
      name: data.name || data.Name || tokenClaims.unique_name || '',
      mobile: data.mobileNumber || data.MobileNumber || data.mobile || data.Mobile || '',
      roles: rolesList,
      activeRestaurantId: data.activeRestaurantId || data.ActiveRestaurantId || (tokenClaims.activeRestId ? Number(tokenClaims.activeRestId) : undefined),
      restaurantName: data.restaurantName || data.RestaurantName || tokenClaims.restaurantName,
      logoUrl: topLogo,
      imageUrl: topImage,
      bannerUrl: topImage,
      restaurants: mappedRestaurants,
    };
  }

  async loginWithOtp(mobile: string, otpCode: string, deviceId?: string): Promise<AuthResponse> {
    const cleanMobile = String(mobile || '').replace(/[^0-9]/g, '').slice(-10);
    const response = await apiClient.post('/Auth/Login', {
      mobileNumber: cleanMobile,
      mobile: cleanMobile,
      otpCode: String(otpCode || '').trim(),
      otp: String(otpCode || '').trim(),
      deviceId,
    });
    return this.mapAuthResponse(response.data);
  }

  // POST /api/Auth/Refresh matching AuthController.cs Refresh method
  async refreshToken(token: string, refreshToken: string): Promise<AuthResponse> {
    const response = await apiClient.post('/Auth/Refresh', {
      token,
      Token: token,
      refreshToken,
      RefreshToken: refreshToken,
    });
    return this.mapAuthResponse(response.data);
  }

  async switchRestaurant(restaurantId: number): Promise<AuthResponse> {
    const response = await apiClient.post('/Auth/SwitchRestaurant', { restaurantId });
    return this.mapAuthResponse(response.data);
  }

  async getMyRestaurants(): Promise<RestaurantDetail[]> {
    const storeState = useAuthStore.getState();
    const token = (globalThis as any).__MENZA_AUTH_TOKEN__ || storeState.token;
    if (token && (token.startsWith('mock-') || token.includes('mock'))) {
      return storeState.restaurants.length > 0 ? storeState.restaurants : [];
    }

    try {
      const response = await apiClient.get('/Auth/MyRestaurants');
      const data = response.data;
      const rawList = Array.isArray(data)
        ? data
        : Array.isArray(data?.restaurants)
        ? data.restaurants
        : Array.isArray(data?.Restaurants)
        ? data.Restaurants
        : [];

      const userRoles = storeState.user?.roles || [];
      const defaultRole = userRoles.length > 0 ? userRoles[0] : 'Owner';

      return rawList.map((r: any) => ({
        restaurantId: r.restaurantId || r.RestaurantId || r.id || r.Id || 0,
        restaurantName: r.restaurantName || r.RestaurantName || r.name || r.Name || 'Restaurant',
        logoUrl: r.logoUrl || r.LogoUrl || r.logo || r.Logo || '',
        imageUrl: r.imageUrl || r.ImageUrl || r.bannerUrl || r.BannerUrl || r.image || r.Image || r.banner || r.Banner || '',
        bannerUrl: r.bannerUrl || r.BannerUrl || r.imageUrl || r.ImageUrl || r.banner || r.Banner || r.image || r.Image || '',
        city: r.city || r.City || '',
        state: r.state || r.State || '',
        address: r.address || r.Address || '',
        role: r.role || r.Role || defaultRole,
        isDefault: Boolean(r.isDefault || r.IsDefault),
      }));
    } catch (err) {
      if (storeState.restaurants.length > 0) {
        return storeState.restaurants;
      }
      throw err;
    }
  }

  async logout(token?: string, refreshToken?: string): Promise<boolean> {
    try {
      const activeToken = token || (globalThis as any).__MENZA_AUTH_TOKEN__ || useAuthStore.getState().token;
      const activeRefreshToken = refreshToken || (globalThis as any).__MENZA_REFRESH_TOKEN__ || useAuthStore.getState().refreshToken;

      const response = await apiClient.post('/Auth/Logout', {
        token: activeToken || '',
        Token: activeToken || '',
        refreshToken: activeRefreshToken || null,
        RefreshToken: activeRefreshToken || null,
      });

      return response.status === 200;
    } catch (err) {
      console.warn('Backend Logout API call failed, continuing with client logout', err);
      return true;
    }
  }
}
