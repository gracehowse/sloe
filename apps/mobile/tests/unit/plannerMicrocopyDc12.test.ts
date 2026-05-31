/**
 * DC12 (2026-05-14, premium-bar audit microcopy sweep) — Plan tab.
 *
 * Pins the linear/direct empty-state copy on Plan:
 *
 *   - Card title:    "No plan yet" (flag off) / "Plan your week" (flag on)
 *   - Sub:           "Generate one in 30 seconds. …"
 *   - Primary CTA:   "Generate my plan" (was "Generate Plan")
 *
 * ENG-788 (2026-05-30) split the title behind `plan_empty_state_v2`:
 * with ≥1 saved recipe the config card now reads "Plan your week"; the
 * 0-recipe case routes to `<PlanEmptyState>` entirely. The legacy
 * "No plan yet" copy survives on the flag-off arm.
 *
 * Plan is a low-emotion surface — the user just wants to know what
 * they're looking at and what the next tap costs. The 30-second
 * time signal is the load-bearing claim that a returning MFP/Lose
 * It refugee reads as "this won't be a 10-minute chore".
 *
 * Web parity is handled inline in
 * `src/app/components/MealPlanner.tsx` (the bottom Regenerate row
 * swaps the verb to "Generate my plan" when `plan.length === 0`).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PLANNER_PATH = resolve(__dirname, "../../app/(tabs)/planner.tsx");
const WEB_PLANNER_PATH = resolve(
  __dirname,
  "../../../../src/app/components/MealPlanner.tsx",
);
const MOBILE_SRC = readFileSync(PLANNER_PATH, "utf8");
const WEB_SRC = readFileSync(WEB_PLANNER_PATH, "utf8");

describe("Plan tab microcopy (DC12)", () => {
  it("mobile empty state card title keeps the calm direct copy on both flag arms", () => {
    // ENG-788 (2026-05-30) turned the single title into a flag ternary;
    // ENG-790 (2026-05-31) widened the "on" arm to `primaryPills`
    // (`plan_source_selector || plan_empty_state_v2`) so the source-
    // selector path also gets the "Plan your week" framing. Off → the
    // legacy "No plan yet". Pin both arms so neither copy can drift.
    expect(MOBILE_SRC).toContain(
      '{primaryPills ? "Plan your week" : "No plan yet"}',
    );
  });

  it("mobile empty state sub carries the 30-second time signal", () => {
    expect(MOBILE_SRC).toContain("Generate one in 30 seconds.");
  });

  it("mobile primary CTA reads 'Generate my plan' (user-action voice)", () => {
    expect(MOBILE_SRC).toContain("Generate my plan");
  });

  it("web Plan bottom CTA swaps to 'Generate my plan' when no plan exists", () => {
    expect(WEB_SRC).toContain('plan.length > 0 ? "Regenerate week" : "Generate my plan"');
  });
});
