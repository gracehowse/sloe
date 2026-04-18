/**
 * Week-start-day preference — Supabase round-trip (M11 audit, 2026-04-18).
 *
 * Small shared client for the `profiles.week_start_day` column so that the
 * save / load shape cannot drift between web (`src/app/components/Settings.tsx`)
 * and mobile (`apps/mobile/app/(tabs)/more.tsx`). Pure: no React, no toast,
 * no analytics — callers wire those in at the call site.
 *
 * Why extract?
 *  - The test plan requires we lock in the exact Supabase query shape
 *    (`update({ week_start_day: "monday" }).eq("id", userId)`) so an
 *    accidental column rename or builder regression is caught by CI.
 *  - Web and mobile need to use the same shape byte-for-byte; inline
 *    implementations are cheap to drift.
 */

/** Cross-platform supabase-js-compatible shape (no generated types). */
type SupabaseLike = {
  from: (table: string) => any;
};

export type WeekStartDay = "monday" | "sunday";

/**
 * Type guard — Supabase returns `unknown` from schemaless selects on
 * older DBs, so we validate before trusting the value.
 */
export function isWeekStartDay(value: unknown): value is WeekStartDay {
  return value === "monday" || value === "sunday";
}

/**
 * Load the user's stored week-start-day. Returns `null` when the user
 * has no row, the call errors, or the column holds an unexpected value.
 * Callers default to "monday" in the UI so a null/error never shows a
 * blank toggle.
 */
export async function loadWeekStartDay(
  supabase: SupabaseLike,
  userId: string,
): Promise<WeekStartDay | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("week_start_day")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const raw = (data as { week_start_day?: unknown }).week_start_day;
  return isWeekStartDay(raw) ? raw : null;
}

/**
 * Persist the new week-start-day. Throws the underlying Supabase error
 * on failure so the caller can roll back local state and surface a
 * toast (web) / Alert (mobile). Never swallows — the UI relies on the
 * throw to distinguish "saved" from "write blocked by RLS / network".
 */
export async function saveWeekStartDay(
  supabase: SupabaseLike,
  userId: string,
  day: WeekStartDay,
): Promise<void> {
  if (!userId) throw new Error("saveWeekStartDay: userId is required");
  if (!isWeekStartDay(day)) throw new Error("saveWeekStartDay: day must be 'monday' or 'sunday'");
  const { error } = await supabase
    .from("profiles")
    .update({ week_start_day: day })
    .eq("id", userId);
  if (error) throw error;
}
