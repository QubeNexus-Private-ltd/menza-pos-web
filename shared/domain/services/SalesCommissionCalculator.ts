import {
  SalesCommissionFormula,
  SalesEarningRecord,
  SalesRestaurantListItem,
} from '@/types/sales';

export const DEFAULT_GLOBAL_SALES_FORMULA: SalesCommissionFormula = {
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

/**
 * Pure Domain Service Contract for Sales Partner Commission Evaluation & Store Reconciliation.
 */
export interface ISalesCommissionCalculator {
  getDefaultFormula(): SalesCommissionFormula;
  isRechargeCommissionEligible(commissionModel?: string): boolean;
  isOrderFeeCommissionEligible(commissionModel?: string): boolean;
  calculateStoreCommission(
    store: SalesRestaurantListItem,
    formula: SalesCommissionFormula,
    ledgerRecords?: SalesEarningRecord[]
  ): number;
  reconcileStoresCommission(
    stores: SalesRestaurantListItem[],
    formula: SalesCommissionFormula,
    ledgerRecords: SalesEarningRecord[]
  ): SalesRestaurantListItem[];
}

/**
 * Domain implementation of Sales Partner commission rules.
 * Free of HTTP or storage dependencies so it can be injected and unit-tested in isolation.
 */
export class SalesCommissionCalculator implements ISalesCommissionCalculator {
  getDefaultFormula(): SalesCommissionFormula {
    return { ...DEFAULT_GLOBAL_SALES_FORMULA };
  }

  isRechargeCommissionEligible(commissionModel?: string): boolean {
    const model = (commissionModel || 'HYBRID').toUpperCase();
    return model === 'RECHARGE_PERCENT' || model === 'HYBRID' || model === 'TIERED';
  }

  isOrderFeeCommissionEligible(commissionModel?: string): boolean {
    const model = (commissionModel || 'HYBRID').toUpperCase();
    return model === 'PLATFORM_FEE_SHARE' || model === 'HYBRID' || model === 'TIERED';
  }

  calculateStoreCommission(
    store: SalesRestaurantListItem,
    formula: SalesCommissionFormula,
    ledgerRecords: SalesEarningRecord[] = []
  ): number {
    if (store.commissionGeneratedTotal > 0) {
      return Math.round(store.commissionGeneratedTotal * 100) / 100;
    }

    const ledgerSum = ledgerRecords
      .filter((entry) => entry.restaurantId === store.restaurantId && entry.commissionAmount > 0)
      .reduce((acc, entry) => acc + entry.commissionAmount, 0);

    if (ledgerSum > 0) {
      return Math.round(ledgerSum * 100) / 100;
    }

    const activeFormula = formula || this.getDefaultFormula();
    const onboardBonus =
      activeFormula.firstRechargeBonusAmount > 0 ? activeFormula.firstRechargeBonusAmount : 500;

    let rechargeCommission = 0;
    let firstRechargeBonus = 0;

    if (this.isRechargeCommissionEligible(activeFormula.commissionModel)) {
      const rechargePct =
        activeFormula.rechargeCommissionPercent > 0 ? activeFormula.rechargeCommissionPercent : 5;
      rechargeCommission =
        store.totalRecharged > 0
          ? Math.round(store.totalRecharged * (rechargePct / 100) * 100) / 100
          : 0;

      const minThreshold =
        activeFormula.minRechargeThresholdForBonus > 0
          ? Math.min(activeFormula.minRechargeThresholdForBonus, 100)
          : 100;

      firstRechargeBonus =
        store.totalRecharged >= minThreshold && activeFormula.firstRechargeBonusAmount > 0
          ? activeFormula.firstRechargeBonusAmount
          : 0;
    }

    let orderFlatBonus = 0;
    if (this.isOrderFeeCommissionEligible(activeFormula.commissionModel)) {
      orderFlatBonus =
        store.totalOrdersCount > 0 && activeFormula.flatPerOrderBonus > 0
          ? Math.round(store.totalOrdersCount * activeFormula.flatPerOrderBonus * 100) / 100
          : 0;
    }

    return (
      Math.round(
        (onboardBonus + rechargeCommission + firstRechargeBonus + orderFlatBonus) * 100
      ) / 100
    );
  }

  reconcileStoresCommission(
    stores: SalesRestaurantListItem[],
    formula: SalesCommissionFormula,
    ledgerRecords: SalesEarningRecord[]
  ): SalesRestaurantListItem[] {
    return stores.map((store) => {
      if (store.commissionGeneratedTotal > 0) {
        return store;
      }
      return {
        ...store,
        commissionGeneratedTotal: this.calculateStoreCommission(store, formula, ledgerRecords),
      };
    });
  }
}
