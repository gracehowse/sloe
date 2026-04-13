/**
 * Simple offline cache using AsyncStorage.
 * Caches recipe data, meal plans, and nutrition journal locally
 * so the app is usable without internet.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  discoverRecipes: "pm:cache:discover",
  savedRecipes: "pm:cache:saved",
  mealPlan: "pm:cache:plan",
  nutritionJournal: "pm:cache:journal",
  lastRecipe: "pm:cache:lastRecipe:",
};

/** Cache with expiry (default 24 hours) */
async function setWithExpiry<T>(key: string, data: T, ttlMs = 24 * 60 * 60 * 1000): Promise<void> {
  try {
    const entry = { data, expiresAt: Date.now() + ttlMs };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch (e) {
    console.warn("[offlineCache] set failed:", key, e);
  }
}

/** Get cached data (returns null if expired or missing) */
async function getWithExpiry<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as { data: T; expiresAt: number };
    if (Date.now() > entry.expiresAt) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

// ── Public API ──────────────────────────────────────────────────────

export async function cacheDiscoverRecipes(recipes: unknown[]): Promise<void> {
  await setWithExpiry(KEYS.discoverRecipes, recipes);
}

export async function getCachedDiscoverRecipes(): Promise<unknown[] | null> {
  return getWithExpiry(KEYS.discoverRecipes);
}

export async function cacheSavedRecipes(recipes: unknown[]): Promise<void> {
  await setWithExpiry(KEYS.savedRecipes, recipes);
}

export async function getCachedSavedRecipes(): Promise<unknown[] | null> {
  return getWithExpiry(KEYS.savedRecipes);
}

export async function cacheMealPlan(plan: unknown): Promise<void> {
  await setWithExpiry(KEYS.mealPlan, plan, 7 * 24 * 60 * 60 * 1000); // 7 day TTL
}

export async function getCachedMealPlan(): Promise<unknown | null> {
  return getWithExpiry(KEYS.mealPlan);
}

export async function cacheRecipeDetail(recipeId: string, data: unknown): Promise<void> {
  await setWithExpiry(KEYS.lastRecipe + recipeId, data, 7 * 24 * 60 * 60 * 1000);
}

export async function getCachedRecipeDetail(recipeId: string): Promise<unknown | null> {
  return getWithExpiry(KEYS.lastRecipe + recipeId);
}

/** Clear all caches (e.g., on sign out) */
export async function clearAllCaches(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const pmKeys = keys.filter((k) => k.startsWith("pm:cache:"));
  if (pmKeys.length > 0) {
    await AsyncStorage.multiRemove(pmKeys);
  }
}
