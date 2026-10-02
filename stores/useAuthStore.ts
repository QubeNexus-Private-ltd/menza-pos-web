import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User, RestaurantDetail } from '@/types/auth';
import { isOwnerUser } from '@/lib/auth/permissions';
import { apiClient } from '@/lib/api/client';
import { APP_CONSTANTS } from '@/lib/constants';

interface AuthState {
  isHydrating: boolean;
  hasCompletedOnboarding: boolean;
  isAuthenticated: boolean;
  hasAcceptedTerms: boolean;
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  restaurants: RestaurantDetail[];
  activeRestaurant: RestaurantDetail | null;

  hydrateSession: () => Promise<boolean>;
  setCompletedOnboarding: (status: boolean) => void;
  setAuthData: (
    token: string,
    refreshToken: string,
    user: User,
    restaurants: RestaurantDetail[],
    activeRestId?: number,
    hasAcceptedTerms?: boolean
  ) => void;
  setHasAcceptedTerms: (status: boolean) => void;
  checkTermsStatus: () => Promise<boolean>;
  acceptTerms: () => Promise<boolean>;
  updateTokens: (token: string, refreshToken: string) => void;
  setRestaurants: (restaurants: RestaurantDetail[]) => void;
  setActiveRestaurant: (restaurant: RestaurantDetail) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isHydrating: false,
      hasCompletedOnboarding: true,
      isAuthenticated: false,
      hasAcceptedTerms: false,
      token: null,
      refreshToken: null,
      user: null,
      restaurants: [],
      activeRestaurant: null,

      hydrateSession: async () => {
        const state = get();
        if (state.isAuthenticated && state.token && state.user) {
          set({ isHydrating: false });
          return true;
        }

        if (typeof window !== 'undefined') {
          try {
            const token = localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
            const userStr = localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.USER_DATA);
            const activeRestStr = localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.ACTIVE_RESTAURANT);

            if (token && userStr) {
              const user = JSON.parse(userStr);
              const activeRest = activeRestStr ? JSON.parse(activeRestStr) : null;
              const isOwner = isOwnerUser(user?.roles);
              const hasAcceptedTerms = !isOwner || localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.CONSENT_ACCEPTED) === 'true';

              set({
                isHydrating: false,
                isAuthenticated: true,
                hasCompletedOnboarding: true,
                hasAcceptedTerms,
                token,
                user,
                activeRestaurant: activeRest,
              });
              return true;
            }
          } catch {
            // Ignore parse errors
          }
        }

        set({ isHydrating: false });
        return false;
      },

      setCompletedOnboarding: (status: boolean) => {
        set({ hasCompletedOnboarding: status });
      },

      setAuthData: (
        token,
        refreshToken,
        user,
        restaurants,
        activeRestId,
        hasAcceptedTermsExplicit
      ) => {
        let activeRest: RestaurantDetail | null = null;
        if (activeRestId) {
          activeRest = restaurants.find((r) => r.restaurantId === activeRestId) || null;
        }
        if (!activeRest && restaurants.length > 0) {
          activeRest = restaurants.find((r) => r.isDefault) || restaurants[0];
        }

        const isOwner = isOwnerUser(user.roles);
        const hasAcceptedTerms = !isOwner || Boolean(hasAcceptedTermsExplicit);

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, token);
            if (refreshToken) localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
            localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.USER_DATA, JSON.stringify(user));
            if (activeRest) {
              localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.ACTIVE_RESTAURANT, JSON.stringify(activeRest));
            }
            if (hasAcceptedTerms) {
              localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.CONSENT_ACCEPTED, 'true');
            }
          } catch {
            // Storage quota safe
          }
        }

        set({
          isAuthenticated: true,
          hasCompletedOnboarding: true,
          hasAcceptedTerms,
          token,
          refreshToken,
          user,
          restaurants,
          activeRestaurant: activeRest,
        });

        // If terms acceptance was not resolved and user is owner, check backend
        if (typeof hasAcceptedTermsExplicit !== 'boolean' && isOwner && !hasAcceptedTerms && user?.userId) {
          get().checkTermsStatus().catch(() => {});
        }
      },

      setHasAcceptedTerms: (status: boolean) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.CONSENT_ACCEPTED, status ? 'true' : 'false');
        }
        set({ hasAcceptedTerms: status });
      },

      checkTermsStatus: async () => {
        const { user, token } = get();
        if (!user?.userId) return false;
        if (!isOwnerUser(user.roles)) {
          set({ hasAcceptedTerms: true });
          return true;
        }

        try {
          const res = await apiClient.get('/Owner/term-condition', {
            params: { userId: user.userId },
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          });
          const isAccepted = Boolean(res.data?.isTermConditionChecked);
          if (isAccepted) {
            get().setHasAcceptedTerms(true);
          }
          return isAccepted;
        } catch {
          return get().hasAcceptedTerms;
        }
      },

      acceptTerms: async () => {
        const { user, token } = get();
        if (!user?.userId) return false;

        try {
          const res = await apiClient.post(
            '/Owner/term-condition',
            { userId: user.userId, isChecked: true },
            { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
          );
          const success = res.data?.success ?? true;
          if (success) {
            get().setHasAcceptedTerms(true);
          }
          return success;
        } catch (err) {
          console.warn('[AuthStore] Failed to accept terms:', err);
          throw err;
        }
      },

      updateTokens: (token, refreshToken) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, token);
          localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
        }
        set({ token, refreshToken });
      },

      setRestaurants: (restaurants) => {
        set((state) => {
          let activeRest = state.activeRestaurant;
          if (activeRest) {
            const found = restaurants.find((r) => r.restaurantId === activeRest?.restaurantId);
            activeRest = found || null;
          }
          if (!activeRest && restaurants.length > 0) {
            activeRest = restaurants.find((r) => r.isDefault) || restaurants[0];
          }
          if (typeof window !== 'undefined' && activeRest) {
            localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.ACTIVE_RESTAURANT, JSON.stringify(activeRest));
          }
          return { restaurants, activeRestaurant: activeRest };
        });
      },

      setActiveRestaurant: (restaurant) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.ACTIVE_RESTAURANT, JSON.stringify(restaurant));
        }
        set({ activeRestaurant: restaurant });
      },

      logout: () => {
        const { token, refreshToken } = get();

        // Call backend logout asynchronously
        if (token) {
          apiClient
            .post('/Auth/Logout', { token, refreshToken })
            .catch(() => {});
        }

        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
            localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.REFRESH_TOKEN);
            localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.USER_DATA);
            localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.ACTIVE_RESTAURANT);
            localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.CONSENT_ACCEPTED);
            localStorage.removeItem('menza_auth_store');
          } catch {
            // Safe
          }
        }

        set({
          isAuthenticated: false,
          token: null,
          refreshToken: null,
          user: null,
          restaurants: [],
          activeRestaurant: null,
          hasAcceptedTerms: false,
        });
      },
    }),
    {
      name: 'menza_auth_store',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : (null as any))),
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        restaurants: state.restaurants,
        activeRestaurant: state.activeRestaurant,
        hasAcceptedTerms: state.hasAcceptedTerms,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
