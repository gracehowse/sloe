import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatCoreDietaryProbeAlignmentHint } from "@/lib/healthSyncProbeHints";

describe("formatCoreDietaryProbeAlignmentHint (ENG-1023)", () => {
  it("returns null when external energy samples exist", () => {
    expect(
      formatCoreDietaryProbeAlignmentHint({
        EnergyConsumed: { total: 2, external: 1 },
        Protein: { total: 0, external: 0 },
      }),
    ).toBeNull();
  });

  it("flags macro samples without dietary energy read access", () => {
    const hint = formatCoreDietaryProbeAlignmentHint({
      EnergyConsumed: { total: 0, external: 0 },
      Protein: { total: 3, external: 2 },
      Carbohydrates: { total: 1, external: 1 },
    });
    expect(hint).toContain("Protein");
    expect(hint).toContain("Carbohydrates");
    expect(hint).toContain("Dietary Energy");
  });
});

describe("probeNutritionImport source pins (ENG-1023)", () => {
  const src = readFileSync(resolve(__dirname, "../../lib/healthSync.ts"), "utf8");

  it("probes every core dietary permission key and stringifies bridge errors", () => {
    expect(src).toMatch(/HEALTH_DIETARY_CORE_PERMISSION_KEYS/);
    expect(src).toMatch(/coreSampleCounts/);
    expect(src).toMatch(/stringifyBridgeUnknown\(e\)/);
  });
});
