export interface PublicOrderItemTrackingDTO {
  itemId: number;
  itemName: string;
  quantity: number;
  price: number;
  unitPrice: number;
  amount: number;
  totalAmount: number;
  unitName?: string | null;
  cookingInstruction?: string | null;
  preparationTimeMinutes?: number | null;
}

export interface PublicOrderTrackingDTO {
  orderId: number;
  restaurantId: number;
  restaurantName: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  contactPhone?: string | null;
  logoUrl?: string | null;
  imageUrl?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  maskedMobileNumber?: string | null;
  orderStatus: string;
  kitchenStatus?: string | null;
  tableName?: string | null;
  tableId?: number | null;
  pickupToken?: string | null;
  tokenNumber: number;
  orderAmount: number;
  subTotal: number;
  itemTotal: number;
  cgst: number;
  sgst: number;
  cgstAmount: number;
  sgstAmount: number;
  taxAmount: number;
  discountAmount?: number | null;
  totalAmount: number;
  paymentMode: string;
  paymentType?: string | null;
  deliveryType?: string | null;
  orderTypeId: number;
  paymentStatus: string;
  isOnline: boolean;
  isSettled: boolean;
  requiresCashierConfirmation: boolean;
  isKitchenActive: boolean;
  isLiveKitchenStatusEnabled: boolean;
  settledDateUtc?: string | null;
  createdDateUtc: string;
  estimatedPickupTime?: string | null;
  items: PublicOrderItemTrackingDTO[];
}
