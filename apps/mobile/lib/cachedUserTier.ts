/**
 * Persisted last-known user tier ("free" / "base" / "pro").
 *
 * Why this exists
 * ---------------
 * The planner Free-gate (and any other surface that branches on
 * `userTier`) used to default to `"free"` while an async profile +
 * RevenueCat reconcile resolved on mount. For paid users, that meant
 * a brief "Upgrade to Pro" gate flashed on every Plan-tab open
 * (TestFlight `AIm3KPwBYlA1IjOMRJf_edQ`, `AIryDu7i28RlWOsKKbHF_aI`,
 * `ADpuHU6O7jEYsHMKjpiW3_w` — repeats post-F-58).
 *
 * Defaulting to a cached "pro" reads the current state on mount in
 * one synchronous step, eliminating the gate flash. The async
 * reconcile still runs and overwrites the cache on every successful
 * resolve — so the cache cannot drift indefinitely.
 *
 * Falls back to `"free"` if no cache exists (first install) — the
 * gate is then accurate for genuinely-Free users.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export type CachedTier = "free" | "base" | "pro";

const KEY = "suppr.cached_user_tier";

/**
 * Normalise a stored/profile tier string to a cached gate tier.
 * `lifetime_pro` (founding-cohort comp, ENG-1043) gates as `pro` — collapse it
 * so the synchronous gate read treats founders as Pro (no upgrade-gate flash).
 */
export function normaliseCachedTier(raw: string | null | undefined): CachedTier {
  if (raw === "lifetime_pro" || raw === "pro") return "pro";
  if (raw === "base") return "base";
  return "free";
}

export async function loadCachedUserTier(): Promise<CachedTier> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v === "free" || v === "base" || v === "pro") return v;
    // A legacy cache may hold the raw `lifetime_pro` string — normalise it.
    if (v === "lifetime_pro") return "pro";
  } catch {
    // ignore — fall through to default
  }
  return "free";
}

export async function saveCachedUserTier(t: CachedTier | "lifetime_pro"): Promise<void> {
  try {
    // Store the gate-equivalent tier so reads never need to re-normalise.
    await AsyncStorage.setItem(KEY, normaliseCachedTier(t));
  } catch {
    // best-effort; the live profile read still resolves the gate
  }
}
