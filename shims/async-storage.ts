/**
 * Web localStorage adapter shim for @react-native-async-storage/async-storage
 * Provides an identical async interface for web environments.
 */

const memoryStore = new Map<string, string>();

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    if (isBrowser) {
      try {
        return window.localStorage.getItem(key);
      } catch (err) {
        console.warn(`[AsyncStorage Web Shim] getItem failed for ${key}:`, err);
      }
    }
    return memoryStore.get(key) ?? null;
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isBrowser) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch (err) {
        console.warn(`[AsyncStorage Web Shim] setItem failed for ${key}:`, err);
      }
    }
    memoryStore.set(key, value);
  },

  async removeItem(key: string): Promise<void> {
    if (isBrowser) {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch (err) {
        console.warn(`[AsyncStorage Web Shim] removeItem failed for ${key}:`, err);
      }
    }
    memoryStore.delete(key);
  },

  async clear(): Promise<void> {
    if (isBrowser) {
      try {
        window.localStorage.clear();
        return;
      } catch (err) {
        console.warn('[AsyncStorage Web Shim] clear failed:', err);
      }
    }
    memoryStore.clear();
  },

  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    const results: [string, string | null][] = [];
    for (const key of keys) {
      const val = await this.getItem(key);
      results.push([key, val]);
    }
    return results;
  },

  async multiSet(keyValuePairs: [string, string][]): Promise<void> {
    for (const [key, value] of keyValuePairs) {
      await this.setItem(key, value);
    }
  },

  async multiRemove(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.removeItem(key);
    }
  },

  async getAllKeys(): Promise<string[]> {
    if (isBrowser) {
      try {
        return Object.keys(window.localStorage);
      } catch {
        return Array.from(memoryStore.keys());
      }
    }
    return Array.from(memoryStore.keys());
  },
};

export default AsyncStorage;
