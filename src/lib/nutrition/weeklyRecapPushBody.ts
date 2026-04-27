/**
 * Sunday push body formatter (Sunday push rewrite — T2, 2026-04-19).
 *
 * Pure helper that turns a `WeeklyRecap` into the exact one-sentence
 * string the Sunday-evening push notification surfaces on the lock
 * screen, plus a discriminated `variant` tag so analytics can attribute
 * which copy path the user opened.
 *
 * ──────────────────────────────────────────────────────────────────────
 * Honest-claims rules (these are non-negotiable — Suppr's voice):
 *
 *   - If `daysLogged === 0`:
 *       "Nothing logged this week. Open Suppr to get back on track."
 *     This is the only acceptable generic fallback. We never invent a
 *     more flattering line when there is no data.
 *
 *   - If `daysLogged > 0` AND `weightDeltaKg === null`:
 *       "{daysLogged} days logged, avg {avgCalories} kcal — see what changed."
 *     Weight is omitted entirely. We do NOT say "no change" or "0 kg" —
 *     a missing weigh-in is not a result.
 *
 *   - If `daysLogged > 0` AND `weightDeltaKg !== null`:
 *       "{daysLogged} days logged, {sign}{weightDeltaKg} kg this week — see what changed."
 *     Sign is always explicit: `+0.3`, `-0.4`, or `0.0` for an exact
 *     null delta. See the zero-delta decision in the comment block
 *     immediately below.
 *
 * Hard rules enforced by tests in `tests/unit/weeklyRecapPushBody.test.ts`:
 *   - No exclamation marks.
 *   - No "great job" / "amazing" / performance adjectives.
 *   - Output ≤178 characters (APNs lock-screen visible truncation
 *     threshold for the body line on a standard iPhone notification).
 *   - Pure — no React, no RN, no `process.env`, no side effects.
 *
 * ──────────────────────────────────────────────────────────────────────
 * Zero-delta (`weightDeltaKg === 0`) decision:
 *
 *   We INCLUDE the weight phrase with `0.0 kg` rather than falling
 *   through to the calories-only variant. Reason: the caller has
 *   already passed the "≥2 weigh-ins inside the window" gate inside
 *   `buildWeeklyRecap` (see `weeklyRecap.ts:152`). A returned `0.0` is
 *   not a missing measurement — it is two weigh-ins that happened to
 *   round to the same kg-tenth. Suppressing it would imply "no data"
 *   when in fact we have data. The variant remains `with_weight`.
 *
 *   (If we ever decide flat weeks read more naturally without weight,
 *   we can switch the policy in one place — the test that pins this
 *   choice will fail loudly.)
 *
 * ──────────────────────────────────────────────────────────────────────
 * Variant attribution:
 *
 *   The `variant` returned alongside the body is consumed by T6 (the
 *   server-side analytics emit on push send) so the route does not
 *   have to re-derive it from the formatted string.
 */

import type { WeeklyRecap } from "./weeklyRecap";
import type { DigestSuggestion } from "./weeklyDigestSuggestion";

/**
 * Four mutually-exclusive copy paths the formatter can produce.
 * Stable string union — do not rename without coordinating with the
 * analytics dashboards downstream of T6.
 *
 * `"with_suggestion"` (Sunday push rewrite — T4, 2026-04-19) is the
 * priority variant: when `selectDigestSuggestion(...)` returns a
 * non-null suggestion AND the recap has at least one logged day, the
 * formatter prepends `suggestion.headline + " · "` to the recap
 * sentence so the lock-screen line carries an actionable hook. The
 * other three variants (`zero_days`, `calories_only`, `with_weight`)
 * are mutually exclusive on data presence; `with_suggestion` is
 * orthogonal in semantics but the union slot stays single-valued so
 * a downstream PostHog `properties.bodyVariant` filter is one
 * equality check, not a regex. Honest-claims rules (no exclamation
 * marks, no performance adjectives, ≤178 char body) still apply.
 *
 * `with_suggestion` only fires when `daysLogged > 0` — we never
 * prepend a digest headline onto the zero-days fallback. Reasoning:
 * the cascade gates already presume real data (Rule 1 needs a usual
 * meal, Rule 3 needs ≥4 logged days, Rule 4 needs streak ≥7, etc.),
 * so a non-null suggestion paired with `daysLogged === 0` would be
 * an internal contradiction. Defensive guard in
 * `formatWeeklyRecapPushBody` covers the edge case anyway.
 */
export type PushBodyVariant =
  | "zero_days"
  | "calories_only"
  | "with_weight"
  | "with_suggestion"
  // B1 (2026-04-27) — fibre / hydration adherence tail variant. Fires
  // when neither a digest suggestion fired AND at least one of fibre /
  // hydration targets is set + on-target. Mutually exclusive with
  // `with_suggestion` (suggestion is the priority hook).
  | "with_adherence";

/**
 * APNs body-line truncation threshold on standard iPhone lock-screen
 * presentation. Pinned by `tests/unit/weeklyRecapPushBody.test.ts` —
 * exceeding this means the user only sees a clipped sentence with an
 * ellipsis, which makes the call-to-action ambiguous.
 */
export const PUSH_BODY_MAX_CHARS = 178;

/**
 * Format the Sunday push body for a completed `WeeklyRecap`, optionally
 * prepended with a Weekly Digest cascade headline.
 *
 * Returns both the user-facing string AND the variant tag so callers
 * (route handler, analytics emit) do not have to re-derive which
 * branch ran.
 *
 * Composition rules (Sunday push rewrite — T4, 2026-04-19):
 *   - When `suggestion` is `null` (or omitted), behaviour is identical
 *     to the pre-T4 implementation — one of `zero_days`,
 *     `calories_only`, `with_weight` based on data presence.
 *   - When `suggestion` is present AND the recap has data
 *     (`daysLogged > 0`), the body becomes
 *     `"{headline} · {recap sentence}"` and the variant is
 *     `with_suggestion`. The recap sentence is whichever of
 *     `calories_only` / `with_weight` would have fired without a
 *     suggestion.
 *   - When the composed body would exceed `PUSH_BODY_MAX_CHARS`, the
 *     recap portion is shortened: drop the calories segment first
 *     (keep `{n} days logged` + weight line if any), then collapse to
 *     just `{n} days logged.` if needed. The cascade headline is
 *     never truncated — it is the actionable hook the user opens for.
 *   - When `suggestion` is present BUT `daysLogged === 0`, the
 *     headline is *not* prepended (no honest data to attach it to);
 *     we fall through to the zero-days fallback. In practice the
 *     cascade gates make this impossible to hit, but defending the
 *     honest-claims invariant matters more than micro-optimising for
 *     dead code.
 */
export function formatWeeklyRecapPushBody(
  recap: WeeklyRecap,
  suggestion: DigestSuggestion | null = null,
): { body: string; variant: PushBodyVariant } {
  // Branch 1 — no data. Only acceptable generic fallback. Suggestions
  // never prepend onto this branch (see file-level honest-claims rule
  // and the comment on `PushBodyVariant`).
  if (recap.daysLogged === 0) {
    return {
      body: "Nothing logged this week. Open Suppr to get back on track.",
      variant: "zero_days",
    };
  }

  // Compose the recap sentence first (the same string the
  // calories_only / with_weight branches would have produced). This
  // is the substrate the suggestion headline gets prepended onto.
  const recapSentence = composeRecapSentence(recap);

  // Branch 4 (priority) — suggestion present + data present. Compose
  // and possibly truncate the recap to fit the APNs body budget.
  if (suggestion && suggestion.headline.length > 0) {
    const composed = composeWithSuggestion(suggestion.headline, recap);
    return { body: composed, variant: "with_suggestion" };
  }

  // No suggestion — fall through to the original variant logic. We
  // re-derive the variant tag from the recap shape (instead of
  // re-running the formatter) so behaviour is byte-identical to the
  // pre-T4 path. B1 (2026-04-27): if fibre / hydration targets are set
  // AND the resulting sentence fits within PUSH_BODY_MAX_CHARS, append
  // an adherence tail. Variant flips to `with_adherence` for analytics
  // attribution; otherwise we fall back to calories_only / with_weight
  // unchanged. Skipped entirely when a digest suggestion is also
  // present — the suggestion branch is the priority hook and we don't
  // want to compete with it for the lock-screen line.
  const baseVariant: PushBodyVariant =
    recap.weightDeltaKg === null ? "calories_only" : "with_weight";
  const tail = formatAdherenceTail(recap);
  if (tail.length > 0) {
    const withTail = recapSentence + tail;
    if (withTail.length <= PUSH_BODY_MAX_CHARS) {
      return { body: withTail, variant: "with_adherence" };
    }
  }
  return { body: recapSentence, variant: baseVariant };
}

/**
 * B1 (2026-04-27) — build the optional fibre / hydration adherence
 * tail. Empty string when both targets are unset (the recap reports
 * 0 / 0 in that case — see `buildWeeklyRecap`'s suppression rule).
 *
 * Format examples (the leading `" · "` is included so callers can
 * concatenate without re-checking emptiness):
 *   - Both:   " · Fibre 78% · Hydration 4/7 days"
 *   - Fibre:  " · Fibre 78%"
 *   - Hydration: " · Hydration 4/7 days"
 *   - Neither: ""
 *
 * The hydration ratio is N/7 because the count is across the full
 * week regardless of meal-logging days (parallel to the formatter's
 * existing weight-line "this week" framing).
 */
function formatAdherenceTail(recap: WeeklyRecap): string {
  const showFiber = recap.fiberAdherencePct > 0;
  const showHydration = recap.hydrationDaysOnTarget > 0;
  if (!showFiber && !showHydration) return "";
  const parts: string[] = [];
  if (showFiber) parts.push(`Fibre ${recap.fiberAdherencePct}%`);
  if (showHydration) parts.push(`Hydration ${recap.hydrationDaysOnTarget}/7 days`);
  return ` · ${parts.join(" · ")}`;
}

/**
 * Build the bare recap sentence (no suggestion). Pure helper so the
 * suggestion branch can re-use the exact same wording the
 * single-variant branches produce.
 */
function composeRecapSentence(recap: WeeklyRecap): string {
  if (recap.weightDeltaKg === null) {
    return `${recap.daysLogged} days logged, avg ${recap.avgCalories} kcal — see what changed.`;
  }
  const signed = formatSignedKg(recap.weightDeltaKg);
  return `${recap.daysLogged} days logged, ${signed} kg this week — see what changed.`;
}

/**
 * Compose the `"{headline} · {recap}"` body with intelligent
 * truncation when the combined length exceeds `PUSH_BODY_MAX_CHARS`.
 *
 * Truncation order (drops the smallest informative slice first):
 *   1. Full recap sentence appended.
 *   2. If too long, drop the calories segment but keep the weight
 *      delta line: `"{headline} · {n} days logged, ±X.X kg this week."`
 *      For weight-less recaps step 2 collapses straight to step 3.
 *   3. If still too long, collapse the recap to `"{n} days logged."`.
 *   4. If even step 3 doesn't fit (headline alone > budget — should
 *      not happen given the 120-char cascade headline ceiling), the
 *      headline is returned as-is. APNs will hard-truncate; the
 *      cascade headline is the priority signal.
 *
 * The cascade headline itself is never modified — it's the actionable
 * hook and shortening it would risk dropping the verb.
 */
function composeWithSuggestion(headline: string, recap: WeeklyRecap): string {
  const sep = " · ";
  // Step 1
  const full = headline + sep + composeRecapSentence(recap);
  if (full.length <= PUSH_BODY_MAX_CHARS) return full;

  // Step 2 — keep weight, drop calories ("see what changed" copy too).
  if (recap.weightDeltaKg !== null) {
    const signed = formatSignedKg(recap.weightDeltaKg);
    const step2 = `${headline}${sep}${recap.daysLogged} days logged, ${signed} kg this week.`;
    if (step2.length <= PUSH_BODY_MAX_CHARS) return step2;
  }

  // Step 3 — collapse recap to days only.
  const step3 = `${headline}${sep}${recap.daysLogged} days logged.`;
  if (step3.length <= PUSH_BODY_MAX_CHARS) return step3;

  // Step 4 — pathological: headline alone exceeds the budget. Return
  // the headline; APNs will clip. Any cascade headline >178 chars
  // would already have failed the cascade module's 120-char ceiling
  // (see `DIGEST_HEADLINE_MAX_CHARS`).
  return headline;
}

/**
 * Sign-prefixed kg string.
 *
 *   +0.3  → "+0.3"
 *   -0.4  → "-0.4"
 *    0.0  → "0.0"   (no sign — there is no direction to show)
 *
 * Always renders one decimal place so adjacent weeks read consistently.
 * `recap.weightDeltaKg` is already rounded to 0.1 in `buildWeeklyRecap`,
 * but we re-apply `.toFixed(1)` here as a defence-in-depth so any
 * future caller that supplies an un-rounded value still produces a
 * stable string.
 */
function formatSignedKg(kg: number): string {
  const rounded = Math.round(kg * 10) / 10;
  if (rounded > 0) return `+${rounded.toFixed(1)}`;
  if (rounded < 0) return rounded.toFixed(1); // toFixed preserves the "-"
  return "0.0";
}
