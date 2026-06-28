import { describe, expect, it } from "vitest";
import {
  DEFAULT_ONBOARDING_STATE,
  GOAL_DEFAULT_PACE,
  PACE_PRESETS,
  PACE_RANGES,
  STEP_IDS,
  STEP_LABELS,
  TOTAL_STEPS,
  canAdvance,
  displayPosition,
  resolveNextStep,
  type OnboardingState,
  type StepId,
} from "../../src/lib/onboarding/state";

/**
 * Onboarding v2 — state shape, step ordering, and `canAdvance`
 * validation rules. Locks in the decision-doc invariants:
 *
 *  - 17 steps in fixed order; `pace` auto-skips when goal = maintain,
 *    `app-choice` auto-skips when the `onboarding-app-choice` flag is OFF,
 *    `why-now` auto-skips when the `onboarding-why-now` flag is OFF,
 *    `upgrade` + `first-log` auto-skip when `onboarding_conversion_funnel_v1` is OFF.
 *    (Was 15 pre customer-lens shrink 2026-04-30 — `permissions`,
 *    `import`, `recipes` were moved off the linear flow. Components
 *    kept on disk for the post-launch nudge queue.
 *    Build-40 (2026-05-01) — re-added `data-bridges` as the new
 *    terminal step bundling manual-targets / Apple Health /
 *    notifications / recipe URL cards.
 *    ENG-990 (2026-06-08) — added `app-choice` ("Coming from another
 *    app?") after Welcome, flag-gated + auto-skipped when OFF.
 *    ENG-963 (2026-06-30) — added `why-now` ("What's bringing you
 *    here?") after `goal`, flag-gated + auto-skipped when OFF. See
 *    state.ts STEP_IDS.)
 *  - Pace safety floor is SOFT-WARN — `canAdvance("pace", …)` returns
 *    true even when projected target falls below 1,200/1,500 kcal.
 *    Only the *banner* policy lives in `targets.ts`.
 *  - Sex `"unspecified"` is valid; the BMR equation uses the male/
 *    female midpoint (covered by `onboardingV2Targets.test.ts`).
 *
 * If any of these fail, that's a regression vs.
 * `docs/decisions/2026-04-19-onboarding-redesign-scope.md`.
 */

const baseState = (
  overrides: Partial<OnboardingState> = {},
): OnboardingState => ({
  ...DEFAULT_ONBOARDING_STATE,
  ...overrides,
});

describe("onboarding v2 — step ordering", () => {
  it("ships exactly 17 steps in the documented order (Build-40 data-bridges + ENG-990 app-choice + ENG-963 why-now + ENG-1233/1241 funnel)", () => {
    expect(TOTAL_STEPS).toBe(17);
    expect(STEP_IDS).toEqual([
      "welcome",
      "app-choice",
      "goal",
      "why-now",
      "sex",
      "age",
      "height",
      "weight",
      "activity",
      "pace",
      "diet",
      "strategy",
      "reveal",
      "signup",
      "data-bridges",
      "upgrade",
      "first-log",
    ]);
  });

  it("does NOT include the off-flow steps (permissions/import/recipes) in STEP_IDS", () => {
    // The legacy step components still exist on disk (and are still
    // exported from steps/index.ts for back-compat), but they must
    // not be reachable via the linear shell. Build-40 replaced their
    // canonical role with the new `data-bridges` step.
    const ids: readonly string[] = STEP_IDS;
    expect(ids).not.toContain("permissions");
    expect(ids).not.toContain("import");
    expect(ids).not.toContain("recipes");
    // The new canonical bridge step IS in the linear flow.
    expect(ids).toContain("data-bridges");
  });

  it("has a label for every step id", () => {
    for (const id of STEP_IDS) {
      expect(STEP_LABELS[id]).toBeTruthy();
    }
  });
});

describe("onboarding v2 — resolveNextStep auto-skip", () => {
  // Index-relative so the assertions survive future step reordering
  // (ENG-990 shifted every body-stats step by one when `app-choice`
  // landed after Welcome). The pace step always sits between `activity`
  // and `diet`; we navigate from `activity` and expect to land on the
  // next *unskipped* step.
  const ACTIVITY = STEP_IDS.indexOf("activity");
  const DIET = STEP_IDS.indexOf("diet");

  it("skips the pace step when goal = maintain (forward navigation)", () => {
    const next = resolveNextStep(ACTIVITY, +1, baseState({ goal: "maintain" }));
    expect(STEP_IDS[next]).toBe("diet");
  });

  it("skips the pace step when goal = maintain (backward navigation)", () => {
    const prev = resolveNextStep(DIET, -1, baseState({ goal: "maintain" }));
    expect(STEP_IDS[prev]).toBe("activity");
  });

  it("does not skip the pace step for cut/recomp/gain goals", () => {
    for (const goal of ["lose", "recomp", "gain"] as const) {
      const next = resolveNextStep(ACTIVITY, +1, baseState({ goal }));
      expect(STEP_IDS[next]).toBe("pace");
    }
  });

  it("also auto-skips the pace step when weightSkipped is true (Stage F diversity-inclusion)", () => {
    const next = resolveNextStep(
      ACTIVITY,
      +1,
      baseState({ goal: "lose", weightSkipped: true }),
    );
    expect(STEP_IDS[next]).toBe("diet");
  });

  it("clamps to [0, TOTAL_STEPS - 1]", () => {
    expect(resolveNextStep(0, -1, baseState())).toBe(0);
    expect(resolveNextStep(TOTAL_STEPS - 1, +1, baseState())).toBe(
      TOTAL_STEPS - 1,
    );
  });
});

describe("onboarding v2 — resolveNextStep app-choice flag gate (ENG-990)", () => {
  const WELCOME = STEP_IDS.indexOf("welcome");

  it("skips app-choice when the flag is OFF (default) — welcome jumps to goal", () => {
    // No options arg → appChoiceEnabled defaults to false → skip.
    const next = resolveNextStep(WELCOME, +1, baseState());
    expect(STEP_IDS[next]).toBe("goal");
  });

  it("skips app-choice when the flag is explicitly OFF", () => {
    const next = resolveNextStep(WELCOME, +1, baseState(), {
      appChoiceEnabled: false,
    });
    expect(STEP_IDS[next]).toBe("goal");
  });

  it("lands on app-choice when the flag is ON", () => {
    const next = resolveNextStep(WELCOME, +1, baseState(), {
      appChoiceEnabled: true,
    });
    expect(STEP_IDS[next]).toBe("app-choice");
  });

  it("skips app-choice on backward navigation too (goal → welcome with flag OFF)", () => {
    const goal = STEP_IDS.indexOf("goal");
    const prev = resolveNextStep(goal, -1, baseState(), {
      appChoiceEnabled: false,
    });
    expect(STEP_IDS[prev]).toBe("welcome");
  });
});

describe("onboarding v2 — resolveNextStep conversion-funnel gate (ENG-1233 / ENG-1241)", () => {
  const DATA_BRIDGES = STEP_IDS.indexOf("data-bridges");
  const UPGRADE = STEP_IDS.indexOf("upgrade");
  const FIRST_LOG = STEP_IDS.indexOf("first-log");

  it("skips upgrade + first-log when the flag is OFF — data-bridges stays terminal", () => {
    const next = resolveNextStep(DATA_BRIDGES, +1, baseState(), {
      conversionFunnelEnabled: false,
    });
    expect(STEP_IDS[next]).toBe("data-bridges");
  });

  it("lands on upgrade when the flag is ON (forward from data-bridges)", () => {
    const next = resolveNextStep(DATA_BRIDGES, +1, baseState(), {
      conversionFunnelEnabled: true,
    });
    expect(STEP_IDS[next]).toBe("upgrade");
  });

  it("lands on first-log after upgrade when the flag is ON", () => {
    const next = resolveNextStep(UPGRADE, +1, baseState(), {
      conversionFunnelEnabled: true,
    });
    expect(STEP_IDS[next]).toBe("first-log");
  });

  it("skips conversion-funnel steps on backward navigation when flag OFF", () => {
    const prev = resolveNextStep(FIRST_LOG, -1, baseState(), {
      conversionFunnelEnabled: false,
    });
    expect(STEP_IDS[prev]).toBe("data-bridges");
  });
});

describe("onboarding v2 — displayPosition conversion-funnel (ENG-1233 / ENG-1241)", () => {
  const funnelOn = {
    appChoiceEnabled: true,
    whyNowEnabled: true,
    conversionFunnelEnabled: true,
  };

  it("excludes upgrade + first-log from the total when the flag is OFF", () => {
    const { total } = displayPosition(0, {
      ...funnelOn,
      conversionFunnelEnabled: false,
    });
    expect(total).toBe(TOTAL_STEPS - 2);
  });

  it("includes upgrade + first-log when the flag is ON", () => {
    const { total } = displayPosition(0, funnelOn);
    expect(total).toBe(TOTAL_STEPS);
  });

  it("hides funnel, app-choice, and why-now when all three flags are OFF", () => {
    const { total } = displayPosition(0, {
      appChoiceEnabled: false,
      whyNowEnabled: false,
      conversionFunnelEnabled: false,
    });
    expect(total).toBe(TOTAL_STEPS - 4);
  });
});

describe("onboarding v2 — signup after reveal (ENG-962)", () => {
  it("places signup immediately after reveal and before data-bridges", () => {
    const reveal = STEP_IDS.indexOf("reveal");
    const signup = STEP_IDS.indexOf("signup");
    const bridges = STEP_IDS.indexOf("data-bridges");
    expect(signup).toBe(reveal + 1);
    expect(bridges).toBe(signup + 1);
  });

  it("lets users reach reveal without a session (targets-first path)", () => {
    expect(canAdvance("goal", baseState({ goal: "lose" }))).toBe(true);
    expect(canAdvance("reveal", baseState())).toBe(true);
    expect(canAdvance("signup", baseState(), { hasSession: false })).toBe(
      false,
    );
  });

  it("reveal Continue lands on signup", () => {
    const reveal = STEP_IDS.indexOf("reveal");
    const next = resolveNextStep(reveal, +1, baseState());
    expect(STEP_IDS[next]).toBe("signup");
  });
});

describe("onboarding v2 — displayPosition counts only visible steps (ENG-990)", () => {
  // ENG-963 — these assertions isolate the app-choice flag's effect by
  // holding `whyNowEnabled: true` (so why-now is NOT also discounted).
  // The why-now flag's own count effect is covered in its dedicated wiring
  // test (`onboardingWhyNowWiring.test.ts`).
  it("excludes app-choice from the total when the flag is OFF", () => {
    const { total } = displayPosition(0, {
      appChoiceEnabled: false,
      whyNowEnabled: true,
      conversionFunnelEnabled: true,
    });
    expect(total).toBe(TOTAL_STEPS - 1);
  });

  it("includes app-choice in the total when the flag is ON", () => {
    const { total } = displayPosition(0, {
      appChoiceEnabled: true,
      whyNowEnabled: true,
      conversionFunnelEnabled: true,
    });
    expect(total).toBe(TOTAL_STEPS);
  });

  it("does not inflate the display index for steps after the hidden app-choice (flag OFF)", () => {
    // goal is raw index 2, but with app-choice hidden it's the 2nd
    // visible step → display index 2 (welcome is 1). why-now sits AFTER
    // goal, so its flag state can't change goal's index.
    const goal = STEP_IDS.indexOf("goal");
    const off = displayPosition(goal, {
      appChoiceEnabled: false,
      whyNowEnabled: true,
      conversionFunnelEnabled: true,
    });
    expect(off.index).toBe(2);
    // With the flag ON, goal is the 3rd visible step → index 3.
    const on = displayPosition(goal, {
      appChoiceEnabled: true,
      whyNowEnabled: true,
      conversionFunnelEnabled: true,
    });
    expect(on.index).toBe(3);
  });

  it("signup display index reflects post-reveal position (ENG-962)", () => {
    const signup = STEP_IDS.indexOf("signup");
    // Both flag-gated steps hidden (the live default) — welcome + 11
    // body/reveal steps before signup → index 12.
    const off = displayPosition(signup, {
      appChoiceEnabled: false,
      whyNowEnabled: false,
    });
    expect(off.index).toBe(12);
  });

  it("welcome is always 'Step 1' in both flag states", () => {
    expect(displayPosition(0, { appChoiceEnabled: false }).index).toBe(1);
    expect(displayPosition(0, { appChoiceEnabled: true }).index).toBe(1);
  });
});

describe("onboarding v2 — canAdvance per step", () => {
  const cases: Array<[StepId, OnboardingState, boolean, string]> = [
    // welcome — no inputs required
    ["welcome", baseState(), true, "always advances"],
    // app-choice — ENG-990 optional capture; advancing without a pick is
    // a first-class choice (the "starting fresh" tile / footer Continue).
    ["app-choice", baseState(), true, "always advances (pick is optional)"],
    // why-now — ENG-963 optional intent capture; advancing without a pick
    // is a first-class choice (the footer Continue always moves on).
    ["why-now", baseState(), true, "always advances (pick is optional)"],
    ["upgrade", baseState(), true, "always advances (skippable trial step)"],
    ["first-log", baseState(), true, "always advances (terminal funnel step)"],
    [
      "why-now",
      baseState({ whyNow: "feel-better" }),
      true,
      "advances with an intent chosen",
    ],
    [
      "app-choice",
      baseState({ appChoice: "mfp" }),
      true,
      "advances with an importable app chosen",
    ],
    [
      "app-choice",
      baseState({ appChoice: "none" }),
      true,
      "advances when starting fresh",
    ],
    // signup — ENG-672 (2026-05-26): advancing past Signup is gated on a
    // REAL Supabase session. Without `hasSession` in the ctx (or with it
    // false) `canAdvance` returns false — this is the guard that stops a
    // user walking the rest of the flow unauthenticated and losing every
    // answer on the terminal /login bounce. The session-true cases live
    // in their own describe block below (the `cases` table here doesn't
    // thread ctx). Here we pin the default-deny: even with name/email/
    // authMethod set, NO session means NO advance.
    ["signup", baseState(), false, "blocks without a session (default-deny)"],
    [
      "signup",
      baseState({ authMethod: "email" }),
      false,
      "authMethod set but no session → still blocked",
    ],
    [
      "signup",
      baseState({ name: "Grace", email: "grace@example.com" }),
      false,
      "name + email typed but no session → still blocked",
    ],
    // strategy — informational (default = goal-derived)
    ["strategy", baseState(), true, "always advances (default = goal-derived)"],
    // goal — must be picked
    ["goal", baseState(), false, "no goal"],
    ["goal", baseState({ goal: "lose" }), true, "lose goal"],
    // sex — required
    ["sex", baseState(), false, "no sex"],
    ["sex", baseState({ sex: "female" }), true, "female"],
    ["sex", baseState({ sex: "unspecified" }), true, "unspecified is valid"],
    // age — must be in [14, 100]
    ["age", baseState({ age: 13 }), false, "below floor"],
    ["age", baseState({ age: 14 }), true, "at floor"],
    ["age", baseState({ age: 100 }), true, "at ceiling"],
    ["age", baseState({ age: 101 }), false, "above ceiling"],
    // height + weight — positive (or weight skipped per Stage F)
    ["height", baseState({ heightCm: 0 }), false, "zero height"],
    ["height", baseState({ heightCm: 170 }), true, "positive height"],
    ["weight", baseState({ weightKg: 0 }), false, "zero weight"],
    ["weight", baseState({ weightKg: 60 }), true, "positive weight"],
    [
      "weight",
      baseState({ weightKg: 0, weightSkipped: true }),
      true,
      "weight skipped (diversity-inclusion path)",
    ],
    // activity — required
    ["activity", baseState(), false, "no activity"],
    ["activity", baseState({ activity: "moderate" }), true, "moderate"],
    // diet — optional
    ["diet", baseState(), true, "always advances (optional)"],
    // reveal — informational, penultimate step. Build-40 — `reveal`
    // advances to `data-bridges`, the new terminal step.
    ["reveal", baseState(), true, ""],
    // data-bridges — terminal, all cards optional, "skip" is valid.
    [
      "data-bridges",
      baseState(),
      true,
      "always advances (every card optional)",
    ],
    [
      "data-bridges",
      baseState({ dataBridgeChosen: "skip" }),
      true,
      "skip is a first-class choice",
    ],
    [
      "data-bridges",
      baseState({
        manualTargetsKcal: 1900,
        manualTargetsProteinG: 145,
        manualTargetsCarbsG: 180,
        manualTargetsFatG: 65,
        dataBridgeChosen: "manual",
      }),
      true,
      "manual targets path",
    ],
  ];

  for (const [step, state, expected, label] of cases) {
    it(`${step}: ${label}`, () => {
      expect(canAdvance(step, state)).toBe(expected);
    });
  }
});

describe("onboarding v2 — signup advance is gated on a real session (ENG-672)", () => {
  /**
   * ENG-672 (2026-05-26) — Urgent / launch-blocker.
   *
   * Pre-fix `canAdvance("signup", …)` returned `true` unconditionally.
   * On mobile the footer Continue was NOT suppressed on the signup
   * step, so a user could tap it and walk the entire flow
   * unauthenticated; the terminal step then bounced them to /login,
   * DISCARDING every computed target + seed — the worst first
   * impression for an MFP refugee.
   *
   * The guard: forward motion off Signup requires a REAL Supabase
   * session (`ctx.hasSession === true`), supplied by each flow shell
   * from its platform auth context. These tests fail loudly if the
   * gate is ever loosened back to an unconditional `true`.
   */
  it("BLOCKS advance when no session has landed (the data-loss guard)", () => {
    expect(canAdvance("signup", baseState(), { hasSession: false })).toBe(
      false,
    );
    // Undefined hasSession (e.g. a deep-link path that didn't thread
    // auth) must default to the SAFE answer — do not advance.
    expect(canAdvance("signup", baseState(), {})).toBe(false);
    expect(canAdvance("signup", baseState())).toBe(false);
  });

  it("ALLOWS advance only once a real session exists", () => {
    expect(canAdvance("signup", baseState(), { hasSession: true })).toBe(true);
  });

  it("a session gates advance even with no name/email typed (Apple-only path)", () => {
    // Apple Sign-In can land a session without the user ever typing the
    // optional name field. The session — not the form fields — is the
    // gate.
    expect(
      canAdvance("signup", baseState({ name: "", email: "" }), {
        hasSession: true,
      }),
    ).toBe(true);
  });

  it("typed credentials WITHOUT a session never advance (premature-advance regression)", () => {
    // This is the precise shape of the pre-fix bug: the user filled in
    // fields, the step optimistically advanced before auth resolved.
    const typed = baseState({
      name: "Grace",
      email: "grace@example.com",
      authMethod: "email",
    });
    expect(canAdvance("signup", typed, { hasSession: false })).toBe(false);
  });
});

describe("onboarding v2 — pace safety floor is SOFT-WARN", () => {
  /**
   * Reified from decision doc 2026-04-19-onboarding-redesign-scope.md
   * §"Decision 2 — Pace safety floor: soft warn, allow advance".
   *
   * Even when the projected daily target is well below the safety
   * floor (1,200 F / 1,500 M / 1,350 unspecified), `canAdvance` for
   * the pace step must still return true so long as a numeric pace
   * has been chosen. The danger banner shows; analytics fire on
   * advance-despite-banner; the user proceeds if they choose.
   */
  it("returns true with no warning context for an aggressive pace (banner + acknowledgement live in the UI layer)", () => {
    const state = baseState({
      goal: "lose",
      sex: "female",
      weightKg: 50,
      heightCm: 155,
      age: 25,
      activity: "sedentary",
      paceKgPerWeek: 0.7,
    });
    // No `paceWarning` ctx supplied → soft-warn product decision
    // applies as before (other warning levels never block).
    expect(canAdvance("pace", state)).toBe(true);
  });

  it("returns false when a `danger` warning is active and the user has not acknowledged (Stage F legal)", () => {
    const state = baseState({
      goal: "lose",
      sex: "female",
      weightKg: 50,
      heightCm: 155,
      age: 25,
      activity: "sedentary",
      paceKgPerWeek: 0.7,
      paceDangerAcknowledged: false,
    });
    expect(
      canAdvance("pace", state, { paceWarning: { level: "danger" } }),
    ).toBe(false);
  });

  it("returns true when a `danger` warning is active AND the user has ticked the acknowledgement", () => {
    const state = baseState({
      goal: "lose",
      sex: "female",
      weightKg: 50,
      heightCm: 155,
      age: 25,
      activity: "sedentary",
      paceKgPerWeek: 0.7,
      paceDangerAcknowledged: true,
    });
    expect(
      canAdvance("pace", state, { paceWarning: { level: "danger" } }),
    ).toBe(true);
  });

  it("does NOT require acknowledgement for `info` or `warn` levels", () => {
    const state = baseState({
      goal: "lose",
      sex: "male",
      weightKg: 80,
      paceKgPerWeek: 0.4,
      paceDangerAcknowledged: false,
    });
    expect(canAdvance("pace", state, { paceWarning: { level: "warn" } })).toBe(
      true,
    );
    expect(canAdvance("pace", state, { paceWarning: { level: "info" } })).toBe(
      true,
    );
  });

  it("allows advance when pace is null — default preset applies", () => {
    const state = baseState({ goal: "lose", paceKgPerWeek: null });
    expect(canAdvance("pace", state)).toBe(true);
  });

  it("auto-passes the pace step when goal is maintain (defence-in-depth)", () => {
    const state = baseState({ goal: "maintain", paceKgPerWeek: null });
    expect(canAdvance("pace", state)).toBe(true);
  });
});

describe("onboarding v2 — pace presets + ranges", () => {
  it("ships 3 presets per non-maintain goal", () => {
    expect(PACE_PRESETS.lose).toHaveLength(3);
    expect(PACE_PRESETS.gain).toHaveLength(3);
    expect(PACE_PRESETS.recomp).toHaveLength(3);
  });

  it("preset values fall within their goal's range", () => {
    for (const goal of ["lose", "gain", "recomp"] as const) {
      const range = PACE_RANGES[goal];
      for (const preset of PACE_PRESETS[goal]) {
        expect(preset.value).toBeGreaterThanOrEqual(range.min);
        expect(preset.value).toBeLessThanOrEqual(range.max);
      }
    }
  });

  it("default pace per goal falls within range", () => {
    for (const goal of ["lose", "gain", "recomp"] as const) {
      const range = PACE_RANGES[goal];
      const def = GOAL_DEFAULT_PACE[goal];
      expect(def).toBeGreaterThanOrEqual(range.min);
      expect(def).toBeLessThanOrEqual(range.max);
    }
    expect(GOAL_DEFAULT_PACE.maintain).toBe(0);
  });
});

describe("onboarding v2 — optional pronouns", () => {
  it("does not gate the sex step or change BMR-driving sex", () => {
    expect(canAdvance("sex", baseState({ sex: "female", pronouns: "" }))).toBe(
      true,
    );
    expect(
      canAdvance("sex", baseState({ sex: null, pronouns: "they/them" })),
    ).toBe(false);
  });
});
