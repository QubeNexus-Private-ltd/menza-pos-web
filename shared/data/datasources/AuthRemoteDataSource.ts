import { apiClient } from '../../core/network/apiClient';
import { AuthResponse } from '../../domain/models/AuthResponse';
import { RestaurantDetail } from '../../domain/models/Restaurant';
import { useAuthStore } from '../../presentation/state/useAuthStore';
import { decodeJwtClaims } from '../../core/auth/jwtUtils';

export class AuthRemoteDataSource {
  async generateOtp(mobile: string, deviceId?: string): Promise<{ message: string; otpCode?: string }> {
    const cleanMobile = String(mobile || '').replace(/[^0-9]/g, '').slice(-10);
    const response = await apiClient.post('/Auth/GenerateOtp', {
      mobileNumber: cleanMobile,
      mobile: cleanMobile,
      deviceId,
    });
    const resData = response.data?.data ?? response.data;
    const otpCode = resData?.otpCode || resData?.OtpCode || resData?.otp || resData?.Otp || resData?.code || resData?.Code;
    return {
      message: resData?.message || resData?.Message || 'OTP sent successfully',
      otpCode: otpCode ? String(otpCode) : undefined,
    };
  }

  async resendOtp(mobile: string, deviceId?: string): Promise<{ message: string; otpCode?: string }> {
    const cleanMobile = String(mobile || '').replace(/[^0-9]/g, '').slice(-10);
    const response = await apiClient.post('/Auth/GenerateOtp', {
      mobileNumber: cleanMobile,
      mobile: cleanMobile,
      deviceId,
    });
    const resData = response.data?.data ?? response.data;
    const otpCode = resData?.otpCode || resData?.OtpCode || resData?.otp || resData?.Otp || resData?.code || resData?.Code;
    return {
      message: resData?.message || resData?.Message || 'OTP sent successfully',
      otpCode: otpCode ? String(otpCode) : undefined,
    };
  }

  private mapAuthResponse(data: any): AuthResponse {
    if (!data) return data;
    const raw = data?.data ?? data;
    const token = raw.token || raw.Token || raw.accessToken || raw.AccessToken || '';
    const tokenClaims = decodeJwtClaims(token);

    const rawRoles = raw.roles || raw.Roles || (raw.role ? [raw.role] : raw.Role ? [raw.Role] : (raw.roleName ? [raw.roleName] : []));
    const rolesList = Array.isArray(rawRoles) ? rawRoles : typeof rawRoles === 'string' ? [rawRoles] : [];

    const topLogo = raw.logoUrl || raw.LogoUrl || raw.logo || raw.Logo || tokenClaims.logoUrl || tokenClaims.storeLogoUrl || tokenClaims.logo || '';
    const topImage = raw.imageUrl || raw.ImageUrl || raw.bannerUrl || raw.BannerUrl || raw.image || raw.Image || raw.banner || raw.Banner || tokenClaims.imageUrl || tokenClaims.bannerUrl || tokenClaims.bannerImageUrl || tokenClaims.storeImageUrl || '';

    const rawRestaurants = raw.restaurants || raw.Restaurants || [];
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
      refreshToken: raw.refreshToken || raw.RefreshToken || raw.refresh_token || '',
      userId: raw.userId || raw.UserId || (tokenClaims.userId ? Number(tokenClaims.userId) : 0),
      name: raw.name || raw.Name || tokenClaims.unique_name || '',
      mobile: raw.mobileNumber || raw.MobileNumber || raw.mobile || raw.Mobile || '',
      roles: rolesList,
      activeRestaurantId: raw.activeRestaurantId || raw.ActiveRestaurantId || (tokenClaims.activeRestId ? Number(tokenClaims.activeRestId) : undefined),
      restaurantName: raw.restaurantName || raw.RestaurantName || tokenClaims.restaurantName,
      logoUrl: topLogo,
      imageUrl: topImage,
      bannerUrl: topImage,
      restaurants: mappedRestaurants,
      isTermConditionChecked: Boolean(raw.isTermConditionChecked ?? raw.IsTermConditionChecked ?? false),
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
    } catch (err: any) {
      if (err?.response?.status === 401) {
        throw err;
      }
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
