/**
 * Web/mobile parity — Create Custom Food form field set.
 *
 * TestFlight build 9 `AE52_fIRZ-ZIupmoJ8T4yaI` (2026-04-19): tester
 * compared Suppr's custom-food form to MyFitnessPal / LoseIt and found
 * four gaps — natural serving size + servings-per-container, detailed
 * micros (sugar / sat fat / sodium), and a barcode. Fix B landed both
 * platforms in one pass; this structural test pins the two surfaces
 * capturing the same fields with the same validation + accessibility
 * labels so web and mobile can't silently drift.
 *
 * If this test fails because someone re-implemented one side without
 * the other, see the linked ASC feedback id before "fixing" the test.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE_PATH = resolve(__dirname, "../../components/CreateCustomFoodSheet.tsx");
const WEB_PATH = resolve(
  __dirname,
  "../../../../src/app/components/suppr/create-custom-food-dialog.tsx",
);
const SHARED_PATH = resolve(
  __dirname,
  "../../../../src/lib/nutrition/customFoods.ts",
);

const MOBILE_SRC = readFileSync(MOBILE_PATH, "utf8");
const WEB_SRC = readFileSync(WEB_PATH, "utf8");
const SHARED_SRC = readFileSync(SHARED_PATH, "utf8");

/** Names of the fields both sides must carry on the input payload. */
const PAYLOAD_KEYS = [
  "name",
  "brand",
  "baseGrams",
  "calories",
  "protein",
  "carbs",
  "fat",
  "fiber",
  "servings",
  "servingsPerContainer",
  "sugarG",
  "saturatedFatG",
  "sodiumMg",
  "barcode",
] as const;

/** Accessibility / a11y labels that identify each input. Web uses
 * `htmlFor` on the `<Label>` or `aria-label`; mobile uses
 * `accessibilityLabel`. We grep for substrings that are unique to each
 * field on both sides. */
const LABEL_PROBES: Array<{ field: string; web: RegExp; mobile: RegExp }> = [
  {
    field: "name",
    web: /htmlFor="custom-food-name"|id="custom-food-name"/,
    mobile: /accessibilityLabel="Custom food name"/,
  },
  {
    field: "brand",
    web: /htmlFor="custom-food-brand"|id="custom-food-brand"/,
    mobile: /accessibilityLabel="Brand"/,
  },
  {
    field: "serving size label",
    web: /aria-label="Serving size label"|id="custom-food-serving-label"/,
    mobile: /accessibilityLabel="Serving size label"/,
  },
  {
    field: "serving size grams",
    web: /aria-label="Serving size grams"|id="custom-food-serving-grams"/,
    mobile: /accessibilityLabel="Serving size grams"/,
  },
  {
    field: "servings per container",
    web: /aria-label="Servings per container"|id="custom-food-servings-per-container"/,
    mobile: /accessibilityLabel="Servings per container"/,
  },
  {
    field: "base grams",
    web: /aria-label="Base grams"|id="custom-food-base-grams"/,
    mobile: /accessibilityLabel="Base grams"/,
  },
  {
    field: "calories",
    web: /id="custom-food-calories"/,
    mobile: /accessibilityLabel="Calories"/,
  },
  {
    field: "protein",
    web: /id="custom-food-protein"/,
    mobile: /accessibilityLabel="Protein grams"/,
  },
  {
    field: "carbs",
    web: /id="custom-food-carbs"/,
    mobile: /accessibilityLabel="Carbs grams"/,
  },
  {
    field: "fat",
    web: /id="custom-food-fat"/,
    mobile: /accessibilityLabel="Fat grams"/,
  },
  {
    field: "fibre",
    web: /id="custom-food-fiber"/,
    mobile: /accessibilityLabel="Fibre grams, optional"/,
  },
  {
    field: "sugar",
    web: /id="custom-food-sugar"/,
    mobile: /accessibilityLabel="Sugar grams, optional"/,
  },
  {
    field: "saturated fat",
    web: /id="custom-food-sat-fat"/,
    mobile: /accessibilityLabel="Saturated fat grams, optional"/,
  },
  {
    field: "sodium",
    web: /id="custom-food-sodium"/,
    mobile: /accessibilityLabel="Sodium milligrams, optional"/,
  },
  {
    field: "barcode",
    web: /id="custom-food-barcode"/,
    mobile: /accessibilityLabel="Barcode, optional"/,
  },
];

describe("Create custom food form parity (TestFlight AE52_fIRZ-ZIupmoJ8T4yaI)", () => {
  it("both surfaces carry every field on the CreateCustomFoodPayload", () => {
    for (const key of PAYLOAD_KEYS) {
      // The type declaration literally writes each key on both sides
      // (e.g. `  servingsPerContainer?: number;`).
      expect(MOBILE_SRC).toMatch(new RegExp(`\\b${key}\\b`));
      expect(WEB_SRC).toMatch(new RegExp(`\\b${key}\\b`));
    }
  });

  it("both surfaces render the same labelled inputs", () => {
    for (const probe of LABEL_PROBES) {
      expect(WEB_SRC).toMatch(probe.web);
      expect(MOBILE_SRC).toMatch(probe.mobile);
    }
  });

  it("both surfaces gate Save on the same four rules (name / base / serving pair / barcode)", () => {
    for (const src of [MOBILE_SRC, WEB_SRC]) {
      expect(src).toMatch(/trimmedName\.length > 0/);
      expect(src).toMatch(/hasValidBase/);
      expect(src).toMatch(/servingValid/);
      expect(src).toMatch(/barcodeValid/);
    }
  });

  it("both surfaces share the same inline barcode error copy", () => {
    const expected = "Enter a valid 8, 12, 13, or 14-digit barcode, or leave blank.";
    expect(MOBILE_SRC).toContain(expected);
    expect(WEB_SRC).toContain(expected);
    // And the error comes from the shared validator so the copy can't
    // drift on one platform without the test catching it.
    expect(SHARED_SRC).toContain(expected);
  });

  it("both surfaces import the shared validator + per-100g helper", () => {
    expect(MOBILE_SRC).toMatch(/validateCustomFoodBarcode/);
    expect(WEB_SRC).toMatch(/validateCustomFoodBarcode/);
    expect(MOBILE_SRC).toMatch(/customFoodToMacrosPer100g/);
    expect(WEB_SRC).toMatch(/customFoodToMacrosPer100g/);
  });

  it("both surfaces hide detailed nutrition behind the same disclosure", () => {
    // The disclosure button text is identical on both platforms so the
    // affordance reads the same.
    expect(MOBILE_SRC).toMatch(/Add detailed nutrition/);
    expect(WEB_SRC).toMatch(/Add detailed nutrition/);
    expect(MOBILE_SRC).toMatch(/Hide detailed nutrition/);
    expect(WEB_SRC).toMatch(/Hide detailed nutrition/);
  });

  it("both surfaces surface a 'Per-serving preview' line computed from the shared helper", () => {
    expect(MOBILE_SRC).toMatch(/Per-serving preview/i);
    expect(WEB_SRC).toMatch(/Per-serving preview/i);
  });
});
