import axios, { InternalAxiosRequestConfig } from 'axios';
import { APP_CONSTANTS } from '../constants/appConstants';
import { useAuthStore } from '../../presentation/state/useAuthStore';
import { logger } from '../logging';
import { SubscriptionEvents } from '../utils/subscriptionEvents';

/**
 * Client-Side Rate Limiter & Request Throttler Engine
 * Implements a sliding-window token bucket, endpoint-specific throttling,
 * burst pacing, and request deduplication.
 */
class ApiRateLimiter {
  private maxRequestsPerWindow: number = 50; // Max 50 requests
  private windowMs: number = 1500;           // Per 1.5-second sliding window
  private minIntervalMs: number = 40;         // Minimum 40ms pacing between concurrent requests to prevent burst 429s in Release mode
  private requestTimestamps: number[] = [];
  private inFlightGetRequests: Map<string, Promise<any>> = new Map();
  private endpointLastCalled: Map<string, number> = new Map();
  private queueMutex: Promise<void> = Promise.resolve();

  // Custom rate limits for sensitive / high-cost endpoints
  private endpointLimits: Record<string, number> = {
    '/Auth/GenerateOtp': 2000, // Max 1 OTP generation every 2 seconds
    '/Auth/Login': 1000,       // Max 1 Login attempt every 1 second
    '/Subscription/Configuration': 500,
  };

  /**
   * Acquire permission to execute an API request.
   * Serializes burst requests in Release mode with a minimum spacing interval (40ms)
   * and enforces sliding window capacity and sensitive endpoint limits.
   */
  async acquire(config: InternalAxiosRequestConfig): Promise<void> {
    const url = config.url || '';

    // Chain execution onto sequential queue to prevent concurrent Hermes execution burst
    const previousQueue = this.queueMutex;
    let releaseLock: () => void;
    this.queueMutex = new Promise((resolve) => {
      releaseLock = resolve;
    });

    try {
      await previousQueue;

      // 1. Check endpoint-specific rate limiters
      for (const [pattern, intervalMs] of Object.entries(this.endpointLimits)) {
        if (url.includes(pattern)) {
          const lastCall = this.endpointLastCalled.get(pattern) || 0;
          const elapsed = Date.now() - lastCall;
          if (elapsed < intervalMs) {
            const delayNeeded = intervalMs - elapsed;
            logger.api(
              'API_REQUEST',
              `UI Rate Limiting: Throttling ${url} by ${delayNeeded}ms`,
              { url, delayNeeded, limitMs: intervalMs }
            );
            await this.sleep(delayNeeded);
          }
          this.endpointLastCalled.set(pattern, Date.now());
          break;
        }
      }

      // 2. Sliding Window Rate Limiter
      let now = Date.now();
      this.requestTimestamps = this.requestTimestamps.filter((t) => now - t < this.windowMs);

      if (this.requestTimestamps.length >= this.maxRequestsPerWindow) {
        const oldestInWindow = this.requestTimestamps[0];
        const timeToWait = this.windowMs - (now - oldestInWindow) + 15;
        logger.api(
          'API_REQUEST',
          `UI Rate Limiting: Window limit reached (${this.maxRequestsPerWindow} reqs / ${this.windowMs}ms). Pacing request by ${timeToWait}ms`,
          { url, timeToWait, activeRequestsInWindow: this.requestTimestamps.length }
        );
        await this.sleep(timeToWait);
        now = Date.now();
        this.requestTimestamps = this.requestTimestamps.filter((t) => now - t < this.windowMs);
      }

      // 3. Minimum Inter-Request Spacing Pacing (prevents burst socket exhaustion)
      if (this.requestTimestamps.length > 0) {
        const lastReqTime = this.requestTimestamps[this.requestTimestamps.length - 1];
        const timeSinceLast = now - lastReqTime;
        if (timeSinceLast < this.minIntervalMs) {
          const sleepDuration = this.minIntervalMs - timeSinceLast;
          await this.sleep(sleepDuration);
          now = Date.now();
        }
      }

      this.requestTimestamps.push(now);
    } finally {
      releaseLock!();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

interface CacheEntry {
  data: any;
  status: number;
  statusText: string;
  headers: any;
  timestamp: number;
  ttlMs: number;
}

class ApiCacheManager {
  private cache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<any>>();

  // Specific TTLs per route pattern (in milliseconds)
  private routeTtl: Array<{ pattern: string; ttlMs: number }> = [
    { pattern: '/CategoryMaster', ttlMs: 30000 },
    { pattern: '/ItemMaster', ttlMs: 30000 },
    { pattern: '/RestaurantConfiguration', ttlMs: 60000 },
    { pattern: '/RestaurantTable', ttlMs: 15000 },
    { pattern: '/Reports', ttlMs: 15000 },
    { pattern: '/Order/TodayRevenue', ttlMs: 10000 },
    { pattern: '/Wallet', ttlMs: 15000 },
    { pattern: '/Subscription/ActivePlan', ttlMs: 60000 },
    { pattern: '/Subscription/Configuration', ttlMs: 120000 },
    { pattern: '/Subscription/RestaurantSubscription', ttlMs: 60000 },
  ];

  private getTtl(url: string): number {
    const match = this.routeTtl.find((r) => url.includes(r.pattern));
    return match ? match.ttlMs : 0;
  }

  get(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry;
  }

  set(key: string, url: string, response: any): void {
    const ttlMs = this.getTtl(url);
    if (ttlMs <= 0) return;
    this.cache.set(key, {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      timestamp: Date.now(),
      ttlMs,
    });
  }

  getInFlight(key: string): Promise<any> | undefined {
    return this.inFlight.get(key);
  }

  setInFlight(key: string, promise: Promise<any>): void {
    this.inFlight.set(key, promise);
  }

  deleteInFlight(key: string): void {
    this.inFlight.delete(key);
  }

  invalidate(urlPattern?: string): void {
    if (!urlPattern) {
      this.cache.clear();
      return;
    }
    for (const key of Array.from(this.cache.keys())) {
      if (
        key.includes(urlPattern) ||
        urlPattern.includes('ItemMaster') ||
        urlPattern.includes('CategoryMaster') ||
        urlPattern.includes('Order') ||
        urlPattern.includes('Table') ||
        urlPattern.includes('Subscription')
      ) {
        this.cache.delete(key);
      }
    }
  }
}

export const apiCacheManager = new ApiCacheManager();

export const apiRateLimiter = new ApiRateLimiter();

export const apiClient = axios.create({
  baseURL: APP_CONSTANTS.API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 25000,
});

const rawRequest = apiClient.request.bind(apiClient);

(apiClient as any).request = async function (config: any) {
  const method = (config?.method || 'get').toUpperCase();

  if (method === 'GET') {
    const activeRestId = (globalThis as any).__MENZA_ACTIVE_REST_ID__ || '';
    const cacheKey = `GET::${config.url}::${JSON.stringify(config.params || {})}::${activeRestId}`;

    // 1. Check TTL cache
    const cached = apiCacheManager.get(cacheKey);
    if (cached) {
      return {
        data: cached.data,
        status: cached.status,
        statusText: cached.statusText,
        headers: cached.headers,
        config,
      };
    }

    // 2. Check in-flight duplicate (deduplication)
    const inFlight = apiCacheManager.getInFlight(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    // 3. Dispatch and cache
    const promise = rawRequest(config)
      .then((res: any) => {
        apiCacheManager.set(cacheKey, config.url || '', res);
        return res;
      })
      .finally(() => {
        apiCacheManager.deleteInFlight(cacheKey);
      });

    apiCacheManager.setInFlight(cacheKey, promise);
    return promise;
  }

  // Invalidate on mutations
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    apiCacheManager.invalidate(config?.url || '');
  }

  return rawRequest(config);
};

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

// Request Interceptor: Rate Limiter + JWT Token & Active Restaurant ID + Logging Correlation
apiClient.interceptors.request.use(
  async (config) => {
    // 1. Acquire client-side rate limit slot
    await apiRateLimiter.acquire(config);

    const storeState = useAuthStore.getState();
    const token = (globalThis as any).__MENZA_AUTH_TOKEN__ || storeState.token;
    const activeRestId = (globalThis as any).__MENZA_ACTIVE_REST_ID__ || storeState.activeRestaurant?.restaurantId;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const isAuthRoute = config.url?.includes('/Auth/');

    if (activeRestId && !isAuthRoute && typeof activeRestId === 'number' && !isNaN(activeRestId)) {
      config.headers['X-Active-Restaurant-Id'] = activeRestId.toString();
      config.headers['X-Restaurant-Id'] = activeRestId.toString();
    }

    // Attach client mobile identifier to support mobile-partitioned rate limiting
    const clientMobile = storeState.user?.mobile || (config.data?.mobile ? String(config.data.mobile).trim() : '');
    if (clientMobile && clientMobile.length >= 10) {
      config.headers['X-Client-Mobile'] = clientMobile;
    }

    // Attach request metadata for logging & correlation
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const startTime = Date.now();
    (config as any)._requestId = requestId;
    (config as any)._startTime = startTime;

    logger.api(
      'API_REQUEST',
      `${(config.method || 'GET').toUpperCase()} ${config.url}`,
      {
        hasParams: Boolean(config.params),
        hasBody: Boolean(config.data),
      },
      {
        requestId,
        apiEndpoint: config.url,
        httpMethod: (config.method || 'GET').toUpperCase(),
        restaurantId: activeRestId,
      }
    );

    return config;
  },
  (error) => {
    logger.api('API_ERROR', 'Request interceptor error', { error: error?.message });
    return Promise.reject(error);
  }
);

// Response Interceptor: Handles 429 Rate Limit Retry & 401 Unauthorized token renewal via POST /api/Auth/Refresh
apiClient.interceptors.response.use(
  (response) => {
    const config = response.config as any;
    const requestId = config?._requestId;
    const startTime = config?._startTime;
    const durationMs = startTime ? Date.now() - startTime : 0;
    const method = (config?.method || 'GET').toUpperCase();
    const url = config?.url || '';

    logger.api(
      'API_RESPONSE',
      `${method} ${url} [${response.status}] in ${durationMs}ms`,
      { status: response.status, durationMs },
      {
        requestId,
        durationMs,
        statusCode: response.status,
        apiEndpoint: url,
        httpMethod: method,
      }
    );

    if (durationMs > 8000) {
      logger.api(
        'API_SLOW_REQUEST',
        `Slow API Request (${durationMs}ms): ${method} ${url}`,
        { durationMs, thresholdMs: 8000 },
        { requestId, durationMs, apiEndpoint: url, httpMethod: method }
      );
    }

    return response;
  },
  async (error) => {
    const originalRequest = error.config as any;
    const requestId = originalRequest?._requestId;
    const startTime = originalRequest?._startTime;
    const durationMs = startTime ? Date.now() - startTime : 0;
    const method = (originalRequest?.method || 'GET').toUpperCase();
    const url = originalRequest?.url || '';
    const status = error.response?.status;

    logger.api(
      'API_ERROR',
      `API Error ${method} ${url} [${status || 'NETWORK_ERR'}]`,
      {
        status,
        errorMessage: error.message,
        responseData: error.response?.data,
      },
      {
        requestId,
        durationMs,
        statusCode: status,
        apiEndpoint: url,
        httpMethod: method,
      }
    );

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // 1. Handle Transient Network Faults & 502/503/504 Server Errors with Exponential Backoff
    const isTransientError =
      !error.response ||
      error.code === 'ECONNABORTED' ||
      error.message?.includes('Network Error') ||
      status === 502 ||
      status === 503 ||
      status === 504;

    const isIdempotentMethod = ['GET', 'HEAD', 'OPTIONS'].includes(method);
    const allowRetry = isIdempotentMethod || originalRequest._resilientRetry;
    const currentRetryCount = originalRequest._transientRetryCount || 0;
    const maxTransientRetries = 2;

    if (isTransientError && allowRetry && currentRetryCount < maxTransientRetries) {
      originalRequest._transientRetryCount = currentRetryCount + 1;
      const backoffMs = 500 * Math.pow(2, currentRetryCount) + Math.floor(Math.random() * 200);

      logger.api(
        'API_REQUEST',
        `Transient network issue on ${method} ${url} [${status || error.code || 'NET_FAIL'}]. Retrying (attempt ${originalRequest._transientRetryCount}/${maxTransientRetries}) in ${backoffMs}ms...`,
        { backoffMs, attempt: originalRequest._transientRetryCount },
        { requestId, apiEndpoint: url, httpMethod: method, statusCode: status }
      );

      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      return apiClient(originalRequest);
    }

    // 2. Handle HTTP 429 Too Many Requests with Exponential Backoff & Jitter
    const isAuthRoute =
      url.includes('/Auth/Login') ||
      url.includes('/Auth/GenerateOtp') ||
      url.includes('/Auth/Refresh');

    if (status === 429) {
      const retryAfterHeader = error.response?.headers?.['retry-after'];
      const retryAfterFromBody = error.response?.data?.retryAfterSeconds;
      const retryAfterSec = retryAfterHeader
        ? parseInt(retryAfterHeader, 10)
        : typeof retryAfterFromBody === 'number'
        ? retryAfterFromBody
        : null;

      const current429Count = originalRequest._rateLimitRetryCount || 0;
      const max429Retries = isAuthRoute ? 1 : 2;
      const isShortWait = !retryAfterSec || retryAfterSec <= 8;

      if (current429Count < max429Retries && isShortWait) {
        originalRequest._rateLimitRetryCount = current429Count + 1;

        // Exponential backoff base with randomized jitter to break thundering herd
        const baseMs = retryAfterSec
          ? retryAfterSec * 1000
          : Math.min(600 * Math.pow(2, current429Count), 3000);
        const jitter = Math.floor(Math.random() * 300); // 0-300ms random jitter
        const totalWaitMs = baseMs + jitter;

        logger.api(
          'API_REQUEST',
          `Server Rate Limit 429 on ${method} ${url}. Backing off for ${totalWaitMs}ms before auto-retrying (attempt ${originalRequest._rateLimitRetryCount}/${max429Retries})...`,
          { totalWaitMs, attempt: originalRequest._rateLimitRetryCount },
          { requestId, apiEndpoint: url, httpMethod: method, statusCode: 429 }
        );

        await new Promise((resolve) => setTimeout(resolve, totalWaitMs));
        return apiClient(originalRequest);
      }

      logger.api(
        'API_ERROR',
        `Server Rate Limit 429 on ${method} ${url} exhausted retries: ${error.response?.data?.message || error.message}`,
        { isAuthRoute, responseData: error.response?.data },
        { requestId, apiEndpoint: url, httpMethod: method, statusCode: 429 }
      );
      return Promise.reject(error);
    }

    // 2. Handle HTTP 402 Payment Required / Subscription Expired
    if (
      status === 402 ||
      error.response?.data?.errorCode === 'SUBSCRIPTION_EXPIRED' ||
      (typeof error.response?.data?.message === 'string' &&
        error.response?.data?.message.includes('SUBSCRIPTION_EXPIRED'))
    ) {
      const msg =
        error.response?.data?.message ||
        'Restaurant subscription has expired past the grace period. Please renew to take orders.';
      logger.api(
        'API_ERROR',
        `Subscription Expired on ${method} ${url}. Emitting SubscriptionEvents.emitExpired.`,
        { status, data: error.response?.data }
      );
      SubscriptionEvents.emitExpired(msg);
      return Promise.reject(error);
    }

    // 3. Check if the request URL is a public auth endpoint that shouldn't trigger refresh token renewal on 401
    const requestUrl = originalRequest.url || '';
    const isAuthEndpoint =
      requestUrl.includes('/Auth/Login') ||
      requestUrl.includes('/Auth/GenerateOtp') ||
      requestUrl.includes('/Auth/Refresh');

    if (status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      const storeState = useAuthStore.getState();
      const currentToken = (globalThis as any).__MENZA_AUTH_TOKEN__ || storeState.token;
      const currentRefreshToken = (globalThis as any).__MENZA_REFRESH_TOKEN__ || storeState.refreshToken;

      const requestAuthHeader = originalRequest.headers?.Authorization as string | undefined;
      const requestToken = requestAuthHeader ? requestAuthHeader.replace(/^Bearer\s+/i, '').trim() : '';

      // 1. Concurrent check: if the stored token has already been refreshed by another concurrent request,
      // retry immediately with the latest token without hitting /Auth/Refresh again.
      if (currentToken && requestToken && currentToken !== requestToken) {
        logger.api('API_REQUEST', 'Retrying request with already-refreshed access token', {
          endpoint: url,
          requestId,
        });
        originalRequest._retry = true;
        originalRequest.headers.Authorization = `Bearer ${currentToken}`;
        return apiClient(originalRequest);
      }

      if (isRefreshing) {
        logger.api('API_REQUEST', 'Queuing pending request during active token refresh', {
          endpoint: url,
          requestId,
        });

        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            logger.api('API_REQUEST', 'Retrying queued request with new access token', {
              endpoint: url,
              requestId,
            });
            originalRequest._retry = true;
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const isMockToken = (t: string | null) => Boolean(t && (t.startsWith('mock-') || t.includes('mock')));

      if (isMockToken(currentToken) || isMockToken(currentRefreshToken)) {
        isRefreshing = false;
        return Promise.reject(error);
      }

      if (currentToken && currentRefreshToken) {
        try {
          logger.api('API_REQUEST', 'Initiating session token renewal', {
            endpoint: '/Auth/Refresh',
          });

          const refreshHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentToken}`,
          };

          const refreshResponse = await axios.post(
            `${APP_CONSTANTS.API_BASE_URL}/Auth/Refresh`,
            {
              token: currentToken,
              Token: currentToken,
              accessToken: currentToken,
              AccessToken: currentToken,
              refreshToken: currentRefreshToken,
              RefreshToken: currentRefreshToken,
            },
            {
              headers: refreshHeaders,
              timeout: 15000,
            }
          );

          // Support both unwrapped AuthResponseModel and wrapped response envelopes
          const raw = refreshResponse.data?.data ?? refreshResponse.data;

          const newAccessToken =
            raw?.token ||
            raw?.Token ||
            raw?.accessToken ||
            raw?.AccessToken;

          const newRefreshToken =
            raw?.refreshToken ||
            raw?.RefreshToken ||
            raw?.refresh_token ||
            currentRefreshToken;

          if (newAccessToken) {
            logger.api('API_REQUEST', 'Session token renewed successfully');

            (globalThis as any).__MENZA_AUTH_TOKEN__ = newAccessToken;
            (globalThis as any).__MENZA_REFRESH_TOKEN__ = newRefreshToken;
            storeState.updateTokens(newAccessToken, newRefreshToken);

            processQueue(null, newAccessToken);
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return apiClient(originalRequest);
          } else {
            throw new Error('Refresh response missing access token.');
          }
        } catch (refreshErr: any) {
          const refreshStatus = refreshErr?.response?.status;
          logger.api('API_ERROR', 'Session token renewal failed', {
            status: refreshStatus,
            error: refreshErr?.message,
          });

          processQueue(refreshErr, null);

          // Strictly reserve logout for explicit authentication rejection from backend.
          // Never log out on network disconnects, timeouts, 502/503/504 gateway errors, or 429 rate limits!
                    const errData = refreshErr?.response?.data;
          const errMsg = typeof errData === 'string'
            ? errData
            : String(errData?.message || errData?.error || errData?.title || '');

          const isExplicitAuthFailure =
            refreshStatus === 401 ||
            refreshStatus === 403 ||
            refreshStatus === 400 ||
            errMsg.toLowerCase().includes('token') ||
            errMsg.toLowerCase().includes('unauthorized') ||
            errMsg.toLowerCase().includes('invalid');

          if (isExplicitAuthFailure) {
            logger.auth('AUTH_SESSION_EXPIRED', 'Refresh token expired or invalid. Logging out.');
            storeState.logout();
          }

          return Promise.reject(refreshErr);
        } finally {
          isRefreshing = false;
        }
      } else {
        if (storeState.isAuthenticated) {
          logger.api('API_ERROR', '401 Unauthorized detected with no refresh token present');
          storeState.logout();
        }
      }
    }

    return Promise.reject(error);
  }
);
