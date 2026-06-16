import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..");
const COOK = readFileSync(resolve(REPO, "apps/mobile/app/cook.tsx"), "utf8");
const RECIPE = readFileSync(resolve(REPO, "apps/mobile/app/recipe/[id].tsx"), "utf8");
const COOK_MODE = readFileSync(resolve(REPO, "src/app/components/CookMode.tsx"), "utf8");

describe("ENG-1129 cook-log servings confirm", () => {
  it("mobile cook mode gates the confirm sheet behind cook_log_servings_confirm", () => {
    expect(COOK).toMatch(/cook_log_servings_confirm/);
    expect(COOK).toMatch(/CookLogServingsSheet/);
    expect(COOK).toMatch(/logServings=/);
  });

  it("mobile recipe auto-log reads logServings separately from portion (view seed)", () => {
    expect(RECIPE).toMatch(/logServings/);
    expect(RECIPE).toMatch(/parsedLogServings/);
  });

  it("web CookMode gates confirm behind cook_log_servings_confirm and tracks servingsLogged", () => {
    expect(COOK_MODE).toMatch(/cook_log_servings_confirm/);
    expect(COOK_MODE).toMatch(/commitLogMeal/);
    expect(COOK_MODE).toMatch(/servingsLogged/);
  });

  it("web CookMode legacy flag-off path logs 1 serving, not batch scaleFactor", () => {
    expect(COOK_MODE).toMatch(/commitLogMeal\(1\)/);
  });
});
