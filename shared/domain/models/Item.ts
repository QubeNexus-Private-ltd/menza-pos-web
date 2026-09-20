export interface MenuItem {
  id: number;
  itemName: string;
  description?: string;
  categoryId?: number;
  categoryName?: string;
  unitId?: number;
  unitName?: string;
  price: number;
  quantity?: number; // e.g. 1 Plate, 2 Pieces, 300 Ml
  portionDisplay?: string;
  imageUrl?: string;
  isVeg?: boolean;
  isAvailable?: boolean;
  kitchenStationId?: number;
  kitchenStationName?: string;
}
