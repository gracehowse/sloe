/**
 * F-130 — tombstone for HealthKit / MFP sample IDs the user has
 * explicitly deleted from their journal.
 *
 * The bug: HK sync imports samples that aren't already in
 * `nutrition_entries` (matched on `health_sample_id`). When a user
 * deletes an apple_health-sourced row, the next sync sees the same
 * HK sample, finds no row to dedup against, and re-imports it. The
 * "duplicate" reappears.
 *
 * The fix: persist a Set of deleted HK sample IDs and OR it into
 * `existingHkIds` during the next sync so previously-deleted samples
 * stay deleted.
 *
 * Storage layers (2026-05-08, F-130 cross-device):
 *  1. **AsyncStorage** (L1) — fast, offline-safe, reads on every sync
 *     for instant resolution. Survives app restart but not reinstall.
 *  2. **Supabase `deleted_health_samples` table** (L2) — survives
 *     reinstall + syncs across devices. Migration:
 *     `supabase/migrations/20260510100000_deleted_health_samples.sql`.
 *
 * Read flow: union(L1, L2). On a fresh install where L1 is empty but
 * L2 has tombstones, L2 wins; on a flaky network where L2 read fails,
 * we fall back to L1.
 *
 * Write flow: write L1 immediately, then upsert to L2 in the
 * background. On L2 failure, queue in a "pending" AsyncStorage set
 * so the next call drains it.
 *
 * Edge cases:
 *  - Migration not yet applied (older Supabase project) → L2 read/
 *    write returns relation-does-not-exist; helper falls back to
 *    L1-only silently.
 *  - User clears AsyncStorage / reinstalls → L1 wiped; on first sync
 *    L2 hydrates the in-memory cache.
 *  - User deletes a non-HK meal → no-op (HK sample id is null).
 */

import { supabase } from "./supabase";

const STORAGE_KEY = "@suppr/deletedHealthSampleIds/v1";
const PENDING_STORAGE_KEY = "@suppr/deletedHealthSampleIds/pending/v1";

let memoCache: Set<string> | null = null;
/** True once we've successfully merged the L2 (Supabase) set into the
 *  in-memory cache for the current session. Used to avoid re-fetching
 *  on every read. */
let serverHydrated = false;

/** Replace the in-memory cache. Used by tests. */
export function __resetDeletedHealthSamplesCacheForTests(): void {
  memoCache = null;
  serverHydrated = false;
}

async function readJsonArray(key: string): Promise<string[]> {
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
  } catch {
    return [];
  }
}

async function writeJsonArray(key: string, ids: ReadonlySet<string>): Promise<void> {
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    await AsyncStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    // AsyncStorage failures are non-fatal — the next attempt will retry.
  }
}

async function loadFromAsyncStorage(): Promise<Set<string>> {
  if (memoCache) return memoCache;
  const arr = await readJsonArray(STORAGE_KEY);
  memoCache = new Set(arr);
  return memoCache;
}

/** True if the supabase error looks like the migration hasn't been
 *  applied to this project yet. PostgREST returns PGRST205 / "relation
 *  does not exist" before the table exists. */
function looksLikeMissingTable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (e.code === "PGRST205" || e.code === "42P01") return true;
  if (typeof e.message === "string" && /relation .* does not exist/i.test(e.message)) {
    return true;
  }
  return false;
}

async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Drain the pending-write queue (IDs we couldn't push to L2 last time
 * because of a network / schema failure). Best-effort; failures stay
 * pending. Called at the top of every load/mark to opportunistically
 * flush before the new operation.
 */
async function drainPendingWrites(userId: string): Promise<void> {
  const pendingArr = await readJsonArray(PENDING_STORAGE_KEY);
  if (pendingArr.length === 0) return;
  const rows = pendingArr.map((id) => ({
    user_id: userId,
    health_sample_id: id,
    source: "apple_health",
  }));
  try {
    const { error } = await supabase
      .from("deleted_health_samples")
      .upsert(rows, { onConflict: "user_id,health_sample_id", ignoreDuplicates: true });
    if (error) {
      if (!looksLikeMissingTable(error)) {
        console.warn("[deletedHealthSamples] drainPendingWrites failed:", error.message);
      }
      return;
    }
    // Successful drain — clear the pending queue.
    await writeJsonArray(PENDING_STORAGE_KEY, new Set());
  } catch (err) {
    console.warn("[deletedHealthSamples] drainPendingWrites threw:", err);
  }
}

/**
 * Mark an HK sample as user-deleted. No-op when `id` is null / empty.
 * Fire-and-forget at every call site; the meal row deletion is the
 * source of truth, so a failed tombstone leaves the row gone but may
 * cause one re-import. Acceptable.
 *
 * Cross-device (F-130 follow-up): writes L1 immediately, then upserts
 * to L2 in the background. On L2 failure, queues to the pending set
 * so the next call retries.
 */
export async function markHealthSampleDeleted(id: string | null | undefined): Promise<void> {
  if (!id || typeof id !== "string") return;
  const set = await loadFromAsyncStorage();
  if (set.has(id)) return;
  set.add(id);
  await writeJsonArray(STORAGE_KEY, set);

  // L2: best-effort cross-device upsert.
  const userId = await getCurrentUserId();
  if (!userId) return;
  await drainPendingWrites(userId);
  try {
    const { error } = await supabase
      .from("deleted_health_samples")
      .upsert(
        { user_id: userId, health_sample_id: id, source: "apple_health" },
        { onConflict: "user_id,health_sample_id", ignoreDuplicates: true },
      );
    if (error) {
      if (looksLikeMissingTable(error)) {
        // Migration not applied yet — silently keep L1-only.
        return;
      }
      // Real error (network, RLS, etc.) — queue for retry.
      const pendingArr = await readJsonArray(PENDING_STORAGE_KEY);
      const pending = new Set(pendingArr);
      pending.add(id);
      await writeJsonArray(PENDING_STORAGE_KEY, pending);
      console.warn("[deletedHealthSamples] L2 upsert failed; queued:", error.message);
    }
  } catch (err) {
    const pendingArr = await readJsonArray(PENDING_STORAGE_KEY);
    const pending = new Set(pendingArr);
    pending.add(id);
    await writeJsonArray(PENDING_STORAGE_KEY, pending);
    console.warn("[deletedHealthSamples] L2 upsert threw; queued:", err);
  }
}

/**
 * Read the current tombstone set. On first call per session, hydrates
 * from Supabase (L2) and unions into the in-memory cache + AsyncStorage
 * so future reads are instant.
 */
export async function loadDeletedHealthSampleIds(): Promise<ReadonlySet<string>> {
  const local = await loadFromAsyncStorage();
  if (serverHydrated) return local;

  const userId = await getCurrentUserId();
  if (!userId) {
    // Not authenticated — local-only is the best we can do this session.
    return local;
  }
  await drainPendingWrites(userId);
  try {
    const { data, error } = await supabase
      .from("deleted_health_samples")
      .select("health_sample_id")
      .eq("user_id", userId);
    if (error) {
      if (looksLikeMissingTable(error)) {
        serverHydrated = true; // don't keep retrying within the session
        return local;
      }
      console.warn("[deletedHealthSamples] L2 read failed:", error.message);
      return local;
    }
    let dirty = false;
    for (const row of data ?? []) {
      const id = (row as { health_sample_id?: string | null }).health_sample_id;
      if (typeof id === "string" && id.length > 0 && !local.has(id)) {
        local.add(id);
        dirty = true;
      }
    }
    if (dirty) await writeJsonArray(STORAGE_KEY, local);
    serverHydrated = true;
    return local;
  } catch (err) {
    console.warn("[deletedHealthSamples] L2 read threw:", err);
    return local;
  }
}

/**
 * Clear the tombstone (both L1 + L2). Exposed for a future "Re-import
 * all from Apple Health" affordance — not wired today (tracked: ENG-752).
 */
export async function clearDeletedHealthSampleIds(): Promise<void> {
  memoCache = new Set();
  serverHydrated = false;
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(PENDING_STORAGE_KEY);
  } catch {
    // Non-fatal.
  }
  const userId = await getCurrentUserId();
  if (!userId) return;
  try {
    await supabase.from("deleted_health_samples").delete().eq("user_id", userId);
  } catch {
    // Non-fatal — local clear succeeded.
  }
}
