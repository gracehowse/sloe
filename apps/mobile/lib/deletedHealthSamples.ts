/**
 * F-130 (`Grace, 2026-05-07`) — local tombstone for HealthKit / MFP
 * sample IDs the user has explicitly deleted from their journal.
 *
 * The bug: HK sync imports samples that aren't already in
 * `nutrition_entries` (matched on `health_sample_id`). When a user
 * deletes an apple_health-sourced row, the next sync sees the same
 * HK sample, finds no row to dedup against, and re-imports it. The
 * "duplicate" reappears.
 *
 * The fix: persist a Set of deleted HK sample IDs in AsyncStorage
 * and OR it into `existingHkIds` during the next sync so previously-
 * deleted samples stay deleted.
 *
 * Scope: local-only (one device). Solo tester for now (memory:
 * project_solo_tester); cross-device durability would need a
 * server-side column on `profiles` or a `deleted_health_samples`
 * table — filed as a follow-up. AsyncStorage is the right cheap
 * unblock for the single-device case Grace reported.
 *
 * Edge cases:
 *  - User clears AsyncStorage / reinstalls → tombstone wiped → all
 *    previously-deleted HK meals re-import on next sync. Annoying
 *    but not destructive.
 *  - User deletes a non-HK meal → no-op (HK sample id is null).
 *  - HK sample IDs are stable UUIDs per HKQuantitySample, so the
 *    set doesn't grow unboundedly per real meal — only on duplicate
 *    HK writes (rare).
 */

const STORAGE_KEY = "@suppr/deletedHealthSampleIds/v1";

let memoCache: Set<string> | null = null;

/** Replace the in-memory cache. Used by tests. */
export function __resetDeletedHealthSamplesCacheForTests(): void {
  memoCache = null;
}

async function loadFromStorage(): Promise<Set<string>> {
  if (memoCache) return memoCache;
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      memoCache = new Set();
      return memoCache;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      memoCache = new Set();
      return memoCache;
    }
    memoCache = new Set(parsed.filter((x): x is string => typeof x === "string" && x.length > 0));
    return memoCache;
  } catch {
    memoCache = new Set();
    return memoCache;
  }
}

async function persist(set: Set<string>): Promise<void> {
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // AsyncStorage failures are non-fatal — the next attempt will retry.
  }
}

/**
 * Mark an HK sample as user-deleted. No-op when `id` is null / empty.
 * Fire-and-forget at every call site; the meal row deletion is the
 * source of truth, so a failed tombstone leaves the row gone but may
 * cause one re-import. Acceptable.
 */
export async function markHealthSampleDeleted(id: string | null | undefined): Promise<void> {
  if (!id || typeof id !== "string") return;
  const set = await loadFromStorage();
  if (set.has(id)) return;
  set.add(id);
  await persist(set);
}

/** Read the current tombstone set. Empty set if storage was wiped. */
export async function loadDeletedHealthSampleIds(): Promise<ReadonlySet<string>> {
  return loadFromStorage();
}

/**
 * Clear the tombstone. Exposed for a future "Re-import all from
 * Apple Health" affordance — not wired today.
 */
export async function clearDeletedHealthSampleIds(): Promise<void> {
  memoCache = new Set();
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Non-fatal.
  }
}
