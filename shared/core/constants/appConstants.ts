const DEFAULT_API_BASE_URL =
  'https://restadmin20260810182511-b7gaaqbfesdxa3cu.centralindia-01.azurewebsites.net/api';
const DEFAULT_CUSTOMER_ORDERING_BASE_URL =
  'https://lemon-mud-097d55a00.7.azurestaticapps.net';

export const APP_CONSTANTS = {
  APP_NAME:
    process.env.NEXT_PUBLIC_APP_NAME ||
    process.env.EXPO_PUBLIC_APP_NAME ||
    process.env.APP_NAME ||
    'Menza',
  APP_TAGLINE: 'Smart Multi-Tenant Restaurant Suite',
  // Live Azure Web API Endpoint (Configurable via .env, Vercel & EAS)
  API_BASE_URL:
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    DEFAULT_API_BASE_URL,
  // Configurable Customer QR Ordering Web App URL
  CUSTOMER_ORDERING_BASE_URL:
    process.env.NEXT_PUBLIC_CUSTOMER_ORDERING_BASE_URL ||
    process.env.EXPO_PUBLIC_CUSTOMER_ORDERING_BASE_URL ||
    process.env.CUSTOMER_ORDERING_BASE_URL ||
    DEFAULT_CUSTOMER_ORDERING_BASE_URL,
  // Cashfree Environment (SANDBOX or PRODUCTION)
  CASHFREE_ENV:
    process.env.NEXT_PUBLIC_CASHFREE_ENV ||
    process.env.EXPO_PUBLIC_CASHFREE_ENV ||
    process.env.CASHFREE_ENV ||
    'SANDBOX',

  ROLES: {
    SUPER_ADMIN: 'SuperAdmin',
    OWNER: 'Owner',
    MANAGER: 'Manager',
    CASHIER: 'Cashier',
    WAITER: 'Waiter',
    CHEF: 'Chef',
  },

  BILLING_MODES: {
    PRE_PAID: 'PRE_PAID',
    POST_PAID: 'POST_PAID',
    PAY_LATER: 'PAY_LATER',
    PAY_AND_SETTLE: 'PAY_AND_SETTLE',
  },

  POS_CHECKOUT_MODES: {
    KOT_PAY_LATER: 'KOT_PAY_LATER',
    PAY_AND_SETTLE: 'PAY_AND_SETTLE',
  },

  SPLASH_SLIDES: [
    {
      id: '1',
      badge: 'SMART RESTAURANT SUITE',
      title: 'Seamless Floor &\nTable Management',
      description: 'Streamline dining operations, track table states in real-time, and provide fast, automated table service.',
      iconName: 'layout-grid',
      gradient: ['#6366F1', '#4F46E5'],
    },
    {
      id: '2',
      badge: 'LIVE KDS & POS',
      title: 'Kitchen & Counter\nInstant Sync',
      description: 'Connect waiters, cashiers, and kitchen display systems (KDS) effortlessly with automated KOT ticketing.',
      iconName: 'utensils-crossed',
      gradient: ['#10B981', '#059669'],
    },
    {
      id: '3',
      badge: 'MULTI-STORE CONTROLLER',
      title: 'Powerful Multi-Store\nAnalytics & Roles',
      description: 'Switch between restaurant locations, monitor revenue growth, and manage staff roles with enterprise precision.',
      iconName: 'trending-up',
      gradient: ['#F59E0B', '#D97706'],
    },
  ]
};
