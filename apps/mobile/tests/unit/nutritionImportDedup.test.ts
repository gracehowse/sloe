import { describe, expect, it } from "vitest";

import { evaluateHealthImportSkip } from "../../lib/nutritionImportDedup";

describe("evaluateHealthImportSkip (ENG-879)", () => {
  it("skips tombstoned HK ids before existing-row dedup", () => {
    const decision = evaluateHealthImportSkip({
      sampleId: "hk-abc",
      existingHkIds: new Set(["hk-abc"]),
      tombstoneIds: new Set(["hk-abc"]),
      dedupKey: "unused",
      legacyFingerprintSet: new Set(),
    });
    expect(decision).toEqual({ skip: true, reason: "tombstone" });
  });

  it("skips samples already present in the journal by HK id", () => {
    const decision = evaluateHealthImportSkip({
      sampleId: "hk-existing",
      existingHkIds: new Set(["hk-existing"]),
      tombstoneIds: new Set(),
      dedupKey: "unused",
      legacyFingerprintSet: new Set(),
    });
    expect(decision).toEqual({ skip: true, reason: "existing_hk_id" });
  });

  it("uses legacy fingerprint when HK id is missing", () => {
    const dedupKey = "2026-06-04|Oatmeal (via MyFitnessPal)|320|29381234";
    const decision = evaluateHealthImportSkip({
      sampleId: null,
      existingHkIds: new Set(),
      tombstoneIds: new Set(),
      dedupKey,
      legacyFingerprintSet: new Set([dedupKey]),
    });
    expect(decision).toEqual({ skip: true, reason: "legacy_fingerprint" });
  });

  it("imports fresh samples whose UUID is only in the tombstone when tombstone set is empty", () => {
    const decision = evaluateHealthImportSkip({
      sampleId: "hk-fresh",
      existingHkIds: new Set(),
      tombstoneIds: new Set(),
      dedupKey: "unused",
      legacyFingerprintSet: new Set(),
    });
    expect(decision).toEqual({ skip: false });
  });
});
