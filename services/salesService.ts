import {
  SalesPerson,
  SalesCommissionFormula,
  SalesEarningsSummary,
  SalesEarningRecord,
  SalesRestaurantListItem,
  CreateSalesPersonRequest,
} from '@/types/sales';
import { OnboardRestaurantPayload } from '@/services/superAdminService';
import { ISalesRepository } from '@shared/domain/repositories/ISalesRepository';
import {
  ISalesCommissionCalculator,
  SalesCommissionCalculator,
} from '@shared/domain/services/SalesCommissionCalculator';
import {
  ISalesRemoteDataSource,
  SalesRemoteDataSource,
} from '@shared/data/datasources/SalesRemoteDataSource';
import { SalesRepositoryImpl } from '@shared/data/repositories/SalesRepositoryImpl';

// --------------------------------------------------------------------------
// Dependency Injection Composition Root for Sales Module
// --------------------------------------------------------------------------
export const salesCommissionCalculator: ISalesCommissionCalculator =
  new SalesCommissionCalculator();

export const salesRemoteDataSource: ISalesRemoteDataSource =
  new SalesRemoteDataSource();

export const salesRepository: ISalesRepository = new SalesRepositoryImpl(
  salesRemoteDataSource,
  salesCommissionCalculator
);

/**
 * Application Service for Sales Partner operations & commission earnings.
 * Supports Constructor Dependency Injection (`new SalesService(repository)`)
 * as well as static facade methods backed by the DI-wired `salesRepository`.
 */
export class SalesService implements ISalesRepository {
  private static activeRepository: ISalesRepository = salesRepository;

  constructor(private readonly repository: ISalesRepository = SalesService.activeRepository) {}

  /**
   * Allows replacing the underlying `ISalesRepository` implementation (e.g., for testing or custom DI scopes).
   */
  static configureRepository(repository: ISalesRepository): void {
    SalesService.activeRepository = repository;
  }

  // --------------------------------------------------------------------------
  // Instance Methods (Injected ISalesRepository)
  // --------------------------------------------------------------------------

  getGlobalFormula(): Promise<SalesCommissionFormula> {
    return this.repository.getGlobalFormula();
  }

  updateGlobalFormula(formula: SalesCommissionFormula): Promise<SalesCommissionFormula> {
    return this.repository.updateGlobalFormula(formula);
  }

  getAllSalesPersons(): Promise<SalesPerson[]> {
    return this.repository.getAllSalesPersons();
  }

  createSalesPerson(payload: CreateSalesPersonRequest): Promise<{ id: number; success: boolean }> {
    return this.repository.createSalesPerson(payload);
  }

  updateSalesPersonStatus(salesPersonId: number, isActive: boolean): Promise<boolean> {
    return this.repository.updateSalesPersonStatus(salesPersonId, isActive);
  }

  updateSalesPersonFormula(
    salesPersonId: number,
    formula: Partial<SalesCommissionFormula>
  ): Promise<boolean> {
    return this.repository.updateSalesPersonFormula(salesPersonId, formula);
  }

  getEarningsSummary(salesPersonId?: number): Promise<SalesEarningsSummary> {
    return this.repository.getEarningsSummary(salesPersonId);
  }

  getEarningsLedger(
    salesPersonId?: number,
    fromDate?: string,
    toDate?: string
  ): Promise<SalesEarningRecord[]> {
    return this.repository.getEarningsLedger(salesPersonId, fromDate, toDate);
  }

  getMyRestaurants(salesPersonId?: number): Promise<SalesRestaurantListItem[]> {
    return this.repository.getMyRestaurants(salesPersonId);
  }

  onboardRestaurantBySales(
    request: OnboardRestaurantPayload & { salesPersonId: number; partnerCode?: string }
  ): Promise<{ restaurantId: number; success: boolean }> {
    return this.repository.onboardRestaurantBySales(request);
  }

  // --------------------------------------------------------------------------
  // Static Facade Methods (Delegating to DI-wired ISalesRepository)
  // --------------------------------------------------------------------------

  static getGlobalFormula(): Promise<SalesCommissionFormula> {
    return SalesService.activeRepository.getGlobalFormula();
  }

  static updateGlobalFormula(formula: SalesCommissionFormula): Promise<SalesCommissionFormula> {
    return SalesService.activeRepository.updateGlobalFormula(formula);
  }

  static getAllSalesPersons(): Promise<SalesPerson[]> {
    return SalesService.activeRepository.getAllSalesPersons();
  }

  static createSalesPerson(
    payload: CreateSalesPersonRequest
  ): Promise<{ id: number; success: boolean }> {
    return SalesService.activeRepository.createSalesPerson(payload);
  }

  static updateSalesPersonStatus(salesPersonId: number, isActive: boolean): Promise<boolean> {
    return SalesService.activeRepository.updateSalesPersonStatus(salesPersonId, isActive);
  }

  static updateSalesPersonFormula(
    salesPersonId: number,
    formula: Partial<SalesCommissionFormula>
  ): Promise<boolean> {
    return SalesService.activeRepository.updateSalesPersonFormula(salesPersonId, formula);
  }

  static getEarningsSummary(salesPersonId?: number): Promise<SalesEarningsSummary> {
    return SalesService.activeRepository.getEarningsSummary(salesPersonId);
  }

  static getEarningsLedger(
    salesPersonId?: number,
    fromDate?: string,
    toDate?: string
  ): Promise<SalesEarningRecord[]> {
    return SalesService.activeRepository.getEarningsLedger(salesPersonId, fromDate, toDate);
  }

  static getMyRestaurants(salesPersonId?: number): Promise<SalesRestaurantListItem[]> {
    return SalesService.activeRepository.getMyRestaurants(salesPersonId);
  }

  static onboardRestaurantBySales(
    request: OnboardRestaurantPayload & { salesPersonId: number; partnerCode?: string }
  ): Promise<{ restaurantId: number; success: boolean }> {
    return SalesService.activeRepository.onboardRestaurantBySales(request);
  }
}
