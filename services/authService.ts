import { apiClient } from '@/lib/api/client';
import { AuthResponse, TermsConditionStatus, RestaurantDetail } from '@/types/auth';

export class AuthService {
  static async generateOtp(mobile: string, deviceId: string = 'web-client'): Promise<boolean> {
    const res = await apiClient.post('/Auth/GenerateOtp', {
      mobile: mobile.trim(),
      deviceId,
    });
    return res.status === 200;
  }

  static async loginWithOtp(mobile: string, otpCode: string, deviceId: string = 'web-client'): Promise<AuthResponse> {
    const res = await apiClient.post<AuthResponse>('/Auth/Login', {
      mobile: mobile.trim(),
      otpCode: otpCode.trim(),
      deviceId,
    });
    return res.data;
  }

  static async getMyRestaurants(): Promise<RestaurantDetail[]> {
    try {
      const res = await apiClient.get<RestaurantDetail[]>('/Auth/MyRestaurants');
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  }

  static async refreshToken(token: string, refreshToken: string): Promise<AuthResponse> {
    const res = await apiClient.post<AuthResponse>('/Auth/Refresh', {
      token,
      refreshToken,
    });
    return res.data;
  }

  static async switchRestaurant(restaurantId: number): Promise<AuthResponse> {
    const res = await apiClient.post<AuthResponse>('/Auth/SwitchRestaurant', {
      restaurantId,
    });
    return res.data;
  }

  static async getTermsConditionStatus(userId: number, token?: string): Promise<boolean> {
    try {
      const res = await apiClient.get<TermsConditionStatus>('/Owner/term-condition', {
        params: { userId },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      return Boolean(res.data?.isTermConditionChecked);
    } catch {
      return false;
    }
  }

  static async acceptTermsCondition(userId: number, token?: string): Promise<boolean> {
    const res = await apiClient.post(
      '/Owner/term-condition',
      { userId, isChecked: true },
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
    return res.data?.success ?? true;
  }

  static async logout(token?: string, refreshToken?: string): Promise<void> {
    try {
      await apiClient.post('/Auth/Logout', { token, refreshToken });
    } catch {
      // Best-effort
    }
  }
}
