export interface Category {
  id: number;
  categoryName: string;
  description?: string;
  isActive?: boolean;
  kitchenStationId?: number;
  kitchenStationName?: string;
}
