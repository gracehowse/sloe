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

  it("signUp/magic-link/reset-password all route their email redirect through /auth/callback (ENG-1395)", () => {
    // The browser client (`createBrowserClient` from @supabase/ssr) is
    // PKCE by default — GoTrue appends `?code=` to whatever
    // emailRedirectTo/redirectTo says, and only /auth/callback exchanges
    // it for a session. Pointing a bare destination URL (the pre-fix
    // value) means the user clicks the email link and lands
    // unauthenticated. See the ENG-1395 email-confirmation flow spec.
    const src = read("app/login/ui.tsx");
    const redirects = [...src.matchAll(/(?:emailRedirectTo|redirectTo):\s*[\s\S]*?`([^`]*)`/g)].map(
      (m) => m[1],
    );
    expect(redirects.length).toBeGreaterThanOrEqual(3); // signUp, magic link, password reset
    for (const r of redirects) {
      expect(r).toContain("/auth/callback");
    }
  });
});

describe("desktop Today week rail (ENG-590)", () => {
  it("NutritionTracker wires right-rail in a flex row at lg+", () => {
    const src = read("src/app/components/NutritionTracker.tsx");
    expect(src).toMatch(/lg:flex lg:gap-8 lg:items-start/);
    expect(src).toMatch(/lg:max-w-\[480px\]/);
    expect(src).toMatch(
      /viewMode === "day"[\s\S]+?<TodayDesktopRightRail[\s\S]+?sticky top-4/,
    );
    expect(src).not.toMatch(/fixed top-20 right-4/);
  });
});
