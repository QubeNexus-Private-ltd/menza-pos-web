import { create } from 'zustand';
import {
  RestaurantSubscriptionHistory,
  SubscriptionPlan,
  UserSubscriptionStatus,
  SubscriptionLifecycleState,
  PlanChangeType,
} from '../../domain/models/Subscription';
import { SubscriptionRemoteDataSource } from '../../data/datasources/SubscriptionRemoteDataSource';
import { SubscriptionRepositoryImpl } from '../../data/repositories/SubscriptionRepositoryImpl';
import { SubscriptionEvents } from '../../core/utils/subscriptionEvents';
import { useAuthStore } from './useAuthStore';

const subscriptionRepo = new SubscriptionRepositoryImpl(new SubscriptionRemoteDataSource());

export interface PlanChangeCalculation {
  changeType: PlanChangeType;
  proratedRefund: number;
  newExpiryDate: string;
  durationDays: number;
  isSamePlan: boolean;
}

interface SubscriptionStoreState {
  subscription: UserSubscriptionStatus | null;
  plans: SubscriptionPlan[];
  history: RestaurantSubscriptionHistory[];
  isLoading: boolean;
  isHistoryLoading: boolean;
  error: string | null;

  // Computed Convenience Flags
  lifecycleState: SubscriptionLifecycleState;
  daysRemaining: number;
  isInGracePeriod: boolean;
  graceDaysRemaining: number;
  isExpired: boolean;

  // Flow State
  pendingOrderId: string | null;
  isRenewalModalOpen: boolean;
  expiredPromptVisible: boolean;
  expiredPromptMessage: string | null;
  selectedPlanForAction: {
    plan: SubscriptionPlan;
    calculation: PlanChangeCalculation;
  } | null;

  // Actions
  fetchSubscriptionStatus: (restaurantId?: number) => Promise<UserSubscriptionStatus | null>;
  fetchPlans: () => Promise<SubscriptionPlan[]>;
  fetchSubscriptionHistory: (restaurantId?: number) => Promise<RestaurantSubscriptionHistory[]>;
  openRenewalModal: (targetPlan?: SubscriptionPlan) => void;
  closeRenewalModal: () => void;
  showExpiredPrompt: (message?: string) => void;
  dismissExpiredPrompt: () => void;
  setPendingOrderId: (orderId: string | null) => void;
  calculatePlanChange: (targetPlan: SubscriptionPlan) => PlanChangeCalculation;
  hasEntitlement: (configKey: string) => boolean;
  canTakeOrders: () => boolean;
  reset: () => void;
}

export const useSubscriptionStore = create<SubscriptionStoreState>((set, get) => {
  // Listen for global HTTP 402 or SUBSCRIPTION_EXPIRED events emitted by apiClient
  SubscriptionEvents.subscribeExpired((message) => {
    get().showExpiredPrompt(message);
    const curr = get().subscription;
    if (curr) {
      set({
        lifecycleState: 'EXPIRED',
        isExpired: true,
        isInGracePeriod: false,
        subscription: {
          ...curr,
          isExpired: true,
          status: 'Expired',
          lifecycleState: 'EXPIRED',
        },
      });
    }
  });

  return {
    subscription: null,
    plans: [],
    history: [],
    isLoading: false,
    isHistoryLoading: false,
    error: null,

    lifecycleState: 'NONE',
    daysRemaining: 0,
    isInGracePeriod: false,
    graceDaysRemaining: 0,
    isExpired: false,

    pendingOrderId: null,
    isRenewalModalOpen: false,
    expiredPromptVisible: false,
    expiredPromptMessage: null,
    selectedPlanForAction: null,

    fetchSubscriptionStatus: async (restaurantId?: number) => {
      const activeRestId =
        restaurantId ||
        useAuthStore.getState().activeRestaurant?.restaurantId ||
        (globalThis as any).__MENZA_ACTIVE_REST_ID__ ||
        0;

      if (!activeRestId || activeRestId <= 0) {
        set({
          subscription: null,
          lifecycleState: 'NONE',
          daysRemaining: 0,
          isInGracePeriod: false,
          graceDaysRemaining: 0,
          isExpired: false,
        });
        return null;
      }

      try {
        set({ isLoading: true, error: null });
        const sub = await subscriptionRepo.getRestaurantSubscription(activeRestId);

        if (!sub) {
          set({
            subscription: null,
            lifecycleState: 'NONE',
            daysRemaining: 0,
            isInGracePeriod: false,
            graceDaysRemaining: 0,
            isExpired: false,
            isLoading: false,
          });
          return null;
        }

        const now = new Date();
        const endDate = new Date(sub.endDate);
        const effectiveEndDate = sub.hasQueuedRenewal && sub.effectiveCoverageEndDate
          ? new Date(sub.effectiveCoverageEndDate)
          : endDate;

        const rawDaysRem = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const totalDaysRem = sub.hasQueuedRenewal && sub.totalDaysRemaining !== undefined
          ? sub.totalDaysRemaining
          : Math.ceil((effectiveEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        const daysRem = sub.hasQueuedRenewal ? totalDaysRem : rawDaysRem;
        const graceEnd = new Date(effectiveEndDate.getTime() + 3 * 24 * 60 * 60 * 1000);

        const inGrace = !sub.hasQueuedRenewal &&
          (sub.isInGracePeriod ??
          (sub.lifecycleState === 'GRACE_PERIOD' ||
            sub.status?.toUpperCase() === 'GRACE_PERIOD' ||
            (now > endDate && now <= graceEnd)));

        const graceRem =
          sub.graceDaysRemaining ??
          (inGrace ? Math.max(0, Math.ceil((graceEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0);

        const expired = !sub.hasQueuedRenewal &&
          (sub.isExpired ||
          sub.lifecycleState === 'EXPIRED' ||
          sub.status?.toUpperCase() === 'EXPIRED' ||
          (!inGrace && now > graceEnd && daysRem <= 0));

        let lifecycle: SubscriptionLifecycleState = sub.lifecycleState || 'ACTIVE';
        if (sub.status?.toUpperCase() === 'PENDING') lifecycle = 'PENDING';
        else if (expired) lifecycle = 'EXPIRED';
        else if (inGrace) lifecycle = 'GRACE_PERIOD';
        else lifecycle = 'ACTIVE';

        const updatedSub: UserSubscriptionStatus = {
          ...sub,
          daysRemaining: daysRem,
          totalDaysRemaining: totalDaysRem,
          currentCycleDaysRemaining: rawDaysRem,
          isInGracePeriod: inGrace,
          graceDaysRemaining: graceRem,
          isExpired: expired,
          lifecycleState: lifecycle,
        };

        set({
          subscription: updatedSub,
          lifecycleState: lifecycle,
          daysRemaining: daysRem,
          isInGracePeriod: inGrace,
          graceDaysRemaining: graceRem,
          isExpired: expired,
          isLoading: false,
        });

        return updatedSub;
      } catch (err: any) {
        set({ error: err?.message || 'Failed to fetch subscription status', isLoading: false });
        return null;
      }
    },

    fetchPlans: async () => {
      try {
        set({ isLoading: true });
        const plans = await subscriptionRepo.getPlans();
        set({ plans: plans || [], isLoading: false });
        return plans || [];
      } catch (err: any) {
        set({ plans: [], error: err?.message || 'Failed to fetch plans', isLoading: false });
        return [];
      }
    },

    fetchSubscriptionHistory: async (restaurantId?: number) => {
      const activeRestId =
        restaurantId ||
        useAuthStore.getState().activeRestaurant?.restaurantId ||
        (globalThis as any).__MENZA_ACTIVE_REST_ID__ ||
        0;

      if (!activeRestId || activeRestId <= 0) {
        set({ history: [] });
        return [];
      }

      try {
        set({ isHistoryLoading: true });
        const list = await subscriptionRepo.getSubscriptionHistory(activeRestId);
        set({ history: list || [], isHistoryLoading: false });
        return list || [];
      } catch (err: any) {
        set({ history: [], isHistoryLoading: false });
        return [];
      }
    },

    calculatePlanChange: (targetPlan: SubscriptionPlan): PlanChangeCalculation => {
      const { subscription } = get();
      const durationDays = targetPlan.durationDays || targetPlan.durationInDays || 30;

      // Scenario 1: No previous active subscription or expired beyond grace period
      if (!subscription || subscription.isExpired || subscription.daysRemaining <= 0) {
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + durationDays);
        return {
          changeType: 'FRESH',
          proratedRefund: 0,
          newExpiryDate: newExpiry.toISOString(),
          durationDays,
          isSamePlan: false,
        };
      }

      const isSamePlan = subscription.subscriptionConfigurationId === targetPlan.id;

      // Scenario 2: Renewing same plan - extension from current end date
      if (isSamePlan) {
        const currentEnd = new Date(subscription.endDate);
        const newEnd = new Date(currentEnd.getTime() + durationDays * 24 * 60 * 60 * 1000);
        return {
          changeType: 'RENEW',
          proratedRefund: 0,
          newExpiryDate: newEnd.toISOString(),
          durationDays,
          isSamePlan: true,
        };
      }

      // Scenario 3: Switching / Upgrading mid-cycle to a different plan
      // Prorated refund for remaining unused days of current plan credited to wallet
      const originalAmount = subscription.amountPaid && subscription.amountPaid > 0 ? subscription.amountPaid : 1499;
      const dailyRate = originalAmount / 30;
      const unusedDays = Math.max(0, subscription.daysRemaining);
      const proratedRefund = Math.round(dailyRate * unusedDays * 100) / 100;

      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + durationDays);

      return {
        changeType: 'UPGRADE',
        proratedRefund,
        newExpiryDate: newExpiry.toISOString(),
        durationDays,
        isSamePlan: false,
      };
    },

    openRenewalModal: (targetPlan?: SubscriptionPlan) => {
      if (targetPlan) {
        const calculation = get().calculatePlanChange(targetPlan);
        set({
          isRenewalModalOpen: true,
          selectedPlanForAction: { plan: targetPlan, calculation },
        });
      } else {
        set({ isRenewalModalOpen: true, selectedPlanForAction: null });
      }
    },

    closeRenewalModal: () => {
      set({ isRenewalModalOpen: false, selectedPlanForAction: null });
    },

    showExpiredPrompt: (message?: string) => {
      set({
        expiredPromptVisible: true,
        expiredPromptMessage:
          message || 'Your subscription has expired beyond the grace period. Please renew to continue taking orders.',
      });
    },

    dismissExpiredPrompt: () => {
      set({ expiredPromptVisible: false, expiredPromptMessage: null });
    },

    setPendingOrderId: (orderId: string | null) => {
      set({ pendingOrderId: orderId });
    },

    hasEntitlement: (configKey: string): boolean => {
      const { subscription, lifecycleState } = get();
      // If expired beyond grace period, all entitlements blocked
      if (lifecycleState === 'EXPIRED') return false;
      if (!subscription) return true; // Default permissive fallback if no sub loaded yet

      const entitlements = subscription.entitlements || [];
      const item = entitlements.find(
        (e) => e.configKey?.toLowerCase() === configKey.toLowerCase()
      );
      return item ? item.isAllowed : true;
    },

    canTakeOrders: (): boolean => {
      const { lifecycleState } = get();
      return lifecycleState !== 'EXPIRED';
    },

    reset: () => {
      set({
        subscription: null,
        plans: [],
        history: [],
        isLoading: false,
        isHistoryLoading: false,
        error: null,
        lifecycleState: 'NONE',
        daysRemaining: 0,
        isInGracePeriod: false,
        graceDaysRemaining: 0,
        isExpired: false,
        pendingOrderId: null,
        isRenewalModalOpen: false,
        expiredPromptVisible: false,
        expiredPromptMessage: null,
        selectedPlanForAction: null,
      });
    },
  };
});
