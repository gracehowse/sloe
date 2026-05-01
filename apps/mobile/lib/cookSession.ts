/**
 * Cook session helpers (audit P1, 2026-04-30) — pure logic factored out
 * of `apps/mobile/app/cook.tsx` so it can be unit-tested without the
 * Expo Router / `useKeepAwake` import surface that chokes the
 * vitest/jsdom test runner.
 *
 * Two helpers live here today:
 *
 *  - `formatCookDuration(seconds)` → "Nm SSs" string. Used by the
 *    completion card to show "Took you Nm SSs" after the user finishes
 *    the recipe.
 *  - `pickDefaultRegularsSlot(now)` → which `Breakfast | Lunch | Dinner |
 *    Snacks` slot the recipe should default to when the user taps
 *    "Add to my regulars". Mirrors the same hour cutoffs as web
 *    `CookMode.handleLogMeal` so platforms classify identically.
 *
 * No React, no React Native, no Expo. Safe to import from anywhere.
 */

/**
 * Format a cook session duration as "Nm SSs" (zero-padded seconds).
 * Used by the calmer completion card so the user gets credit for
 * the actual time they spent — no exclamation marks, no rounding up.
 *
 *   formatCookDuration(0)    -> "0m 00s"
 *   formatCookDuration(620)  -> "10m 20s"
 *   formatCookDuration(3725) -> "62m 05s" (we deliberately stay in
 *     minutes past 60; this is a subjective time-spent label, not a
 *     wall-clock display).
 *
 * NaN, Infinity, and negative values clamp to "0m 00s" so the
 * UI never has to special-case bad input.
 */
export function formatCookDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const m = Math.floor(s / 60);
  const remSec = s % 60;
  return `${m}m ${remSec.toString().padStart(2, "0")}s`;
}

/**
 * Pick the meal slot most likely fitted to "now" — used as the default
 * when the user taps "Add to my regulars" so the saved combo lands in
 * the slot they typically eat the recipe at. Mirrors the same hour
 * cutoffs as the web `CookMode.handleLogMeal` fallback so the two
 * platforms classify identically.
 *
 *   < 11h → Breakfast
 *   < 15h → Lunch
 *   < 17h → Snacks
 *   else  → Dinner
 *
 * Hour comparison uses the local-time getter (`getHours()`) — the
 * caller's wall clock decides which slot lands. There is no UTC
 * variant: a user cooking at 7pm in Berlin should get Dinner even if
 * the server they're talking to thinks it's 5pm UTC.
 */
export function pickDefaultRegularsSlot(
  now: Date,
): "Breakfast" | "Lunch" | "Dinner" | "Snacks" {
  const h = now.getHours();
  if (h < 11) return "Breakfast";
  if (h < 15) return "Lunch";
  if (h < 17) return "Snacks";
  return "Dinner";
}

/** AsyncStorage key prefix for cook-history per recipe. Stores a small
 *  JSON array of `{ durationSec, ts }` entries — newest last, capped to
 *  a small recent-window. Exported so the cook screen and any future
 *  read site (the planned "you usually cook this in N min" surface)
 *  agree on the storage key. */
export const COOK_HISTORY_KEY_PREFIX = "suppr-cook-history-v1:";

/** Cap the per-recipe cook-history at this many entries so storage
 *  cannot balloon for a frequently-cooked recipe. */
export const COOK_HISTORY_MAX_ENTRIES = 10;

/** Shape of one persisted cook-history entry. Extended 2026-04-30 (Paprika
 *  parity) with optional `scale`, `rating`, `note` fields plus an
 *  optional `recipeCookHistoryId` once the row has been written to
 *  Supabase (enables future "edit my last cook" flows). All new fields
 *  are optional so a v1 entry (just `durationSec` + `ts`) still parses. */
export type CookHistoryEntry = {
  /** Total seconds the user spent in cook mode for this session. */
  durationSec: number;
  /** Wall-clock ms timestamp of when the session ended. */
  ts: number;
  /** Scale factor the user picked for this cook (Paprika parity). */
  scale?: number;
  /** 1..5 rating the user gave THIS cook. */
  rating?: number;
  /** Free-text per-cook note ("added more garlic"), capped at 500
   *  chars by the writer. Empty / whitespace-only strings drop to
   *  undefined on parse. */
  note?: string;
  /** UUID of the row written to `public.recipe_cook_history` if the
   *  Supabase write succeeded. Local-only for sessions where the
   *  network was offline. */
  recipeCookHistoryId?: string;
};

/** Per-cook note cap. Mirrors the DB CHECK in
 *  `supabase/migrations/20260504100000_recipe_cook_history.sql`. */
export const COOK_NOTE_MAX_LEN = 500;

/** Clamp + normalise a per-cook note string. Returns undefined for
 *  empty / non-string input, otherwise returns a trimmed string
 *  truncated to `COOK_NOTE_MAX_LEN`. */
export function clampCookNote(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed.length > COOK_NOTE_MAX_LEN
    ? trimmed.slice(0, COOK_NOTE_MAX_LEN)
    : trimmed;
}

/** Validate + filter a raw `JSON.parse` result back into a typed
 *  history array. Returns `[]` for any malformed input — never throws.
 *  Backward-compat: v1 entries with only `{ durationSec, ts }` still
 *  parse cleanly; new fields drop through when absent / malformed. */
export function parseCookHistory(raw: unknown): CookHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: CookHistoryEntry[] = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const rec = e as Record<string, unknown>;
    const durationSec = typeof rec.durationSec === "number" ? rec.durationSec : NaN;
    const ts = typeof rec.ts === "number" ? rec.ts : NaN;
    if (!Number.isFinite(durationSec) || durationSec <= 0) continue;
    if (!Number.isFinite(ts) || ts <= 0) continue;
    const entry: CookHistoryEntry = { durationSec, ts };

    if (typeof rec.scale === "number" && Number.isFinite(rec.scale) && rec.scale > 0) {
      entry.scale = rec.scale;
    }
    if (typeof rec.rating === "number" && Number.isFinite(rec.rating)) {
      const r = Math.round(rec.rating);
      if (r >= 1 && r <= 5) entry.rating = r;
    }
    const note = clampCookNote(rec.note);
    if (note) entry.note = note;
    if (typeof rec.recipeCookHistoryId === "string" && rec.recipeCookHistoryId) {
      entry.recipeCookHistoryId = rec.recipeCookHistoryId;
    }

    out.push(entry);
  }
  return out;
}

/**
 * Compute the median duration across a history array. Returns `null`
 * for an empty array so callers can decide whether to render the
 * "you usually cook this in N min" line at all (no history → no line).
 *
 * Even-length arrays use the mean of the two centre values, rounded
 * to the nearest second, so the displayed minute-rounded label is
 * stable across two adjacent runs.
 */
export function medianCookDuration(
  history: readonly CookHistoryEntry[],
): number | null {
  const durations = history
    .map((e) => e.durationSec)
    .filter((d) => Number.isFinite(d) && d > 0)
    .slice()
    .sort((a, b) => a - b);
  if (durations.length === 0) return null;
  const mid = Math.floor(durations.length / 2);
  if (durations.length % 2 === 0) {
    return Math.round((durations[mid - 1]! + durations[mid]!) / 2);
  }
  return durations[mid]!;
}

/**
 * Append a new entry, then truncate to `COOK_HISTORY_MAX_ENTRIES`
 * keeping the most recent entries. Pure function so the caller can
 * pass in the existing array (parsed from storage) and write the
 * result back without juggling slice math at every site.
 */
export function appendCookHistoryEntry(
  prior: readonly CookHistoryEntry[],
  entry: CookHistoryEntry,
): CookHistoryEntry[] {
  const next = prior.slice();
  next.push(entry);
  return next.slice(-COOK_HISTORY_MAX_ENTRIES);
}
