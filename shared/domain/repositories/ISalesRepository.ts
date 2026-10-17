import {
  SalesPerson,
  SalesCommissionFormula,
  SalesEarningsSummary,
  SalesEarningRecord,
  SalesRestaurantListItem,
  CreateSalesPersonRequest,
} from '@/types/sales';
import { OnboardRestaurantPayload } from '@/services/superAdminService';

/**
 * Domain Repository Contract for Sales Partner Management & Commission Ledger.
 */
export interface ISalesRepository {
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
  getMyRestaurants(salesPersonId?: number): Promise<SalesRestaurantListItem[]>;

  onboardRestaurantBySales(
    request: OnboardRestaurantPayload & { salesPersonId: number; partnerCode?: string }
  ): Promise<{ restaurantId: number; success: boolean }>;
}
