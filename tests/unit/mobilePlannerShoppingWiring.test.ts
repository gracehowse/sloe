/**
 * ENG-1668 — Plan→Shopping navigation must rebuild the list from the plan
 * before routing (web parity). Mobile previously bare-pushed `/shopping`,
 * leaving `shopping_items` empty when a plan existed but no regenerate had
 * run.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", p), "utf8");

const WEB_PLANNER = read("src/app/components/MealPlanner.tsx");
const MOBILE_PLANNER = read("apps/mobile/app/(tabs)/planner.tsx");

describe("Plan→Shopping CTA wiring — web ↔ mobile parity (ENG-1668)", () => {
  it("web handleShoppingList generates then navigates", () => {
    expect(WEB_PLANNER).toMatch(
      /const handleShoppingList = \(\) => \{[\s\S]{0,120}void generateShoppingListFromPlan\(\);[\s\S]{0,80}onNavigate\?\.\("shopping"\)/,
    );
  });

  it("mobile handleShoppingList generates then navigates", () => {
    expect(MOBILE_PLANNER).toMatch(/const handleShoppingList = useCallback\(/);
    expect(MOBILE_PLANNER).toMatch(
      /void generateShoppingListFromPlan\(plan\)[\s\S]{0,200}router\.push\("\/shopping"/,
    );
  });

  it("mobile Plan Shopping CTAs route through handleShoppingList, not bare push", () => {
    expect(MOBILE_PLANNER).toMatch(/onOpenShopping=\{handleShoppingList\}/);
    expect(MOBILE_PLANNER).toMatch(/if \(next === "shopping"\) \{[\s\S]{0,80}handleShoppingList\(\)/);
    expect(MOBILE_PLANNER).not.toMatch(/onOpenShopping=\{\(\) => router\.push\("\/shopping"/);
    expect(MOBILE_PLANNER).not.toMatch(
      /if \(next === "shopping"\) \{[\s\S]{0,80}router\.push\("\/shopping"/,
    );
  });
});
