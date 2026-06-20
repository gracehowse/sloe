/**
 * adherence_over_display (audit P1-3) — SOURCE-LEVEL PIN.
 *
 * NOT a behavioural test. It guards that all four headline render sites
 * (web + mobile × hero ring + adherence card) actually consume the shared
 * ENG-1073 — all four headline render sites consume `formatAdherenceHeadline`
 * when adherence exceeds 110% (no feature-flag gate).
 * this only pins the wiring (a refactor deleting the import/flag fails here).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SITES = {
  webHero: resolve(__dirname, "../../src/app/components/suppr/progress-hero-metric.tsx"),
  webCard: resolve(__dirname, "../../src/app/components/suppr/progress-average-adherence.tsx"),
  mobileHero: resolve(__dirname, "../../apps/mobile/components/progress/ProgressHeroMetric.tsx"),
  mobileCard: resolve(__dirname, "../../apps/mobile/components/progress/ProgressAverageAdherence.tsx"),
} as const;

describe("adherence over-display wiring (source pin, ENG-1073)", () => {
  for (const [name, path] of Object.entries(SITES)) {
    it(`${name} imports formatAdherenceHeadline from the shared module`, () => {
      const src = readFileSync(path, "utf8");
      expect(src).toMatch(/formatAdherenceHeadline/);
      expect(src).toMatch(/adherenceDisplay/);
    });

    it(`${name} uses formatAdherenceHeadline when adherencePct > 110 (no flag gate)`, () => {
      const src = readFileSync(path, "utf8");
      expect(src).toMatch(/adherencePct > 110/);
      expect(src).toMatch(/formatAdherenceHeadline\(adherencePct\)/);
      expect(src).not.toMatch(/isFeatureEnabled\("adherence_over_display"\)/);
    });
  }

  it("DevFlagOverrides no longer lists adherence_over_display (ENG-1073 shipped)", () => {
    const src = readFileSync(
      resolve(__dirname, "../../apps/mobile/components/settings/DevFlagOverrides.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/"adherence_over_display"/);
  });

  it("progressRangeStats leaves adherencePct raw/uncapped (presentation owns the fix)", () => {
    const src = readFileSync(
      resolve(__dirname, "../../src/lib/nutrition/progressRangeStats.ts"),
      "utf8",
    );
    // The raw value source must NOT cap — both window + range builders.
    expect(src).toMatch(/adherencePct = Math\.round\(\(avgCaloriesPerDay \/ targetCalories\) \* 100\)/);
    expect(src).not.toMatch(/Math\.min\(\s*100\s*,.*adherencePct/);
  });
});
