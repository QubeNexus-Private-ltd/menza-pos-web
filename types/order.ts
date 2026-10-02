export const BillingModes = {
  DINE_IN: 1,
  TAKEAWAY: 2,
  DELIVERY: 3,
  POST_PAID: 'POST_PAID',
  PRE_PAID: 'PRE_PAID',
} as const;

export type BillingMode = typeof BillingModes[keyof typeof BillingModes];

export const PosCheckoutModes = {
  CASH: 'CASH',
  UPI: 'UPI',
  CARD: 'CARD',
  SPLIT: 'SPLIT',
  DUE: 'DUE',
} as const;

export type PosCheckoutMode = typeof PosCheckoutModes[keyof typeof PosCheckoutModes];

export interface OrderItem {
  orderDetailId?: number;
  orderId?: number;
  itemId: number;
  itemName: string;
  quantity: number;
  price: number;
  unitPrice?: number;
  amount?: number;
  totalPrice?: number;
  cookingInstruction?: string;
  remarks?: string;
  kitchenStatus?: string;
  ticketVersion?: number;
  status?: string;
}

export interface OrderMaster {
  orderId: number;
  id?: number;
  restaurantId: number;
  restaurantName?: string;
  address?: string;
  contactNumber?: string;
  orderNumber?: string;
  orderType: string;
  orderTypeName?: string;
  orderTypeId?: number;
  tableId?: number | null;
  tableName?: string | null;
  tableNumber?: string | null;
  totalAmount: number;
  grandTotal?: number;
  subTotal?: number;
  subtotal?: number;
  taxAmount?: number;
  cgst?: number;
  sgst?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  discountAmount?: number;
  orderStatus: string;
  status?: string;
  paymentStatus: string;
  paymentMode?: string;
  tenderedAmount?: number;
  changeAmount?: number;
  customerName?: string;
  customerMobile?: string;
  customerPhone?: string;
  mobileNumber?: string;
  waiterName?: string;
  remarks?: string;
  ticketVersion?: number;
  createdOn?: string;
  createdAt?: string;
  createdAtUtc?: string;
  settledAt?: string;
  settledAtUtc?: string;
  settledDateUtc?: string;
  paidAmount?: number;
  items: OrderItem[];
  orderDetails?: OrderItem[];
}

export interface RestaurantTodayRevenue {
  todayRevenue: number;
  todayOrdersCount: number;
  settledOrdersCount?: number;
  pendingOrdersCount?: number;
  totalOrders?: number;
  averageOrderValue?: number;
  dineInRevenue?: number;
  takeawayRevenue?: number;
  deliveryRevenue?: number;
}

export interface TodayRevenueMetricsDTO {
  restaurantId: number;
  todayRevenue: number;
  todayOrdersCount: number;
  settledOrdersCount?: number;
  pendingOrdersCount?: number;
  totalTaxCollected?: number;
  totalDiscountGiven?: number;
}

export interface SettleOrderRequest {
  paymentMode: string;
  amount: number;
  tenderedAmount?: number;
  changeAmount?: number;
  roundOff?: number;
  discountAmount?: number;
  discountType?: string;
  customerName?: string;
  customerMobile?: string;
  remarks?: string;
}

export interface SettleOrderResponseDTO {
  success: boolean;
  statusCode: number;
  message: string;
  orderId?: number;
  settledAmount?: number;
  paymentMode?: string;
}

export interface OrderStatusDTO {
  status: string;
  displayName: string;
  isTerminal?: boolean;
}

export interface OrderHistoryItem {
  historyId?: number;
  orderId: number;
  status: string;
  remarks?: string;
  createdOn?: string;
  updatedBy?: string;
}
