/**
 * Fasting stages — shared model for the Sloe fasting surfaces.
 *
 * Backs the "Fasting stages" progress bar + the current-stage chip on
 * the full fasting timer (`apps/mobile/app/fasting.tsx` /
 * `src/app/components/FastingTimer.tsx`, Figma 305:2) and the small
 * stage dot on the Today fasting card (Figma 498:2/498:3). Lives in
 * `src/lib/fasting/` so web + mobile share one definition (imported on
 * mobile via `@suppr/shared/fasting/stages`) — no platform drift in the
 * stage thresholds or labels.
 *
 * Design intent (Sloe DS, per `docs/prototypes/stitch-sloe/fasting.html`):
 * - Four named stages along a single progress track: Fed → Fat burning
 *   → Ketosis → Deep. These are the same body-state markers the milestone
 *   chips use, collapsed into a continuous stage bar.
 * - Stages are **descriptive, not prescriptive** — Suppr is a tool, not a
 *   clinician (`_project-context.md`: "Health claims are forbidden"). The
 *   labels name commonly-cited fasting body states; they never tell the
 *   user to fast longer to achieve an outcome.
 *
 * Thresholds align with the milestone hours (`milestones.ts`) and the
 * `fastingStageNarrative` buckets so the bar, the chips, and the italic
 * narrative line never contradict each other:
 *   - Fed         0h  — body still absorbing the last meal
 *   - Fat burning 4h  — glycogen drawing down, fat metabolism picking up
 *   - Ketosis     12h — ketones typically rising
 *   - Deep        16h — deep-fast / autophagy territory
 */

export type FastingStageId = "fed" | "fatBurning" | "ketosis" | "deep";

export type FastingStage = {
  id: FastingStageId;
  /** Short label rendered on the stage bar + current-stage chip. */
  label: string;
  /** Hour mark at which this stage begins (relative to fast start). */
  startHour: number;
};

/**
 * Canonical ordered stage list. Order matters — `fastingStageAtHours`
 * walks it ascending. Keep `startHour` strictly ascending if you edit.
 */
export const FASTING_STAGES: readonly FastingStage[] = [
  { id: "fed", label: "Fed", startHour: 0 },
  { id: "fatBurning", label: "Fat burning", startHour: 4 },
  { id: "ketosis", label: "Ketosis", startHour: 12 },
  { id: "deep", label: "Deep", startHour: 16 },
];

/**
 * Resolve the active stage for a given elapsed fasting duration.
 *
 * @param elapsedHours Hours since the fast started. Negative / non-finite
 *   values clamp to 0 (defensive — clock skew between client + server).
 * @returns The current `FastingStage` and its zero-based index in
 *   `FASTING_STAGES`. Always returns a stage (the "Fed" stage covers
 *   `[0, 4)` so a just-started fast is never stage-less).
 */
export function fastingStageAtHours(elapsedHours: number): {
  stage: FastingStage;
  index: number;
} {
  const hours = Number.isFinite(elapsedHours) ? Math.max(0, elapsedHours) : 0;
  let index = 0;
  for (let i = 0; i < FASTING_STAGES.length; i += 1) {
    if (hours >= FASTING_STAGES[i].startHour) index = i;
  }
  return { stage: FASTING_STAGES[index], index };
}

/**
 * Fractional position (0..1) along the stage bar for a given elapsed
 * duration, capped by the user's fast window so the marker lands on the
 * goal end when the fast completes.
 *
 * The bar is laid out so each stage occupies an equal segment (the four
 * dots are evenly spaced in the Sloe mock). We map elapsed → goal as a
 * simple ratio of the window, which keeps the marker monotonic and never
 * past the final dot.
 *
 * @param elapsedHours Hours since fast start (clamped `>= 0`).
 * @param fastWindowHours The user's window hours (16 for 16:8, 23 for
 *   OMAD, etc). Non-positive / non-finite → returns 0.
 * @returns A value in `[0, 1]`.
 */
export function fastingStageBarFraction(
  elapsedHours: number,
  fastWindowHours: number,
): number {
  if (!Number.isFinite(fastWindowHours) || fastWindowHours <= 0) return 0;
  const hours = Number.isFinite(elapsedHours) ? Math.max(0, elapsedHours) : 0;
  return Math.min(1, hours / fastWindowHours);
}
