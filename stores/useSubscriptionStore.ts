import { create } from 'zustand';
import {
  SubscriptionPlan,
  UserSubscriptionStatus,
  SubscriptionLifecycleState,
} from '@/types/subscription';
import { SubscriptionService } from '@/services/subscriptionService';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';

interface SubscriptionStoreState {
  subscription: UserSubscriptionStatus | null;
  plans: SubscriptionPlan[];
  isLoading: boolean;
  isPlansLoading: boolean;
  error: string | null;
  hasLoaded: boolean;

  // Computed Convenience Flags
  lifecycleState: SubscriptionLifecycleState;
  daysRemaining: number;
  isInGracePeriod: boolean;
  graceDaysRemaining: number;
  isExpired: boolean;
  isNoSubscription: boolean;

  // UI Flow State
  isRenewalModalOpen: boolean;
  selectedPlan: SubscriptionPlan | null;

  // Actions
  fetchSubscriptionStatus: (restaurantId?: number) => Promise<UserSubscriptionStatus | null>;
  fetchPlans: () => Promise<SubscriptionPlan[]>;
  openRenewalModal: (plan?: SubscriptionPlan) => void;
  closeRenewalModal: () => void;
  setExpired: (expired: boolean) => void;
  assignPlan: (
    restaurantId: number,
    planId: number,
    durationDays?: number,
    price?: number
  ) => Promise<{ success: boolean; message?: string }>;
  initiateCashFreePayment: (
    restaurantId: number,
    planId: number,
    amount: number,
    mobileNumber?: string
  ) => Promise<{
    success: boolean;
    orderId?: string;
    paymentSessionId?: string;
    paymentLink?: string;
    message?: string;
  }>;
  verifyPayment: (orderId: string) => Promise<{ success: boolean; isPaid: boolean; message?: string }>;
  canTakeOrders: () => boolean;
  hasEntitlement: (configKey: string) => boolean;
  reset: () => void;
}

export const useSubscriptionStore = create<SubscriptionStoreState>((set, get) => ({
  subscription: null,
  plans: [],
  isLoading: false,
  isPlansLoading: false,
  error: null,
  hasLoaded: false,

  lifecycleState: 'NONE',
  daysRemaining: 0,
  isInGracePeriod: false,
  graceDaysRemaining: 0,
  isExpired: false,
  isNoSubscription: true,

  isRenewalModalOpen: false,
  selectedPlan: null,

  fetchSubscriptionStatus: async (restaurantId?: number) => {
    const authRestId = useAuthStore.getState().activeRestaurant?.restaurantId;
    const fallbackRestId = useAuthStore.getState().restaurants?.[0]?.restaurantId;
    const targetRestId = restaurantId || authRestId || fallbackRestId || 0;

    if (!targetRestId || targetRestId <= 0) {
      set({
        subscription: null,
        lifecycleState: 'NONE',
        daysRemaining: 0,
        isInGracePeriod: false,
        graceDaysRemaining: 0,
        isExpired: false,
        isNoSubscription: true,
        hasLoaded: false,
      });
      return null;
    }

    try {
      set({ isLoading: true, error: null });
      const sub = await SubscriptionService.getRestaurantSubscription(targetRestId);

      // If restaurant has no subscription record at all
      if (!sub) {
        set({
          subscription: null,
          lifecycleState: 'NONE',
          daysRemaining: 0,
          isInGracePeriod: false,
          graceDaysRemaining: 0,
          isExpired: true,
          isNoSubscription: true,
          hasLoaded: true,
          isLoading: false,
        });
        return null;
      }

      const now = new Date();
      const endDate = new Date(sub.endDate || sub.expiryDate || Date.now());
      const rawDaysRem = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const daysRem = sub.daysRemaining !== undefined ? sub.daysRemaining : rawDaysRem;

      const inGrace = Boolean(
        sub.isInGracePeriod || sub.lifecycleState === 'GRACE_PERIOD' || sub.status === 'Grace Period'
      );
      const graceRem =
        sub.graceDaysRemaining !== undefined ? sub.graceDaysRemaining : inGrace ? Math.max(0, 3 + daysRem) : 0;
      const expired = Boolean(
        sub.isExpired || sub.lifecycleState === 'EXPIRED' || sub.status === 'Expired' || (!inGrace && daysRem <= 0)
      );

      let lifecycle: SubscriptionLifecycleState = sub.lifecycleState || 'ACTIVE';
      if (expired) lifecycle = 'EXPIRED';
      else if (inGrace) lifecycle = 'GRACE_PERIOD';
      else if (sub.status?.toUpperCase() === 'PENDING') lifecycle = 'PENDING';
      else lifecycle = 'ACTIVE';

      const updatedSub: UserSubscriptionStatus = {
        ...sub,
        daysRemaining: daysRem,
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
        isNoSubscription: false,
        hasLoaded: true,
        isLoading: false,
      });

      return updatedSub;
    } catch (err: any) {
      set({
        error: err?.message || 'Failed to fetch subscription status',
        isLoading: false,
        hasLoaded: true,
      });
      return null;
    }
  },

  fetchPlans: async () => {
    try {
      set({ isPlansLoading: true });
      const rawPlans = await SubscriptionService.getPlans();
      const activePlans = Array.isArray(rawPlans) ? rawPlans.filter((p) => p.isActive) : [];
      set({ plans: activePlans, isPlansLoading: false });
      return activePlans;
    } catch {
      set({ isPlansLoading: false });
      return [];
    }
  },

  openRenewalModal: (plan?: SubscriptionPlan) => {
    set({
      isRenewalModalOpen: true,
      selectedPlan: plan || null,
    });
  },

  closeRenewalModal: () => {
    set({
      isRenewalModalOpen: false,
      selectedPlan: null,
    });
  },

  setExpired: (expired: boolean) => {
    set((state) => ({
      isExpired: expired,
      lifecycleState: expired ? 'EXPIRED' : state.lifecycleState === 'EXPIRED' ? 'ACTIVE' : state.lifecycleState,
      isRenewalModalOpen: expired ? true : state.isRenewalModalOpen,
    }));
  },

  assignPlan: async (restaurantId: number, planId: number, durationDays = 30, price = 0) => {
    try {
      set({ isLoading: true, error: null });
      const res = await SubscriptionService.assignSubscription(restaurantId, planId, durationDays, price);

      if (res.success) {
        await get().fetchSubscriptionStatus(restaurantId);
        set({ isRenewalModalOpen: false });
      } else {
        set({ error: res.message || 'Failed to activate plan' });
      }

      set({ isLoading: false });
      return res;
    } catch (err: any) {
      const msg = err?.message || 'Failed to activate subscription plan';
      set({ error: msg, isLoading: false });
      return { success: false, message: msg };
    }
  },

  initiateCashFreePayment: async (restaurantId: number, planId: number, amount: number, mobileNumber?: string) => {
    return await SubscriptionService.initiateCashFreePayment(restaurantId, planId, amount, mobileNumber);
  },

  verifyPayment: async (orderId: string) => {
    return await SubscriptionService.verifyCashFreePayment(orderId);
  },

  canTakeOrders: () => {
    const { subscription, lifecycleState, isExpired } = get();
    // If no subscription at all, or expired, orders must be strictly blocked
    if (!subscription || lifecycleState === 'NONE' || lifecycleState === 'EXPIRED' || isExpired) {
      return false;
    }
    return true;
  },

  hasEntitlement: (configKey: string): boolean => {
    const { subscription, lifecycleState, isExpired } = get();
    if (!subscription || lifecycleState === 'NONE' || lifecycleState === 'EXPIRED' || isExpired) {
      return false;
    }
    const entitlements = subscription.entitlements || [];
    const item = entitlements.find((e) => (e.configKey || '').toLowerCase() === configKey.toLowerCase());
    return item ? Boolean(item.isAllowed) : true;
  },

  reset: () => {
    set({
      subscription: null,
      plans: [],
      isLoading: false,
      isPlansLoading: false,
      error: null,
      hasLoaded: false,
      lifecycleState: 'NONE',
      daysRemaining: 0,
      isInGracePeriod: false,
      graceDaysRemaining: 0,
      isExpired: false,
      isNoSubscription: true,
      isRenewalModalOpen: false,
      selectedPlan: null,
    });
  },
}));
