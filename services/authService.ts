import { apiClient } from '@/lib/api/client';
import { AuthResponse, TermsConditionStatus } from '@/types/auth';

export class AuthService {
  static async generateOtp(mobile: string, deviceId: string = 'web-client'): Promise<{ success: boolean; message: string; otpCode?: string }> {
    const cleanMobile = mobile.replace(/[^0-9]/g, '').slice(-10);
    const res = await apiClient.post('/Auth/GenerateOtp', {
      mobile: cleanMobile,
      mobileNumber: cleanMobile,
      deviceId,
    });
    const resData = res.data?.data ?? res.data;
    const otpCode = resData?.otpCode || resData?.OtpCode || resData?.otp || resData?.Otp || resData?.code || resData?.Code;
    return {
      success: res.status === 200,
      message: resData?.message || resData?.Message || 'OTP sent successfully',
      otpCode: otpCode ? String(otpCode) : undefined,
    };
  }

  static async loginWithOtp(mobile: string, otpCode: string, deviceId: string = 'web-client'): Promise<AuthResponse> {
    const cleanMobile = mobile.replace(/[^0-9]/g, '').slice(-10);
    const res = await apiClient.post<AuthResponse>('/Auth/Login', {
      mobile: cleanMobile,
      mobileNumber: cleanMobile,
      otpCode: otpCode.trim(),
      otp: otpCode.trim(),
      deviceId,
    });
    const raw = (res.data as any)?.data ?? res.data;
    return raw;
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
