import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ENG-1306 — mobile writers of `profiles.weight_kg_by_day` /
 * `profiles.body_fat_pct_by_day` must go through the
 * `upsert_body_metric_days` RPC (server-side per-day jsonb upsert under the
 * profile row lock) instead of client-side full-map UPDATEs, so a HealthKit
 * sync racing a manual weigh-in merges instead of clobbering. Web mirror
 * pins + the RPC migration pins live in
 * tests/unit/upsertBodyMetricDaysWiring.test.ts.
 */

const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

describe("ENG-1306 — mobile body-metric writers use the per-day RPC", () => {
  const USE_WEIGHT_DATA = read("hooks/useWeightData.ts");
  const HEALTH_SYNC = read("lib/healthSync.ts");

  it("useWeightData persists via the RPC patch (log + edit + delete)", () => {
    expect(USE_WEIGHT_DATA).toContain('rpc("upsert_body_metric_days"');
    expect(USE_WEIGHT_DATA).toContain("p_weight_patch: patch");
    // delete = null-valued day key, handled server-side
    expect(USE_WEIGHT_DATA).toContain("persistWeightPatch({ [dateKey]: null })");
    // the old full-map profiles UPDATE is gone
    expect(USE_WEIGHT_DATA).not.toMatch(/\.update\(payload\)/);
    expect(USE_WEIGHT_DATA).not.toMatch(/weight_kg_by_day:\s*nextMap/);
  });

  it("healthSync sends only the HealthKit-reported days as patches", () => {
    expect(HEALTH_SYNC).toContain("p_weight_patch: fromHealthWeight");
    expect(HEALTH_SYNC).toContain("p_body_fat_patch: fromHealthBodyFat");
    // no client-side full-map writes of either metric map remain
    expect(HEALTH_SYNC).not.toMatch(/update\(\{\s*\n?\s*weight_kg_by_day/);
    expect(HEALTH_SYNC).not.toMatch(/update\(\{\s*\n?\s*body_fat_pct_by_day/);
  });

  it("steps/activity/workouts maps keep their existing write path (out of ENG-1306 scope)", () => {
    // Guard against an over-eager refactor: those maps are single-writer
    // (HealthKit only) so the full-map update there is not a race.
    expect(HEALTH_SYNC).toMatch(/update\(\{ steps_by_day: stepsByDay \}\)/);
  });
});
