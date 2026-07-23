/**
 * ENG-1668 — mobile Plan→Shopping must generate the list (web parity).
 *
 * Web `MealPlanner.handleShoppingList` calls `generateShoppingListFromPlan`
 * then navigates. Mobile used to bare-`router.push("/shopping")`. Pin the
 * wiring (host + hook) so the empty-state regression can't return silently.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const PLANNER = readFileSync(
  resolve(ROOT, "apps/mobile/app/(tabs)/planner.tsx"),
  "utf8",
);
const HOOK = readFileSync(
  resolve(ROOT, "apps/mobile/hooks/useOpenShoppingList.ts"),
  "utf8",
);

describe("mobile Plan Shopping open generates list (ENG-1668)", () => {
  it("hook generates then navigates", () => {
    expect(HOOK).toContain("generateShoppingListFromPlan(plan)");
    expect(HOOK).toContain('router.push("/shopping"');
    expect(HOOK.indexOf("generateShoppingListFromPlan(plan)")).toBeLessThan(
      HOOK.indexOf('router.push("/shopping"'),
    );
  });

  it("wires PlanV3 and PlanTabChrome Shopping entries to useOpenShoppingList", () => {
    expect(PLANNER).toContain("useOpenShoppingList");
    expect(PLANNER).toContain("onOpenShopping={openShoppingList}");
    expect(PLANNER).toMatch(/if \(next === "shopping"\) \{\s*openShoppingList\(\);/);
  });

  it("does not leave bare router.push as the PlanV3 shopping handler", () => {
    expect(PLANNER).not.toMatch(
      /onOpenShopping=\{\(\) => router\.push\("\/shopping"/,
    );
  });
});
