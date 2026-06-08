/**
 * Fasting milestone helpers (Suppr — web Fasting expansion, 2026-05-14).
 *
 * Pure functions used by the web `<FastingTimer />` to render the
 * milestone chips and projected-end time alongside the timer ring.
 * Lives in `src/lib/fasting/` so the same helpers can be re-used by
 * the mobile fasting screen if/when the milestone chips are ported
 * over there — today the mobile screen only shows Started + Goal
 * timestamps, no body-state milestones.
 *
 * Design intent:
 * - Milestones are body-state markers commonly cited in intermittent
 *   fasting literature (glycogen depletion ~8h, ketosis onset ~12h,
 *   deep fast / fat-burning ~16h). They are **descriptive, not
 *   prescriptive** — Suppr is a tool, not a clinician (see
 *   `_project-context.md`: "Health claims are forbidden"). Copy is
 *   intentionally light: "8h: Glycogen", "12h: Ketosis",
 *   "16h: Deep fast".
 * - Only milestones the user has NOT yet hit are shown — once an
 *   hour mark is in the past for the active fast, that chip falls
 *   away rather than being rendered as a "✓ achieved" badge, to
 *   keep the surface forward-looking and avoid gamification
 *   pressure (Suppr voice: "No diet-culture shaming, no toxic
 *   gamification").
 * - Milestones beyond the user's chosen fast window (e.g. 16h for a
 *   14:10 user) are filtered out — there is no value in suggesting
 *   the user fast longer than their stated goal.
 */

export type FastingMilestone = {
  /** Hour mark relative to fast start. */
  hours: number;
  /** Short label rendered in the chip. */
  label: string;
};

/**
 * Canonical fasting window presets — shared web + mobile so the user sees
 * the same options on both platforms and the stored `profiles.fasting_window`
 * value round-trips across clients.
 *
 * Stored as the literal `"FF:EE"` string (`fast hours`:`eat hours`).
 * Per Grace's decision ENG-922 (2026-06-07) Suppr supports all five
 * windows. Order: ascending fast hours, with 16:8 (the most common) first.
 *   - 16:8  — lean gains / popular default
 *   - 18:6
 *   - 20:4  — "warrior"
 *   - 14:10 — gentle
 *   - 23:1  — OMAD (one meal a day)
 */
export const FASTING_WINDOW_PRESETS = [
  "16:8",
  "18:6",
  "20:4",
  "14:10",
  "23:1",
] as const;

export type FastingWindowPreset = (typeof FASTING_WINDOW_PRESETS)[number];

/**
 * Display label for a fasting window string. `23:1` reads as "OMAD"
 * (one meal a day) per the Sloe Figma frames (305:2 preset pills);
 * every other preset shows its raw `FF:EE` string. Falls back to the
 * raw value for any custom / unknown window so the pill always renders
 * something meaningful.
 */
export function fastingWindowLabel(window: string): string {
  return window === "23:1" ? "OMAD" : window;
}

/**
 * Canonical milestone list. Order matters — `selectUpcomingMilestones`
 * relies on ascending `hours`. If you add a new milestone, keep them
 * ordered ascending.
 */
export const FASTING_MILESTONES: readonly FastingMilestone[] = [
  { hours: 8, label: "Glycogen" },
  { hours: 12, label: "Ketosis" },
  { hours: 16, label: "Deep fast" },
];

/**
 * Return the milestones the user hasn't reached yet on the current
 * fast, capped by the user's chosen fast window.
 *
 * @param elapsedMs Elapsed milliseconds since the fast started.
 *   Must be `>= 0`; negative values are clamped to 0.
 * @param fastWindowHours The hour count from the user's preset
 *   (16 for 16:8, 18 for 18:6, etc). Must be `> 0`; non-positive
 *   values yield an empty list.
 * @returns Milestones strictly ahead of `elapsedMs`, and `<=`
 *   `fastWindowHours`. The "at the current mark" case (elapsed
 *   exactly equals a milestone in milliseconds) returns the
 *   milestone — we treat it as still ahead so the user sees the
 *   chip on the exact tick.
 */
export function selectUpcomingMilestones(
  elapsedMs: number,
  fastWindowHours: number,
): FastingMilestone[] {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) elapsedMs = 0;
  if (!Number.isFinite(fastWindowHours) || fastWindowHours <= 0) return [];
  const elapsedHours = elapsedMs / 3_600_000;
  return FASTING_MILESTONES.filter(
    (m) => m.hours <= fastWindowHours && m.hours >= elapsedHours,
  ).map((m) => ({ ...m }));
}

/**
 * Format the projected end-of-fast time as a short locale time
 * string (`HH:MM`). Returns an empty string if `startIso` is invalid
 * so callers can collapse the row rather than render "Invalid Date".
 *
 * @param startIso ISO string of the active fast's start time.
 * @param fastWindowHours Hour count from the user's preset.
 * @param locale Optional BCP-47 locale; defaults to the runtime
 *   default (matches everywhere else we render times).
 */
export function formatProjectedEndTime(
  startIso: string,
  fastWindowHours: number,
  locale?: string,
): string {
  if (!startIso || !Number.isFinite(fastWindowHours) || fastWindowHours <= 0) {
    return "";
  }
  const startMs = Date.parse(startIso);
  if (Number.isNaN(startMs)) return "";
  const end = new Date(startMs + fastWindowHours * 3_600_000);
  return end.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}
