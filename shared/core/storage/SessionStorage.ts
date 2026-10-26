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
  STAFF_PIN: '@menza_staff_pin',
  IS_PIN_LOCK_ENABLED: '@menza_is_pin_lock_enabled',
  ACTIVE_STAFF_NAME: '@menza_active_staff_name',
  REMEMBERED_MOBILE: '@menza_remembered_mobile',
};

export interface PersistedSession {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  restaurants: RestaurantDetail[];
  activeRestaurant: RestaurantDetail | null;
  hasCompletedOnboarding: boolean;
  hasAcceptedTerms: boolean;
  staffPin?: string | null;
  isPinLockEnabled?: boolean;
  activeStaffName?: string | null;
  rememberedMobile?: string | null;
}

export class SessionStorage {
  /**
   * Persist full user session after successful login / OTP verification
   */
  static async saveSession(session: PersistedSession): Promise<void> {

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
        items.push([
          STORAGE_KEYS.ACTIVE_RESTAURANT, 
          session.activeRestaurant ? JSON.stringify(session.activeRestaurant) : '',
        ]);
      }

      if (session.user?.mobile) {
        items.push([STORAGE_KEYS.REMEMBERED_MOBILE, session.user.mobile]);
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
        STORAGE_KEYS.STAFF_PIN,
        STORAGE_KEYS.IS_PIN_LOCK_ENABLED,
        STORAGE_KEYS.ACTIVE_STAFF_NAME,
        STORAGE_KEYS.REMEMBERED_MOBILE,
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
      const staffPin = data[STORAGE_KEYS.STAFF_PIN] || null;
      const isPinLockEnabled = data[STORAGE_KEYS.IS_PIN_LOCK_ENABLED] === 'true';
      const activeStaffName = data[STORAGE_KEYS.ACTIVE_STAFF_NAME] || null;
      const rememberedMobile = data[STORAGE_KEYS.REMEMBERED_MOBILE] || null;

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
        staffPin,
        isPinLockEnabled,
        activeStaffName,
        rememberedMobile: rememberedMobile || user?.mobile || null,
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
        staffPin: null,
        isPinLockEnabled: false,
        activeStaffName: null,
        rememberedMobile: null,
      };
    }
  }

  static async saveRememberedMobile(mobile: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.REMEMBERED_MOBILE, mobile);
    } catch {}
  }

  static async getRememberedMobile(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.REMEMBERED_MOBILE);
    } catch {
      return null;
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

  /**
   * Persist custom staff unlock PIN
   */
  static async saveStaffPin(pin: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.STAFF_PIN, pin);
      logger.auth('STAFF_PIN_SAVED', 'Staff unlock PIN saved in storage');
    } catch (err: any) {
      logger.api('API_ERROR', 'Failed to save staff PIN in storage', { error: err?.message });
    }
  }

  /**
   * Persist PIN lock enabled toggle
   */
  static async savePinLockEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.IS_PIN_LOCK_ENABLED, enabled ? 'true' : 'false');
      logger.auth('PIN_LOCK_TOGGLED', `PIN lock enabled setting saved: ${enabled}`);
    } catch (err: any) {
      logger.api('API_ERROR', 'Failed to save PIN lock enabled setting', { error: err?.message });
    }
  }

  /**
   * Persist current active staff operator name
   */
  static async saveActiveStaffName(name: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_STAFF_NAME, name);
    } catch (err: any) {
      logger.api('API_ERROR', 'Failed to save active staff name', { error: err?.message });
    }
  }
}
