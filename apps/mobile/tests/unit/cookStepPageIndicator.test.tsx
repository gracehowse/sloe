import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(__dirname, "../../../..");

describe("ENG-947 cook swipe wiring", () => {
  it("standalone cook screen gates swipe + segment indicator", () => {
    const src = readFileSync(join(REPO, "apps/mobile/app/cook.tsx"), "utf8");
    expect(src).toContain('isFeatureEnabled("cook_swipe_steps_v1")');
    expect(src).toContain("CookStepSwipeSurface");
    expect(src).toContain("CookStepPageIndicator");
    expect(src).toContain("cook_step_swiped");
  });

  it("recipe cook overlay gates swipe + segment indicator", () => {
    const src = readFileSync(join(REPO, "apps/mobile/app/recipe/[id].tsx"), "utf8");
    expect(src).toContain('isFeatureEnabled("cook_swipe_steps_v1")');
    expect(src).toContain("CookStepSwipeSurface");
    expect(src).toContain("CookStepPageIndicator");
  });

  it("web CookMode gates touch swipe", () => {
    const src = readFileSync(join(REPO, "src/app/components/CookMode.tsx"), "utf8");
    expect(src).toContain('isFeatureEnabled("cook_swipe_steps_v1")');
    expect(src).toContain("resolveCookStepSwipe");
    expect(src).toContain("cook_step_swiped");
  });
});
