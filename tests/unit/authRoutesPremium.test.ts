/**
 * Premium P1 auth routes — dedicated signup + sign-in-only login.
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../..");

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

describe("auth routes (Premium P1)", () => {
  it("/signup renders LoginClient in signup mode (not a redirect)", () => {
    const src = read("app/signup/page.tsx");
    expect(src).not.toMatch(/redirect\s*\(/);
    expect(src).toMatch(/LoginClient/);
    expect(src).toMatch(/initialMode="signup"/);
    expect(src).toMatch(/postSignInHref="\/onboarding"/);
  });

  it("/login redirects historic ?mode=signup to /signup", () => {
    const src = read("app/login/page.tsx");
    expect(src).toMatch(/redirect\s*\(\s*["']\/signup["']\s*\)/);
    expect(src).toMatch(/hideTabs/);
  });

  it("LoginClient sends new signups to onboarding by default", () => {
    const src = read("app/login/ui.tsx");
    expect(src).toMatch(/initialMode === "signup" \? "\/onboarding" : "\/home"/);
  });
});

describe("desktop Today week rail (ENG-590)", () => {
  it("NutritionTracker wires TodayWeekSidebar in a flex row at lg+", () => {
    const src = read("src/app/components/NutritionTracker.tsx");
    expect(src).toMatch(/md:flex md:gap-6 md:items-start/);
    expect(src).toMatch(/md:max-w-\[440px\]/);
    expect(src).toMatch(
      /viewMode === "day"[\s\S]+?<TodayWeekSidebar[\s\S]+?sticky top-4/,
    );
    expect(src).not.toMatch(/fixed top-20 right-4/);
  });
});
