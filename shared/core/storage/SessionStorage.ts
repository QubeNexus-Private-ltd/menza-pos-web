import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../../domain/models/User';
import { RestaurantDetail } from '../../domain/models/Restaurant';
import { logger } from '../logging';

const STORAGE_KEYS = {
  TOKEN: '@menza_session_token',
  REFRESH_TOKEN: '@menza_session_refresh_token',
  USER: '@menza_session_user',
  RESTAURANTS: '@menza_session_restaurants',
  ACTIVE_RESTAURANT: '@menza_session_active_restaurant',
  ONBOARDING_COMPLETED: '@menza_has_completed_onboarding',
  TERMS_ACCEPTED: '@menza_has_accepted_terms',
};

export interface PersistedSession {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  restaurants: RestaurantDetail[];
  activeRestaurant: RestaurantDetail | null;
  hasCompletedOnboarding: boolean;
  hasAcceptedTerms: boolean;
}

export class SessionStorage {
  /**
   * Persist full user session after successful login / OTP verification
   */
  static async saveSession(session: {
    token: string;
    refreshToken: string;
    user: User;
    restaurants: RestaurantDetail[];
    activeRestaurant?: RestaurantDetail | null;
    hasCompletedOnboarding?: boolean;
    hasAcceptedTerms?: boolean;
  }): Promise<void> {
    try {
      const items: [string, string][] = [
        [STORAGE_KEYS.TOKEN, session.token || ''],
        [STORAGE_KEYS.REFRESH_TOKEN, session.refreshToken || ''],
        [STORAGE_KEYS.USER, JSON.stringify(session.user || null)],
        [STORAGE_KEYS.RESTAURANTS, JSON.stringify(session.restaurants || [])],
        [STORAGE_KEYS.ONBOARDING_COMPLETED, 'true'],
        [STORAGE_KEYS.TERMS_ACCEPTED, session.hasAcceptedTerms ? 'true' : 'false'],
      ];

      if (session.activeRestaurant) {
        items.push([STORAGE_KEYS.ACTIVE_RESTAURANT, JSON.stringify(session.activeRestaurant)]);
      }

      await AsyncStorage.multiSet(items);
      logger.auth('AUTH_SESSION_CREATED', 'Session stored securely in AsyncStorage');
    } catch (err: any) {
      logger.api('API_ERROR', 'Failed to persist session in AsyncStorage', { error: err?.message });
    }
  }

  /**
   * Load persisted session on app launch
   */
  static async loadSession(): Promise<PersistedSession> {
    try {
      const keys = [
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER,
        STORAGE_KEYS.RESTAURANTS,
        STORAGE_KEYS.ACTIVE_RESTAURANT,
        STORAGE_KEYS.ONBOARDING_COMPLETED,
        STORAGE_KEYS.TERMS_ACCEPTED,
      ];

      const stores = await AsyncStorage.multiGet(keys);
      const data: Record<string, string | null> = {};
      stores.forEach(([k, v]) => {
        data[k] = v;
      });

      const token = data[STORAGE_KEYS.TOKEN] || null;
      const refreshToken = data[STORAGE_KEYS.REFRESH_TOKEN] || null;
      const hasCompletedOnboarding = data[STORAGE_KEYS.ONBOARDING_COMPLETED] === 'true';
      const hasAcceptedTerms = data[STORAGE_KEYS.TERMS_ACCEPTED] === 'true';

      let user: User | null = null;
      let restaurants: RestaurantDetail[] = [];
      let activeRestaurant: RestaurantDetail | null = null;

      if (data[STORAGE_KEYS.USER]) {
        try {
          user = JSON.parse(data[STORAGE_KEYS.USER]!);
        } catch {
          user = null;
        }
      }

      if (data[STORAGE_KEYS.RESTAURANTS]) {
        try {
          restaurants = JSON.parse(data[STORAGE_KEYS.RESTAURANTS]!);
        } catch {
          restaurants = [];
        }
      }

      if (data[STORAGE_KEYS.ACTIVE_RESTAURANT]) {
        try {
          activeRestaurant = JSON.parse(data[STORAGE_KEYS.ACTIVE_RESTAURANT]!);
        } catch {
          activeRestaurant = null;
        }
      }

      return {
        token,
        refreshToken,
        user,
        restaurants,
        activeRestaurant,
        hasCompletedOnboarding,
        hasAcceptedTerms,
      };
    } catch (err: any) {
      logger.api('API_ERROR', 'Failed to load session from AsyncStorage', { error: err?.message });
      return {
        token: null,
        refreshToken: null,
        user: null,
        restaurants: [],
        activeRestaurant: null,
        hasCompletedOnboarding: false,
        hasAcceptedTerms: false,
      };
    }
  }

  /**
   * Persist renewed JWT access & refresh tokens (called by Refresh Token flow)
   */
  static async saveTokens(token: string, refreshToken: string): Promise<void> {
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.TOKEN, token || ''],
        [STORAGE_KEYS.REFRESH_TOKEN, refreshToken || ''],
      ]);
      logger.api('API_REQUEST', 'Session tokens updated in storage');
    } catch (err: any) {
      logger.api('API_ERROR', 'Failed to update tokens in storage', { error: err?.message });
    }
  }

  /**
   * Persist active restaurant selection
   */
  static async saveActiveRestaurant(restaurant: RestaurantDetail): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_RESTAURANT, JSON.stringify(restaurant));
    } catch (err: any) {
      logger.api('API_ERROR', 'Failed to save active restaurant in storage', { error: err?.message });
    }
  }

  /**
   * Persist restaurant list
   */
  static async saveRestaurants(restaurants: RestaurantDetail[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.RESTAURANTS, JSON.stringify(restaurants));
    } catch (err: any) {
      logger.api('API_ERROR', 'Failed to save restaurants in storage', { error: err?.message });
    }
  }

  /**
   * Persist onboarding completion status
   */
  static async saveOnboardingCompleted(status: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, status ? 'true' : 'false');
    } catch (err: any) {
      logger.api('API_ERROR', 'Failed to save onboarding status', { error: err?.message });
    }
  }

  /**
   * Persist terms & conditions acceptance status
   */
  static async saveTermsAccepted(status: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TERMS_ACCEPTED, status ? 'true' : 'false');
      logger.auth('TERMS_ACCEPTED', `Terms acceptance status saved: ${status}`);
    } catch (err: any) {
      logger.api('API_ERROR', 'Failed to save terms acceptance status', { error: err?.message });
    }
  }

  /**
   * Wipe all session keys on user logout or session termination
   */
  static async clearSession(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER,
        STORAGE_KEYS.RESTAURANTS,
        STORAGE_KEYS.ACTIVE_RESTAURANT,
      ]);
      logger.auth('LOGOUT_COMPLETED', 'Session cleared from AsyncStorage');
    } catch (err: any) {
      logger.api('API_ERROR', 'Failed to clear session from AsyncStorage', { error: err?.message });
    }
  }
}
