/**
 * F-16 (2026-04-25, build 11) — Household sharing scope narrowing.
 *
 * Updated from the original privacy-audit M2 version (2026-04-18).
 * The sharing model is now:
 *
 *   - Dinners shared by default. Lunches shared only when the
 *     household opts in. Breakfasts + snacks are never shared.
 *   - Macro targets + remaining-today are PRIVATE — they are no
 *     longer shared with other household members.
 *
 * Copy is legal-approved VERBATIM. Both surfaces import from the
 * shared module `src/lib/household/scopeCopy.ts`. This test pins:
 *
 *   1. The shared copy strings equal the approved text, character
 *      for character. A paraphrase — even an accidental one —
 *      fails the test and fails the build.
 *   2. Both platform files import from `scopeCopy.ts` and render
 *      the imported constants (not a copy-paste). This keeps web
 *      and mobile locked to the same source of truth — a
 *      CLAUDE.md parity non-negotiable.
 *   3. The old copy strings (which promised the opposite guarantee
 *      — that macros WERE shared) are gone from both files, so no
 *      drift, dead UI, or commented-out legacy copy can mislead
 *      reviewers into thinking the old model is still live.
 *   4. The existing `/api/household/join` rate-limit guard (M1)
 *      still holds. Unchanged from the prior test.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  HOUSEHOLD_CARD_HEADER_COPY,
  HOUSEHOLD_JOIN_DISCLOSURE_COPY,
  SCOPE_NARROWING_NOTICE_COPY,
  SHARE_LUNCH_TOGGLE_LABEL,
  SHARE_LUNCH_TOGGLE_HELPER,
} from "@/lib/household/scopeCopy";

// Verbatim legal-approved strings (F-16, 2026-04-25). If any of these
// values change, legal-reviewer sign-off is required before landing.
const EXPECTED_JOIN_DISCLOSURE =
  "Joining shares your planned dinners with everyone in this household. If the household turns on lunch sharing, lunches are shared too. Breakfasts, snacks, your calorie and macro targets, and your remaining-today numbers all stay private.";

const EXPECTED_CARD_HEADER =
  "Share dinner plans with your household. Members see each other's dinners (and lunches, if enabled) — never your breakfasts, snacks, calorie targets, or remaining-today numbers.";

const EXPECTED_NOTICE =
  "We've tightened household sharing — targets and remaining-today are now private. Dinners only (plus lunches if your household enables it).";

// Fragments from the OLD (pre-F-16) copy that must NOT survive in
// either surface. Listed explicitly because a partial match (e.g.
// "daily calorie + macro targets" lingering in a comment or a dead
// branch) would indicate the narrowing was only partially applied.
const FORBIDDEN_LEGACY_FRAGMENTS = [
  "daily calorie + macro targets",
  "remaining-today numbers with every other member",
  "Nothing else from your account is shared",
];

function readRepoFile(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("household sharing scope copy (F-16, 2026-04-25)", () => {
  it("shared scopeCopy.ts holds the legal-approved strings verbatim", () => {
    expect(HOUSEHOLD_JOIN_DISCLOSURE_COPY).toBe(EXPECTED_JOIN_DISCLOSURE);
    expect(HOUSEHOLD_CARD_HEADER_COPY).toBe(EXPECTED_CARD_HEADER);
    expect(SCOPE_NARROWING_NOTICE_COPY).toBe(EXPECTED_NOTICE);
    expect(SHARE_LUNCH_TOGGLE_LABEL).toBe("Share lunches too");
    expect(SHARE_LUNCH_TOGGLE_HELPER).toBe(
      "Dinners are always shared. Lunches are off by default.",
    );
  });

  it("web HouseholdPanel imports from scopeCopy and uses the constants", () => {
    const src = readRepoFile("src/app/components/HouseholdPanel.tsx");
    // Imports the shared module (relative path from src/app/components).
    expect(src).toMatch(
      /from\s+['"]\.\.\/\.\.\/lib\/household\/scopeCopy['"]/,
    );
    // Renders the imported constants, not a duplicated string literal.
    expect(src).toContain("HOUSEHOLD_JOIN_DISCLOSURE_COPY");
    expect(src).toContain("HOUSEHOLD_CARD_HEADER_COPY");
    expect(src).toContain("SCOPE_NARROWING_NOTICE_COPY");
    // None of the old copy can linger.
    for (const fragment of FORBIDDEN_LEGACY_FRAGMENTS) {
      expect(src, `web copy still contains legacy fragment: "${fragment}"`).not.toContain(fragment);
    }
  });

  it("mobile HouseholdCard imports from scopeCopy and uses the constants", () => {
    const src = readRepoFile("apps/mobile/components/HouseholdCard.tsx");
    expect(src).toMatch(/from\s+['"][^'"]*scopeCopy['"]/);
    expect(src).toContain("HOUSEHOLD_JOIN_DISCLOSURE_COPY");
    expect(src).toContain("HOUSEHOLD_CARD_HEADER_COPY");
    expect(src).toContain("SCOPE_NARROWING_NOTICE_COPY");
    for (const fragment of FORBIDDEN_LEGACY_FRAGMENTS) {
      expect(src, `mobile copy still contains legacy fragment: "${fragment}"`).not.toContain(fragment);
    }
  });
});

describe("household join rate limit (M1)", () => {
  it("POST /api/household/join calls rateLimit before processing the body", () => {
    const src = readRepoFile("app/api/household/join/route.ts");
    expect(src).toContain('keyPrefix: "api:household-join"');
    expect(src).toMatch(/rateLimit\s*\(/);
    expect(src).toMatch(/limit:\s*5/);
    // P0-6: authenticate first so the bucket is per-user; rate-limit must still
    // run before invite JSON / DB work so stuffing can't burn Supabase before the cap.
    const postIdx = src.indexOf("export async function POST");
    expect(postIdx).toBeGreaterThan(0);
    const body = src.slice(postIdx);
    const rateLimitCallIdx = body.indexOf("await rateLimit(");
    const jsonCallIdx = body.indexOf("await req.json()");
    expect(rateLimitCallIdx).toBeGreaterThan(0);
    expect(jsonCallIdx).toBeGreaterThan(rateLimitCallIdx);
  });
});
