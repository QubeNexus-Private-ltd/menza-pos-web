import { create } from 'zustand';
import { User } from '../../domain/models/User';
import { RestaurantDetail } from '../../domain/models/Restaurant';
import { logger } from '../../core/logging';
import { SessionStorage } from '../../core/storage/SessionStorage';
import { AuthRemoteDataSource } from '../../data/datasources/AuthRemoteDataSource';

interface AuthState {
  isHydrating: boolean;
  hasCompletedOnboarding: boolean;
  isAuthenticated: boolean;
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  restaurants: RestaurantDetail[];
  activeRestaurant: RestaurantDetail | null;

  hydrateSession: () => Promise<boolean>;
  setCompletedOnboarding: (status: boolean) => void;
  setAuthData: (token: string, refreshToken: string, user: User, restaurants: RestaurantDetail[], activeRestId?: number) => void;
  updateTokens: (token: string, refreshToken: string) => void;
  setRestaurants: (restaurants: RestaurantDetail[]) => void;
  setActiveRestaurant: (restaurant: RestaurantDetail) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isHydrating: true,
  hasCompletedOnboarding: false,
  isAuthenticated: false,
  token: null,
  refreshToken: null,
  user: null,
  restaurants: [],
  activeRestaurant: null,

  hydrateSession: async () => {
    // Fast path: if state is already authenticated with valid user, skip redundant storage read
    const state = get();
    if (state.isAuthenticated && state.token && state.user) {
      return true;
    }

    try {
      logger.auth('APP_ONBOARDING_CHECK', 'Hydrating auth session from SessionStorage');
      const session = await SessionStorage.loadSession();

      if (!session.hasCompletedOnboarding) {
        set({ isHydrating: false, hasCompletedOnboarding: false });
        return false;
      }

      if (session.token && session.user) {
        logger.auth('AUTH_SESSION_CREATED', 'Successfully restored user session from persistent storage', {
          userId: session.user.id,
          name: session.user.name,
          activeRestaurantId: session.activeRestaurant?.restaurantId,
        });

        // Populate global execution context
        (globalThis as any).__MENZA_AUTH_TOKEN__ = session.token;
        (globalThis as any).__MENZA_REFRESH_TOKEN__ = session.refreshToken;
        (globalThis as any).__MENZA_ACTIVE_REST_ID__ = session.activeRestaurant?.restaurantId || null;

        logger.setUserId(session.user.id);
        if (session.activeRestaurant?.restaurantId) {
          logger.setRestaurantId(session.activeRestaurant.restaurantId);
        }

        set({
          isHydrating: false,
          hasCompletedOnboarding: true,
          isAuthenticated: true,
          token: session.token,
          refreshToken: session.refreshToken,
          user: session.user,
          restaurants: session.restaurants,
          activeRestaurant: session.activeRestaurant,
        });
        return true;
      }

      set({ isHydrating: false, hasCompletedOnboarding: true });
      return false;
    } catch (e) {
      logger.api('API_ERROR', 'Failed to hydrate auth session from storage', { error: String(e) });
      set({ isHydrating: false });
      return false;
    }
  },

  setCompletedOnboarding: (status: boolean) => {
    logger.auth('ONBOARDING_COMPLETED', `User completed onboarding: ${status}`);
    SessionStorage.saveOnboardingCompleted(status);
    set({ hasCompletedOnboarding: status });
  },

  setAuthData: (token, refreshToken, user, restaurants, activeRestId) => {
    logger.auth('AUTH_SESSION_CREATED', `Setting authentication session for user: ${user.name} (${user.mobile})`, {
      userId: user.id,
      roles: user.roles,
      restaurantCount: restaurants.length,
    });

    let activeRest: RestaurantDetail | null = null;
    if (activeRestId) {
      activeRest = restaurants.find((r) => r.restaurantId === activeRestId) || null;
    }
    if (!activeRest && restaurants.length > 0) {
      activeRest = restaurants.find((r) => r.isDefault) || restaurants[0];
    }

    // Populate globals
    (globalThis as any).__MENZA_AUTH_TOKEN__ = token;
    (globalThis as any).__MENZA_REFRESH_TOKEN__ = refreshToken;
    (globalThis as any).__MENZA_ACTIVE_REST_ID__ = activeRest?.restaurantId || null;

    logger.setUserId(user.id);
    if (activeRest?.restaurantId) {
      logger.setRestaurantId(activeRest.restaurantId);
    }

    SessionStorage.saveSession({
      token,
      refreshToken,
      user,
      restaurants,
      activeRestaurant: activeRest,
      hasCompletedOnboarding: true,
    });

    set({
      isAuthenticated: true,
      hasCompletedOnboarding: true,
      token,
      refreshToken,
      user,
      restaurants,
      activeRestaurant: activeRest,
    });
  },

  updateTokens: (token, refreshToken) => {
    logger.auth('TOKEN_REFRESH_SUCCESS', 'Tokens updated in memory and storage');
    (globalThis as any).__MENZA_AUTH_TOKEN__ = token;
    (globalThis as any).__MENZA_REFRESH_TOKEN__ = refreshToken;
    SessionStorage.saveTokens(token, refreshToken);
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

      (globalThis as any).__MENZA_ACTIVE_REST_ID__ = activeRest?.restaurantId || null;
      if (activeRest?.restaurantId) {
        logger.setRestaurantId(activeRest.restaurantId);
      }

      SessionStorage.saveRestaurants(restaurants);
      return {
        restaurants,
        activeRestaurant: activeRest,
      };
    });
  },

  setActiveRestaurant: (restaurant) => {
    (globalThis as any).__MENZA_ACTIVE_REST_ID__ = restaurant.restaurantId;
    logger.setRestaurantId(restaurant.restaurantId);
    SessionStorage.saveActiveRestaurant(restaurant);
    set({ activeRestaurant: restaurant });
  },

  logout: () => {
    logger.auth('LOGOUT_STARTED', 'Initiating user logout process');
    const currentToken = get().token || (globalThis as any).__MENZA_AUTH_TOKEN__;
    const currentRefreshToken = get().refreshToken || (globalThis as any).__MENZA_REFRESH_TOKEN__;

    // Call backend logout API asynchronously to revoke token & session
    if (currentToken) {
      new AuthRemoteDataSource().logout(currentToken, currentRefreshToken).catch((err) => {
        logger.api('API_ERROR', 'Remote logout failed or network unreachable', { error: String(err) });
      });
    }

    (globalThis as any).__MENZA_AUTH_TOKEN__ = null;
    (globalThis as any).__MENZA_REFRESH_TOKEN__ = null;
    (globalThis as any).__MENZA_ACTIVE_REST_ID__ = null;
    logger.setUserId(undefined);
    logger.setRestaurantId(undefined);

    SessionStorage.clearSession();

    set({
      isAuthenticated: false,
      token: null,
      refreshToken: null,
      user: null,
      restaurants: [],
      activeRestaurant: null,
    });
    logger.auth('LOGOUT_COMPLETED', 'User logout completed successfully');
  },
}));
