import {
  SalesPerson,
  SalesCommissionFormula,
  SalesEarningsSummary,
  SalesEarningRecord,
  SalesRestaurantListItem,
  CreateSalesPersonRequest,
} from '@/types/sales';
import { OnboardRestaurantPayload } from '@/services/superAdminService';
import { ISalesRepository } from '../../domain/repositories/ISalesRepository';
import { ISalesCommissionCalculator } from '../../domain/services/SalesCommissionCalculator';
import { ISalesRemoteDataSource } from '../datasources/SalesRemoteDataSource';

/**
 * Clean Architecture Repository Implementation for Sales Partner & Commission Ledger.
 * Uses Constructor Dependency Injection for both remote data access and domain commission calculation.
 */
export class SalesRepositoryImpl implements ISalesRepository {
  constructor(
    private readonly dataSource: ISalesRemoteDataSource,
    private readonly commissionCalculator: ISalesCommissionCalculator
  ) {}

  async getGlobalFormula(): Promise<SalesCommissionFormula> {
    return await this.dataSource.getGlobalFormula();
  }

  async updateGlobalFormula(formula: SalesCommissionFormula): Promise<SalesCommissionFormula> {
    return await this.dataSource.updateGlobalFormula(formula);
  }

  async getAllSalesPersons(): Promise<SalesPerson[]> {
    return await this.dataSource.getAllSalesPersons();
  }

  async createSalesPerson(
    payload: CreateSalesPersonRequest
  ): Promise<{ id: number; success: boolean }> {
    return await this.dataSource.createSalesPerson(payload);
  }

  async updateSalesPersonStatus(salesPersonId: number, isActive: boolean): Promise<boolean> {
    return await this.dataSource.updateSalesPersonStatus(salesPersonId, isActive);
  }

  async updateSalesPersonFormula(
    salesPersonId: number,
    formula: Partial<SalesCommissionFormula>
  ): Promise<boolean> {
    return await this.dataSource.updateSalesPersonFormula(salesPersonId, formula);
  }

  async getEarningsSummary(salesPersonId?: number): Promise<SalesEarningsSummary> {
    return await this.dataSource.getEarningsSummary(salesPersonId);
  }

  async getEarningsLedger(
    salesPersonId?: number,
    fromDate?: string,
    toDate?: string
  ): Promise<SalesEarningRecord[]> {
    return await this.dataSource.getEarningsLedger(salesPersonId, fromDate, toDate);
  }

  async getMyRestaurants(salesPersonId?: number): Promise<SalesRestaurantListItem[]> {
    const stores = await this.dataSource.getRawMyRestaurants(salesPersonId);
    if (!stores || stores.length === 0) {
      return [];
    }

    const needsReconciliation = stores.some((s) => s.commissionGeneratedTotal <= 0);
    if (!needsReconciliation) {
      return stores;
    }

    const [ledger, summary] = await Promise.all([
      this.getEarningsLedger(salesPersonId).catch(() => [] as SalesEarningRecord[]),
      this.getEarningsSummary(salesPersonId).catch(() => null),
    ]);

    const activeFormula =
      summary?.activeFormula || (await this.getGlobalFormula());

    return this.commissionCalculator.reconcileStoresCommission(
      stores,
      activeFormula,
      ledger
    );
  }

  async onboardRestaurantBySales(
    request: OnboardRestaurantPayload & { salesPersonId: number; partnerCode?: string }
  ): Promise<{ restaurantId: number; success: boolean }> {
    return await this.dataSource.onboardRestaurantBySales(request);
  }
}
