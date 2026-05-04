/**
 * `@react-native-async-storage/async-storage` in-memory shim.
 * Lets any transitive import (e.g. analytics bootstrap) succeed without
 * calling native bridges. Tests that need to assert storage writes should
 * `vi.mock(...)` with a spy instead.
 */
const store = new Map<string, string>();

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    return store.has(key) ? store.get(key)! : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    store.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    store.delete(key);
  },
  async clear(): Promise<void> {
    store.clear();
  },
  async multiGet(keys: readonly string[]): Promise<[string, string | null][]> {
    return keys.map((k) => [k, store.has(k) ? store.get(k)! : null]);
  },
  async multiSet(entries: readonly [string, string][]): Promise<void> {
    for (const [k, v] of entries) store.set(k, v);
  },
  async multiRemove(keys: readonly string[]): Promise<void> {
    for (const k of keys) store.delete(k);
  },
  async getAllKeys(): Promise<string[]> {
    return Array.from(store.keys());
  },
};

export default AsyncStorage;
