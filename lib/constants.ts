function normalizeApiUrl(rawUrl?: string): string {
  const fallback = 'https://menzaposapi20260927220419-efbdafa3buaccge8.centralindia-01.azurewebsites.net/api';
  const url = (rawUrl || '').trim();
  if (!url) return fallback;
  const stripped = url.replace(/\/+$/, '');
  return stripped.endsWith('/api') ? stripped : `${stripped}/api`;
}

const resolvedApiUrl = normalizeApiUrl(
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL
);

export const APP_CONSTANTS = {
  APP_NAME: 'Menza Web POS',
  VERSION: '1.0.0',
  DEFAULT_API_URL: resolvedApiUrl,
  API_BASE_URL: resolvedApiUrl,
  STORAGE_KEYS: {
    AUTH_TOKEN: 'menza_auth_token',
    REFRESH_TOKEN: 'menza_refresh_token',
    USER_DATA: 'menza_user_data',
    ACTIVE_RESTAURANT: 'menza_active_restaurant',
    CONSENT_ACCEPTED: 'menza_consent_accepted',
    PRINTER_CONFIG: 'menza_printer_config',
    THEME: 'menza_theme',
  },
  ROLES: {
    SUPER_ADMIN: 'SUPERADMIN',
    OWNER: 'OWNER',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    CASHIER: 'CASHIER',
    WAITER: 'WAITER',
    KITCHEN: 'KITCHEN',
  },
  ORDER_STATUSES: {
    PENDING: 'PENDING',
    CONFIRMED: 'CONFIRMED',
    PREPARING: 'PREPARING',
    READY: 'READY',
    SERVED: 'SERVED',
    SETTLED: 'SETTLED',
    CANCELLED: 'CANCELLED',
  },
} as const;
