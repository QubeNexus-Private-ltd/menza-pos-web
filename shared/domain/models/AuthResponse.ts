import { RestaurantDetail } from './Restaurant';

export interface AuthResponse {
  token: string;
  refreshToken: string;
  userId: number;
  name: string;
  mobile: string;
  roles: string[];
  activeRestaurantId?: number;
  restaurantName?: string;
  logoUrl?: string;
  imageUrl?: string;
  bannerUrl?: string;
  restaurants: RestaurantDetail[];
}
