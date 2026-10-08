import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { APP_CONSTANTS } from '@/lib/constants';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export const apiClient: AxiosInstance = axios.create({
  baseURL,
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

// Request Interceptor: Inject JWT Token & Active Restaurant ID
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      try {
        // Try getting token from direct storage key
        let token = localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);

        // Fallback: check zustand persisted storage
        if (!token) {
          const authStorageStr = localStorage.getItem('menza_auth_store');
          if (authStorageStr) {
            const parsed = JSON.parse(authStorageStr);
            token = parsed?.state?.token;
          }
        }

        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token.trim()}`;
        }

        // Try getting active restaurant ID
        let restId = localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.ACTIVE_RESTAURANT);
        if (!restId) {
          const authStorageStr = localStorage.getItem('menza_auth_store');
          if (authStorageStr) {
            const parsed = JSON.parse(authStorageStr);
            restId = parsed?.state?.activeRestaurant?.restaurantId?.toString();
          }
        }

        if (restId && config.headers && !config.headers['X-Restaurant-Id']) {
          config.headers['X-Restaurant-Id'] = restId;
        }
      } catch {
        // Ignore localStorage access errors during SSR or private browsing
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 Unauthorized & 402 Payment Required
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined') {
      if (error.response?.status === 401) {
        const isAuthEndpoint = error.config?.url?.includes('/Auth/');
        if (!isAuthEndpoint && !window.location.pathname.includes('/login')) {
          console.warn('[ApiClient] 401 Unauthorized encountered. Session may be expired.');
        }
      } else if (error.response?.status === 402) {
        try {
          const { useSubscriptionStore } = require('@/stores/useSubscriptionStore');
          useSubscriptionStore.getState().setExpired(true);
        } catch {}
      }
    }
    return Promise.reject(error);
  }
);
