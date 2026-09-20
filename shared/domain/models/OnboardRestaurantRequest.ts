export interface OnboardRestaurantRequest {
  restaurantName: string;
  address?: string;
  city?: string;
  state?: string;
  contactNumber: string;
  email?: string;
  gstNumber?: string;
  imageUrl?: string;
  logoUrl?: string;
  ownerName: string;
  ownerMobile: string;
}
