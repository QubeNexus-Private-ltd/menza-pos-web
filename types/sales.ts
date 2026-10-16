export type SalesCommissionModel =
  | 'RECHARGE_PERCENT'
  | 'PLATFORM_FEE_SHARE'
  | 'HYBRID'
  | 'TIERED';

export interface SalesCommissionFormula {
  id?: number;
  salesPersonId?: number | null; // null represents global default template
  formulaName: string;
  commissionModel: SalesCommissionModel;

  // A. Recharge-Based Earnings (Top-up take)
  rechargeCommissionPercent: number; // e.g. 5.0% of recharge value
  firstRechargeBonusAmount: number; // e.g. Flat ₹500 on 1st top-up
  minRechargeThresholdForBonus: number; // e.g. Minimum ₹2,000 for bonus

  // B. Order Platform Fee Earnings (Usage take)
  platformFeeSharePercent: number; // e.g. 25% of Menza's platform fee on each order
  flatPerOrderBonus: number; // e.g. ₹1.00 fixed per completed order

  // C. Policy Controls
  earningTenureMonths: number; // 0 = Lifetime, or N months from restaurant onboard date
  maxCommissionCapPerMonth?: number;
  isActive: boolean;
  updatedAt?: string;
}

export interface SalesPerson {
  id: number;
  userId: number;
  name: string;
  mobile: string;
  email?: string;
  partnerCode: string;
  upiId?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfscCode?: string;
  panNumber?: string;
  isActive: boolean;
  formula?: SalesCommissionFormula | null;
  totalRestaurantsOnboarded: number;
  activeRestaurantsCount: number;
  lifetimeEarnings: number;
  unpaidEarnings: number;
  createdAt: string;
}

export type SalesEarningTriggerType =
  | 'RECHARGE'
  | 'ORDER_FEE'
  | 'FIRST_RECHARGE_BONUS'
  | 'STORE_ONBOARD'
  | 'ONBOARDING'
  | 'MANUAL_ADJUSTMENT';

export type SalesPayoutStatus =
  | 'ACCUMULATED'
  | 'PENDING_APPROVAL'
  | 'PAID';

export interface SalesEarningRecord {
  id: string | number;
  salesPersonId: number;
  restaurantId: number;
  restaurantName: string;
  triggerType: SalesEarningTriggerType;
  referenceId?: string;
  baseAmount: number;
  appliedFormula: string;
  commissionAmount: number;
  payoutStatus: SalesPayoutStatus;
  createdAt: string;
}

export interface SalesEarningsSummary {
  salesPersonId: number;
  salesPersonName: string;
  partnerCode: string;
  totalLifetimeEarnings: number;
  unpaidBalance: number;
  paidBalance: number;
  currentMonthEarnings: number;
  lastMonthEarnings: number;
  totalOnboardedCount: number;
  activeRestaurantsCount: number;
  activeFormula: SalesCommissionFormula;
  recentTransactions: SalesEarningRecord[];
}

export interface CreateSalesPersonRequest {
  name: string;
  mobile: string;
  email?: string;
  partnerCode?: string;
  upiId?: string;
  panNumber?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfscCode?: string;
  formula?: Partial<SalesCommissionFormula>;
}

export interface SalesRestaurantListItem {
  restaurantId: number;
  restaurantName: string;
  city: string;
  state: string;
  address?: string;
  ownerName: string;
  ownerMobile: string;
  isActive: boolean;
  onboardedDate: string;
  walletBalance: number;
  totalRecharged: number;
  totalOrdersCount: number;
  commissionGeneratedTotal: number;
}
