export interface User {
  id: number;
  name: string;
  mobile: string;
  deviceId?: string;
  roles: string[];
  activeRestaurantId?: number;
}
