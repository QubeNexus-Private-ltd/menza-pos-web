export interface Category {
  id: number;
  categoryName: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
  kitchenStationId?: number;
  kitchenStationName?: string;
}
