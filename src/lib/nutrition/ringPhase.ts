/**
 * ringPhase — the hero calorie ring's state machine (SPEC 1, 2026-06-09:
 * empty → filling → near (90–99%) → hit (100%) → overflow).
 *
 * Pure + shared so the mobile haptic triggers and any web analog read one
 * tested contract. The HAPTIC rule (mobile host applies it):
 *   - entered `near`      → single Medium impact
 *   - crossed into `hit`  → Medium → 80ms → Success (the win beat) + glow
 *   - grew into `overflow`→ single soft Medium (only from `hit`, i.e. the
 *     user keeps logging past goal — a single jump from filling straight
 *     past 102% fires the HIT beat only; the highest milestone wins)
 *   - downward transitions (deleting food) fire NOTHING.
 */

export type RingPhase = "empty" | "filling" | "near" | "hit" | "overflow";

/** Overflow begins past this ratio — a 2% grace band keeps "dead on goal"
 *  reading as HIT, not instantly over. */
export const RING_OVERFLOW_RATIO = 1.02;
/** The near-goal band start (spec: 90%). */
export const RING_NEAR_RATIO = 0.9;

export function ringPhase(consumed: number, goal: number): RingPhase {
  if (!Number.isFinite(consumed) || !Number.isFinite(goal)) return "empty";
  if (consumed <= 0 || goal <= 0) return "empty";
  const r = consumed / goal;
  if (r >= RING_OVERFLOW_RATIO) return "overflow";
  if (r >= 1) return "hit";
  if (r >= RING_NEAR_RATIO) return "near";
  return "filling";
}

export type RingPhaseEvent = "near" | "hit" | "overflow" | null;

const ORDER: Record<RingPhase, number> = {
  empty: 0,
  filling: 1,
  near: 2,
  hit: 3,
  overflow: 4,
};

/** The single event an upward phase transition fires (highest milestone
 *  crossed wins; downward moves fire nothing). */
export function ringPhaseEvent(prev: RingPhase, next: RingPhase): RingPhaseEvent {
  if (ORDER[next] <= ORDER[prev]) return null;
  // Highest-milestone rule: a jump from filling/near straight past the
  // overflow ratio is still the WIN moment — the hit beat fires, not the
  // overflow nudge. Overflow only fires when growing FROM hit.
  if (ORDER[prev] < ORDER.hit && ORDER[next] >= ORDER.hit) return "hit";
  if (next === "overflow") return "overflow";
  if (next === "near") return "near";
  return null;
}
