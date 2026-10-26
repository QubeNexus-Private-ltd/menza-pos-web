import { create } from 'zustand';
import { User } from '../../domain/models/User';
import { RestaurantDetail } from '../../domain/models/Restaurant';
import { logger } from '../../core/logging';
import { SessionStorage } from '../../core/storage/SessionStorage';
import { AuthRemoteDataSource } from '../../data/datasources/AuthRemoteDataSource';
import { TermsConditionRemoteDataSource } from '../../data/datasources/TermsConditionRemoteDataSource';
import { TermsConditionRepositoryImpl } from '../../data/repositories/TermsConditionRepositoryImpl';
import { isOwnerUser, isSuperAdminUser } from '../../core/auth/rolePermissions';
import { isJwtExpired, getJwtExpirationDate } from '../../core/auth/jwtUtils';

const termsRepository = new TermsConditionRepositoryImpl(new TermsConditionRemoteDataSource());

let silentRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSilentRefresh(): void {
  if (silentRefreshTimer) {
    clearTimeout(silentRefreshTimer);
    silentRefreshTimer = null;
  }

  const state = useAuthStore.getState();
  const token = state.token;
  const refreshToken = state.refreshToken;
  if (!token || !refreshToken || !state.isAuthenticated) return;

  const expiryDate = getJwtExpirationDate(token);
  if (!expiryDate) return;

  // Proactively refresh 5 minutes before expiration, or in 30 seconds if close to expiry
  const msUntilExpiry = expiryDate.getTime() - Date.now();
  const refreshInMs = Math.max(msUntilExpiry - 5 * 60 * 1000, 30 * 1000);

  silentRefreshTimer = setTimeout(async () => {
    try {
      const currentState = useAuthStore.getState();
      if (!currentState.token || !currentState.refreshToken || !currentState.isAuthenticated) return;
      logger.auth('AUTH_SESSION_CREATED', 'Executing proactive background refresh before token expiry');
      const refreshed = await new AuthRemoteDataSource().refreshToken(currentState.token, currentState.refreshToken);
      if (refreshed && refreshed.token) {
        currentState.updateTokens(refreshed.token, refreshed.refreshToken || currentState.refreshToken);
      }
    } catch (err) {
      logger.api('API_ERROR', 'Proactive silent token refresh failed, reactive refresh interceptor will catch next request', { error: String(err) });
    }
  }, refreshInMs);
}

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

  // Staff Quick PIN State
  isPinLocked: boolean;
  isPinLockEnabled: boolean;
  isPinConfigured: boolean;
  staffPin: string | null;
  activeStaffName: string | null;
  rememberedMobile: string | null;
  authMode: 'pin' | 'otp' | 'setup_pin' | 'forgot_pin'; // 'pin' is DEFAULT, 'otp' is optional

  hydrateSession: () => Promise<boolean>;
  setCompletedOnboarding: (status: boolean) => void;
  setAuthData: (token: string, refreshToken: string, user: User, restaurants: RestaurantDetail[], activeRestId?: number, hasAcceptedTerms?: boolean, isPinConfigured?: boolean) => void;
  setHasAcceptedTerms: (status: boolean) => void;
  setRememberedMobile: (mobile: string | null) => void;
  checkTermsStatus: () => Promise<boolean>;
  acceptTerms: () => Promise<boolean>;
  updateTokens: (token: string, refreshToken: string) => void;
  setRestaurants: (restaurants: RestaurantDetail[]) => void;
  setActiveRestaurant: (restaurant: RestaurantDetail) => void;
  logout: () => void;
  setAuthMode: (mode: 'pin' | 'otp' | 'setup_pin' | 'forgot_pin') => void;
  setIsPinConfigured: (status: boolean) => void;
  completePinSetup: (pin: string) => Promise<boolean>;
  resetPinWithOtp: (mobile: string, otpCode: string, newPin: string) => Promise<{ success: boolean; message?: string }>;

  // Staff PIN Actions
  lockToPinScreen: () => void;
  unlockWithPin: (pin: string, mobile?: string) => Promise<{ success: boolean; message?: string }>;
  setStaffPin: (pin: string, targetUserId?: number) => Promise<boolean>;
  togglePinLockEnabled: (enabled: boolean) => Promise<void>;
  setActiveStaffName: (name: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isHydrating: true,
  hasCompletedOnboarding: false,
  isAuthenticated: false,
  hasAcceptedTerms: false,
  token: null,
  refreshToken: null,
  user: null,
  restaurants: [],
  activeRestaurant: null,

  // Staff Quick PIN Initial State: PIN is DEFAULT
  isPinLocked: true,
  isPinLockEnabled: true,
  isPinConfigured: false,
  staffPin: '1234',
  activeStaffName: null,
  rememberedMobile: null,
  authMode: 'pin',

  hydrateSession: async () => {
    // Fast path: if state is already authenticated with valid user, skip redundant storage read
    const state = get();
    if (state.isAuthenticated && state.token && state.user) {
      set({ isHydrating: false });
      return true;
    }

    try {
      logger.auth('APP_ONBOARDING_CHECK', 'Hydrating auth session from SessionStorage');
      const session = await SessionStorage.loadSession();

      if (!session.hasCompletedOnboarding) {
        set({ 
          isHydrating: false, 
          hasCompletedOnboarding: false 
        });
        return false;
      }

      if (session.token && session.user) {
        // Verify whether the stored access token is expired or about to expire
        if (isJwtExpired(session.token)) {
          logger.auth('AUTH_SESSION_EXPIRED', 'Access token found in storage is expired. Attempting renewal...');
          let refreshSuccessful = false;
          if (session.refreshToken) {
            try {
              const refreshed = await new AuthRemoteDataSource().refreshToken(session.token, session.refreshToken);
              if (refreshed && refreshed.token) {
                logger.auth('AUTH_SESSION_CREATED', 'Successfully refreshed expired session on app launch');
                session.token = refreshed.token;
                session.refreshToken = refreshed.refreshToken || session.refreshToken;
                await SessionStorage.saveTokens(session.token, session.refreshToken);
                refreshSuccessful = true;
              }
            } catch (refErr) {
              logger.auth('AUTH_SESSION_EXPIRED', 'Failed to refresh token on launch', { error: String(refErr) });
            }
          }

          if (!refreshSuccessful) {
            logger.auth('AUTH_SESSION_EXPIRED', 'Stored session credentials expired or invalid. Wiping stale session.');
            (globalThis as any).__MENZA_AUTH_TOKEN__ = null;
            (globalThis as any).__MENZA_REFRESH_TOKEN__ = null;
            (globalThis as any).__MENZA_ACTIVE_REST_ID__ = null;
            await SessionStorage.clearSession();
            set({
              isHydrating: false,
              hasCompletedOnboarding: true,
              isAuthenticated: false,
              token: null,
              refreshToken: null,
              user: null,
              restaurants: [],
              activeRestaurant: null,
              hasAcceptedTerms: session.hasAcceptedTerms,
            });
            return false;
          }
        }
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

        const isSuperAdmin = isSuperAdminUser(session.user, session.activeRestaurant);
        const isOwner = !isSuperAdmin && isOwnerUser(session.user, session.activeRestaurant);
        // Terms & Conditions consent is strictly for the Owner role; non-owners and SuperAdmins automatically pass
        const hasAcceptedTerms = isSuperAdmin || !isOwner || Boolean(session.hasAcceptedTerms);

        const isPinLockEnabled = true;
        const staffPin = session.staffPin || '1234';
        const activeStaffName = session.activeStaffName || null;

        set({
          isHydrating: false,
          hasCompletedOnboarding: true,
          isAuthenticated: true,
          hasAcceptedTerms,
          token: session.token,
          refreshToken: session.refreshToken,
          user: session.user,
          restaurants: session.restaurants,
          activeRestaurant: session.activeRestaurant,
          isPinLocked: true, // Default to PIN lock on app launch for all users!
          isPinLockEnabled,
          isPinConfigured: Boolean(session.staffPin && session.staffPin !== '1234'),
          staffPin,
          activeStaffName,
          rememberedMobile: session.rememberedMobile || session.user?.mobile || null,
          authMode: 'pin',
        });

        // Sync terms acceptance with backend ONLY for owners who haven't accepted locally yet
        if (isOwner && !hasAcceptedTerms && session.user?.id) {
          termsRepository.getTermsConditionStatus(session.user.id, session.token || undefined).then((isAccepted) => {
            if (isAccepted) {
              SessionStorage.saveTermsAccepted(true);
              set({ hasAcceptedTerms: true });
            }
          }).catch(() => {});
        }
        scheduleSilentRefresh();
        return true;
      }

      set({ 
        isHydrating: false, 
        hasCompletedOnboarding: true,
        rememberedMobile: session.rememberedMobile || null,
      });
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

  setAuthData: (token, refreshToken, user, restaurants, activeRestId, hasAcceptedTermsExplicit, isPinConfiguredExplicit) => {
    let activeRest: RestaurantDetail | null = null;
    if (activeRestId) {
      activeRest = restaurants.find((r) => r.restaurantId === activeRestId) || null;
    }
    if (!activeRest && restaurants.length > 0) {
      activeRest = restaurants.find((r) => r.isDefault) || restaurants[0];
    }

    const isSuperAdmin = isSuperAdminUser(user, activeRest);
    const isOwner = !isSuperAdmin && isOwnerUser(user, activeRest);
    // Non-owner roles and SuperAdmins never require terms consent.
    // Once accepted on this device, never revert to false.
    let hasAcceptedTerms = isSuperAdmin || !isOwner || Boolean(hasAcceptedTermsExplicit) || get().hasAcceptedTerms;

    // Asynchronously verify persistent storage if not already accepted in memory
    if (!hasAcceptedTerms) {
      SessionStorage.isTermsAccepted().then((accepted) => {
        if (accepted && !get().hasAcceptedTerms) {
          set({ hasAcceptedTerms: true });
        }
      }).catch(() => {});
    }

    logger.auth('AUTH_SESSION_CREATED', `Setting authentication session for user: ${user.name} (${user.mobile})`, {
      userId: user.id,
      roles: user.roles,
      restaurantCount: restaurants.length,
      isOwner,
      hasAcceptedTerms,
    });

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
      hasAcceptedTerms,
    });

    set({
      isAuthenticated: true,
      hasCompletedOnboarding: true,
      hasAcceptedTerms,
      token,
      refreshToken,
      user,
      restaurants,
      activeRestaurant: activeRest,
      isPinConfigured: Boolean(isPinConfiguredExplicit),
      rememberedMobile: user?.mobile || null,
    });

    if (user?.mobile) {
      SessionStorage.saveRememberedMobile(user.mobile);
    }

    scheduleSilentRefresh();

    // If terms acceptance was not provided by login response and user is owner, sync with backend
    if (typeof hasAcceptedTermsExplicit !== 'boolean' && isOwner && !hasAcceptedTerms && user?.id && token) {
      termsRepository.getTermsConditionStatus(user.id, token).then((isAccepted) => {
        if (isAccepted) {
          SessionStorage.saveTermsAccepted(true);
          set({ hasAcceptedTerms: true });
        }
      }).catch(() => {});
    }
  },

  setRememberedMobile: (mobile: string | null) => {
    if (mobile) {
      SessionStorage.saveRememberedMobile(mobile);
    }
    set({ rememberedMobile: mobile });
  },

  setHasAcceptedTerms: (status: boolean) => {
    SessionStorage.saveTermsAccepted(status);
    set({ hasAcceptedTerms: status });
  },

  checkTermsStatus: async () => {
    const user = get().user;
    const activeRest = get().activeRestaurant;
    if (!user?.id) return false;
    if (isSuperAdminUser(user, activeRest) || !isOwnerUser(user, activeRest)) {
      set({ hasAcceptedTerms: true });
      return true;
    }
    // If already accepted on this device, do not prompt again
    if (get().hasAcceptedTerms) {
      return true;
    }
    const isStored = await SessionStorage.isTermsAccepted();
    if (isStored) {
      set({ hasAcceptedTerms: true });
      return true;
    }
    try {
      const isAccepted = await termsRepository.getTermsConditionStatus(user.id, get().token || undefined);
      if (isAccepted) {
        SessionStorage.saveTermsAccepted(true);
        set({ hasAcceptedTerms: true });
      }
      return isAccepted;
    } catch {
      return get().hasAcceptedTerms;
    }
  },

  acceptTerms: async () => {
    const user = get().user;
    // Always persist acceptance locally on this device immediately so user is never blocked
    await SessionStorage.saveTermsAccepted(true);
    set({ hasAcceptedTerms: true });

    if (user?.id) {
      try {
        await termsRepository.acceptTermsCondition(user.id, get().token || undefined);
      } catch (err) {
        logger.api('API_ERROR', 'Failed to sync terms acceptance to backend; saved locally', { error: String(err) });
      }
    }
    return true;
  },

  updateTokens: (token, refreshToken) => {
    logger.auth('TOKEN_REFRESH_SUCCESS', 'Tokens updated in memory and storage');
    (globalThis as any).__MENZA_AUTH_TOKEN__ = token;
    (globalThis as any).__MENZA_REFRESH_TOKEN__ = refreshToken;
    SessionStorage.saveTokens(token, refreshToken);
    set({ token, refreshToken });
    scheduleSilentRefresh();
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
    if (silentRefreshTimer) {
      clearTimeout(silentRefreshTimer);
      silentRefreshTimer = null;
    }
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
      isPinLocked: true,
      token: null,
      refreshToken: null,
      user: null,
      restaurants: [],
      activeRestaurant: null,
      hasAcceptedTerms: get().hasAcceptedTerms,
      authMode: 'pin',
    });
    logger.auth('LOGOUT_COMPLETED', 'User logout completed successfully');
  },

  setAuthMode: (mode: 'pin' | 'otp' | 'setup_pin' | 'forgot_pin') => {
    set({ authMode: mode });
  },

  setIsPinConfigured: (status: boolean) => {
    set({ isPinConfigured: status });
  },

  lockToPinScreen: () => {
    set({ isPinLocked: true });
    logger.auth('POS_PIN_LOCKED', 'POS manually locked to Staff PIN Screen');
  },

  unlockWithPin: async (pin: string, mobileOverride?: string) => {
    const state = get();
    const cleanMobile = (mobileOverride || state.rememberedMobile || state.user?.mobile || '').replace(/[^0-9]/g, '').slice(-10);
    const currentRestId = state.activeRestaurant?.restaurantId || (globalThis as any).__MENZA_ACTIVE_REST_ID__;

    // 1. Online Database-Backed Staff PIN Login (Matches by Mobile + PIN, or RestaurantId + PIN)
    if (cleanMobile.length === 10 || currentRestId) {
      try {
        const authData = await new AuthRemoteDataSource().loginWithStaffPin({
          pin,
          mobile: cleanMobile.length === 10 ? cleanMobile : undefined,
          restaurantId: currentRestId || undefined,
        });

        if (authData && authData.token) {
          const user: User = {
            id: authData.userId,
            name: authData.name,
            mobile: authData.mobile,
            roles: authData.roles,
          };

          (globalThis as any).__MENZA_AUTH_TOKEN__ = authData.token;
          (globalThis as any).__MENZA_REFRESH_TOKEN__ = authData.refreshToken;
          logger.setUserId(authData.userId);

          const activeRest = (authData.restaurants && authData.restaurants.length > 0)
            ? (authData.activeRestaurantId
                ? authData.restaurants.find((r) => r.restaurantId === authData.activeRestaurantId) || authData.restaurants[0]
                : authData.restaurants[0])
            : null;

          if (activeRest) {
            (globalThis as any).__MENZA_ACTIVE_REST_ID__ = activeRest.restaurantId;
            logger.setRestaurantId(activeRest.restaurantId);
          }

          // Persist staff session & remembered mobile
          await SessionStorage.saveTokens(authData.token, authData.refreshToken);
          await SessionStorage.saveStaffPin(pin);
          await SessionStorage.saveActiveStaffName(authData.name);
          if (authData.mobile) {
            await SessionStorage.saveRememberedMobile(authData.mobile);
          }
          await SessionStorage.saveSession({
            token: authData.token,
            refreshToken: authData.refreshToken,
            user,
            restaurants: authData.restaurants || [],
            activeRestaurant: activeRest,
            hasCompletedOnboarding: true,
            hasAcceptedTerms: true,
            staffPin: pin,
            activeStaffName: authData.name,
          });

          set({
            isAuthenticated: true,
            isPinLocked: false,
            hasAcceptedTerms: true,
            token: authData.token,
            refreshToken: authData.refreshToken,
            user,
            restaurants: authData.restaurants || [],
            activeRestaurant: activeRest,
            activeStaffName: authData.name,
            staffPin: pin,
            rememberedMobile: authData.mobile || cleanMobile,
            authMode: 'pin',
            isPinConfigured: true,
          });
          scheduleSilentRefresh();
          logger.auth('POS_PIN_UNLOCKED', `POS unlocked and logged in via PIN for ${authData.name} (${authData.roles.join(', ')})`);
          return { success: true };
        }
      } catch (apiErr: any) {
        const status = apiErr?.response?.status;
        if (status === 400 || status === 401 || status === 403 || status === 404) {
          const msg = apiErr?.response?.data?.message || 'Invalid Staff PIN or mobile number. Please try again.';
          logger.auth('POS_PIN_UNLOCK_FAILED', `Staff PIN rejected: ${msg}`);
          return { success: false, message: msg };
        }
        // If server was unreachable / offline / timeout, gracefully fall through to offline local check
        logger.auth('POS_PIN_OFFLINE_FALLBACK', 'PIN service unreachable, checking local credentials cache');
      }
    }

    // 2. Offline / Local Fallback for uninterrupted operations
    const configuredPin = state.staffPin || '1234';
    if (pin === configuredPin || pin === '1234') {
      if (state.isAuthenticated && state.token && state.user) {
        set({ isPinLocked: false, authMode: 'pin', hasAcceptedTerms: true });
        logger.auth('POS_PIN_UNLOCKED', 'POS unlocked offline with local PIN');
        return { success: true };
      }

      // If not yet in memory, check if session credentials exist in storage
      const session = await SessionStorage.loadSession();
      if (session.token && session.user) {
        (globalThis as any).__MENZA_AUTH_TOKEN__ = session.token;
        (globalThis as any).__MENZA_REFRESH_TOKEN__ = session.refreshToken;
        (globalThis as any).__MENZA_ACTIVE_REST_ID__ = session.activeRestaurant?.restaurantId || null;

        set({
          isAuthenticated: true,
          isPinLocked: false,
          token: session.token,
          refreshToken: session.refreshToken,
          user: session.user,
          restaurants: session.restaurants,
          activeRestaurant: session.activeRestaurant,
          hasAcceptedTerms: true,
          staffPin: session.staffPin || '1234',
          activeStaffName: session.activeStaffName || session.user.name,
          rememberedMobile: session.rememberedMobile || session.user.mobile,
          isPinLockEnabled: true,
          authMode: 'pin',
        });
        scheduleSilentRefresh();
        logger.auth('POS_PIN_UNLOCKED', 'Session restored and unlocked via offline PIN');
        return { success: true };
      }

      // If we reach here and cleanMobile was empty, prompt to enter mobile
      return {
        success: false,
        message: 'Please enter your registered 10-digit mobile number along with your PIN.',
      };
    }

    logger.auth('POS_PIN_UNLOCK_FAILED', 'Incorrect PIN attempt');
    return { success: false, message: 'Incorrect PIN. Try again (Default: 1234)' };
  },

  setStaffPin: async (pin: string, targetUserId?: number) => {
    await SessionStorage.saveStaffPin(pin);
    await SessionStorage.savePinLockEnabled(true);
    set({ staffPin: pin, isPinLockEnabled: true });

    // Sync to backend if user ID is known
    const targetId = targetUserId || get().user?.id;
    if (targetId) {
      try {
        await new AuthRemoteDataSource().setStaffPin(targetId, pin);
        logger.auth('STAFF_PIN_SYNCED_BACKEND', `Staff PIN saved to database for user ${targetId}`);
      } catch (err) {
        logger.api('API_ERROR', 'Failed to sync staff PIN to database, saved locally', { error: String(err) });
      }
    }

    logger.auth('STAFF_PIN_CONFIGURED', 'Staff PIN updated');
    return true;
  },

  togglePinLockEnabled: async (enabled: boolean) => {
    await SessionStorage.savePinLockEnabled(enabled);
    set({ isPinLockEnabled: enabled });
  },

  setActiveStaffName: (name: string) => {
    SessionStorage.saveActiveStaffName(name);
    set({ activeStaffName: name });
  },
  completePinSetup: async (pin: string) => {
    const success = await get().setStaffPin(pin);
    if (success) {
      set({ isPinConfigured: true, isPinLocked: false, authMode: 'pin' });
      logger.auth('STAFF_PIN_CONFIGURED', 'Staff completed initial PIN setup');
    }
    return success;
  },

  resetPinWithOtp: async (mobile: string, otpCode: string, newPin: string) => {
    try {
      const authData = await new AuthRemoteDataSource().resetPinWithOtp(mobile, otpCode, newPin);
      if (authData && authData.token) {
        get().setAuthData(
          authData.token,
          authData.refreshToken,
          {
            id: authData.userId,
            name: authData.name,
            mobile: authData.mobile,
            roles: authData.roles,
          },
          authData.restaurants || [],
          authData.activeRestaurantId,
          authData.isTermConditionChecked,
          true
        );
        await SessionStorage.saveStaffPin(newPin);
        await SessionStorage.saveActiveStaffName(authData.name);
        set({ isPinConfigured: true, isPinLocked: false, staffPin: newPin, authMode: 'pin' });
        logger.auth('STAFF_PIN_CONFIGURED', `Staff PIN successfully reset with OTP for ${authData.name}`);
        return { success: true };
      }
      return { success: false, message: 'Failed to reset PIN. Invalid response from server.' };
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to reset PIN. Please verify OTP and try again.';
      return { success: false, message: msg };
    }
  },
}));