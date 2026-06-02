/**
 * ENG-792 — onboarding seed-save telemetry. The shared helper IS the
 * web+mobile logic both flows now route through, so this covers the
 * failure path on both platforms without rendering the heavy flow
 * components.
 */
import { describe, it, expect } from "vitest";
import { seedSaveTelemetry } from "../../src/lib/onboarding/seedSaveTelemetry.ts";

describe("seedSaveTelemetry (ENG-792)", () => {
  it("null result (save step never ran) → 0 saved, no failure", () => {
    expect(seedSaveTelemetry(null, 0)).toEqual({ recipesSaved: 0, failure: null });
    expect(seedSaveTelemetry(undefined, 3)).toEqual({ recipesSaved: 0, failure: null });
  });

  it("successful save → real saved count, no failure event", () => {
    expect(seedSaveTelemetry({ savedCount: 5, error: null }, 5)).toEqual({
      recipesSaved: 5,
      failure: null,
    });
  });

  it("save failure (0 saved + error) → failure descriptor with error + attempted", () => {
    // The textbook case: resolve succeeded (5 attempted), upsert rejected →
    // user stranded at 0 saved. Must produce a queryable failure signal.
    expect(seedSaveTelemetry({ savedCount: 0, error: "rls denied" }, 5)).toEqual({
      recipesSaved: 0,
      failure: { error: "rls denied", attempted: 5 },
    });
  });

  it("partial save with an error still flags failure + reports the real count", () => {
    const t = seedSaveTelemetry({ savedCount: 2, error: "partial write" }, 5);
    expect(t.recipesSaved).toBe(2);
    expect(t.failure).toEqual({ error: "partial write", attempted: 5 });
  });
});
