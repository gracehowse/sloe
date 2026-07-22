/**
 * ENG-1045 — middleware skips getUser on public routes; API routes excluded
 * from the matcher.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(join(__dirname, "../../middleware.ts"), "utf8");

describe("middleware public fast-path (ENG-1045)", () => {
  it("checks isPublic before creating the Supabase client / getUser", () => {
    const publicCheck = SRC.indexOf("if (isPublic(pathname))");
    const getUser = SRC.indexOf("supabase.auth.getUser()");
    expect(publicCheck).toBeGreaterThan(-1);
    expect(getUser).toBeGreaterThan(publicCheck);
  });

  it("matcher excludes /api/*", () => {
    expect(SRC).toMatch(/\(\?!api\/\|/);
  });
});

describe("ENG-1642 — /m/<token> meal-share landing is public", () => {
  it("checks pathname.startsWith(\"/m/\") inside isPublic, ahead of getUser", () => {
    const mealShareCheck = SRC.indexOf('pathname.startsWith("/m/")');
    const getUser = SRC.indexOf("supabase.auth.getUser()");
    expect(mealShareCheck).toBeGreaterThan(-1);
    expect(getUser).toBeGreaterThan(mealShareCheck);
  });

  it("returns true for the /m/ prefix (source-level, not just present)", () => {
    expect(SRC).toContain('if (pathname.startsWith("/m/")) return true;');
  });

  it("does not require /m/<token> to be a fixed literal in PUBLIC_ROUTES (any token must match)", () => {
    // A Set.has() lookup would only ever match one literal path — the
    // anon landing must work for every token, so the implementation MUST
    // use a startsWith prefix check rather than adding tokens to
    // PUBLIC_ROUTES one at a time.
    expect(SRC).not.toMatch(/PUBLIC_ROUTES = new Set\(\[[^\]]*"\/m\//);
  });
});

describe("ENG-1645 — /g/<code> referral landing is public", () => {
  it('checks pathname.startsWith("/g/") inside isPublic, ahead of getUser', () => {
    const referralCheck = SRC.indexOf('pathname.startsWith("/g/")');
    const getUser = SRC.indexOf("supabase.auth.getUser()");
    expect(referralCheck).toBeGreaterThan(-1);
    expect(getUser).toBeGreaterThan(referralCheck);
  });

  it("returns true for the /g/ prefix (source-level, not just present)", () => {
    expect(SRC).toContain('if (pathname.startsWith("/g/")) return true;');
  });

  it("does not require /g/<code> to be a fixed literal in PUBLIC_ROUTES (any code must match)", () => {
    // Same reasoning as the /m/ case above — a referral code is dynamic per
    // invite, so the implementation MUST use a startsWith prefix check
    // rather than adding codes to PUBLIC_ROUTES one at a time.
    expect(SRC).not.toMatch(/PUBLIC_ROUTES = new Set\(\[[^\]]*"\/g\//);
  });
});
