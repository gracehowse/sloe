/**
 * Tests for `lib/barcodePortionMemory` — covers the audit/2026-04-30
 * competitive-parity feature where the barcode picker pre-fills the
 * grams the user committed last time for that exact barcode.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  _resetRememberedPortionsForTests,
  clampRememberedToServingOptions,
  getRememberedPortion,
  recordPortion,
} from "@/lib/barcodePortionMemory";

describe("barcodePortionMemory.recordPortion / getRememberedPortion", () => {
  beforeEach(async () => {
    await _resetRememberedPortionsForTests();
  });
  afterEach(async () => {
    await _resetRememberedPortionsForTests();
  });

  it("returns null when no portion has ever been recorded", async () => {
    expect(await getRememberedPortion("5000159484695")).toBeNull();
  });

  it("round-trips a recorded portion for the same barcode", async () => {
    await recordPortion("5000159484695", 30);
    expect(await getRememberedPortion("5000159484695")).toBe(30);
  });

  it("rounds grams to one decimal on persist", async () => {
    await recordPortion("5000159484695", 32.49);
    expect(await getRememberedPortion("5000159484695")).toBe(32.5);
  });

  it("overwrites the prior portion when re-recorded", async () => {
    await recordPortion("5000159484695", 30);
    await recordPortion("5000159484695", 45);
    expect(await getRememberedPortion("5000159484695")).toBe(45);
  });

  it("namespaces by barcode — recording one does not leak to another", async () => {
    await recordPortion("5000159484695", 30);
    expect(await getRememberedPortion("9999999999999")).toBeNull();
  });

  it("rejects malformed input — empty barcode, zero/negative grams, NaN", async () => {
    await recordPortion("", 30);
    await recordPortion("5000159484695", 0);
    await recordPortion("5000159484695", -10);
    await recordPortion("5000159484695", Number.NaN);
    expect(await getRememberedPortion("5000159484695")).toBeNull();
    expect(await getRememberedPortion("")).toBeNull();
  });

  it("rejects abusively long barcode strings (>64 chars) without throwing", async () => {
    const giant = "X".repeat(2_000);
    await recordPortion(giant, 30);
    expect(await getRememberedPortion(giant)).toBeNull();
  });

  it("clears expired entries on read (>90 days old)", async () => {
    // Inject an expired entry directly via AsyncStorage to exercise the TTL branch.
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const ancient = Date.now() - 91 * 24 * 60 * 60 * 1000;
    await AsyncStorage.setItem(
      "barcode_portion_v1:5000159484695",
      JSON.stringify({ grams: 30, ts: ancient }),
    );
    expect(await getRememberedPortion("5000159484695")).toBeNull();
    // And the stale entry should have been removed.
    expect(await AsyncStorage.getItem("barcode_portion_v1:5000159484695")).toBeNull();
  });

  it("returns null and does not throw when the stored payload is malformed", async () => {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    await AsyncStorage.setItem("barcode_portion_v1:5000159484695", "not-json");
    expect(await getRememberedPortion("5000159484695")).toBeNull();
    await AsyncStorage.setItem("barcode_portion_v1:5000159484695", JSON.stringify({ grams: "x" }));
    expect(await getRememberedPortion("5000159484695")).toBeNull();
  });
});

describe("barcodePortionMemory.clampRememberedToServingOptions", () => {
  it("returns the remembered grams unchanged when no serving options are provided", () => {
    expect(clampRememberedToServingOptions(37, null)).toBe(37);
    expect(clampRememberedToServingOptions(37, [])).toBe(37);
    expect(clampRememberedToServingOptions(37, undefined)).toBe(37);
  });

  it("snaps to an exact serving-option match within 0.5 g", () => {
    const opts = [{ grams: 30 }, { grams: 60 }, { grams: 90 }];
    expect(clampRememberedToServingOptions(30.2, opts)).toBe(30);
  });

  it("returns the closest serving option when no exact match", () => {
    const opts = [{ grams: 30 }, { grams: 60 }, { grams: 90 }];
    // 50 is closer to 60 than to 30
    expect(clampRememberedToServingOptions(50, opts)).toBe(60);
    // 35 is closer to 30
    expect(clampRememberedToServingOptions(35, opts)).toBe(30);
  });

  it("ignores invalid serving options", () => {
    const opts = [{ grams: Number.NaN }, { grams: 0 }, { grams: -5 }, { grams: 60 }];
    expect(clampRememberedToServingOptions(50, opts)).toBe(60);
  });

  it("returns the input verbatim when remembered is non-positive", () => {
    expect(clampRememberedToServingOptions(0, [{ grams: 30 }])).toBe(0);
    expect(clampRememberedToServingOptions(Number.NaN, [{ grams: 30 }])).toBeNaN();
  });
});
