import { apiClient } from '@/lib/api/client';
import {
  SalesPerson,
  SalesCommissionFormula,
  SalesEarningsSummary,
  SalesEarningRecord,
  SalesRestaurantListItem,
  CreateSalesPersonRequest,
} from '@/types/sales';
import { OnboardRestaurantPayload } from '@/services/superAdminService';

const DEFAULT_GLOBAL_FORMULA: SalesCommissionFormula = {
  id: 1,
  salesPersonId: null,
  formulaName: 'Standard Sales Growth Formula',
  commissionModel: 'HYBRID',
  rechargeCommissionPercent: 5.0,
  firstRechargeBonusAmount: 500,
  minRechargeThresholdForBonus: 2000,
  platformFeeSharePercent: 20.0,
  flatPerOrderBonus: 1.0,
  earningTenureMonths: 12,
  isActive: true,
  updatedAt: new Date().toISOString(),
};

const LOCAL_STORAGE_SALES_KEY = 'menza_sales_persons_v1';
const LOCAL_STORAGE_FORMULA_KEY = 'menza_sales_formula_global_v1';
const LOCAL_STORAGE_EARNINGS_KEY = 'menza_sales_earnings_v1';

export class SalesService {
  // --------------------------------------------------------------------------
  // Global & Custom Formulas
  // --------------------------------------------------------------------------

  static async getGlobalFormula(): Promise<SalesCommissionFormula> {
    try {
      const res = await apiClient.get('/Sales/formula/default');
      if (res.data) return res.data;
    } catch {
      // Fallback to local storage or default
    }

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_FORMULA_KEY);
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return DEFAULT_GLOBAL_FORMULA;
  }

  static async updateGlobalFormula(formula: SalesCommissionFormula): Promise<SalesCommissionFormula> {
    try {
      const res = await apiClient.put('/Sales/formula/default', formula);
      if (res.data) return res.data;
    } catch {
      // Fallback
    }

    const updated = { ...formula, updatedAt: new Date().toISOString() };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_FORMULA_KEY, JSON.stringify(updated));
      } catch {}
    }
    return updated;
  }

  // --------------------------------------------------------------------------
  // SuperAdmin Salesperson Management
  // --------------------------------------------------------------------------

  static async getAllSalesPersons(): Promise<SalesPerson[]> {
    try {
      const res = await apiClient.get('/Sales/persons');
      const items = res.data?.items || res.data?.data || (Array.isArray(res.data) ? res.data : []);
      if (Array.isArray(res.data) && res.data.length === 0) {
        return [];
      }
      if (items.length > 0) {
        return items.map(this.mapSalesPersonDto);
      }
    } catch {
      // Fallback to local storage if offline
    }

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_SALES_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed.map(this.mapSalesPersonDto);
        }
      } catch {}
    }

    return [];
  }

  static async createSalesPerson(payload: CreateSalesPersonRequest): Promise<{ id: number; success: boolean }> {
    const cleanMobile = payload.mobile.replace(/\D/g, '').slice(-10);
    const partnerCode = payload.partnerCode?.trim() || undefined;

    try {
      const res = await apiClient.post('/Sales/person', {
        ...payload,
        mobile: cleanMobile,
        partnerCode,
      });
      const data = res.data?.data || res.data;
      const returnedId = data?.id ?? data?.Id;
      if (returnedId) {
        return { id: Number(returnedId), success: true };
      }
      return { id: 0, success: data?.success ?? true };
    } catch (err: any) {
      console.error('Failed to create sales person via API', err);
      throw err;
    }
  }

  static async updateSalesPersonStatus(salesPersonId: number, isActive: boolean): Promise<boolean> {
    try {
      await apiClient.put(`/Sales/person/${salesPersonId}/status`, { isActive });
      return true;
    } catch {}

    const all = await this.getAllSalesPersons();
    const idx = all.findIndex((a) => a.id === salesPersonId);
    if (idx !== -1) {
      all[idx].isActive = isActive;
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_SALES_KEY, JSON.stringify(all));
      }
      return true;
    }
    return false;
  }

  static async updateSalesPersonFormula(
    salesPersonId: number,
    formula: Partial<SalesCommissionFormula>
  ): Promise<boolean> {
    try {
      await apiClient.put(`/Sales/person/${salesPersonId}/formula`, formula);
      return true;
    } catch {}

    const all = await this.getAllSalesPersons();
    const idx = all.findIndex((a) => a.id === salesPersonId);
    if (idx !== -1) {
      const globalFormula = await this.getGlobalFormula();
      all[idx].formula = {
        ...globalFormula,
        ...all[idx].formula,
        ...formula,
        salesPersonId,
        updatedAt: new Date().toISOString(),
      } as SalesCommissionFormula;
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_SALES_KEY, JSON.stringify(all));
      }
      return true;
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // Sales Person Earnings & Ledger
  // --------------------------------------------------------------------------

  static async getEarningsSummary(salesPersonId?: number): Promise<SalesEarningsSummary> {
    try {
      const endpoint = salesPersonId && salesPersonId > 0
        ? `/Sales/person/${salesPersonId}/earnings`
        : '/Sales/me/earnings';
      const res = await apiClient.get(endpoint);
      if (res.data) return res.data;
    } catch {}

    const globalFormula = await this.getGlobalFormula();

    return {
      salesPersonId: salesPersonId || 0,
      salesPersonName: '',
      partnerCode: '',
      totalLifetimeEarnings: 0,
      unpaidBalance: 0,
      paidBalance: 0,
      currentMonthEarnings: 0,
      lastMonthEarnings: 0,
      totalOnboardedCount: 0,
      activeRestaurantsCount: 0,
      activeFormula: globalFormula,
      recentTransactions: [],
    };
  }

  static async getEarningsLedger(
    salesPersonId?: number,
    fromDate?: string,
    toDate?: string
  ): Promise<SalesEarningRecord[]> {
    try {
      const endpoint = salesPersonId && salesPersonId > 0
        ? `/Sales/person/${salesPersonId}/ledger`
        : '/Sales/me/ledger';
      const res = await apiClient.get(endpoint, {
        params: { fromDate, toDate },
      });
      if (res.data?.items && Array.isArray(res.data.items)) return res.data.items;
      if (Array.isArray(res.data)) return res.data;
    } catch {}

    if (salesPersonId && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`${LOCAL_STORAGE_EARNINGS_KEY}_${salesPersonId}`);
        if (stored) return JSON.parse(stored);
      } catch {}
    }

    return [];
  }

  // --------------------------------------------------------------------------
  // Sales Person Onboarded Restaurants
  // --------------------------------------------------------------------------

  static async getMyRestaurants(salesPersonId?: number): Promise<SalesRestaurantListItem[]> {
    try {
      const endpoint = salesPersonId && salesPersonId > 0
        ? `/Sales/person/${salesPersonId}/restaurants`
        : '/Sales/me/restaurants';
      const res = await apiClient.get(endpoint);
      if (res.data?.items && Array.isArray(res.data.items)) return res.data.items;
      if (Array.isArray(res.data)) return res.data;
    } catch {}

    return [];
  }

  // --------------------------------------------------------------------------
  // Onboard Restaurant with Sales Attribution
  // --------------------------------------------------------------------------

  static async onboardRestaurantBySales(
    request: OnboardRestaurantPayload & { salesPersonId: number; partnerCode?: string }
  ): Promise<{ restaurantId: number; success: boolean }> {
    // Attempt backend onboard API with sales attribution
    let stateCode = (request.state || 'KA').trim();
    if (stateCode.length > 10) {
      const stateMap: Record<string, string> = {
        'andhra pradesh': 'AP', 'arunachal pradesh': 'AR', assam: 'AS', bihar: 'BR',
        chhattisgarh: 'CG', goa: 'GA', gujarat: 'GJ', haryana: 'HR', 'himachal pradesh': 'HP',
        jharkhand: 'JH', karnataka: 'KA', kerala: 'KL', 'madhya pradesh': 'MP', maharashtra: 'MH',
        manipur: 'MN', meghalaya: 'ML', mizoram: 'MZ', nagaland: 'NL', odisha: 'OD', punjab: 'PB',
        rajasthan: 'RJ', sikkim: 'SK', 'tamil nadu': 'TN', telangana: 'TG', tripura: 'TR',
        'uttar pradesh': 'UP', uttarakhand: 'UK', 'west bengal': 'WB', delhi: 'DL',
      };
      stateCode = stateMap[stateCode.toLowerCase()] || stateCode.slice(0, 10);
    }
    const payload = { ...request, state: stateCode };

    try {
      const res = await apiClient.post('/Sales/onboard-restaurant', payload);
      const restId = res.data?.id || res.data?.Id || res.data?.restaurantId;
      if (restId) {
        return { restaurantId: Number(restId), success: true };
      }
    } catch {}

    // Fall back to standard SuperAdminService.onboardRestaurant
    const { SuperAdminService } = await import('@/services/superAdminService');
    const result = await SuperAdminService.onboardRestaurant(request);
    return result;
  }

  // --------------------------------------------------------------------------
  // Helper DTO Mapper
  // --------------------------------------------------------------------------

  private static mapSalesPersonDto(r: any): SalesPerson {
    const id = Number(r.id ?? r.Id ?? 0);
    return {
      id,
      userId: Number(r.userId ?? r.UserId ?? 0),
      name: r.name ?? r.Name ?? '',
      mobile: r.mobile ?? r.Mobile ?? '',
      email: r.email ?? r.Email ?? '',
      partnerCode: r.partnerCode ?? r.PartnerCode ?? (id > 0 ? `SP${String(id).padStart(2, '0')}` : ''),
      upiId: r.upiId ?? r.UpiId ?? '',
      bankAccountName: r.bankAccountName ?? r.BankAccountName ?? '',
      bankAccountNumber: r.bankAccountNumber ?? r.BankAccountNumber ?? '',
      bankIfscCode: r.bankIfscCode ?? r.BankIfscCode ?? '',
      panNumber: r.panNumber ?? r.PanNumber ?? '',
      isActive: r.isActive ?? r.IsActive ?? true,
      formula: r.formula ?? r.Formula ?? null,
      totalRestaurantsOnboarded: Number(r.totalRestaurantsOnboarded ?? r.TotalRestaurantsOnboarded ?? 0),
      activeRestaurantsCount: Number(r.activeRestaurantsCount ?? r.ActiveRestaurantsCount ?? 0),
      lifetimeEarnings: Number(r.lifetimeEarnings ?? r.LifetimeEarnings ?? 0),
      unpaidEarnings: Number(r.unpaidEarnings ?? r.UnpaidEarnings ?? 0),
      createdAt: r.createdAt ?? r.CreatedAt ?? new Date().toISOString(),
    };
  }
}
