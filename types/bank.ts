export interface RestaurantBankAccountRequest {
  accountNumber: string;
  accountHolder: string;
  ifsc: string;
  bankName?: string;
  pan?: string;
  email?: string;
  phoneNumber?: string;
}

export interface RestaurantBankAccountResponse {
  restaurantId: number;
  vendorCode?: string;
  accountHolder?: string;
  accountNumberMasked?: string;
  ifsc?: string;
  bankName?: string;
  status?: string;
  kycStatus?: string;
  isActive: boolean;
}

export interface VerifyBankAccountRequest {
  accountNumber: string;
  ifsc: string;
  accountHolder?: string;
  phoneNumber?: string;
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
}
