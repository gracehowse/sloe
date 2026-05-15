/**
 * DC12 (2026-05-14, premium-bar audit microcopy sweep) — Plan tab.
 *
 * Pins the linear/direct empty-state copy on Plan:
 *
 *   - Card title:    "No plan yet" (was "Plan your week")
 *   - Sub:           "Generate one in 30 seconds. …"
 *   - Primary CTA:   "Generate my plan" (was "Generate Plan")
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
  it("mobile empty state card title is the calm direct 'No plan yet'", () => {
    expect(MOBILE_SRC).toContain("<Text style={styles.cardTitle}>No plan yet</Text>");
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
