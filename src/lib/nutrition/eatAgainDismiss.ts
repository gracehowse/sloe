/**
 * "Eat again" banner dismiss — pure helper shared by web + mobile.
 *
 * Replaces the previous "store today's dateKey as a string" rule with a
 * belt-and-braces `{ dateKey, dismissedAt }` record so a device clock
 * rollback (travel across time zones, wobble, manual date change) can't
 * resurrect the banner on the same real-world day.
 *
 * ## Hide rule
 * Banner stays hidden when *either* applies:
 *  - stored `dateKey` still matches `now`'s local date (same-day hide), OR
 *  - stored `dismissedAt` is within the last 12 hours of `now`
 *    (clock-rollback safety net).
 *
 * ## Storage
 * v2 key: `"suppr-eat-again-dismissed-v2"`.
 *
 * Persistence is host-owned — web uses `localStorage`, mobile uses
 * `AsyncStorage`. Callers read/write the raw JSON string via
 * `serialiseDismissState` / `parseDismissState` and run the hide
 * decision through `shouldShowEatAgain`.
 *
 * ## Migration from v1
 * The v1 shape was a bare `YYYY-MM-DD` string stored under
 * `"suppr-eat-again-dismissed"`. `migrateLegacyDismiss(v1Raw, now)`
 * lifts that into a v2 `DismissState` so the user's dismiss isn't lost
 * on upgrade. Callers always write v2 going forward.
 *
 * Pure — no Date side-effects; callers pass `now`.
 */

/** v2 storage key. */
export const STORAGE_KEY = "suppr-eat-again-dismissed-v2";

/** Legacy v1 key — read-through for migration only. */
export const LEGACY_STORAGE_KEY_V1 = "suppr-eat-again-dismissed";

/** Clock-rollback safety window in milliseconds (12 hours). */
export const DISMISS_ROLLBACK_WINDOW_MS = 12 * 60 * 60 * 1000;

/** v2 dismiss record. */
export type DismissState = {
  /** Local `YYYY-MM-DD` at the moment of dismissal. */
  dateKey: string;
  /** ISO 8601 timestamp at the moment of dismissal. */
  dismissedAt: string;
};

function formatDayKey(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

function isIsoLike(s: string): boolean {
  // Minimal: parseable by Date and round-trips to a finite epoch.
  const t = Date.parse(s);
  return Number.isFinite(t);
}

/** Safely parse a persisted v2 JSON blob. Returns `null` when the shape
 * doesn't match so the caller falls through to "show banner". */
export function parseDismissState(raw: string | null | undefined): DismissState | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const { dateKey, dismissedAt } = parsed as Record<string, unknown>;
    if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
    if (typeof dismissedAt !== "string" || !isIsoLike(dismissedAt)) return null;
    return { dateKey, dismissedAt };
  } catch {
    return null;
  }
}

/** Serialise a v2 state for storage. Kept as its own helper so both
 * platforms write the same JSON shape byte-for-byte. */
export function serialiseDismissState(state: DismissState): string {
  return JSON.stringify({ dateKey: state.dateKey, dismissedAt: state.dismissedAt });
}

/**
 * Lift a v1 bare-dateKey blob into a v2 record. Returns `null` when
 * the legacy value is missing or malformed so the banner simply shows
 * (safe default — the user re-dismisses if they want).
 *
 * `dismissedAt` is synthesised as `now` so the 12-hour rollback window
 * protects the migration too. That's a tiny lie about history
 * (technically the user dismissed earlier), but it's the correct
 * behaviour: after the upgrade, the banner should stay hidden for the
 * rest of the real-world day.
 */
export function migrateLegacyDismiss(rawV1: string | null | undefined, now: Date): DismissState | null {
  if (rawV1 == null) return null;
  const s = String(rawV1).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return null;
  return { dateKey: s, dismissedAt: now.toISOString() };
}

/**
 * Host-side read convenience: try v2 first, fall back to migrating
 * v1. Returns `null` when nothing usable is stored. Callers always
 * *write* v2 after reading so the migration happens in the background.
 */
export function readDismissState(
  v2Raw: string | null | undefined,
  v1Raw: string | null | undefined,
  now: Date,
): DismissState | null {
  const v2 = parseDismissState(v2Raw);
  if (v2) return v2;
  return migrateLegacyDismiss(v1Raw, now);
}

/**
 * Decide whether the banner should show right now.
 *
 * Returns `true` to show, `false` to hide. Any null/invalid `stored`
 * shows the banner (fresh / corrupt / missing all route to the same
 * "no dismiss" state).
 */
export function shouldShowEatAgain(
  stored: DismissState | null | undefined,
  now: Date,
): boolean {
  if (!stored) return true;
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return true;
  // Same local day — hide.
  if (stored.dateKey === formatDayKey(now)) return false;
  // Rollback safety — hide when the dismiss is within the last
  // DISMISS_ROLLBACK_WINDOW_MS of `now`. `Math.abs` covers both
  // directions: device moved backwards OR forwards relative to
  // the moment of dismissal.
  const dismissedMs = Date.parse(stored.dismissedAt);
  if (!Number.isFinite(dismissedMs)) return true;
  const deltaMs = Math.abs(now.getTime() - dismissedMs);
  if (deltaMs < DISMISS_ROLLBACK_WINDOW_MS) return false;
  return true;
}

/** Build a v2 dismiss record for the moment `now`. */
export function recordDismiss(now: Date): DismissState {
  const safe = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  return {
    dateKey: formatDayKey(safe),
    dismissedAt: safe.toISOString(),
  };
}
