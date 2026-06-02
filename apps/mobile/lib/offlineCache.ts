/**
 * Simple offline cache using AsyncStorage.
 * Caches recipe data, meal plans, and nutrition journal locally
 * so the app is usable without internet.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  discoverRecipes: "pm:cache:discover",
  // Per-user prefix (trailing colon): saved/library recipes are private to
  // the signed-in account, so the cache key embeds the userId. Sign-out's
  // `clearUserScopedAsyncStorage()` deliberately does NOT wipe userId-scoped
  // keys (per its documented policy they pick up the correct per-user value
  // on next sign-in), so this scoping is exactly what prevents one account's
  // library flashing for another on a shared device — no sign-out wiring
  // needed.
  savedRecipes: "pm:cache:saved:",
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
  // F-59 (2026-04-22): never persist an empty array — a pre-F-50
  // build may have written `[]` when Discover was genuinely broken,
  // and cold-paints of that empty cache now flash "No recipes yet"
  // before the network fetch completes.
  if (!Array.isArray(recipes) || recipes.length === 0) return;
  await setWithExpiry(KEYS.discoverRecipes, recipes);
}

export async function getCachedDiscoverRecipes(): Promise<unknown[] | null> {
  // F-59 (2026-04-22): treat a cached empty array as no cache. Belt-
  // and-suspenders against poison-cache carried over from older
  // broken builds where `cacheDiscoverRecipes([])` had fired.
  const value = await getWithExpiry(KEYS.discoverRecipes);
  if (Array.isArray(value) && value.length === 0) return null;
  return value as unknown[] | null;
}

export async function cacheSavedRecipes(
  userId: string,
  recipes: unknown[],
): Promise<void> {
  // Never persist an empty array (same rationale as cacheDiscoverRecipes):
  // a transient empty — e.g. a timed-out fetch — must not poison the cache
  // and make a populated library cold-paint as "empty" next session.
  if (!userId || !Array.isArray(recipes) || recipes.length === 0) return;
  await setWithExpiry(KEYS.savedRecipes + userId, recipes);
}

export async function getCachedSavedRecipes(
  userId: string,
): Promise<unknown[] | null> {
  if (!userId) return null;
  const value = await getWithExpiry(KEYS.savedRecipes + userId);
  if (Array.isArray(value) && value.length === 0) return null;
  return value as unknown[] | null;
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
