/**
 * ENG-956 — per-meal lock flag-gate + parity guard.
 *
 * The full MealPlanner / planner.tsx render needs the whole AppData +
 * navigation context, so this file follows the established source-level guard
 * pattern (see `mealPlannerLayoutConsolidation.test.ts`) to pin the wiring:
 *
 *   1. The lock affordance (glyph + "Keep this meal") is gated on the
 *      `plan_meal_lock_v1` flag — never rendered unconditionally.
 *   2. The Regenerate label flips to "Refresh the rest" when ≥1 meal is locked.
 *   3. Web and mobile share the flag key, the microcopy, and the events
 *      (`plan_meal_lock_toggled`, `plan_regenerated_partial`).
 *   4. The flag is default-OFF — it is NOT in either platform's
 *      REDESIGN_DEFAULT_ON registry.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WEB = readFileSync(
  resolve(__dirname, "../../src/app/components/MealPlanner.tsx"),
  "utf8",
);
const MOBILE = readFileSync(
  resolve(__dirname, "../../apps/mobile/app/(tabs)/planner.tsx"),
  "utf8",
);
const WEB_TRACK = readFileSync(
  resolve(__dirname, "../../src/lib/analytics/track.ts"),
  "utf8",
);
const MOBILE_ANALYTICS = readFileSync(
  resolve(__dirname, "../../apps/mobile/lib/analytics.ts"),
  "utf8",
);
const EVENTS = readFileSync(
  resolve(__dirname, "../../src/lib/analytics/events.ts"),
  "utf8",
);
const WEB_CONTEXT = readFileSync(
  resolve(__dirname, "../../src/context/AppDataContext.tsx"),
  "utf8",
);

const FLAG = "plan_meal_lock_v1";

describe("ENG-956 — per-meal lock flag gating", () => {
  it("reads the same flag key on both platforms", () => {
    expect(WEB).toContain(`isFeatureEnabled("${FLAG}")`);
    expect(MOBILE).toContain(`isFeatureEnabled("${FLAG}")`);
  });

  it("gates the lock affordance on the flag (web)", () => {
    // The lock glyph + Keep action are only rendered when `mealLockEnabled`.
    expect(WEB).toMatch(/const mealLockEnabled = isFeatureEnabled\("plan_meal_lock_v1"\)/);
    expect(WEB).toMatch(/lockAvailable\s*=\s*mealLockEnabled/);
    expect(WEB).toContain("Keep this meal");
  });

  it("gates the lock affordance on the flag (mobile)", () => {
    expect(MOBILE).toMatch(/const mealLockEnabled = isFeatureEnabled\("plan_meal_lock_v1"\)/);
    expect(MOBILE).toMatch(/mealLockEnabled && planMealHasRecipe\(meal\)/);
    expect(MOBILE).toContain("Keep this meal");
  });

  it("flips the Regenerate label to 'Refresh the rest' when a meal is locked (both)", () => {
    expect(WEB).toContain("Refresh the rest");
    expect(WEB).toMatch(/lockedMealCount > 0/);
    expect(MOBILE).toContain("Refresh the rest");
    expect(MOBILE).toMatch(/lockedMealCount > 0/);
  });

  it("is default-OFF — NOT in either REDESIGN_DEFAULT_ON registry", () => {
    // The default-on set is a literal `new Set([...])`; the flag must not be
    // a member, or it would resolve ON in every build.
    const webDefaultOn = WEB_TRACK.slice(
      WEB_TRACK.indexOf("REDESIGN_DEFAULT_ON = new Set"),
      WEB_TRACK.indexOf("export function isFeatureEnabled"),
    );
    const mobileDefaultOn = MOBILE_ANALYTICS.slice(
      MOBILE_ANALYTICS.indexOf("REDESIGN_DEFAULT_ON = new Set"),
      MOBILE_ANALYTICS.indexOf("export function isFeatureEnabled"),
    );
    expect(webDefaultOn).not.toContain(FLAG);
    expect(mobileDefaultOn).not.toContain(FLAG);
  });

  it("declares the shared lock + partial-regen events in the taxonomy", () => {
    expect(EVENTS).toContain("plan_meal_lock_toggled");
    expect(EVENTS).toContain("plan_regenerated_partial");
  });

  it("emits the lock toggle on both platforms + the partial-regen on each", () => {
    // Lock toggle fires from the UI surfaces on both platforms.
    expect(WEB).toContain("plan_meal_lock_toggled");
    expect(MOBILE).toContain("plan_meal_lock_toggled");
    // Partial-regen fires from the regenerate path: AppDataContext on web,
    // planner.tsx on mobile (mobile owns its own generate path).
    expect(WEB_CONTEXT).toContain("plan_regenerated_partial");
    expect(MOBILE).toContain("plan_regenerated_partial");
  });
});
