import { create } from 'zustand';
import {
  SubscriptionPlan,
  UserSubscriptionStatus,
  SubscriptionLifecycleState,
  RestaurantSubscriptionHistory,
} from '@/types/subscription';
import { SubscriptionService } from '@/services/subscriptionService';
import { useAuthStore } from '@shared/presentation/state/useAuthStore';
import { WalletEvents } from '@shared/core/utils/walletEvents';

interface SubscriptionStoreState {
  subscription: UserSubscriptionStatus | null;
  plans: SubscriptionPlan[];
  history: RestaurantSubscriptionHistory[];
  isLoading: boolean;
  isPlansLoading: boolean;
  isHistoryLoading: boolean;
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
  activeModalTab: 'renew' | 'explore' | 'history';

  // Actions
  fetchSubscriptionStatus: (restaurantId?: number) => Promise<UserSubscriptionStatus | null>;
  fetchPlans: () => Promise<SubscriptionPlan[]>;
  fetchSubscriptionHistory: (restaurantId?: number) => Promise<RestaurantSubscriptionHistory[]>;
  openRenewalModal: (plan?: SubscriptionPlan, initialTab?: 'renew' | 'explore' | 'history') => void;
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
    gateway?: string;
    keyId?: string;
    amount?: number;
    currency?: string;
    message?: string;
  }>;
  verifyPayment: (
    orderId: string,
    restaurantId?: number,
    subscriptionConfigurationId?: number,
    amountPaid?: number,
    razorpayPaymentId?: string,
    razorpaySignature?: string
  ) => Promise<{ success: boolean; isPaid: boolean; message?: string }>;
  canTakeOrders: () => boolean;
  hasEntitlement: (configKey: string) => boolean;
  reset: () => void;
}

export const useSubscriptionStore = create<SubscriptionStoreState>((set, get) => ({
  subscription: null,
  plans: [],
  history: [],
  isLoading: false,
  isPlansLoading: false,
  isHistoryLoading: false,
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
  activeModalTab: 'renew',

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
          isExpired: false,
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
      const isTransient = err?.response?.status === 429 || err?.status === 429 || !err?.response;
      set((state) => ({
        error: err?.message || 'Failed to fetch subscription status',
        isLoading: false,
        hasLoaded: state.subscription ? true : !isTransient,
        isNoSubscription: state.subscription ? false : !isTransient,
      }));
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

  fetchSubscriptionHistory: async (restaurantId?: number) => {
    const authRestId = useAuthStore.getState().activeRestaurant?.restaurantId;
    const fallbackRestId = useAuthStore.getState().restaurants?.[0]?.restaurantId;
    const targetRestId = restaurantId || authRestId || fallbackRestId || 0;
    if (!targetRestId || targetRestId <= 0) {
      set({ history: [], isHistoryLoading: false });
      return [];
    }

    try {
      set({ isHistoryLoading: true });
      const historyData = await SubscriptionService.getSubscriptionHistory(targetRestId);
      const validHistory = Array.isArray(historyData) ? historyData : [];
      set({ history: validHistory, isHistoryLoading: false });
      return validHistory;
    } catch {
      set({ isHistoryLoading: false });
      return [];
    }
  },

  openRenewalModal: (plan?: SubscriptionPlan, initialTab?: 'renew' | 'explore' | 'history') => {
    const hasSub = Boolean(get().subscription);
    set({
      isRenewalModalOpen: true,
      selectedPlan: plan || null,
      activeModalTab: initialTab || (hasSub ? 'renew' : 'explore'),
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
        try {
          WalletEvents.emit();
        } catch (e) {
          console.warn('Error emitting WalletEvents on assignPlan:', e);
        }
        await get().fetchSubscriptionStatus(restaurantId);
        await get().fetchSubscriptionHistory(restaurantId);
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

  verifyPayment: async (
    orderId: string,
    restaurantId?: number,
    subscriptionConfigurationId?: number,
    amountPaid?: number,
    razorpayPaymentId?: string,
    razorpaySignature?: string
  ) => {
    const res = await SubscriptionService.verifyCashFreePayment(
      orderId,
      restaurantId,
      subscriptionConfigurationId,
      amountPaid,
      razorpayPaymentId,
      razorpaySignature
    );
    if (res?.success || res?.isPaid) {
      try {
        WalletEvents.emit();
      } catch (e) {
        console.warn('Error emitting WalletEvents on verifyPayment:', e);
      }
    }
    return res;
  },

  canTakeOrders: () => {
    const { subscription, lifecycleState, isExpired, isNoSubscription, hasLoaded } = get();
    // If not loaded yet, allow flow to proceed rather than prematurely blocking
    if (!hasLoaded) {
      return true;
    }
    // Block if verified no active subscription or expired beyond grace period
    if (isNoSubscription || !subscription || lifecycleState === 'NONE' || lifecycleState === 'EXPIRED' || isExpired) {
      return false;
    }
    return true;
  },

  hasEntitlement: (configKey: string): boolean => {
    const { subscription, lifecycleState, isExpired, isNoSubscription, hasLoaded } = get();
    if (!hasLoaded) {
      return true;
    }
    if (isNoSubscription || !subscription || lifecycleState === 'NONE' || lifecycleState === 'EXPIRED' || isExpired) {
      return false;
    }
    const entitlements = subscription.entitlements || [];
    const item = entitlements.find(
      (e: any) => (e.configKey || e.ConfigKey || '').toLowerCase() === configKey.toLowerCase()
    );
    return item ? Boolean(item.isAllowed ?? (item as any).IsAllowed) : true;
  },

  reset: () => {
    set({
      subscription: null,
      plans: [],
      history: [],
      isLoading: false,
      isPlansLoading: false,
      isHistoryLoading: false,
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
