export interface CartModifier {
  modifierId: number;
  modifierName: string;
  extraPrice: number;
}

export interface CartItem {
  itemId: number;
  itemName: string;
  itemDescription?: string;
  price?: number;
  amount?: number;
  quantity: number;
  variantId?: number;
  variantName?: string;
  variantPrice?: number;
  modifiers?: CartModifier[];
  unitPrice?: number;
  totalAmount?: number;
  imageUrl?: string;
  cookingInstruction?: string;
  isAvailable?: boolean;
  restaurantId?: number;
  unit?: number;
}

export interface CartSummary {
  userId?: number;
  deviceId?: string;
  restaurantId?: number;
  restaurantName?: string;
  items: CartItem[];
  itemTotal?: number;
  subTotal: number;
  discountAmount?: number;
  taxableAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  taxAmount?: number;
  platformFee?: number;
  grandTotal?: number;
  totalAmount?: number;
  hasUnavailableItems?: boolean;
}
