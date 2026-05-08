/**
 * F-138 Phase 2 — pin the plausibility-gate wiring so a future agent
 * can't silently bypass the BLOCK/WARN/AUTO_VERIFY flow.
 *
 *   - submitFoodCorrection calls checkSubmissionPlausibility BEFORE
 *     the DB upsert
 *   - On verdict 'block' the function returns early with the typed
 *     error and the per-reason list
 *   - The form surfaces corrBlockReasons inline and resets it on
 *     close / next submit
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..", "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(REPO, rel), "utf8");
}

describe("F-138 Phase 2 — submit-path wiring", () => {
  const SRC = read("apps/mobile/lib/verifyRecipe.ts");

  it("imports checkSubmissionPlausibility from the shared helper", () => {
    expect(SRC).toMatch(
      /import\s*\{\s*checkSubmissionPlausibility\s*\}\s*from\s*["'][^"']*foodCorrection\/plausibility["']/,
    );
  });

  it("submitFoodCorrection calls plausibility check BEFORE the DB upsert", () => {
    const fnIdx = SRC.indexOf("submitFoodCorrection");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSlice = SRC.slice(fnIdx, fnIdx + 4000);
    const checkIdx = fnSlice.indexOf("checkSubmissionPlausibility(");
    const upsertIdx = fnSlice.indexOf(".upsert(");
    expect(checkIdx).toBeGreaterThan(-1);
    expect(upsertIdx).toBeGreaterThan(-1);
    expect(checkIdx).toBeLessThan(upsertIdx);
  });

  it("returns plausibility_blocked + reasons on verdict block", () => {
    expect(SRC).toMatch(/error:\s*["']plausibility_blocked["']/);
    expect(SRC).toMatch(/reasons:\s*plausibility\.reasons/);
  });
});

describe("F-138 Phase 2 — form surfaces block reasons inline", () => {
  const SRC = read("apps/mobile/components/BarcodeScannerModal.tsx");

  it("declares corrBlockReasons state", () => {
    expect(SRC).toMatch(
      /const\s+\[corrBlockReasons,\s*setCorrBlockReasons\]\s*=\s*useState<string\[\]\s*\|\s*null>\(null\)/,
    );
  });

  it("submitCorrection sets corrBlockReasons on plausibility_blocked", () => {
    expect(SRC).toMatch(
      /result\.error\s*===\s*["']plausibility_blocked["'][\s\S]{0,200}setCorrBlockReasons\(result\.reasons\)/,
    );
  });

  it("renders the block reasons inside the form when present", () => {
    expect(SRC).toMatch(/corrBlockReasons\s*&&\s*corrBlockReasons\.length\s*>\s*0/);
    expect(SRC).toMatch(/These numbers don/);
  });

  it("clears corrBlockReasons on successful submit + reset + close", () => {
    expect(SRC).toMatch(/setCorrBlockReasons\(null\)/);
    // Three call sites: success branch + onReset + handleClose.
    const matches = SRC.match(/setCorrBlockReasons\(null\)/g);
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
});
