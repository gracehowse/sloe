/**
 * F-87 (2026-04-25) — pin USDA two-stage fetch + trust-weighted ranking
 * for generic-name searches.
 *
 * Bug: searching "eggs" returned a USDA Branded row called "EGGS"
 * (525 kcal / 7.5g protein / 60g carbs / 27.5g fat per 100g — a misnamed
 * packaged product) above the verified Foundation row "Eggs, Grade A,
 * Large, egg whole" (~143 kcal / 100g). The branded row passed the F-77
 * Atwater plausibility gate because its macros agree internally, so
 * filtering on math alone wasn't enough.
 *
 * Fix: server-side, pull verified rows (Foundation / SR Legacy / Survey
 * (FNDDS)) ahead of branded for page 1; client-side, demote USDA Branded
 * via trust ranking. Verified USDA always leads when it matches.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const FDC_CLIENT = resolve(__dirname, "../../src/lib/usda/fdcClient.ts");
const SRC = readFileSync(FDC_CLIENT, "utf8");

describe("F-87 — fdcFoodsSearch two-stage fetch", () => {
  it("declares VERIFIED_DATA_TYPES = Foundation / SR Legacy / Survey (FNDDS)", () => {
    expect(SRC).toMatch(/VERIFIED_DATA_TYPES\s*=\s*\[\s*"Foundation",\s*"SR Legacy",\s*"Survey \(FNDDS\)"\s*\]/);
  });

  it("two-stage path runs verified + branded fetches in parallel on page 1", () => {
    expect(SRC).toMatch(/Promise\.all\(\[\s*fdcFetchSingle\([^)]*\bdataType:\s*VERIFIED_DATA_TYPES/s);
  });

  it("explicit caller-provided dataType bypasses the two-stage path", () => {
    expect(SRC).toMatch(/opts\?\.dataType\?\.length/);
  });

  it("branded results are deduped against verified by fdcId", () => {
    expect(SRC).toMatch(/seenIds\.has\(id\)/);
  });

  it("page 2+ stays on the single-fetch path (branded long-tail)", () => {
    // The else-branch of `pageNumber === 1` calls fdcFetchSingle with no
    // dataType filter. Pin the structural shape.
    expect(SRC).toMatch(/pageNumber === 1[\s\S]*?\}\s*else\s*\{\s*foods\s*=\s*await\s+fdcFetchSingle/);
  });
});

describe("F-87 — verified slice / branded slice split sensibly", () => {
  it("verified slice gets ~60% of page size, branded gets the rest", () => {
    expect(SRC).toMatch(/Math\.max\(3,\s*Math\.floor\(pageSize\s*\*\s*0\.6\)\)/);
    expect(SRC).toMatch(/Math\.max\(2,\s*pageSize\s*-\s*verifiedSlice\)/);
  });
});
