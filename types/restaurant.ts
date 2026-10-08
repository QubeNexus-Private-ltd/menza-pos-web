export interface StoreOperatingStatus {
  restaurantId: number;
  restaurantName?: string;
  isOpen: boolean;
  isOrderingEnabled: boolean;
  orderingMode?: string;
  status?: string;
  statusMessage?: string;
  isKitchenAcceptingOrders?: boolean;
  isKitchenActive?: boolean;
  closingTime?: string;
  openingTime?: string;
  lastOrderTime?: string;
  lastOrderBufferMinutes?: number;
  temporaryClosureReason?: string | null;
  canPlaceOrder?: boolean;
  modifiedOnUtc?: string;
}

export interface RestaurantConfig {
  restaurantId: number;
  restaurantName: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  contactNumber?: string;
  email?: string;
  gstNumber?: string;
  fssaiNumber?: string;
  currencySymbol?: string;
  taxRate?: number;
  gstRate?: number;
  cgstPercentage?: number;
  sgstPercentage?: number;
  serviceChargeRate?: number;
  isGstEnabled?: boolean;
  isServiceChargeEnabled?: boolean;
  isSmsNotificationsEnabled?: boolean;
  isAutoKotPrintEnabled?: boolean;
  isAutoReceiptPrintEnabled?: boolean;
  operatingStatus?: StoreOperatingStatus;
}

export interface RestaurantBankDetails {
  bankId?: number;
  restaurantId: number;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName?: string;
  isVerified?: boolean;
  upiId?: string;
}
