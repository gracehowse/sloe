/**
 * ENG-1668 — mobile Plan→Shopping must generate the list (web parity).
 *
 * Web `MealPlanner.handleShoppingList` calls `generateShoppingListFromPlan`
 * then navigates. Mobile used to bare-`router.push("/shopping")`, leaving
 * an empty list for any plan that wasn't freshly regenerated. Pin the
 * wiring so the empty-state regression can't return silently.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const PLANNER = readFileSync(
  resolve(ROOT, "apps/mobile/app/(tabs)/planner.tsx"),
  "utf8",
);

describe("mobile Plan Shopping open generates list (ENG-1668)", () => {
  it("defines openShoppingList that calls generateShoppingListFromPlan before navigate", () => {
    expect(PLANNER).toMatch(/const openShoppingList = useCallback/);
    const start = PLANNER.indexOf("const openShoppingList = useCallback");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = PLANNER.slice(start, start + 800);
    expect(body).toContain("generateShoppingListFromPlan(plan)");
    expect(body).toContain('router.push("/shopping"');
    // Generate must appear before the navigate push in the handler body.
    expect(body.indexOf("generateShoppingListFromPlan(plan)")).toBeLessThan(
      body.indexOf('router.push("/shopping"'),
    );
  });

  it("wires PlanV3 and PlanTabChrome Shopping entries to openShoppingList", () => {
    expect(PLANNER).toContain("onOpenShopping={openShoppingList}");
    expect(PLANNER).toMatch(/if \(next === "shopping"\) \{\s*openShoppingList\(\);/);
  });

  it("does not leave bare router.push as the PlanV3 shopping handler", () => {
    expect(PLANNER).not.toMatch(
      /onOpenShopping=\{\(\) => router\.push\("\/shopping"/,
    );
  });
});
