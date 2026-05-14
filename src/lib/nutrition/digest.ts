/**
 * Digest primitive (D3) — shared helpers.
 *
 * Pure module backing the web + mobile `<Digest />` primitive. Owns the
 * single source of truth for the headline string so both platforms
 * produce identical copy from identical inputs.
 *
 * See `docs/design/digest-primitive.md` §5 for the headline rules.
 */

export type DigestHeadlineInput = {
  weightDeltaKg: number | null;
  closestToTargetLabel: string | null;
  streakDays: number;
  daysLogged: number;
};

/**
 * Resolve the single headline string per §5.
 *
 * Rules (first match wins):
 *   1. `daysLogged === 0` → "Quiet week."
 *   2. |weightDeltaKg| ≥ 0.3 → "Last week: down/up X.X kg." (past-tense per project voice rule)
 *   3. closestToTargetLabel present → "Closest to target: <day>."
 *   4. streakDays ≥ 7 → "Streak held — X days."
 *   5. fallback → "Last week, at a glance."
 *
 * 2026-05-13 (premium-bar audit DC12 polish — past-tense voice rule):
 * the fallback "Your week, at a glance." now reads "Last week, at a
 * glance." to match the other recap-eyebrow surfaces (Digest range
 * line, weight-delta headline). The recap renders Sun/Mon looking
 * back — past tense reads as a closed retrospective, not a mid-stream
 * nudge.
 */
export function resolveDigestHeadline(input: DigestHeadlineInput): string {
  if (input.daysLogged === 0) return "Quiet week.";
  if (input.weightDeltaKg != null && Math.abs(input.weightDeltaKg) >= 0.3) {
    const direction = input.weightDeltaKg < 0 ? "down" : "up";
    const magnitude = Math.abs(input.weightDeltaKg).toFixed(1);
    return `Last week: ${direction} ${magnitude} kg.`;
  }
  if (input.closestToTargetLabel) {
    return `Closest to target: ${input.closestToTargetLabel}.`;
  }
  if (input.streakDays >= 7) {
    return `Streak held — ${input.streakDays} days.`;
  }
  return "Last week, at a glance.";
}
