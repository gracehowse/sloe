/**
 * Last-week TDEE storage (mobile, AsyncStorage-only).
 *
 * The Weekly Check-in surface needs a "TDEE 7 days ago" value to show
 * the delta. The schema has `adaptive_tdee` (current value) +
 * `adaptive_tdee_updated_at`, but no history table — by design (per
 * the audit task: "DO NOT add a complex history table"). Instead we
 * snapshot the *current* adaptive TDEE into AsyncStorage at the end
 * of each week, keyed by `YYYY-Www` so we can ask "what was last
 * week's TDEE?".
 *
 * Key: `weekly_checkin_tdee_v1:<userId>:<weekKey>`. The value carries
 * the TDEE kcal and the ISO timestamp it was captured at. Older keys
 * are pruned by the read path (only the previous + current week are
 * ever needed, so we delete the entry from ≥2 weeks ago whenever we
 * write a new one).
 *
 * Failure mode: same as `whatsNew.ts` — read errors return `null`,
 * write errors are swallowed. The screen falls back to the "first
 * week" placeholder when no value is stored.
 *
 * Spec: extended-competitor-audit task (2026-04-30, Step 1).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

/** Versioned prefix so a future schema change can re-prompt. */
const STORAGE_PREFIX = "weekly_checkin_tdee_v1";

type StorageLike = Pick<typeof AsyncStorage, "getItem" | "setItem" | "removeItem">;

export interface StoredTdeeSnapshot {
  /** Adaptive (or formula fallback) TDEE in kcal. */
  tdee: number;
  /** ISO timestamp captured at write time. Used to detect stale
   *  entries on the read path. */
  capturedAt: string;
  /** The week key the snapshot was *captured for* (the week that just
   *  ended). Mirrors the read-path lookup so tests can assert the
   *  round-trip without re-deriving the key. */
  weekKey: string;
}

function buildKey(userId: string, weekKey: string): string {
  return `${STORAGE_PREFIX}:${userId}:${weekKey}`;
}

/**
 * Read the TDEE snapshot for the supplied (userId, weekKey).
 * Returns `null` when no snapshot exists or the stored payload is
 * unreadable.
 */
export async function readTdeeSnapshot(
  userId: string,
  weekKey: string,
  storage: StorageLike = AsyncStorage,
): Promise<StoredTdeeSnapshot | null> {
  if (!userId || !weekKey) return null;
  try {
    const raw = await storage.getItem(buildKey(userId, weekKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredTdeeSnapshot>;
    if (
      !parsed ||
      typeof parsed.tdee !== "number" ||
      !Number.isFinite(parsed.tdee) ||
      parsed.tdee <= 0 ||
      typeof parsed.capturedAt !== "string" ||
      typeof parsed.weekKey !== "string"
    ) {
      return null;
    }
    return parsed as StoredTdeeSnapshot;
  } catch {
    return null;
  }
}

/**
 * Write a TDEE snapshot for the supplied (userId, weekKey). No-ops on
 * write failure; the worst case is the user sees the "building
 * confidence" / "first week" placeholder until the next attempt.
 *
 * The caller passes the week key — typically the *previous* week
 * (i.e. the week that just ended), so the next visit's "previous
 * value" lookup hits this entry.
 */
export async function writeTdeeSnapshot(
  userId: string,
  weekKey: string,
  tdeeKcal: number,
  storage: StorageLike = AsyncStorage,
  now: Date = new Date(),
): Promise<void> {
  if (!userId || !weekKey) return;
  if (!Number.isFinite(tdeeKcal) || tdeeKcal <= 0) return;
  try {
    const payload: StoredTdeeSnapshot = {
      tdee: Math.round(tdeeKcal),
      capturedAt: now.toISOString(),
      weekKey,
    };
    await storage.setItem(buildKey(userId, weekKey), JSON.stringify(payload));
  } catch {
    /* swallow */
  }
}

/**
 * Drop a TDEE snapshot from storage. Used by the prune step on the
 * write path so old keys don't accumulate forever — we never need
 * more than one previous week's worth.
 */
export async function clearTdeeSnapshot(
  userId: string,
  weekKey: string,
  storage: StorageLike = AsyncStorage,
): Promise<void> {
  if (!userId || !weekKey) return;
  try {
    await storage.removeItem(buildKey(userId, weekKey));
  } catch {
    /* swallow */
  }
}
