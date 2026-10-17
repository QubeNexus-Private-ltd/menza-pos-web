import { AxiosInstance } from 'axios';
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
import { DEFAULT_GLOBAL_SALES_FORMULA } from '../../domain/services/SalesCommissionCalculator';

const LOCAL_STORAGE_SALES_KEY = 'menza_sales_persons_v1';
const LOCAL_STORAGE_FORMULA_KEY = 'menza_sales_formula_global_v1';
const LOCAL_STORAGE_EARNINGS_KEY = 'menza_sales_earnings_v1';

export interface ISalesRemoteDataSource {
  getGlobalFormula(): Promise<SalesCommissionFormula>;
  updateGlobalFormula(formula: SalesCommissionFormula): Promise<SalesCommissionFormula>;
  getAllSalesPersons(): Promise<SalesPerson[]>;
  createSalesPerson(payload: CreateSalesPersonRequest): Promise<{ id: number; success: boolean }>;
  updateSalesPersonStatus(salesPersonId: number, isActive: boolean): Promise<boolean>;
  updateSalesPersonFormula(
    salesPersonId: number,
    formula: Partial<SalesCommissionFormula>
  ): Promise<boolean>;
  getEarningsSummary(salesPersonId?: number): Promise<SalesEarningsSummary>;
  getEarningsLedger(
    salesPersonId?: number,
    fromDate?: string,
    toDate?: string
  ): Promise<SalesEarningRecord[]>;
  getRawMyRestaurants(salesPersonId?: number): Promise<SalesRestaurantListItem[]>;
  onboardRestaurantBySales(
    request: OnboardRestaurantPayload & { salesPersonId: number; partnerCode?: string }
  ): Promise<{ restaurantId: number; success: boolean }>;
}

/**
 * Infrastructure Data Source for Sales Partner endpoints with Constructor Dependency Injection for the HTTP client.
 */
export class SalesRemoteDataSource implements ISalesRemoteDataSource {
  constructor(private readonly httpClient: AxiosInstance = apiClient) {}

  async getGlobalFormula(): Promise<SalesCommissionFormula> {
    try {
      const res = await this.httpClient.get('/Sales/formula/default');
      if (res.data) return this.mapFormulaDto(res.data?.data || res.data);
    } catch {
      // Fallback to local storage or default
    }

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_FORMULA_KEY);
        if (stored) return this.mapFormulaDto(JSON.parse(stored));
      } catch {}
    }
    return { ...DEFAULT_GLOBAL_SALES_FORMULA };
  }

  async updateGlobalFormula(formula: SalesCommissionFormula): Promise<SalesCommissionFormula> {
    try {
      const res = await this.httpClient.put('/Sales/formula/default', formula);
      if (res.data) return this.mapFormulaDto(res.data?.data || res.data);
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

  async getAllSalesPersons(): Promise<SalesPerson[]> {
    try {
      const res = await this.httpClient.get('/Sales/persons');
      const items =
        res.data?.items || res.data?.data || (Array.isArray(res.data) ? res.data : []);
      if (Array.isArray(res.data) && res.data.length === 0) {
        return [];
      }
      if (items.length > 0) {
        return items.map((r: any) => this.mapSalesPersonDto(r));
      }
    } catch {
      // Fallback to local storage if offline
    }

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_SALES_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed.map((r: any) => this.mapSalesPersonDto(r));
        }
      } catch {}
    }

    return [];
  }

  async createSalesPerson(
    payload: CreateSalesPersonRequest
  ): Promise<{ id: number; success: boolean }> {
    const cleanMobile = payload.mobile.replace(/\D/g, '').slice(-10);
    const partnerCode = payload.partnerCode?.trim() || undefined;

    const res = await this.httpClient.post('/Sales/person', {
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
  }

  async updateSalesPersonStatus(salesPersonId: number, isActive: boolean): Promise<boolean> {
    try {
      await this.httpClient.put(`/Sales/person/${salesPersonId}/status`, { isActive });
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

  async updateSalesPersonFormula(
    salesPersonId: number,
    formula: Partial<SalesCommissionFormula>
  ): Promise<boolean> {
    try {
      await this.httpClient.put(`/Sales/person/${salesPersonId}/formula`, formula);
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

  async getEarningsSummary(salesPersonId?: number): Promise<SalesEarningsSummary> {
    const endpoints =
      salesPersonId && salesPersonId > 0
        ? [`/Sales/person/${salesPersonId}/earnings`, '/Sales/me/earnings']
        : ['/Sales/me/earnings'];

    for (const endpoint of endpoints) {
      try {
        const res = await this.httpClient.get(endpoint);
        if (res.data) {
          const d = res.data?.data || res.data;
          const activeFormula =
            d.activeFormula || d.ActiveFormula || (await this.getGlobalFormula());
          const rawTxns = d.recentTransactions || d.RecentTransactions || [];
          return {
            salesPersonId: Number(d.salesPersonId ?? d.SalesPersonId ?? salesPersonId ?? 0),
            salesPersonName: d.salesPersonName ?? d.SalesPersonName ?? '',
            partnerCode: d.partnerCode ?? d.PartnerCode ?? '',
            totalLifetimeEarnings: Number(
              d.totalLifetimeEarnings ?? d.TotalLifetimeEarnings ?? 0
            ),
            unpaidBalance: Number(d.unpaidBalance ?? d.UnpaidBalance ?? 0),
            paidBalance: Number(d.paidBalance ?? d.PaidBalance ?? 0),
            currentMonthEarnings: Number(
              d.currentMonthEarnings ?? d.CurrentMonthEarnings ?? 0
            ),
            lastMonthEarnings: Number(d.lastMonthEarnings ?? d.LastMonthEarnings ?? 0),
            totalOnboardedCount: Number(d.totalOnboardedCount ?? d.TotalOnboardedCount ?? 0),
            activeRestaurantsCount: Number(
              d.activeRestaurantsCount ?? d.ActiveRestaurantsCount ?? 0
            ),
            activeFormula: this.mapFormulaDto(activeFormula),
            recentTransactions: Array.isArray(rawTxns)
              ? rawTxns.map((r: any) => this.mapLedgerDto(r))
              : [],
          };
        }
      } catch {}
    }

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

  async getEarningsLedger(
    salesPersonId?: number,
    fromDate?: string,
    toDate?: string
  ): Promise<SalesEarningRecord[]> {
    const endpoints =
      salesPersonId && salesPersonId > 0
        ? [`/Sales/person/${salesPersonId}/ledger`, '/Sales/me/ledger']
        : ['/Sales/me/ledger'];

    for (const endpoint of endpoints) {
      try {
        const res = await this.httpClient.get(endpoint, {
          params: { fromDate, toDate },
        });
        const raw =
          res.data?.items || res.data?.data || (Array.isArray(res.data) ? res.data : null);
        if (Array.isArray(raw)) {
          return raw.map((r: any) => this.mapLedgerDto(r));
        }
      } catch {}
    }

    if (salesPersonId && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`${LOCAL_STORAGE_EARNINGS_KEY}_${salesPersonId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed.map((r: any) => this.mapLedgerDto(r));
        }
      } catch {}
    }

    return [];
  }

  async getRawMyRestaurants(salesPersonId?: number): Promise<SalesRestaurantListItem[]> {
    const endpoints =
      salesPersonId && salesPersonId > 0
        ? [`/Sales/person/${salesPersonId}/restaurants`, '/Sales/me/restaurants']
        : ['/Sales/me/restaurants'];

    for (const endpoint of endpoints) {
      try {
        const res = await this.httpClient.get(endpoint);
        const items =
          res.data?.items || res.data?.data || (Array.isArray(res.data) ? res.data : null);
        if (Array.isArray(items)) {
          return items.map((r: any) => this.mapRestaurantDto(r));
        }
      } catch {}
    }

    return [];
  }

  async onboardRestaurantBySales(
    request: OnboardRestaurantPayload & { salesPersonId: number; partnerCode?: string }
  ): Promise<{ restaurantId: number; success: boolean }> {
    let stateCode = (request.state || 'KA').trim();
    if (stateCode.length > 10) {
      const stateMap: Record<string, string> = {
        'andhra pradesh': 'AP',
        'arunachal pradesh': 'AR',
        assam: 'AS',
        bihar: 'BR',
        chhattisgarh: 'CG',
        goa: 'GA',
        gujarat: 'GJ',
        haryana: 'HR',
        'himachal pradesh': 'HP',
        jharkhand: 'JH',
        karnataka: 'KA',
        kerala: 'KL',
        'madhya pradesh': 'MP',
        maharashtra: 'MH',
        manipur: 'MN',
        meghalaya: 'ML',
        mizoram: 'MZ',
        nagaland: 'NL',
        odisha: 'OD',
        punjab: 'PB',
        rajasthan: 'RJ',
        sikkim: 'SK',
        'tamil nadu': 'TN',
        telangana: 'TG',
        tripura: 'TR',
        'uttar pradesh': 'UP',
        uttarakhand: 'UK',
        'west bengal': 'WB',
        delhi: 'DL',
      };
      stateCode = stateMap[stateCode.toLowerCase()] || stateCode.slice(0, 10);
    }
    const payload = { ...request, state: stateCode };

    try {
      const res = await this.httpClient.post('/Sales/onboard-restaurant', payload);
      const restId = res.data?.id || res.data?.Id || res.data?.restaurantId;
      if (restId) {
        return { restaurantId: Number(restId), success: true };
      }
    } catch {}

    const { SuperAdminService } = await import('@/services/superAdminService');
    return await SuperAdminService.onboardRestaurant(request);
  }

  private mapSalesPersonDto(r: any): SalesPerson {
    const id = Number(r.id ?? r.Id ?? 0);
    return {
      id,
      userId: Number(r.userId ?? r.UserId ?? 0),
      name: r.name ?? r.Name ?? '',
      mobile: r.mobile ?? r.Mobile ?? '',
      email: r.email ?? r.Email ?? '',
      partnerCode:
        r.partnerCode ?? r.PartnerCode ?? (id > 0 ? `SP${String(id).padStart(2, '0')}` : ''),
      upiId: r.upiId ?? r.UpiId ?? '',
      bankAccountName: r.bankAccountName ?? r.BankAccountName ?? '',
      bankAccountNumber: r.bankAccountNumber ?? r.BankAccountNumber ?? '',
      bankIfscCode: r.bankIfscCode ?? r.BankIfscCode ?? '',
      panNumber: r.panNumber ?? r.PanNumber ?? '',
      isActive: r.isActive ?? r.IsActive ?? true,
      formula: r.formula || r.Formula ? this.mapFormulaDto(r.formula || r.Formula) : null,
      totalRestaurantsOnboarded: Number(
        r.totalRestaurantsOnboarded ?? r.TotalRestaurantsOnboarded ?? 0
      ),
      activeRestaurantsCount: Number(
        r.activeRestaurantsCount ?? r.ActiveRestaurantsCount ?? 0
      ),
      lifetimeEarnings: Number(r.lifetimeEarnings ?? r.LifetimeEarnings ?? 0),
      unpaidEarnings: Number(r.unpaidEarnings ?? r.UnpaidEarnings ?? 0),
      createdAt: r.createdAt ?? r.CreatedAt ?? new Date().toISOString(),
    };
  }

  private mapFormulaDto(f: any): SalesCommissionFormula {
    if (!f || typeof f !== 'object') return { ...DEFAULT_GLOBAL_SALES_FORMULA };
    return {
      id: Number(f.id ?? f.Id ?? 1),
      salesPersonId: f.salesPersonId ?? f.SalesPersonId ?? null,
      formulaName:
        f.formulaName ?? f.FormulaName ?? DEFAULT_GLOBAL_SALES_FORMULA.formulaName,
      commissionModel: f.commissionModel ?? f.CommissionModel ?? 'HYBRID',
      rechargeCommissionPercent: Number(
        f.rechargeCommissionPercent ?? f.RechargeCommissionPercent ?? 5.0
      ),
      firstRechargeBonusAmount: Number(
        f.firstRechargeBonusAmount ?? f.FirstRechargeBonusAmount ?? 500
      ),
      minRechargeThresholdForBonus: Number(
        f.minRechargeThresholdForBonus ?? f.MinRechargeThresholdForBonus ?? 2000
      ),
      platformFeeSharePercent: Number(
        f.platformFeeSharePercent ?? f.PlatformFeeSharePercent ?? 20.0
      ),
      flatPerOrderBonus: Number(f.flatPerOrderBonus ?? f.FlatPerOrderBonus ?? 0),
      earningTenureMonths: Number(f.earningTenureMonths ?? f.EarningTenureMonths ?? 12),
      maxCommissionCapPerMonth: f.maxCommissionCapPerMonth ?? f.MaxCommissionCapPerMonth,
      isActive: Boolean(f.isActive ?? f.IsActive ?? true),
      updatedAt: f.updatedAt ?? f.UpdatedAt ?? new Date().toISOString(),
    };
  }

  private mapLedgerDto(r: any): SalesEarningRecord {
    return {
      id: String(r.id ?? r.Id ?? ''),
      salesPersonId: Number(r.salesPersonId ?? r.SalesPersonId ?? 0),
      restaurantId: Number(r.restaurantId ?? r.RestaurantId ?? 0),
      restaurantName:
        r.restaurantName ??
        r.RestaurantName ??
        `Store #${r.restaurantId ?? r.RestaurantId ?? 0}`,
      triggerType: (r.triggerType ?? r.TriggerType ?? 'RECHARGE') as any,
      referenceId: String(r.referenceId ?? r.ReferenceId ?? ''),
      baseAmount: Number(r.baseAmount ?? r.BaseAmount ?? 0),
      appliedFormula: r.appliedFormula ?? r.AppliedFormula ?? '',
      commissionAmount: Number(r.commissionAmount ?? r.CommissionAmount ?? 0),
      payoutStatus: (r.payoutStatus ?? r.PayoutStatus ?? 'ACCUMULATED') as any,
      createdAt: r.createdAt ?? r.CreatedAt ?? new Date().toISOString(),
    };
  }

  private mapRestaurantDto(r: any): SalesRestaurantListItem {
    return {
      restaurantId: Number(r.restaurantId ?? r.RestaurantId ?? r.id ?? r.Id ?? 0),
      restaurantName:
        r.restaurantName ?? r.RestaurantName ?? r.restName ?? r.RestName ?? 'Store',
      city: r.city ?? r.City ?? '',
      state: r.state ?? r.State ?? '',
      address: r.address ?? r.Address ?? '',
      ownerName: r.ownerName ?? r.OwnerName ?? 'Assigned Owner',
      ownerMobile:
        r.ownerMobile ?? r.OwnerMobile ?? r.contactNumber ?? r.ContactNumber ?? '',
      isActive: Boolean(r.isActive ?? r.IsActive ?? true),
      onboardedDate:
        r.onboardedDate ??
        r.OnboardedDate ??
        r.createdDateUtc ??
        r.CreatedDateUtc ??
        new Date().toISOString(),
      walletBalance: Number(r.walletBalance ?? r.WalletBalance ?? 0),
      totalRecharged: Number(r.totalRecharged ?? r.TotalRecharged ?? 0),
      totalOrdersCount: Number(r.totalOrdersCount ?? r.TotalOrdersCount ?? 0),
      commissionGeneratedTotal: Number(
        r.commissionGeneratedTotal ??
          r.CommissionGeneratedTotal ??
          r.commissionEarned ??
          r.CommissionEarned ??
          r.totalCommission ??
          r.TotalCommission ??
          0
      ),
    };
  }
}
