/**
 * weeklyDigestSuggestion — the 5-rule "what should this user do this week"
 * cascade for the new Weekly Digest surface (Sunday push rewrite, deadline
 * 2026-05-03).
 *
 * Single source of truth, used by:
 *   - The Weekly Digest card on Progress (web + mobile) — Block 2 of the
 *     digest renders `headline` + `body` and (when present) the CTA.
 *   - The Sunday push body formatter — when a suggestion fires, the
 *     formatter prepends `headline` to the existing recap sentence so the
 *     lock-screen line carries the actionable hook.
 *
 * Cascade is **strict first-match-wins**. The order below is the priority
 * order — once a rule fires, the function returns immediately without
 * evaluating the rest. The order encodes product judgment:
 *   1. Re-log prompt        (highest leverage — turns logged habit → 1-tap)
 *   2. Maintenance recalibration (corrects the calorie target itself)
 *   3. Protein nudge        (macro-level fix when the goal is intact)
 *   4. Streak protection    (motivational, only when behaviour is at risk)
 *   5. Weight-trend mismatch (last-resort review when numbers disagree)
 *
 * Returning `null` means "no honest suggestion this week". The caller
 * (Digest UI) renders the empty-state copy ("Nothing to change this
 * week. Your numbers held.") — the empty-state copy lives in the UI, not
 * here, so the module stays purely about *which* rule fires.
 *
 * Hard rules (pinned by `tests/unit/weeklyDigestSuggestion.test.ts`):
 *   - No exclamation marks anywhere in headline or body.
 *   - No "great job" / "amazing" / performance adjectives.
 *   - Headlines ≤120 chars (push body has ~178 char budget; cascade
 *     headline takes first half, recap data takes the second half).
 *   - Bodies ≤200 chars.
 *   - Honest claims: when a gate's required input is missing/null, the
 *     rule cannot fire. We never invent data to make a suggestion fit.
 *
 * Pure shared module — no React, no RN, no I/O. Mobile re-exports from
 * `apps/mobile/lib/weeklyDigestSuggestion.ts` so both platforms hit the
 * same code path.
 */

import type { ResolvedMaintenance } from "./resolveMaintenance";
import type { UsualMealRecapInsight, WeeklyRecap } from "./weeklyRecap";
import type { FreezeLedger } from "./streakFreeze";

/**
 * Stable rule identifier. Used by the Digest UI for analytics
 * attribution (`weekly_digest_suggestion_shown { rule }`) and by the
 * push body formatter to log which copy path went out.
 */
export type DigestSuggestionRule =
  | "re_log_prompt"
  | "maintenance_recalibration"
  | "protein_nudge"
  | "streak_protection"
  | "weight_trend_mismatch";

/**
 * Tier-gating per A1: matches the per-suggestion paywall map decided
 * this session. The Digest UI uses this to render the locked-state CTA
 * when the user's tier is below the requirement.
 *
 *   - "free" — no paywall (Maintenance is free; re-log save is free).
 *   - "base" — Suppr Base required (high-protein recipe filter, etc.).
 *   - "pro"  — Suppr Pro required (no Pro-gated suggestions today, but
 *              the type covers future rules without a breaking change).
 */
export type DigestSuggestionTier = "free" | "base" | "pro";

/**
 * Output of the cascade.
 *
 *   - `headline` is the one-line summary used by both the push body
 *     formatter (prepended to the recap sentence) and the Digest UI
 *     card title.
 *   - `body` is the full sentence shown in Digest Block 2 — usually the
 *     headline + a follow-up clause that explains the next step.
 *   - `cta` may be `null` for informational suggestions that have no
 *     button (e.g. streak protection — there's nothing to tap; the
 *     advice itself is the action).
 */
export type DigestSuggestion = {
  rule: DigestSuggestionRule;
  headline: string;
  body: string;
  cta: {
    label: string;
    /** Route or deep-link, e.g. "/save-meal", "/recipes?filter=high-protein". */
    destination: string;
    tierRequired: DigestSuggestionTier;
  } | null;
};

/**
 * Profile slice the cascade reads. Kept narrow on purpose — the cascade
 * does not need full profile rows, only the four columns that gate Rule
 * 2 (maintenance recalibration) plus the goal/weight pair for Rule 5.
 *
 * `targetCaloriesSource` lineage:
 *   - "onboarding"           — set by the onboarding flow on first run.
 *   - "user"                 — user manually overrode it (Settings or
 *                              Today). Manual override gets a 14-day
 *                              cooldown before Rule 2 can suggest a new
 *                              recalibration.
 *   - "recompute"            — auto-recomputed when activity_level
 *                              changed; not a user decision, no cooldown.
 *   - "digest_recalibration" — user accepted a Rule 2 suggestion.
 *                              Triggers the 21-day cooldown so the same
 *                              recalibration banner doesn't reappear.
 *
 * The columns themselves come from the schema migration that
 * `data-integrity` is shipping in parallel; this module does not touch
 * the schema. When the columns are absent (older profiles), the Rule 2
 * gate treats the override checks as "no override on file" and the
 * recalibration suggestion can fire.
 */
export type DigestSuggestionProfile = {
  targetCaloriesSource:
    | "onboarding"
    | "user"
    | "recompute"
    | "digest_recalibration"
    | null;
  /** ISO timestamp; null when no source has ever been recorded. */
  targetCaloriesSetAt: string | null;
  goal: "cut" | "maintain" | "bulk" | null;
  weightGoalKg: number | null;
};

/**
 * Cascade input. The caller (Digest UI / route handler) is responsible
 * for assembling these from the existing helpers — `buildWeeklyRecap`,
 * `resolveMaintenance`, `readFreezeLedger`, `buildUsualMealRecapInsight`,
 * etc. — so the cascade itself stays storage-agnostic and trivially
 * unit-testable.
 *
 *   - `recap` — the WeeklyRecap shape, plus the two extra signals the
 *     cascade reads that don't live on the recap proper:
 *       - `proteinOnTarget` (days hit the protein target — from
 *         `progressWeekReport`)
 *       - `targets` (the week's calorie + protein targets — from the
 *         same bundle)
 *     These are passed alongside `recap` rather than mutated onto it
 *     because the recap shape is consumed by the share-string formatter
 *     and the push body formatter, neither of which need them.
 *   - `resolvedMaintenance` — output of `resolveMaintenance(profile)`.
 *     `null` when profile inputs are incomplete.
 *   - `staticTdee` — the formula-only TDEE for the Rule 2 delta check.
 *     Equal to `resolvedMaintenance.formulaKcal` in the common case;
 *     accepted as a separate field so the gate is explicit and the
 *     delta is computed against a stable baseline even if a future
 *     resolver flip changes what `formulaKcal` means.
 *   - `ledger` — freeze ledger. The Rule 4 gate inspects
 *     `earnedAt` for a "freeze earned in last 14 days" suppression so a
 *     user who just earned one isn't told they have zero.
 *   - `freezesAvailable` — `availableFreezes(ledger, budgetMax)`. Pre-
 *     computed so the cascade doesn't need to know `budgetMax`.
 *   - `saves` — saved-meals counters. `recentlyAddedCount` is the
 *     number added in the last 7 days; reserved for future rules but
 *     accepted now so the type is forward-compatible.
 *   - `usualMealInsight` — output of `buildUsualMealRecapInsight`.
 *     Drives Rule 1.
 *   - `saveSeedItemCount` — the size of the would-be saved-meal seed
 *     when the user accepts the prompt. Rule 1 only fires when this is
 *     ≥ 2 (a single-item "usual" isn't worth a save dialog).
 *   - `profile` — the narrow slice above.
 */
export type DigestSuggestionInput = {
  recap: WeeklyRecap;
  proteinOnTarget: number;
  targets: { calories: number; protein: number };
  resolvedMaintenance: ResolvedMaintenance | null;
  staticTdee: number | null;
  ledger: FreezeLedger;
  freezesAvailable: number;
  saves: { count: number; recentlyAddedCount: number };
  usualMealInsight: UsualMealRecapInsight;
  saveSeedItemCount: number;
  profile: DigestSuggestionProfile;
  /** Injectable now — keeps the time-window gates testable. */
  now?: Date;
};

/** 14 days in ms — manual-override cooldown for Rule 2. */
const MANUAL_OVERRIDE_COOLDOWN_MS = 14 * 86_400_000;

/** 21 days in ms — accepted-recalibration cooldown for Rule 2. */
const RECALIBRATION_COOLDOWN_MS = 21 * 86_400_000;

/** 14 days in ms — freeze-earned suppression for Rule 4. */
const FREEZE_EARNED_SUPPRESS_MS = 14 * 86_400_000;

/** Minimum maintenance-vs-formula delta to consider Rule 2 worth firing. */
const MAINTENANCE_RECALIBRATION_MIN_DELTA = 100;

/**
 * Headline character ceiling. APNs lock-screen body has ~178 chars; the
 * "with_suggestion" push variant prepends this headline plus a separator
 * before the recap sentence, so the headline must leave room for the
 * recap stub and the joining glyph.
 */
export const DIGEST_HEADLINE_MAX_CHARS = 120;

/** Body ceiling for the Digest card's Block 2. Long-tail safety. */
export const DIGEST_BODY_MAX_CHARS = 200;

/**
 * Run the cascade. Returns the first matching rule's suggestion, or
 * `null` when no rule fires. The caller renders the empty-state copy
 * for `null`.
 */
export function selectDigestSuggestion(
  input: DigestSuggestionInput,
): DigestSuggestion | null {
  // Rule 1 — Re-log prompt. Highest leverage: turns a logged habit
  // into a 1-tap entry next week.
  const rule1 = tryReLogPrompt(input);
  if (rule1) return rule1;

  // Rule 2 — Maintenance recalibration. Fixes the calorie target
  // itself when adaptive ≠ formula by ≥100 kcal AND respects the
  // manual-override + accepted-recalibration cooldowns.
  const rule2 = tryMaintenanceRecalibration(input);
  if (rule2) return rule2;

  // Rule 3 — Protein nudge. Macro-level fix when the goal is intact
  // but adherence is below half the logged days.
  const rule3 = tryProteinNudge(input);
  if (rule3) return rule3;

  // Rule 4 — Streak protection. Informational; no CTA. Only fires
  // when the user has zero freezes AND a streak worth protecting.
  const rule4 = tryStreakProtection(input);
  if (rule4) return rule4;

  // Rule 5 — Weight-trend mismatch. Last-resort review when calories
  // and weight disagree.
  const rule5 = tryWeightTrendMismatch(input);
  if (rule5) return rule5;

  return null;
}

// ───────────────────────────────────────────────────────────────────
// Rule 1 — Re-log prompt
// ───────────────────────────────────────────────────────────────────

function tryReLogPrompt(input: DigestSuggestionInput): DigestSuggestion | null {
  const { usualMealInsight, saveSeedItemCount } = input;
  if (!usualMealInsight) return null;
  if (usualMealInsight.kind !== "prompt") return null;
  // A single-item "usual" isn't worth a save dialog — the user gets
  // no leverage from saving one logged item. Two or more is the floor.
  if (!Number.isFinite(saveSeedItemCount) || saveSeedItemCount < 2) return null;

  const slot = usualMealInsight.suggestedSlot;
  const slotLower = slot.toLowerCase();
  // `repeats` is present on the Action 5 Item 8 loosened gate; on the
  // original gate (zero saved meals + ≥5 distinct days) we don't have
  // a verbatim repeat count, so fall back to `saveSeedItemCount` which
  // is the dialog-seed size — still factual ("you logged 3 items").
  const count = usualMealInsight.repeats ?? saveSeedItemCount;

  const headline = `Save your usual ${slotLower} as a meal — you logged the same items ${count}x.`;
  return {
    rule: "re_log_prompt",
    headline,
    body: headline,
    cta: {
      label: `Save ${slot} as a meal`,
      destination: `/save-meal?slot=${encodeURIComponent(slot)}`,
      tierRequired: "free",
    },
  };
}

// ───────────────────────────────────────────────────────────────────
// Rule 2 — Maintenance recalibration
// ───────────────────────────────────────────────────────────────────

function tryMaintenanceRecalibration(
  input: DigestSuggestionInput,
): DigestSuggestion | null {
  const { resolvedMaintenance, staticTdee, profile } = input;
  if (!resolvedMaintenance) return null;
  if (resolvedMaintenance.source !== "adaptive") return null;
  if (resolvedMaintenance.confidence !== "high") return null;
  if (!Number.isFinite(staticTdee) || staticTdee == null) return null;

  const adaptiveTdee = resolvedMaintenance.kcal;
  const delta = adaptiveTdee - staticTdee;
  const absDelta = Math.abs(delta);
  if (absDelta < MAINTENANCE_RECALIBRATION_MIN_DELTA) return null;

  const now = (input.now ?? new Date()).getTime();

  // Manual-override cooldown: if the user set their target_calories
  // manually within the last 14 days, do not pester them with a new
  // recalibration. Their explicit decision wins for two weeks.
  if (
    profile.targetCaloriesSource === "user" &&
    profile.targetCaloriesSetAt
  ) {
    const setAt = Date.parse(profile.targetCaloriesSetAt);
    if (Number.isFinite(setAt) && now - setAt < MANUAL_OVERRIDE_COOLDOWN_MS) {
      return null;
    }
  }

  // Accepted-recalibration cooldown: if the user already accepted a
  // Rule 2 suggestion within the last 21 days, don't re-prompt.
  if (
    profile.targetCaloriesSource === "digest_recalibration" &&
    profile.targetCaloriesSetAt
  ) {
    const setAt = Date.parse(profile.targetCaloriesSetAt);
    if (Number.isFinite(setAt) && now - setAt < RECALIBRATION_COOLDOWN_MS) {
      return null;
    }
  }

  const direction = delta > 0 ? "higher" : "lower";
  const sign = delta > 0 ? "+" : "−";
  const headline = `Your real burn is ${sign}${absDelta} kcal ${direction} than the formula.`;
  const body = `${headline} Update your calorie goal?`;
  return {
    rule: "maintenance_recalibration",
    headline,
    body,
    cta: {
      label: "Adjust calorie goal",
      destination: "/digest/recalibrate-maintenance",
      tierRequired: "free",
    },
  };
}

// ───────────────────────────────────────────────────────────────────
// Rule 3 — Protein nudge
// ───────────────────────────────────────────────────────────────────

function tryProteinNudge(input: DigestSuggestionInput): DigestSuggestion | null {
  const { recap, proteinOnTarget } = input;
  if (!Number.isFinite(proteinOnTarget) || proteinOnTarget < 0) return null;
  if (recap.daysLogged < 4) return null;
  if (proteinOnTarget >= recap.daysLogged * 0.5) return null;

  const headline = `Protein landed on target ${proteinOnTarget} of ${recap.daysLogged} days.`;
  const body = `${headline} A high-protein breakfast is the easiest fix.`;
  return {
    rule: "protein_nudge",
    headline,
    body,
    cta: {
      label: "Browse high-protein recipes",
      destination: "/recipes?filter=high-protein",
      tierRequired: "base",
    },
  };
}

// ───────────────────────────────────────────────────────────────────
// Rule 4 — Streak protection
// ───────────────────────────────────────────────────────────────────

function tryStreakProtection(
  input: DigestSuggestionInput,
): DigestSuggestion | null {
  const { recap, freezesAvailable, ledger } = input;
  if (freezesAvailable !== 0) return null;
  if (recap.streakLength < 7) return null;

  // Suppress when the user has earned a freeze in the last 14 days —
  // they may be at zero only because we just consumed one, and the
  // "log on weekends" prompt would feel disconnected from their
  // recent activity.
  const now = (input.now ?? new Date()).getTime();
  const earned = Array.isArray(ledger.earnedAt) ? ledger.earnedAt : [];
  for (const entry of earned) {
    const t = Date.parse(entry.earnedAt);
    if (Number.isFinite(t) && now - t < FREEZE_EARNED_SUPPRESS_MS) {
      return null;
    }
  }

  const headline = `Log on weekends to keep your ${recap.streakLength}-day streak going.`;
  const body = `${headline} That's where most streaks break.`;
  return {
    rule: "streak_protection",
    headline,
    body,
    cta: null,
  };
}

// ───────────────────────────────────────────────────────────────────
// Rule 5 — Weight-trend mismatch
// ───────────────────────────────────────────────────────────────────

function tryWeightTrendMismatch(
  input: DigestSuggestionInput,
): DigestSuggestion | null {
  const { recap, profile, targets } = input;
  if (profile.goal !== "cut") return null;
  if (recap.weightDeltaKg == null) return null;
  if (recap.weightDeltaKg <= 0) return null;
  if (recap.daysLogged < 5) return null;
  if (!Number.isFinite(targets.calories) || targets.calories <= 0) return null;
  if (recap.avgCalories > targets.calories) return null;

  const headline = `You hit your calorie target on ${recap.daysLogged} days but weight ticked up.`;
  const body = `${headline} Worth a check-in — Maintenance might need updating.`;
  return {
    rule: "weight_trend_mismatch",
    headline,
    body,
    cta: {
      label: "Open Maintenance",
      destination: "/progress?metric=maintenance",
      tierRequired: "free",
    },
  };
}
