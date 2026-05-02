/**
 * Tri-state save-button copy contract (2026-05-02).
 *
 * The "Cal AI convert" framing depends on the save button reading
 * differently based on how many items the user verified. This file
 * pins the exact strings — every regression here would silently
 * change the fundraising-deck-ready demo flow.
 *
 * UI tests for the actual button live in
 * `tests/unit/photoLogVerifyFlow.test.tsx`; this file pins the pure
 * helper and is fast-feedback for the copy.
 */
import { describe, expect, it } from "vitest";
import { photoLogSaveCopy, type AiLoggedItem } from "@/lib/nutrition/aiLogging";

const mk = (verified?: boolean): AiLoggedItem => ({
  name: "x",
  calories: 100,
  protein: 0,
  carbs: 0,
  fat: 0,
  confidence: 0.7,
  source: "ai_photo",
  verified,
});

describe("photoLogSaveCopy — exact tri-state strings", () => {
  it("ALL VERIFIED → 'Log verified' (no subcaption)", () => {
    expect(photoLogSaveCopy([mk(true)])).toEqual({ primary: "Log verified" });
    expect(photoLogSaveCopy([mk(true), mk(true), mk(true)])).toEqual({
      primary: "Log verified",
    });
  });

  it("MIXED → 'Log meal' + '<verified> of <total> verified'", () => {
    expect(photoLogSaveCopy([mk(true), mk(false)])).toEqual({
      primary: "Log meal",
      subcaption: "1 of 2 verified",
    });
    // The example from the design spec: 2 of 4 verified.
    expect(photoLogSaveCopy([mk(true), mk(true), mk(false), mk(false)])).toEqual({
      primary: "Log meal",
      subcaption: "2 of 4 verified",
    });
  });

  it("NONE VERIFIED → 'Log estimate' (primary unchanged)", () => {
    expect(photoLogSaveCopy([mk(false)])).toEqual({ primary: "Log estimate" });
    expect(photoLogSaveCopy([mk(false), mk(false), mk(false)])).toEqual({
      primary: "Log estimate",
    });
    // `verified` undefined is treated as not-verified; AI fallback path.
    expect(photoLogSaveCopy([mk(undefined)])).toEqual({ primary: "Log estimate" });
  });

  it("EMPTY LIST → 'Log estimate' (defensive — UI disables button when empty)", () => {
    expect(photoLogSaveCopy([])).toEqual({ primary: "Log estimate" });
  });

  it("primary string is one of exactly three known values (regression bar)", () => {
    const allowed = new Set(["Log verified", "Log meal", "Log estimate"]);
    const samples: AiLoggedItem[][] = [
      [],
      [mk(false)],
      [mk(true)],
      [mk(true), mk(false)],
      [mk(undefined), mk(true)],
    ];
    for (const s of samples) {
      expect(allowed.has(photoLogSaveCopy(s).primary)).toBe(true);
    }
  });
});
