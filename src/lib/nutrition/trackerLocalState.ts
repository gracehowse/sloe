/**
 * Local-state + localStorage helpers extracted from `NutritionTracker.tsx`
 * (ENG-621 — chip away at the 4k-line screen file). These are module-scope,
 * presentation-free utilities the Today tracker uses to persist small bits of
 * UI state (recent foods, per-day north-star skips) and to normalise loosely
 * typed inputs (dashboard macro keys, step maps, the web activity-bonus call).
 *
 * Pulled out verbatim so the behaviour is identical; isolating them here lets
 * them be unit-tested without mounting the whole tracker.
 */
import { computeActivityBonusKcal } from "./activityBonus.ts";
import { todayKey } from "./trackerDate.ts";

export const RECENT_BARCODE_KEY = "suppr-recent-foods-v1";

/** Must match Settings "Dashboard widgets" keys (`WIDGET_MACRO_OPTIONS`). */
export const TRACKED_DASHBOARD_MACRO_KEYS = new Set([
  "protein",
  "carbs",
  "fat",
  "fiber",
  "sugar",
  "sodium",
  "water",
]);

export function normalizeTrackedDashboardMacros(raw: unknown): string[] {
  const fallback = ["protein", "carbs", "fat"];
  if (!Array.isArray(raw) || raw.length === 0) return fallback;
  const next = (raw as unknown[]).filter(
    (x): x is string => typeof x === "string" && TRACKED_DASHBOARD_MACRO_KEYS.has(x),
  );
  return next.length > 0 ? next : fallback;
}

export function parseStepsDayMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(o)) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n) && n >= 0) out[k] = Math.round(n);
  }
  return out;
}

/**
 * Web call-site wrapper around `computeActivityBonusKcal`. See
 * `docs/decisions/2026-05-13-activity-bonus-projected-eod-model.md`
 * for rationale and `src/lib/nutrition/activityBonus.ts` for the
 * single-source-of-truth math.
 */
export function dayActivityBudgetAddonWeb(
  prefer: boolean,
  dk: string,
  maintenance: number,
  activityByDay: Record<string, number>,
  basalByDay: Record<string, number>,
  workoutsByDay: Record<string, Array<{ calories?: number }>>,
  maintenanceSource: "measured" | "adaptive" | "formula" | null,
): number {
  const workouts = workoutsByDay[dk] ?? [];
  return computeActivityBonusKcal({
    prefer,
    maintenanceSource,
    dateKey: dk,
    todayDateKey: todayKey(),
    restingKcal: basalByDay[dk] ?? 0,
    activeKcal: activityByDay[dk] ?? 0,
    maintenanceKcal: maintenance,
    workoutKcal: workouts.reduce((s, w) => s + (w.calories ?? 0), 0),
  });
}

export function loadRecentFoods(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_BARCODE_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function pushRecentFood(name: string) {
  const prev = loadRecentFoods().filter((x) => x !== name);
  const next = [name, ...prev].slice(0, 8);
  localStorage.setItem(RECENT_BARCODE_KEY, JSON.stringify(next));
}

/**
 * Phase 4 / B3.Y (2026-04-27) — per-day skipped-recipe set for the
 * north-star suggestion. Backed by localStorage so a swipe-to-skip survives a
 * page reload, scoped by `selectedDateKey` so the set resets daily.
 */
export const NORTH_STAR_SKIP_KEY_PREFIX = "suppr.northstar.skipped.";

export function readNorthStarSkippedSet(dateKey: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(NORTH_STAR_SKIP_KEY_PREFIX + dateKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((s): s is string => typeof s === "string"));
  } catch {
    return new Set();
  }
}

export function writeNorthStarSkippedSet(dateKey: string, set: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      NORTH_STAR_SKIP_KEY_PREFIX + dateKey,
      JSON.stringify(Array.from(set)),
    );
  } catch {
    // Quota / disabled storage — silent failure is fine; the skip
    // simply doesn't persist past the in-memory state.
  }
}
