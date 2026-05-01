/**
 * Locale gating for the food-search "barcode fallback" empty-state hint.
 *
 * Pins:
 *   - en-GB / en-AU / en-IE / fr-FR / de-DE → hint shows.
 *   - en-US → hint hidden.
 *   - US territories (PR, GU, AS, VI, MP) → hint hidden (FatSecret US
 *     dataset largely covers them; treat as US).
 *   - bare "en" / null / undefined → hint shows (safe fallback for
 *     non-US users with permissive browsers).
 *   - Region tag extraction works for both `-` and `_` separators
 *     (some legacy systems emit `en_GB`).
 */
import { describe, expect, it } from "vitest";
import {
  regionFromLocale,
  shouldShowBarcodeFallbackHint,
  US_DATASET_REGIONS_FOR_TESTS,
} from "../../src/lib/nutrition/foodSearchLocale";

describe("regionFromLocale", () => {
  it.each([
    ["en-US", "US"],
    ["en-GB", "GB"],
    ["en-AU", "AU"],
    ["fr-FR", "FR"],
    ["de-DE", "DE"],
    ["en_IE", "IE"],
    ["zh-Hans-CN", "CN"], // skips the script subtag
    ["sr-Cyrl-RS", "RS"],
  ])("extracts region from %s → %s", (locale, expected) => {
    expect(regionFromLocale(locale)).toBe(expected);
  });

  it("returns null for bare language tags", () => {
    expect(regionFromLocale("en")).toBeNull();
    expect(regionFromLocale("fr")).toBeNull();
  });

  it("returns null for empty / null / undefined", () => {
    expect(regionFromLocale("")).toBeNull();
    expect(regionFromLocale(null)).toBeNull();
    expect(regionFromLocale(undefined)).toBeNull();
  });

  it("uppercases the result", () => {
    expect(regionFromLocale("en-gb")).toBe("GB");
  });
});

describe("shouldShowBarcodeFallbackHint", () => {
  it("hides hint for en-US", () => {
    expect(shouldShowBarcodeFallbackHint("en-US")).toBe(false);
  });

  it.each(["en-GB", "en-AU", "en-IE", "fr-FR", "de-DE", "es-ES", "it-IT"])(
    "shows hint for non-US locale %s",
    (locale) => {
      expect(shouldShowBarcodeFallbackHint(locale)).toBe(true);
    },
  );

  it.each(Array.from(US_DATASET_REGIONS_FOR_TESTS))(
    "hides hint for US territory %s",
    (region) => {
      expect(shouldShowBarcodeFallbackHint(`en-${region}`)).toBe(false);
    },
  );

  it("shows hint for bare 'en' (safe fallback)", () => {
    expect(shouldShowBarcodeFallbackHint("en")).toBe(true);
  });

  it("shows hint for null / empty / undefined locale", () => {
    expect(shouldShowBarcodeFallbackHint(null)).toBe(true);
    expect(shouldShowBarcodeFallbackHint(undefined)).toBe(true);
    expect(shouldShowBarcodeFallbackHint("")).toBe(true);
  });
});
