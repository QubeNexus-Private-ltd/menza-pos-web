export interface UserRestaurantDetail {
  restaurantId: number;
  restaurantName: string;
  address: string;
  city: string;
  state: string;
  logoUrl?: string;
  imageUrl?: string;
  bannerUrl?: string;
  roleId?: number;
  roleName?: string;
  role?: string;
  isDefault?: boolean;
  isActive?: boolean;
  ownerName?: string;
  ownerMobile?: string;
}

export type RestaurantDetail = UserRestaurantDetail;

export interface User {
  userId: number;
  id?: number;
  name: string;
  mobile: string;
  roles: string[];
  activeRestaurantId?: number | null;
  restaurantName?: string;
}

export interface AuthResponse {
  token: string;
  refreshToken?: string;
  userId: number;
  name: string;
  mobile: string;
  roles: string[];
  activeRestaurantId?: number | null;
  encryptedRestaurantId?: string;
  restaurantName?: string;
  address?: string;
  city?: string;
  state?: string;
  logoUrl?: string;
  imageUrl?: string;
  bannerUrl?: string;
  restaurants: UserRestaurantDetail[];
  isTermConditionChecked?: boolean;
}

export interface GenerateOtpRequest {
  mobile: string;
  deviceId?: string;
}

export interface LoginWithOtpRequest {
  mobile: string;
  otpCode: string;
  deviceId?: string;
}

export interface RefreshTokenRequest {
  token: string;
  refreshToken: string;
}

export interface TermsConditionStatus {
  userId: number;
  isOwner: boolean;
  isTermConditionChecked: boolean;
  acceptedAtUtc?: string | null;
  message?: string;
}
