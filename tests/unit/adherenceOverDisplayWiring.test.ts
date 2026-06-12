/**
 * adherence_over_display (audit P1-3) — SOURCE-LEVEL PIN.
 *
 * NOT a behavioural test. It guards that all four headline render sites
 * (web + mobile × hero ring + adherence card) actually consume the shared
 * `formatAdherenceHeadline` helper behind the `adherence_over_display`
 * feature flag — so the band-inverted display can't silently drift back to
 * a raw uncapped `{pct}%` on any one surface, and the flag gate can't be
 * dropped from one site. Behaviour is pinned by `adherenceDisplay.test.ts`;
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

describe("adherence_over_display wiring (source pin)", () => {
  for (const [name, path] of Object.entries(SITES)) {
    it(`${name} imports formatAdherenceHeadline from the shared module`, () => {
      const src = readFileSync(path, "utf8");
      expect(src).toMatch(/formatAdherenceHeadline/);
      expect(src).toMatch(/nutrition\/adherenceDisplay/);
    });

    it(`${name} gates the over branch behind isFeatureEnabled("adherence_over_display")`, () => {
      const src = readFileSync(path, "utf8");
      expect(src).toMatch(/isFeatureEnabled\("adherence_over_display"\)/);
      // The flag must gate ONLY the over branch — the >110 guard sits beside
      // the flag check so the ≤110 (healthy) path is never flag-touched.
      expect(src).toMatch(/adherencePct > 110/);
    });
  }

  it("DevFlagOverrides lists the flag in the curated set", () => {
    const src = readFileSync(
      resolve(__dirname, "../../apps/mobile/components/settings/DevFlagOverrides.tsx"),
      "utf8",
    );
    expect(src).toMatch(/"adherence_over_display"/);
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
