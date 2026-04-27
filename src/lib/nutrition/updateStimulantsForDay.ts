/**
 * F-13 (2026-04-19) — shared write-path helper that keeps
 * `profiles.extra_caffeine_by_day` and `profiles.extra_alcohol_g_by_day`
 * in sync with each successful `nutrition_entries` insert / delete.
 *
 * One helper, two platforms. Web calls this from the `useNutritionJournalState`
 * insert + remove path, mobile calls it from the Today food-search commit,
 * the barcode log path, the recipe-log-to-journal path, the planned-meal
 * log path, the debounced sync effect, and `deleteMeal`. Because both
 * column names are hard-coded here, the two platforms cannot drift on
 * which column a stimulant lands in.
 *
 * Contract:
 *   - `delta.caffeineMg` — signed integer-ish value added to the day's
 *     caffeine total. Positive on insert, negative on delete. 0 → skip
 *     entirely (no Supabase round-trip, no event).
 *   - `delta.alcoholG` — signed value added to the day's alcohol-ethanol
 *     total (grams). 1 decimal place precision is preserved.
 *
 * Atomicity:
 *   - Read-modify-write against `profiles` by `id`. Supabase does not
 *     expose `jsonb_set` through PostgREST for the full clobber we need
 *     (we have to merge with the existing map), so we read the current
 *     maps, mutate, and update both columns in a single `.update()`.
 *   - At Suppr's scale the last-write-wins race between two near-simultaneous
 *     logs on different devices is a non-issue (product call per task spec,
 *     2026-04-19 — "just use optimistic write; the rare double-log case is
 *     a non-issue at this scale"). No idempotency key.
 *
 * Missing-column tolerance:
 *   - If the profile row has a null / malformed value for a column, we
 *     treat it as `{}` and write a clean map. Same defensive pattern the
 *     `parseDayNumberMap` helper uses on the read side.
 *
 * Non-negative clamp:
 *   - The resulting per-day number is clamped at 0. A stale delete that
 *     sees a map that has already been zero'd cannot drive the total
 *     negative. The shared `hydrationStimulants.clampPositive` read path
 *     already drops negatives on display, but we also clamp on write so
 *     the stored value matches what the UI renders.
 *
 * Return:
 *   - Resolves to `{ ok: true }` on success, `{ ok: false, error }` on
 *     any Supabase error. Callers log but do NOT roll back the preceding
 *     `nutrition_entries` insert — the meal row is the source of truth.
 *     A lost increment here leaves the meal macros correct and the daily
 *     stimulant total temporarily under-counted; the user's next log of
 *     a stimulant-bearing food self-heals the map.
 */

 
type SupabaseLike = any;

export type StimulantDelta = {
  /** Signed integer mg delta. Positive on log, negative on delete. 0 skips. */
  caffeineMg: number;
  /** Signed decimal g-of-ethanol delta. 0 skips. */
  alcoholG: number;
};

export type UpdateStimulantsResult =
  | { ok: true; caffeineMg: number; alcoholG: number }
  | { ok: false; error: string };

function isValidDateKey(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * Parse a Supabase JSONB map into a clean `{YYYY-MM-DD: number}` shape.
 *
 * Drops:
 *   - non-date-key keys (e.g. legacy debug entries, accidental writes)
 *   - non-finite / non-positive values
 *
 * Intentionally lossy — we'd rather silently lose a garbage map entry
 * than echo it back into Supabase and widen the corruption.
 */
function parseMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k !== "string" || !isValidDateKey(k)) continue;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n <= 0) continue;
    out[k] = n;
  }
  return out;
}

/**
 * Apply the delta and return the new value for `dayKey`.
 * Caffeine snaps to integer mg; alcohol snaps to 1 dp g.
 */
function applyDelta(
  map: Record<string, number>,
  dayKey: string,
  delta: number,
  precision: "integer" | "tenth",
): { next: Record<string, number>; dayValue: number } {
  const current = map[dayKey] ?? 0;
  const raw = current + delta;
  const clamped = raw > 0 ? raw : 0;
  const rounded =
    precision === "integer"
      ? Math.round(clamped)
      : Math.round(clamped * 10) / 10;
  const next = { ...map };
  if (rounded > 0) {
    next[dayKey] = rounded;
  } else {
    delete next[dayKey];
  }
  return { next, dayValue: rounded };
}

export async function updateStimulantsForDay(
  supabase: SupabaseLike,
  userId: string,
  dayKey: string,
  delta: StimulantDelta,
): Promise<UpdateStimulantsResult> {
  // Guard clauses — a malformed call MUST be a no-op, never a throw, so
  // the preceding `nutrition_entries` insert / delete is never rolled back.
  if (!userId || typeof userId !== "string") {
    return { ok: false, error: "missing_user_id" };
  }
  if (!dayKey || !isValidDateKey(dayKey)) {
    return { ok: false, error: "invalid_date_key" };
  }

  const caffDelta = typeof delta.caffeineMg === "number" && Number.isFinite(delta.caffeineMg)
    ? delta.caffeineMg
    : 0;
  const alcDelta = typeof delta.alcoholG === "number" && Number.isFinite(delta.alcoholG)
    ? delta.alcoholG
    : 0;

  // No-op: nothing to write, skip the round-trip entirely.
  if (caffDelta === 0 && alcDelta === 0) {
    return { ok: true, caffeineMg: 0, alcoholG: 0 };
  }

  const { data, error: readErr } = await supabase
    .from("profiles")
    .select("extra_caffeine_by_day, extra_alcohol_g_by_day")
    .eq("id", userId)
    .maybeSingle();

  if (readErr) {
    const msg = (readErr as { message?: string })?.message ?? "read_failed";
    return { ok: false, error: msg };
  }

  const row = (data ?? {}) as {
    extra_caffeine_by_day?: unknown;
    extra_alcohol_g_by_day?: unknown;
  };

  const caffMap = parseMap(row.extra_caffeine_by_day);
  const alcMap = parseMap(row.extra_alcohol_g_by_day);

  const update: Record<string, unknown> = {};
  let nextCaffeine = caffMap[dayKey] ?? 0;
  let nextAlcohol = alcMap[dayKey] ?? 0;

  if (caffDelta !== 0) {
    const { next, dayValue } = applyDelta(caffMap, dayKey, caffDelta, "integer");
    update.extra_caffeine_by_day = next;
    nextCaffeine = dayValue;
  }
  if (alcDelta !== 0) {
    const { next, dayValue } = applyDelta(alcMap, dayKey, alcDelta, "tenth");
    update.extra_alcohol_g_by_day = next;
    nextAlcohol = dayValue;
  }

  const { error: writeErr } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", userId);

  if (writeErr) {
    const msg = (writeErr as { message?: string })?.message ?? "write_failed";
    return { ok: false, error: msg };
  }

  return { ok: true, caffeineMg: nextCaffeine, alcoholG: nextAlcohol };
}
