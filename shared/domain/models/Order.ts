export type OrderStatus =
  | 'PendingPayment'
  | 'Placed'
  | 'Confirmed'
  | 'Preparing'
  | 'Ready'
  | 'Served'
  | 'Delivered'
  | 'Completed'
  | 'Cancelled'
  | 'Settled'
  | string;

export type PaymentStatus = 'Pending' | 'Paid' | 'SUCCESS' | 'FAILED' | string;
export type PaymentMode = 'CASH' | 'ONLINE' | 'CARD' | 'UPI' | string;
export type OrderTypeName = 'Dine-In' | 'SELF_PICKUP' | 'Delivery' | string;

export const OrderStatusHelper = {
  isActive: (status?: string): boolean => {
    if (!status) return false;
    const s = status.toLowerCase();
    return ['pendingpayment', 'placed', 'confirmed', 'preparing', 'cooking', 'ready', 'served', 'delivered'].includes(s);
  },
  isTerminal: (status?: string): boolean => {
    if (!status) return false;
    const s = status.toLowerCase();
    return ['completed', 'cancelled', 'settled'].includes(s);
  },
  isPaid: (paymentStatus?: string): boolean => {
    if (!paymentStatus) return false;
    const s = paymentStatus.toLowerCase();
    return s === 'paid' || s === 'success';
  },
};

export interface OrderItem {
  itemId: number;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  cookingInstruction?: string;
  gstRate?: number;
  gstAmount?: number;
  stationCode?: string;
  stationName?: string;
  stationBadgeColor?: string;
  stationIcon?: string;
}

export interface OrderMaster {
  id: number;
  orderNumber?: string;
  restaurantId?: number;
  restaurantName?: string;
  customerName: string;
  mobileNumber?: string;
  tableId?: number;
  tableName?: string;
  source?: string;
  orderTypeId: number;
  orderTypeName?: OrderTypeName;
  subtotal?: number;
  discountAmount?: number;
  cgst?: number;
  sgst?: number;
  totalAmount: number;
  paidAmount?: number;
  pendingAmount?: number;
  totalOrdersCount?: number;
  paidOrdersCount?: number;
  pendingOrdersCount?: number;
  tenderedAmount?: number;
  changeAmount?: number;
  settledBy?: number;
  settledDateUtc?: string;
  billingMode?: string;
  commission?: number;
  paymentMode?: PaymentMode;
  paymentStatus?: PaymentStatus;
  status: OrderStatus;
  items: OrderItem[];
  createdAt?: string;
  pickupToken?: string;
  tokenNumber?: number | string;
  gstNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  contactNumber?: string;
  contactPhone?: string;
  logoUrl?: string;
  imageUrl?: string;
}

export interface PlaceOrderItemRequest {
  itemId: number;
  itemName?: string;
  quantity: number;
  unitId?: number;
  amount: number;
  totalAmount?: number;
}

export interface PlaceOrderRequest {
  restaurantId?: number;
  name: string;
  mobileNumber?: string;
  remarks?: string;
  isHomeDelivery?: boolean;
  orderTypeId?: number;
  tableId?: number;
  tableNumber?: string;
  sectionName?: string;
  orderStatus?: string;
  source?: string;
  deviceId?: string;
  estimatedPickupTime?: string;
  cgst?: number;
  sgst?: number;
  totalAmount?: number;
  tenderedAmount?: number;
  changeAmount?: number;
  paymentMode?: string;
  paymentStatus?: string;
  billingMode?: string;
  items?: PlaceOrderItemRequest[];
}

export interface RestaurantTodayRevenue {
  restaurantId: number;
  date: string;
  todayRevenue: number;
  todayOrdersCount: number;
  activeOrdersCount: number;
  completedOrdersCount: number;
  cancelledOrdersCount: number;
  todayCommissionDeducted: number;
}

export interface PaginatedOrdersResult {
  items: OrderMaster[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface OrderStatusOption {
  key: string;
  label: string;
  category?: string;
  displayOrder?: number;
}

export interface ActiveOrderType {
  id: number;
  code: 'COUNTER' | 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | string;
  typeName: string;
  description?: string;
  configKey: string;
  isAllowedByPlan: boolean;
  isEnabledByStore: boolean;
  isActive: boolean;
  displayOrder: number;
}

export interface SettleOrderRequest {
  orderId?: number;
  paymentMode?: string;
  discountAmount?: number;
  tenderedAmount?: number;
  changeAmount?: number;
  billingMode?: string;
  remarks?: string;
  orderStatus?: string;
}

export interface SettleOrderResponse {
  success: boolean;
  statusCode?: number;
  isAlreadySettled?: boolean;
  orderId: number;
  restaurantId?: number;
  tableId?: number;
  tableName?: string;
  customerName?: string;
  mobileNumber?: string;
  orderAmount?: number;
  discountAmount?: number;
  cgst?: number;
  sgst?: number;
  totalAmount?: number;
  tenderedAmount?: number;
  changeAmount?: number;
  paymentMode?: string;
  paymentStatus?: string;
  orderStatus?: string;
  settledBy?: number;
  settledDateUtc?: string;
  message?: string;
}

export type BillingMode = 'PRE_PAID' | 'POST_PAID';

export const BillingModes = {
  PRE_PAID: 'PRE_PAID' as const,
  POST_PAID: 'POST_PAID' as const,
  PAY_LATER: 'PAY_LATER' as const,
  PAY_AND_SETTLE: 'PAY_AND_SETTLE' as const,
  KOT_PAY_LATER: 'KOT_PAY_LATER' as const,
  SEND_TO_KOT: 'SEND_TO_KOT' as const,
};

export const PosCheckoutModes = {
  KOT_PAY_LATER: 'KOT_PAY_LATER' as const,
  PAY_AND_SETTLE: 'PAY_AND_SETTLE' as const,
};

export const PosOrderSources = {
  POS_ADMIN: 'POS_ADMIN' as const,
  QR_DINEIN: 'QR_DINEIN' as const,
  QR_DIRECT: 'QR_DIRECT' as const,
  ONLINE: 'ONLINE' as const,
};
