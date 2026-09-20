import { IAuthRepository } from '../../domain/repositories/IAuthRepository';
import { AuthRemoteDataSource } from '../datasources/AuthRemoteDataSource';
import { AuthResponse } from '../../domain/models/AuthResponse';
import { RestaurantDetail } from '../../domain/models/Restaurant';

export class AuthRepositoryImpl implements IAuthRepository {
  constructor(private remoteDataSource: AuthRemoteDataSource) {}

  async generateOtp(mobile: string, deviceId?: string): Promise<{ message: string; otpCode?: string }> {
    return await this.remoteDataSource.generateOtp(mobile, deviceId);
  }

  async resendOtp(mobile: string, deviceId?: string): Promise<{ message: string; otpCode?: string }> {
    return await this.remoteDataSource.resendOtp(mobile, deviceId);
  }

  async loginWithOtp(mobile: string, otpCode: string, deviceId?: string): Promise<AuthResponse> {
    return await this.remoteDataSource.loginWithOtp(mobile, otpCode, deviceId);
  }

  async refreshToken(token: string, refreshToken: string): Promise<AuthResponse> {
    return await this.remoteDataSource.refreshToken(token, refreshToken);
  }

  async switchRestaurant(restaurantId: number): Promise<AuthResponse> {
    return await this.remoteDataSource.switchRestaurant(restaurantId);
  }

  async getMyRestaurants(): Promise<RestaurantDetail[]> {
    return await this.remoteDataSource.getMyRestaurants();
  }

  async logout(token?: string, refreshToken?: string): Promise<boolean> {
    return await this.remoteDataSource.logout(token, refreshToken);
  }
}
