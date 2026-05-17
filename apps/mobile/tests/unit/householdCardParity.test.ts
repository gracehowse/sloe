/**
 * Mobile household-card parity (TestFlight feedback AAegi1DJEiscjIFi_pYaep4,
 * 2026-04-18).
 *
 * The original symptom: tapping "Create Household" did nothing on iOS.
 * Root cause: `apps/mobile/components/HouseholdCard.tsx` was calling
 * `fetch("/api/household")` with a relative URL. React Native has no
 * origin, so those fetches either threw or resolved to garbage and the
 * `try/catch` block silently swallowed the failure.
 *
 * This is a structural source-level test (mobile RNTL render tests live
 * elsewhere) that pins:
 *   1. No relative `/api/household...` fetch survives in the file.
 *   2. The card imports the four functions from the shared
 *      `src/lib/household/householdClient.ts` (the actual runtime path).
 *   3. Web (`src/app/components/HouseholdPanel.tsx`) imports from the
 *      same shared client — i.e. parity is enforced at the import level
 *      so a refactor on one platform can't drift the other.
 *
 * If this test starts failing because someone re-introduced the
 * `fetch("/api/household")` pattern, see the linked TestFlight ticket
 * before "fixing" the test.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE_PATH = resolve(__dirname, "../../components/HouseholdCard.tsx");
const WEB_PATH = resolve(__dirname, "../../../../src/app/components/HouseholdPanel.tsx");

const MOBILE_SRC = readFileSync(MOBILE_PATH, "utf8");
const WEB_SRC = readFileSync(WEB_PATH, "utf8");

const SHARED_FNS = [
  "createHousehold",
  "getMyHousehold",
  "joinHouseholdByInviteCode",
  "leaveHousehold",
];

/**
 * Strip JS line + block comments so the "no relative fetch" assertion
 * doesn't trip over the migration note we leave at the top of the file.
 * Naive but sufficient — the source files don't contain regex literals
 * or strings shaped like comments.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("mobile household card — direct-Supabase port (TestFlight AAegi1DJEiscjIFi_pYaep4)", () => {
  const MOBILE_CODE = stripComments(MOBILE_SRC);

  it("no longer calls the Next.js /api/household routes", () => {
    expect(MOBILE_CODE).not.toMatch(/fetch\(["']\/api\/household/);
    expect(MOBILE_CODE).not.toMatch(/\/api\/household\/join/);
    expect(MOBILE_CODE).not.toMatch(/\/api\/household\/leave/);
  });

  it("imports all four household functions from the shared client", () => {
    expect(MOBILE_SRC).toMatch(/from\s+["'][^"']*@suppr\/shared\/household\/householdClient["']/);
    for (const fn of SHARED_FNS) {
      expect(MOBILE_SRC).toMatch(new RegExp(`\\b${fn}\\b`));
    }
  });
});

describe("web/mobile household parity — both call the same shared client", () => {
  const WEB_CODE = stripComments(WEB_SRC);

  it("web HouseholdPanel imports the shared household client", () => {
    expect(WEB_SRC).toMatch(/from\s+["'][^"']*lib\/household\/householdClient["']/);
    expect(WEB_CODE).not.toMatch(/fetch\(["']\/api\/household/);
  });

  it("both surfaces import the same four functions", () => {
    for (const fn of SHARED_FNS) {
      expect(MOBILE_SRC).toMatch(new RegExp(`\\b${fn}\\b`));
      expect(WEB_SRC).toMatch(new RegExp(`\\b${fn}\\b`));
    }
  });
});
