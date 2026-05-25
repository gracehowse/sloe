/**
 * Onboarding v2 — shared state shape, step ordering, and per-step
 * validation. Imported by both the web flow (`app/onboarding/v2/`) and
 * the mobile v2 flow (via `apps/mobile/lib/onboarding-v2.ts` re-export).
 *
 * Decision history: docs/decisions/2026-04-19-onboarding-redesign-scope.md
 *
 * Critical invariants enforced here:
 *  - Tab structure: 5 main tabs, others under More (out of scope for state)
 *  - Pace safety floor: SOFT-WARN, never hard-block. `canAdvance("pace", …)`
 *    returns true even when projected target is below the safety floor —
 *    only the warning banner shows. The decision doc + analytics
 *    `onboarding_pace_below_safety_floor` event are the audit trail.
 *  - Sex `"unspecified"` is a real user choice; the BMR equation uses
 *    the male/female midpoint (mirrors `calculateBMR` in tdee.ts).
 *  - Maintain skips the Pace step automatically (no kcal delta).
 */

// Relative import (not the `@/lib/nutrition/tdee` alias) so the mobile
// `@/*` alias — which points at the mobile workspace root — doesn't
// shadow the shared module when mobile typechecks via the
// `apps/mobile/lib/onboarding-v2.ts` re-export shim.
import type { ActivityLevel, NutritionStrategy, Sex } from "../nutrition/tdee";

/** Goals the v2 flow supports. Maps to existing strategy / budget calc
 *  via `mapGoalToStrategy` and `mapGoalToBudgetGoal` in `targets.ts`. */
export type Goal = "lose" | "maintain" | "gain" | "recomp";

/** Step IDs in display order. The flow auto-skips `pace` for maintain.
 *
 *  Customer-lens shrink (2026-04-30): three optional steps —
 *  `permissions`, `import`, `recipes` — were moved off the linear flow
 *  to cut the step counter from 15 to 12 (Cal AI ships 6, MFP 5,
 *  Lifesum 7; 15 was an outlier and tested as a churn anchor). The
 *  removed steps' affordances live on as organic discovery surfaces
 *  post-onboarding:
 *    - HealthKit + notifications → Settings → Health sync (always-on)
 *    - Recipe import → /(tabs)/library → Import button + /import-shared
 *    - Recipe seeding → /(tabs)/library browse + Today empty-state CTA
 *
 *  Re-add `data-bridges` (2026-05-01): customer-lens audit found that
 *  three competitor-refugee personas (MFP, MacroFactor, Paprika) bounced
 *  on day 1 because the flow ended at the Reveal aha without offering
 *  *any* path to bring their existing data with them. Data bridges
 *  re-introduces a single optional step that bundles the bridges most
 *  competitors give up on completing:
 *    1. Manual targets — paste-in 4-input form for users who already
 *       know their kcal / P / C / F (MFP / MacroFactor refugees).
 *    2. Apple Health — wraps `requestHealthPermissions` →
 *       `syncHealthData` so the user can see their adaptive-TDEE
 *       running on real active-energy data from day 1 (mobile only).
 *    3. Notifications — gentle reminders on by default for retention.
 *    4. Recipe URL — preserves the legacy `import.tsx` Instagram-link
 *       parser as one card inside the new step.
 *  Each card is independently skippable; the user can pick any one,
 *  several, or none. `dataBridgeChosen` is the audit signal capturing
 *  which path they took (or "skip"). data-bridges is the new terminal
 *  step (was: reveal); reveal becomes "show targets, then advance".
 *  Step files for the legacy `permissions.tsx` / `import.tsx` /
 *  `recipes.tsx` are kept on disk — building blocks for the post-launch
 *  nudge queue follow-up. */
export const STEP_IDS = [
  "welcome", // 01
  "signup", // 02
  "goal", // 03
  "sex", // 04
  "age", // 05
  "height", // 06
  "weight", // 07
  "activity", // 08
  "pace", // 09 — auto-skipped when goal = maintain
  "diet", // 10
  "strategy", // 11 — macro split (parity with legacy nutrition_strategy)
  "reveal", // 12 — penultimate aha
  "data-bridges", // 13 — terminal: bring your data with you (Build-40)
] as const;

export type StepId = (typeof STEP_IDS)[number];

/** Display labels mirrored on web + mobile. */
export const STEP_LABELS: Record<StepId, string> = {
  welcome: "Welcome",
  signup: "Account",
  goal: "Goal",
  sex: "Sex",
  age: "Age",
  height: "Height",
  weight: "Weight",
  activity: "Activity",
  pace: "Pace",
  diet: "Diet",
  strategy: "Macro style",
  reveal: "Your targets",
  "data-bridges": "Bring your data",
};

export const TOTAL_STEPS = STEP_IDS.length;

/** Auth method picked on the signup step. `null` until the user picks. */
export type AuthMethod = "apple" | "google" | "email" | null;

/** Unit system for height + weight. Persisted across the session so
 *  weight inherits the height step's choice. */
export type UnitSystem = "metric" | "imperial";

/** Permission grant tri-state: `null` = not asked, true/false = answered. */
export type PermissionGrant = boolean | null;

/** Recipe import source picked in step 13. Demo-only state for v2 launch. */
export type ImportSource = "instagram" | "tiktok" | "blog" | null;

/**
 * Build-40 (2026-05-01) — which data-bridge card the user actioned on
 * the data-bridges step.
 *   - "manual"        — entered manual kcal/P/C/F targets
 *   - "apple-health"  — granted HealthKit permissions (mobile only)
 *   - "notifications" — granted push notifications
 *   - "recipe"        — pasted a recipe URL
 *   - "skip"          — picked "Maybe later" / hit Build my plan empty
 *   - null            — hasn't touched the step yet
 *
 * Multiple cards can fire — the field captures the LAST card the user
 * actioned (used by analytics for funnel slicing). data-bridges is the
 * terminal step; advance is allowed regardless of which card (or none)
 * was picked.
 */
export type DataBridgeOption =
  | "manual"
  | "apple-health"
  | "notifications"
  | "recipe"
  | "skip"
  | null;

/** The whole onboarding state. Flat by design — easier to persist
 *  across tabs/refreshes and easier to round-trip through analytics. */
export interface OnboardingState {
  step: number;
  // Account
  name: string;
  email: string;
  authMethod: AuthMethod;
  // Goal + pace
  goal: Goal | null;
  /** Continuous kg/week slider value. `null` until user touches it
   *  (defaults pulled from `GOAL_DEFAULT_PACE` at calculation time). */
  paceKgPerWeek: number | null;
  // Body stats
  sex: Sex | null;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel | null;
  // Preferences
  diet: string[];
  allergies: string[];
  /**
   * Macro split override. `null` means "use the goal-derived default"
   * (`mapGoalToStrategy` in targets.ts). Set when the user picks a
   * different style on the Strategy step (parity with legacy
   * `nutrition_strategy` column on `profiles`).
   */
  nutritionStrategy: NutritionStrategy | null;
  unitSystem: UnitSystem;
  // Permissions + final demo
  healthGranted: PermissionGrant;
  notifGranted: PermissionGrant;
  importSource: ImportSource;
  /**
   * Whether the user has explicitly ticked the danger-banner
   * acknowledgement on the Pace step. Required by `legal-reviewer`
   * Stage F sign-off (decision doc 2026-04-19): one-tap Continue
   * with no affirmative tick reads as a dark pattern in reverse.
   * The acknowledgement re-resets whenever the warning reason
   * changes (handled in PaceStep) so an intentional advance is
   * captured per-decision, not per-session.
   */
  paceDangerAcknowledged: boolean;
  /**
   * Whether the user opted out of entering a body weight on the
   * Weight step. Required by `diversity-inclusion` Stage F sign-off
   * (decision doc 2026-04-19) — gives users with active ED or in
   * recovery a path through onboarding that doesn't force scale
   * interaction. When true, the Pace step is also auto-skipped (we
   * can't compute a safety-floor without weight) and the Reveal
   * step shows a "calibrate from your logs" message instead of
   * concrete targets.
   */
  weightSkipped: boolean;
  /**
   * Phase 5 / B2.3 — set of seed slugs the user picked on the final
   * "Pick 5 recipes" step. Persisted across step navigation so the
   * user can go back / forward without losing their selection.
   * Stored as a string array (JSON-friendly); `togglePick` /
   * `derivePickerState` work with `ReadonlySet<string>` for ergonomic
   * referential-equality checks. The terminal-step handler converts
   * between the two shapes.
   */
  pickedRecipeSlugs: string[];
  /**
   * Build-40 (2026-05-01) — manual-target inputs from the data-bridges
   * step. Captured when the user opts to paste their existing kcal /
   * macro targets straight in (the MFP / MacroFactor refugee path).
   *
   * Persistence rule: if all four are set + finite, they OVERRIDE the
   * computed targets in `effectiveTargetsForPersist()`. Otherwise the
   * computed targets win. Partial overrides are intentionally NOT
   * supported — half a target is worse than none for downstream
   * macro-tracking accuracy. `null` is the unset value.
   */
  manualTargetsKcal: number | null;
  manualTargetsProteinG: number | null;
  manualTargetsCarbsG: number | null;
  manualTargetsFatG: number | null;
  /**
   * Build-40 (2026-05-01) — last data-bridge card the user actioned.
   * See `DataBridgeOption` above. Drives the Reveal-stage analytics
   * payload + future post-launch nudge sequencing.
   */
  dataBridgeChosen: DataBridgeOption;
}

/** Default pace per goal — applied when the user hasn't dragged the
 *  slider yet. Values match the prototype's defaults; the continuous
 *  range per goal lives in `PACE_RANGES` (used by the slider UI). */
export const GOAL_DEFAULT_PACE: Record<Goal, number> = {
  lose: 0.4,
  maintain: 0,
  gain: 0.25,
  recomp: 0.15,
};

/**
 * Min / max / step for the pace slider, per goal.
 *
 * `lose` upper bound was 0.9 kg/week in the prototype draft, lowered
 * to 0.75 by `diversity-inclusion` Stage F sign-off (decision doc
 * 2026-04-19): the visible-max equates to ~1.65 lb/week, which is at
 * the edge of clinical guidance and makes the slider a body-neutral
 * default rather than ED-normalising. Users wanting a higher rate
 * still have to acknowledge the danger banner — the safety-floor
 * machinery is unchanged. (A future "extended range" disclosure flow
 * may reintroduce the 0.9 ceiling — tracked in
 * docs/planning/ongoing-backlog.md.)
 */
export const PACE_RANGES: Record<Goal, { min: number; max: number; step: number }> = {
  lose: { min: 0.1, max: 0.75, step: 0.05 },
  maintain: { min: 0, max: 0, step: 0 },
  gain: { min: 0.1, max: 0.4, step: 0.025 },
  recomp: { min: 0.05, max: 0.3, step: 0.025 },
};

/** Pace presets per goal. Tap-targets that snap the slider. */
export const PACE_PRESETS: Record<
  Exclude<Goal, "maintain">,
  { value: number; label: string; subtitle: string }[]
> = {
  lose: [
    { value: 0.2, label: "Gentle", subtitle: "~0.2 kg / week" },
    { value: 0.4, label: "Steady", subtitle: "~0.4 kg / week" },
    { value: 0.7, label: "Ambitious", subtitle: "~0.7 kg / week" },
  ],
  gain: [
    { value: 0.15, label: "Lean", subtitle: "~0.15 kg / week" },
    { value: 0.25, label: "Standard", subtitle: "~0.25 kg / week" },
    { value: 0.35, label: "Bulk", subtitle: "~0.35 kg / week" },
  ],
  recomp: [
    { value: 0.1, label: "Subtle", subtitle: "~0.1 kg / week" },
    { value: 0.15, label: "Standard", subtitle: "~0.15 kg / week" },
    { value: 0.25, label: "Aggressive", subtitle: "~0.25 kg / week" },
  ],
};

/** Default starting state. Body stats are sane midpoints so the Reveal
 *  step always has *something* to show before the user customises. */
export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  step: 0,
  name: "",
  email: "",
  authMethod: null,
  goal: null,
  paceKgPerWeek: null,
  sex: null,
  age: 28,
  heightCm: 170,
  weightKg: 72,
  activity: null,
  diet: [],
  allergies: [],
  nutritionStrategy: null,
  unitSystem: "metric",
  healthGranted: null,
  notifGranted: null,
  importSource: null,
  paceDangerAcknowledged: false,
  weightSkipped: false,
  pickedRecipeSlugs: [],
  manualTargetsKcal: null,
  manualTargetsProteinG: null,
  manualTargetsCarbsG: null,
  manualTargetsFatG: null,
  dataBridgeChosen: null,
};

/** Resolve the step index a navigation should land on, accounting for
 *  the two auto-skips of `pace`:
 *   - `goal === "maintain"` — no kcal delta to set (decision-doc default)
 *   - `weightSkipped` — no body data to compute a safe floor against
 *     (Stage F diversity-inclusion update)
 *  Returns a clamped index inside [0, TOTAL_STEPS - 1]. */
export function resolveNextStep(
  current: number,
  delta: number,
  state: Pick<OnboardingState, "goal" | "weightSkipped">,
): number {
  let next = current + delta;
  const skipPace =
    (state.goal === "maintain" || state.weightSkipped) &&
    STEP_IDS[next] === "pace";
  if (skipPace) {
    next += delta > 0 ? 1 : -1;
  }
  return Math.max(0, Math.min(TOTAL_STEPS - 1, next));
}

/** Optional context for `canAdvance` — provider passes the live
 *  `paceWarning` so the Pace step's acknowledgement gate can fire
 *  without state.ts importing from targets.ts (circular). Duck-typed
 *  on `level` to keep the type cycle out. */
export interface CanAdvanceContext {
  paceWarning?: { level: "info" | "warn" | "danger" } | null;
}

/** Per-step validation. Returns true when "Continue" should enable.
 *
 *  IMPORTANT — Pace step (legal-reviewer Stage F sign-off):
 *  the safety floor is SOFT-WARN — we never block advance based on
 *  the projected kcal alone. But when the projected target triggers
 *  the `danger` banner, the user must tick the explicit
 *  acknowledgement checkbox before Continue activates. Continue
 *  remains a one-tap action for `info` / `warn` / no-warning states.
 *
 *  Decision doc § "Decision 2" + Stage F update.
 */
export function canAdvance(
  stepId: StepId,
  state: OnboardingState,
  ctx?: CanAdvanceContext,
): boolean {
  switch (stepId) {
    case "welcome":
      return true;
    case "signup":
      // The Signup step owns its own "Create account" CTA which fires
      // the real Supabase signUp and then advances the flow itself
      // (via context.go). The global footer Continue is suppressed on
      // this step in the shell — see `web-flow.tsx`. canAdvance
      // returns true defensively so any code path that doesn't honour
      // the suppression (e.g. keyboard shortcut, deep-link) still
      // permits forward motion rather than soft-locking the flow.
      return true;
    case "goal":
      return state.goal !== null;
    case "pace":
      // Maintain doesn't reach this branch (auto-skipped) but defend anyway.
      if (state.goal === "maintain") return true;
      // `null` means the UI + target math use `GOAL_DEFAULT_PACE[goal]`
      // (Steady is shown selected). Don't block Continue until the user
      // taps a preset — the default is a valid choice.
      // Danger banner → require explicit acknowledgement. Other
      // warning levels (info, warn) advance with one tap, so the
      // soft-warn product decision still holds for the gentler
      // bands.
      if (
        ctx?.paceWarning?.level === "danger" &&
        !state.paceDangerAcknowledged
      ) {
        return false;
      }
      return true;
    case "sex":
      return state.sex !== null;
    case "age":
      return state.age >= 14 && state.age <= 100;
    case "height":
      return state.heightCm > 0;
    case "weight":
      // Stage F (diversity-inclusion) — `weightSkipped` is the
      // explicit "no scale interaction" path. When set, advance is
      // permitted with no weight value and the Pace step is also
      // auto-skipped; the Reveal step shows a calibration message
      // instead of concrete kcal targets.
      return state.weightSkipped || state.weightKg > 0;
    case "activity":
      return state.activity !== null;
    case "diet":
      return true; // optional step
    case "strategy":
      // Always advanceable — `null` means "use the goal-derived
      // default" (mapGoalToStrategy), so the user always has a valid
      // macro split even if they don't tap a card.
      return true;
    case "reveal":
      // Build-40 (2026-05-01) — `reveal` is now the penultimate step
      // (was terminal). User taps Continue to land on `data-bridges`,
      // which is the new terminal step where the `handleComplete`
      // write path fires.
      return true;
    case "data-bridges":
      // Build-40 (2026-05-01) — terminal step. Every card is
      // independently optional; "skip" is a valid first-class choice
      // (see DataBridgeOption). Advance is always permitted so the
      // user can land on Today after Reveal even if they haven't
      // touched a single bridge card.
      return true;
    default:
      return true;
  }
}
