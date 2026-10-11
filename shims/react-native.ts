/**
 * Web compatibility shim for react-native
 * Translates React Native primitives and utilities to standard browser web APIs.
 */

export const Platform: any = {
  OS: 'web',
  Version: 1,
  select: (options: Record<string, any>) => options.web || options.default || null,
  isTesting: false,
};

export const Alert = {
  alert: (title: string, message?: string, buttons?: Array<{ text?: string; onPress?: () => void; style?: string }>) => {
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

export const PermissionsAndroid: any = {
  PERMISSIONS: {
    BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
    BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
    ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    NEVER_ASK_AGAIN: 'never_ask_again',
  },
  request: async (permission?: any, rationale?: any): Promise<string> => 'granted',
  check: async (permission?: any): Promise<boolean> => true,
  requestMultiple: async (permissions?: any): Promise<Record<string, string>> => ({}),
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

export type AppStateStatus = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';

export const AppState = {
  currentState: 'active' as AppStateStatus,
  addEventListener: (type: string, listener: (state: AppStateStatus) => void) => {
    if (typeof document !== 'undefined') {
      const visibilityHandler = () => {
        listener(document.visibilityState === 'visible' ? 'active' : 'background');
      };
      document.addEventListener('visibilitychange', visibilityHandler);
      return {
        remove: () => {
          document.removeEventListener('visibilitychange', visibilityHandler);
        },
      };
    }
    return { remove: () => {} };
  },
  removeEventListener: (type: string, listener: (state: AppStateStatus) => void) => {},
};

export const View = (props: any) => null;
export const Text = (props: any) => null;
export const TouchableOpacity = (props: any) => null;
export type StyleProp<T> = any;
export type ViewStyle = any;
export type TextStyle = any;
export type ImageStyle = any;

export const Linking = {
  openURL: async (url: string) => {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
      return true;
    }
    return false;
  },
  canOpenURL: async (url: string) => true,
  openSettings: async () => {},
  getInitialURL: async () => null,
  sendIntent: async (action: string, extras?: any[]) => {},
  addEventListener: () => ({ remove: () => {} }),
  removeEventListener: () => {},
};

export class NativeEventEmitter {
  constructor(nativeModule?: any) {}
  addListener(eventType: string, listener: (...args: any[]) => any) {
    return { remove: () => {} };
  }
  removeAllListeners(eventType?: string) {}
  emit(eventType: string, ...params: any[]) {}
}

export default {
  Platform,
  Alert,
  Vibration,
  NativeModules,
  PermissionsAndroid,
  useColorScheme,
  StyleSheet,
  Dimensions,
  AppState,
  Linking,
  NativeEventEmitter,
};

