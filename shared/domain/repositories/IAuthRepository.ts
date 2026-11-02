import { AuthResponse } from '../models/AuthResponse';
import { RestaurantDetail } from '../models/Restaurant';

export interface IAuthRepository {
  generateOtp(mobile: string, deviceId?: string): Promise<{ message: string; otpCode?: string }>;
  resendOtp(mobile: string, deviceId?: string): Promise<{ message: string; otpCode?: string }>;
  loginWithOtp(mobile: string, otpCode: string, deviceId?: string): Promise<AuthResponse>;
  refreshToken(token: string, refreshToken: string): Promise<AuthResponse>;
  switchRestaurant(restaurantId: number): Promise<AuthResponse>;
  getMyRestaurants(): Promise<RestaurantDetail[]>;
  logout(token?: string, refreshToken?: string): Promise<boolean>;
  loginWithStaffPin(
    paramsOrRestId: { pin: string; mobile?: string; restaurantId?: number; deviceId?: string } | number,
    pin?: string,
    deviceId?: string
  ): Promise<AuthResponse>;
  setStaffPin(targetUserId: number, pin: string): Promise<boolean>;
  resetPinWithOtp(mobile: string, otpCode: string, newPin: string, deviceId?: string): Promise<AuthResponse>;
}
