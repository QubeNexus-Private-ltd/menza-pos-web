export interface RestaurantBankAccountRequest {
  accountNumber: string;
  accountHolder: string;
  ifsc: string;
  bankName?: string;
  pan?: string;
  email?: string;
  phoneNumber?: string;
  upiId?: string;
  printUpiQrOnReceipts?: boolean;
  isRazorpay?: boolean;
  gateway?: string;
}

export interface RestaurantBankAccountResponse {
  restaurantId: number;
  vendorCode?: string;
  accountHolder?: string;
  accountNumberMasked?: string;
  ifsc?: string;
  bankName?: string;
  upiId?: string;
  printUpiQrOnReceipts?: boolean;
  status?: string;
  kycStatus?: string;
  isActive: boolean;
  gateway?: string;
  isRazorpay?: boolean;
}

export interface VerifyBankAccountRequest {
  accountNumber: string;
  ifsc: string;
  accountHolder?: string;
  phoneNumber?: string;
  restaurantId?: number;
  isRazorpay?: boolean;
  gateway?: string;
}

export interface VerifyBankAccountResponse {
  isValid: boolean;
  accountStatus: 'VALID' | 'INVALID' | 'UNKNOWN' | string;
  registeredName?: string;
  nameMatchScore?: number;
  nameMatchResult?: string;
  bankName?: string;
  branch?: string;
  city?: string;
  utr?: string;
  referenceId?: string;
  message: string;
  gateway?: string;
  isRazorpay?: boolean;
}
