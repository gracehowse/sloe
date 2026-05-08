/**
 * Pattern #9 (tracker `AN8GJ1Dr3M`, 2026-05-08) — lightweight metadata
 * about the most recent HealthKit sync, surfaced in the
 * `WhereThisComesFromSheet` provenance UI.
 *
 * No schema migration in v1. AsyncStorage holds:
 *   - lastSyncedAtMs — set by `healthSync.ts` after every successful
 *     update of the body / dietary maps. Read by the provenance sheet
 *     to render "X min ago" on Today + Burn detail.
 *
 * Cross-device durability is out of scope for v1 (solo tester per
 * memory project_solo_tester). When we want it, swap this for a
 * profiles JSONB column + L1+L2 helper shape (matches F-130
 * cross-device pattern).
 *
 * Keep the API tiny and forgiving — every callsite is fire-and-forget.
 */

const LAST_SYNCED_AT_KEY = "@suppr/healthSyncMeta/lastSyncedAt/v1";

export async function recordHealthSyncedAt(ms: number = Date.now()): Promise<void> {
  if (!Number.isFinite(ms) || ms <= 0) return;
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    await AsyncStorage.setItem(LAST_SYNCED_AT_KEY, String(Math.floor(ms)));
  } catch {
    // Non-fatal — next successful sync re-stamps.
  }
}

export async function loadHealthLastSyncedAt(): Promise<number | null> {
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const raw = await AsyncStorage.getItem(LAST_SYNCED_AT_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Test helper. */
export async function clearHealthSyncedAt(): Promise<void> {
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    await AsyncStorage.removeItem(LAST_SYNCED_AT_KEY);
  } catch {
    /* noop */
  }
}
