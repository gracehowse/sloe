/**
 * Web mirror of `apps/mobile/tests/unit/barcodePortionMemory.test.ts`.
 * Same shape, same TTL behaviour, same clamp logic — backend is
 * `localStorage`. Audit/2026-04-30 competitive-parity feature.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  _resetRememberedPortionsForTests,
  clampRememberedToServingOptions,
  getRememberedPortion,
  recordPortion,
} from "@/lib/barcodePortionMemory";

describe("barcodePortionMemory.recordPortion / getRememberedPortion (web)", () => {
  beforeEach(() => {
    _resetRememberedPortionsForTests();
  });
  afterEach(() => {
    _resetRememberedPortionsForTests();
  });

  it("returns null when no portion has ever been recorded", () => {
    expect(getRememberedPortion("5000159484695")).toBeNull();
  });

  it("round-trips a recorded portion for the same barcode", () => {
    recordPortion("5000159484695", 30);
    expect(getRememberedPortion("5000159484695")).toBe(30);
  });

  it("rounds grams to one decimal on persist", () => {
    recordPortion("5000159484695", 32.49);
    expect(getRememberedPortion("5000159484695")).toBe(32.5);
  });

  it("overwrites the prior portion when re-recorded", () => {
    recordPortion("5000159484695", 30);
    recordPortion("5000159484695", 45);
    expect(getRememberedPortion("5000159484695")).toBe(45);
  });

  it("namespaces by barcode — recording one does not leak to another", () => {
    recordPortion("5000159484695", 30);
    expect(getRememberedPortion("9999999999999")).toBeNull();
  });

  it("rejects malformed input — empty barcode, zero/negative grams, NaN", () => {
    recordPortion("", 30);
    recordPortion("5000159484695", 0);
    recordPortion("5000159484695", -10);
    recordPortion("5000159484695", Number.NaN);
    expect(getRememberedPortion("5000159484695")).toBeNull();
    expect(getRememberedPortion("")).toBeNull();
  });

  it("rejects abusively long barcode strings (>64 chars) without throwing", () => {
    const giant = "X".repeat(2_000);
    recordPortion(giant, 30);
    expect(getRememberedPortion(giant)).toBeNull();
  });

  it("clears expired entries on read (>90 days old)", () => {
    const ancient = Date.now() - 91 * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(
      "barcode_portion_v1:5000159484695",
      JSON.stringify({ grams: 30, ts: ancient }),
    );
    expect(getRememberedPortion("5000159484695")).toBeNull();
    expect(window.localStorage.getItem("barcode_portion_v1:5000159484695")).toBeNull();
  });

  it("returns null and does not throw when the stored payload is malformed", () => {
    window.localStorage.setItem("barcode_portion_v1:5000159484695", "not-json");
    expect(getRememberedPortion("5000159484695")).toBeNull();
    window.localStorage.setItem(
      "barcode_portion_v1:5000159484695",
      JSON.stringify({ grams: "x" }),
    );
    expect(getRememberedPortion("5000159484695")).toBeNull();
  });
});

describe("barcodePortionMemory.clampRememberedToServingOptions (web)", () => {
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
    expect(clampRememberedToServingOptions(50, opts)).toBe(60);
    expect(clampRememberedToServingOptions(35, opts)).toBe(30);
  });

  it("ignores invalid serving options", () => {
    const opts = [{ grams: Number.NaN }, { grams: 0 }, { grams: -5 }, { grams: 60 }];
    expect(clampRememberedToServingOptions(50, opts)).toBe(60);
  });
});
