/** No-op AsyncStorage for Storybook. */
const store = new Map<string, string>();

export async function getItem(key: string): Promise<string | null> {
  return store.has(key) ? store.get(key)! : null;
}

export async function setItem(key: string, value: string): Promise<void> {
  store.set(key, value);
}

export async function removeItem(key: string): Promise<void> {
  store.delete(key);
}

export async function clear(): Promise<void> {
  store.clear();
}

export default { getItem, setItem, removeItem, clear };
