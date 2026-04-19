/**
 * Privacy audit M2 (2026-04-18): household members can see each
 * other's daily macro targets and remaining-today numbers
 * (app/api/household/route.ts), so both join surfaces must surface a
 * clear consent disclosure before the user joins or creates.
 *
 * This test pins the disclosure phrase in both:
 *   - src/app/components/HouseholdPanel.tsx   (web)
 *   - apps/mobile/components/HouseholdCard.tsx (mobile)
 *
 * If either screen drifts, the test fails — the consent surface stays
 * honest across web/mobile parity (CLAUDE.md non-negotiable rule).
 *
 * It also pins the rate limit on POST /api/household/join — privacy
 * audit M1 — by string-grepping the route file. A grep is enough: a
 * full HTTP test would need a live Next.js handler and Upstash mock,
 * which is overkill for a deletion guard.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REQUIRED_DISCLOSURE_FRAGMENTS = [
  "daily calorie + macro targets",
  "remaining-today numbers",
  "Nothing else from your account is shared",
];

function readRepoFile(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("household macro-sharing disclosure copy (M2)", () => {
  it("web HouseholdPanel surfaces every required fragment", () => {
    const src = readRepoFile("src/app/components/HouseholdPanel.tsx");
    for (const fragment of REQUIRED_DISCLOSURE_FRAGMENTS) {
      expect(src, `web copy missing fragment: "${fragment}"`).toContain(fragment);
    }
  });

  it("mobile HouseholdCard surfaces every required fragment", () => {
    const src = readRepoFile("apps/mobile/components/HouseholdCard.tsx");
    for (const fragment of REQUIRED_DISCLOSURE_FRAGMENTS) {
      expect(src, `mobile copy missing fragment: "${fragment}"`).toContain(fragment);
    }
  });
});

describe("household join rate limit (M1)", () => {
  it("POST /api/household/join calls rateLimit before processing the body", () => {
    const src = readRepoFile("app/api/household/join/route.ts");
    expect(src).toContain('keyPrefix: "household_join"');
    expect(src).toMatch(/rateLimit\s*\(/);
    expect(src).toMatch(/limit:\s*5/);
    // Rate-limit must run BEFORE the auth check so unauthenticated
    // brute force can't exhaust auth lookups instead. Scope the
    // ordering check to the POST handler body, not the import block
    // (where `getUserIdFromRequest` appears first as a named import).
    const postIdx = src.indexOf("export async function POST");
    expect(postIdx).toBeGreaterThan(0);
    const body = src.slice(postIdx);
    const rateLimitCallIdx = body.indexOf("await rateLimit(");
    const userIdCallIdx = body.indexOf("await getUserIdFromRequest(");
    expect(rateLimitCallIdx).toBeGreaterThan(0);
    expect(userIdCallIdx).toBeGreaterThan(rateLimitCallIdx);
  });
});
