/**
 * Global web environment polyfills
 * Provides browser definitions for React Native runtime globals like __DEV__.
 */
if (typeof globalThis !== 'undefined') {
  if (typeof (globalThis as any).__DEV__ === 'undefined') {
    (globalThis as any).__DEV__ = process.env.NODE_ENV !== 'production';
  }
  if (typeof (globalThis as any).global === 'undefined') {
    (globalThis as any).global = globalThis;
  }
}

if (typeof window !== 'undefined') {
  if (typeof (window as any).__DEV__ === 'undefined') {
    (window as any).__DEV__ = process.env.NODE_ENV !== 'production';
  }
}

export {};
