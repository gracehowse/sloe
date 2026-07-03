import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

import {
  OFF_STALENESS_MAX_PENALTY,
  OFF_STALENESS_PENALTY_FULL_MS,
  OFF_STALENESS_PENALTY_START_MS,
} from "../../src/lib/openFoodFacts/offStaleness";

describe("OFF staleness corpus constants (ENG-1326)", () => {
  it("matches the committed corpus report recommended curve", () => {
    const reportPath = join(
      process.cwd(),
      "docs/testing/off-staleness-corpus-2026-07-03.json",
    );
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
      curve: {
        recommended: {
          penaltyStartMs: number;
          penaltyFullMs: number;
          maxPenalty: number;
        };
      };
    };
    expect(OFF_STALENESS_PENALTY_START_MS).toBe(report.curve.recommended.penaltyStartMs);
    expect(OFF_STALENESS_PENALTY_FULL_MS).toBe(report.curve.recommended.penaltyFullMs);
    expect(OFF_STALENESS_MAX_PENALTY).toBe(report.curve.recommended.maxPenalty);
  });
});
