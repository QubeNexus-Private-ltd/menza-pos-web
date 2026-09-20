export interface RestaurantConfig {
  id: number;
  restaurantName: string;
  address?: string;
  city?: string;
  state?: string;
  imageUrl?: string;
  logoUrl?: string;
  contactNumber?: string;
  email?: string;
  gstNumber?: string;
  sgstPercentage?: number;
  cgstPercentage?: number;
  totalGstPercentage?: number;
  currencySymbol?: string;
  taxPercentage?: number;
  walletBalance?: number;
  isActive?: boolean;
  businessProfile?: 'QSR_CAFE' | 'DINE_IN' | 'HYBRID';
  orderingMode?: 'SCHEDULE' | 'MANUAL';
  isAcceptingOrdersManual?: boolean;
  manualPauseUntilUtc?: string | null;
  pauseReason?: string | null;
  openingTime?: string;
  closingTime?: string;
  lastOrderBufferMinutes?: number;
  weeklyScheduleJson?: string | null;
  kitchenMode?: 'SINGLE_KITCHEN' | 'MULTI_STATION';
  isKitchenActive?: boolean;
  kitchenPausedUntilUtc?: string | null;
  kitchenRemainingPauseMinutes?: number | null;
  kitchenPauseReason?: string | null;
  currentOperatingStatus?: string;
  lastOpenedAtUtc?: string | null;
  lastOpenedByUserId?: number | null;
  lastClosedAtUtc?: string | null;
  lastClosedByUserId?: number | null;
  closeReason?: string | null;
  lastOrderResumedAtUtc?: string | null;
  lastOrderResumedByUserId?: number | null;
  lastOrderPausedAtUtc?: string | null;
  lastOrderPausedByUserId?: number | null;
  lastPauseDurationMinutes?: number | null;
  lastModeChangedAtUtc?: string | null;
  lastModeChangedByUserId?: number | null;
  lastKitchenStatusChangedAtUtc?: string | null;
  lastKitchenStatusChangedByUserId?: number | null;
  lastKitchenPausedAtUtc?: string | null;
}

export interface StoreOperatingStatus {
  restaurantId: number;
  restaurantName: string;
  storeImage?: string | null;
  storeImageUrl?: string | null;
  logoUrl?: string | null;
  bannerImage?: string | null;
  bannerUrl?: string | null;
  imageUrl?: string | null;
  isOpen: boolean;
  orderingMode: 'SCHEDULE' | 'MANUAL';
  businessProfile?: 'QSR_CAFE' | 'DINE_IN' | 'HYBRID';
  isTableOrderingActive?: boolean;
  status: 'OPEN' | 'PAUSED' | 'CLOSED' | 'WALLET_EXHAUSTED';
  statusMessage: string;
  openingTime: string;
  closingTime: string;
  lastOrderTime: string;
  lastOrderBufferMinutes: number;
  manualPauseUntilUtc?: string | null;
  remainingPauseMinutes?: number | null;
  pauseReason?: string | null;
  kitchenMode?: 'SINGLE_KITCHEN' | 'MULTI_STATION';
  isKitchenActive?: boolean;
  kitchenPausedUntilUtc?: string | null;
  kitchenRemainingPauseMinutes?: number | null;
  kitchenPauseReason?: string | null;
  canPlaceOrder: boolean;
  nextOpeningTime?: string | null;
  walletBalance?: number;
  timestampUtc?: string;

  // Real-time tracking & state audit
  currentOperatingStatus?: string;
  lastOpenedAtUtc?: string | null;
  lastOpenedByUserId?: number | null;
  lastClosedAtUtc?: string | null;
  lastClosedByUserId?: number | null;
  closeReason?: string | null;
  lastOrderResumedAtUtc?: string | null;
  lastOrderResumedByUserId?: number | null;
  lastOrderPausedAtUtc?: string | null;
  lastOrderPausedByUserId?: number | null;
  lastPauseDurationMinutes?: number | null;
  lastModeChangedAtUtc?: string | null;
  lastModeChangedByUserId?: number | null;
  lastKitchenStatusChangedAtUtc?: string | null;
  lastKitchenStatusChangedByUserId?: number | null;
  lastKitchenPausedAtUtc?: string | null;
}

export interface RestaurantOperatingHistoryEntry {
  id: number;
  restaurantId: number;
  restaurantName: string;
  eventType: string; // "STORE_OPENED" | "STORE_CLOSED_MANUAL" | "ORDERS_RESUMED" | "ORDERS_PAUSED" | "MODE_CHANGED" | "KITCHEN_ACTIVE_TOGGLE" | "KITCHEN_PAUSED" | "HOURS_UPDATED"
  previousStatus?: string | null;
  newStatus?: string | null;
  pauseDurationMinutes?: number | null;
  reason?: string | null;
  remarks?: string | null;
  orderingMode?: string;
  businessProfile?: string;
  isKitchenActive?: boolean;
  actionSource?: string;
  createdBy: number;
  createdByName?: string | null;
  createdDateUtc: string;
}

export interface ToggleOrderingRequest {
  isAccepting?: boolean;
  pauseMinutes?: number;
  reason?: string;
  mode?: 'SCHEDULE' | 'MANUAL';
  businessProfile?: 'QSR_CAFE' | 'DINE_IN' | 'HYBRID';
  kitchenMode?: 'SINGLE_KITCHEN' | 'MULTI_STATION';
  isKitchenActive?: boolean;
  kitchenPauseMinutes?: number;
  kitchenPauseReason?: string;
}

export interface OperatingHoursRequest {
  orderingMode?: 'SCHEDULE' | 'MANUAL';
  openingTime?: string;
  closingTime?: string;
  lastOrderBufferMinutes?: number;
  weeklyScheduleJson?: string;
}

export interface RestaurantOrderingConfig {
  isTableOrderingEnabled: boolean;
  isSelfPickupEnabled: boolean;
  isDeliveryEnabled: boolean;
  isCounterOrderingEnabled: boolean;
  isPaymentRequiredForTableOrder: boolean;
  isPaymentRequiredForPickupOrder: boolean;
  isPaymentRequiredForDeliveryOrder: boolean;
  allowCashOnDelivery: boolean;
  allowPayAtTable: boolean;
  allowOnlinePayment: boolean;
  autoAcceptOrders: boolean;
  isKdsEnabled: boolean;
  isSmsNotificationsEnabled: boolean;
  isAdvanceBookingEnabled?: boolean;
  bookingSlotIntervalMinutes?: number;
  averageDiningDurationMinutes?: number;
  advanceBookingWindowDays?: number;
  requireAdvanceDeposit?: boolean;
  depositAmountPerPerson?: number;
}

export type { RestaurantReservationConfig } from './Table';
