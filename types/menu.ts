export interface ItemVariant {
  variantId?: number;
  id?: number;
  variantName: string;
  name?: string;
  price: number;
  isDefault?: boolean;
}

export interface ItemModifier {
  modifierId?: number;
  id?: number;
  modifierName: string;
  name?: string;
  price: number;
}

export interface ItemModifierGroup {
  groupId?: number;
  id?: number;
  groupName: string;
  name?: string;
  minSelections?: number;
  maxSelections?: number;
  modifiers: ItemModifier[];
}

export interface MenuItem {
  itemId: number;
  id?: number;
  restaurantId?: number;
  categoryId: number;
  itemName: string;
  name?: string;
  itemDescription?: string;
  description?: string;
  price: number;
  unitId?: number;
  unitName?: string;
  isVegetarian?: boolean;
  isVeg?: boolean;
  imageUrl?: string;
  itemImageUrl?: string;
  image?: string;
  isAvailable?: boolean;
  isActive?: boolean;
  inStock?: boolean;
  taxRate?: number;
  stationId?: number;
  stationName?: string;
  portionDisplay?: string;
  variants?: ItemVariant[];
  modifierGroups?: ItemModifierGroup[];
}

export interface Category {
  categoryId: number;
  id?: number;
  restaurantId?: number;
  categoryName: string;
  name?: string;
  categoryDescription?: string;
  description?: string;
  displayOrder?: number;
  order?: number;
  isActive?: boolean;
  items?: MenuItem[];
  itemsCount?: number;
}

export interface StoreMenuCatalogTree {
  restaurantId: number;
  restaurantName: string;
  categories: Category[];
}
