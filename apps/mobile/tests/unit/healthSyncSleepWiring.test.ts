import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { HEALTH_SYNC_TYPES } from "@suppr/shared/health/syncTypes";

/**
 * ENG-1584 — pins the sleep-sync wiring in `healthSync.ts` (mirrors
 * `upsertBodyMetricDaysWiring.test.ts`'s convention of reading the
 * source file and asserting on specific strings, since `syncHealthData`
 * isn't exercised end-to-end anywhere against a mocked native bridge —
 * the pure aggregation logic itself is unit-tested directly in
 * `healthSyncSleep.test.ts`).
 */
const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

describe("ENG-1584 — HEALTH_SYNC_TYPES.sleep is flipped to supported", () => {
  it("sleep entry is supported + defaultOn (matches every other entry's shape)", () => {
    const sleep = HEALTH_SYNC_TYPES.find((t) => t.key === "sleep");
    expect(sleep).toBeDefined();
    expect(sleep?.supported).toBe(true);
    expect(sleep?.defaultOn).toBe(true);
  });

  it("every entry is now supported (sleep was the last holdout)", () => {
    expect(HEALTH_SYNC_TYPES.every((t) => t.supported)).toBe(true);
  });
});

describe("ENG-1584 — apps/mobile/lib/healthSync.ts reads SleepAnalysis", () => {
  const HEALTH_SYNC = read("lib/healthSync.ts");

  it("requests SleepAnalysis read permission in the same stage-1 body-metrics sheet", () => {
    expect(HEALTH_SYNC).toMatch(/HEALTH_KIT_BODY_READ = \[[\s\S]*?"SleepAnalysis"[\s\S]*?\]/);
  });

  it("declares getSleepSamples on the native module type", () => {
    expect(HEALTH_SYNC).toContain("getSleepSamples(");
  });

  it("imports the pure aggregation helper from healthSyncSleep.ts", () => {
    expect(HEALTH_SYNC).toContain(
      'import { aggregateAsleepMinutesByDay, type RawSleepSample } from "./healthSyncSleep"',
    );
  });

  it("syncHealthData selects, aggregates, and writes sleep_minutes_by_day", () => {
    expect(HEALTH_SYNC).toContain("sleep_minutes_by_day");
    expect(HEALTH_SYNC).toContain("aggregateAsleepMinutesByDay(sleepSamples)");
    expect(HEALTH_SYNC).toMatch(/update\(\{ sleep_minutes_by_day: sleepMinutesByDay \}\)/);
  });

  it("syncHealthData's return type and value both carry sleepUpdated", () => {
    // Return-type declaration.
    expect(HEALTH_SYNC).toMatch(/sleepUpdated:\s*boolean;\s*\n\}>/);
    // The actual returned object.
    expect(HEALTH_SYNC).toMatch(/return \{\s*\n\s*stepsUpdated,[\s\S]*?sleepUpdated,\s*\n\s*\};/);
  });

  it("is single-writer like steps/activity/workouts (out of ENG-1306 RPC scope)", () => {
    // Sleep is HealthKit-only, same as steps/activity/workouts/basal — no
    // manual-entry race, so the direct full-map `.update()` (not the
    // `upsert_body_metric_days` RPC used for weight/body-fat) is correct.
    expect(HEALTH_SYNC).not.toMatch(/p_sleep_patch/);
  });
});

describe("ENG-1584 — apps/mobile/app/health-sync.tsx surfaces a sleep sync in the summary", () => {
  it("calls the shared summary-parts helper (screen-line-budget ratchet — ENG-717 — bars inlining it)", () => {
    // `health-sync.tsx` doesn't get a dedicated Sleep settings row (same as
    // body fat — see the module docblock in healthSyncSleep.ts / this
    // file's sibling describe blocks), but it DOES fold every updated
    // flag into a plain-text "Updated: …" summary after Sync Now. The
    // per-flag `parts.push(...)` logic itself lives in
    // `healthSyncResultSummaryParts` (`lib/healthSync.ts`), not inlined
    // here — health-sync.tsx is a legacy `check:screen-budget` allow-listed
    // file that may only shrink, so the screen just calls the helper.
    const screen = read("app/health-sync.tsx");
    expect(screen).toContain("healthSyncResultSummaryParts");
    expect(screen).toContain("const parts = healthSyncResultSummaryParts(result);");
  });

  it("healthSyncResultSummaryParts (lib/healthSync.ts) folds sleep in, same precedent as body fat", () => {
    const lib = read("lib/healthSync.ts");
    expect(lib).toContain('if (result.sleepUpdated) parts.push("sleep")');
    expect(lib).toContain('if (result.bodyFatUpdated) parts.push("body fat")');
  });
});

describe("ENG-1584 — supabase/migrations has the sleep_minutes_by_day column", () => {
  it("a migration adds profiles.sleep_minutes_by_day as a jsonb column", () => {
    const migration = read(
      "../../supabase/migrations/20260721120000_eng1584_sleep_minutes_by_day.sql",
    );
    expect(migration).toContain("sleep_minutes_by_day jsonb");
  });
});

describe("ENG-1584 — generated Supabase types include sleep_minutes_by_day", () => {
  it("mobile and web copies both declare the column and stay identical (db:types:check)", () => {
    const mobileTypes = read("lib/database.types.ts");
    const webTypes = readFileSync(
      join(__dirname, "..", "..", "..", "..", "src/lib/supabase/database.types.ts"),
      "utf8",
    );
    expect(mobileTypes).toContain("sleep_minutes_by_day: Json | null");
    expect(mobileTypes).toBe(webTypes);
  });
});
