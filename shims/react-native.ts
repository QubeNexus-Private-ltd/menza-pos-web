/**
 * Web compatibility shim for react-native
 * Translates React Native primitives and utilities to standard browser web APIs.
 */

export const Platform = {
  OS: 'web',
  select: (options: Record<string, any>) => options.web || options.default || null,
  isTesting: false,
};

export const Alert = {
  alert: (title: string, message?: string, buttons?: Array<{ text?: string; onPress?: () => void }>) => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(`${title}${message ? '\n\n' + message : ''}`);
      if (confirmed && buttons && buttons.length > 0) {
        const okBtn = buttons.find((b) => !b.text?.toLowerCase().includes('cancel')) || buttons[0];
        okBtn.onPress?.();
      }
    }
  },
};

export const Vibration = {
  vibrate: (pattern?: number | number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern || 200);
      } catch {
        // Silently ignore browser vibration permissions
      }
    }
  },
  cancel: () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch {}
    }
  },
};

export const NativeModules: Record<string, any> = {
  BluetoothPrinterModule: null,
  OrderAlertModule: null,
  CFPaymentGatewayModule: null,
};

export const PermissionsAndroid = {
  PERMISSIONS: {},
  request: async () => 'granted',
  check: async () => true,
  requestMultiple: async () => ({}),
};

export const useColorScheme = () => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

export const StyleSheet = {
  create: (styles: Record<string, any>) => styles,
  flatten: (style: any) => style,
};

export const Dimensions = {
  get: () => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
    scale: 1,
    fontScale: 1,
  }),
  addEventListener: () => ({ remove: () => {} }),
};

export default {
  Platform,
  Alert,
  Vibration,
  NativeModules,
  PermissionsAndroid,
  useColorScheme,
  StyleSheet,
  Dimensions,
};
