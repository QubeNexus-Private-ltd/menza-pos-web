import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { APP_CONSTANTS } from '@/lib/constants';
import { logger } from '@/lib/logger';

/**
 * Resolves API Base URL strictly from environment variables.
 * Emits an explicit, informative error if not configured,
 * preventing silent fallback to local ports or exposed hardcoded endpoints.
 */
function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL;
  if (!envUrl) {
    const errorMsg =
      '[Configuration Error] Missing required environment variable: NEXT_PUBLIC_API_BASE_URL. ' +
      'Please configure NEXT_PUBLIC_API_BASE_URL in your .env.local file or in the Vercel Project Settings > Environment Variables.';
    if (typeof window !== 'undefined') {
      console.error(errorMsg);
      logger.error('CRITICAL_ENV_MISSING', new Error(errorMsg), { variable: 'NEXT_PUBLIC_API_BASE_URL' });
    }
    // Return empty string during static build analysis; throw at runtime if invoked
    if (typeof window !== 'undefined') {
      throw new Error(errorMsg);
    }
    return '';
  }
  return envUrl.replace(/\/+$/, '');
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// In-memory cache manager for light GET requests
class ApiCacheManager {
  private cache = new Map<string, { data: any; expiry: number }>();

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.data as T;
  }

  set(key: string, data: any, ttlSeconds: number = 60): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  invalidate(prefix?: string): void {
    if (!prefix) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}

export const apiCacheManager = new ApiCacheManager();

// Request Interceptor: Inject JWT Token & Active Restaurant ID + Production/Testing Logging
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const startTime = Date.now();
    (config as any)._startTime = startTime;
    (config as any)._requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    if (typeof window !== 'undefined') {
      try {
        // 1. Resolve token from global context, session storage, or fallback keys
        let token: string | null =
          (globalThis as any).__MENZA_AUTH_TOKEN__ ||
          localStorage.getItem('@menza_session_token') ||
          localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);

        if (!token) {
          const authStorageStr = localStorage.getItem('menza_auth_store');
          if (authStorageStr) {
            try {
              const parsed = JSON.parse(authStorageStr);
              token = parsed?.state?.token;
            } catch {}
          }
        }

        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token.trim()}`;
        }

        // 2. Resolve active restaurant ID from global context, session storage, or fallback keys
        let restId: string | null =
          (globalThis as any).__MENZA_ACTIVE_REST_ID__?.toString() ||
          localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.ACTIVE_RESTAURANT);

        if (!restId) {
          const rawSessionRest = localStorage.getItem('@menza_session_active_restaurant');
          if (rawSessionRest) {
            try {
              const parsed = JSON.parse(rawSessionRest);
              restId = parsed?.restaurantId?.toString();
            } catch {}
          }
        }

        if (!restId) {
          const authStorageStr = localStorage.getItem('menza_auth_store');
          if (authStorageStr) {
            try {
              const parsed = JSON.parse(authStorageStr);
              restId = parsed?.state?.activeRestaurant?.restaurantId?.toString();
            } catch {}
          }
        }

        if (restId && config.headers && !config.headers['X-Restaurant-Id']) {
          config.headers['X-Restaurant-Id'] = restId;
          config.headers['X-Active-Restaurant-Id'] = restId;
        }
      } catch {
        // Storage access safe
      }
    }

    logger.api('REQUEST', config.method || 'GET', config.url || '', {
      hasParams: Boolean(config.params),
      hasBody: Boolean(config.data),
      requestId: (config as any)._requestId,
    });

    return config;
  },
  (error) => {
    logger.api('ERROR', 'REQUEST_INIT', error?.config?.url || 'unknown', { error: error?.message });
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle 401 Unauthorized, 402 Subscription Expired + Observability
apiClient.interceptors.response.use(
  (response) => {
    const config = response.config as any;
    const durationMs = config?._startTime ? Date.now() - config._startTime : 0;
    const method = (config?.method || 'GET').toUpperCase();
    const url = config?.url || '';

    if (durationMs > 4000) {
      logger.api('SLOW', method, url, {
        status: response.status,
        durationMs,
        requestId: config?._requestId,
      });
    } else {
      logger.api('RESPONSE', method, url, {
        status: response.status,
        durationMs,
        requestId: config?._requestId,
      });
    }

    return response;
  },
  (error) => {
    const config = error.config as any;
    const durationMs = config?._startTime ? Date.now() - config._startTime : 0;
    const method = (config?.method || 'GET').toUpperCase();
    const url = config?.url || '';
    const status = error.response?.status;

    logger.api('ERROR', method, url, {
      status,
      durationMs,
      message: error?.message,
      responseData: error.response?.data,
      requestId: config?._requestId,
    });

    if (typeof window !== 'undefined') {
      if (status === 401) {
        const isAuthEndpoint = url.includes('/Auth/');
        if (!isAuthEndpoint && !window.location.pathname.includes('/login')) {
          logger.warn(`[ApiClient] 401 Unauthorized encountered on ${url}. Session may be expired.`);
        }
      } else if (
        status === 402 ||
        error.response?.data?.errorCode === 'SUBSCRIPTION_EXPIRED' ||
        (typeof error.response?.data?.message === 'string' &&
          error.response.data.message.includes('SUBSCRIPTION_EXPIRED'))
      ) {
        try {
          const { useSubscriptionStore } = require('@/stores/useSubscriptionStore');
          useSubscriptionStore.getState().setExpired(true);
        } catch {
          // Dynamic require fallback
        }
      }
    }
    return Promise.reject(error);
  }
);
