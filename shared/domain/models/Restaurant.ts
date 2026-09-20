export interface RestaurantDetail {
  restaurantId: number;
  restaurantName: string;
  logoUrl?: string;
  imageUrl?: string;
  bannerUrl?: string;
  city?: string;
  state?: string;
  address?: string;
  role: string;
  isDefault: boolean;
  isActive?: boolean;
  ownerName?: string;
  ownerMobile?: string;
}
