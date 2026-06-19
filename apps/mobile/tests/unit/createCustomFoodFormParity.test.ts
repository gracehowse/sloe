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
const LABEL_PROBES: { field: string; web: RegExp; mobile: RegExp }[] = [
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
  // F-156 PR-1 (2026-05-10): the standalone "Base grams" input was
  // replaced by the macro basis toggle (Per serving | Per 100 g). The
  // baseGrams value is now derived from the basis + servingGrams, so
  // the user no longer types it. Probe lives below in the basis toggle
  // tests instead.
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

  // F-156 PR-1 (2026-05-10) — basis toggle + Fibre into the macro grid.
  it("both surfaces import the shared convertMacrosBetweenBases helper + MacroBasis type", () => {
    for (const src of [MOBILE_SRC, WEB_SRC]) {
      expect(src).toMatch(/convertMacrosBetweenBases/);
      expect(src).toMatch(/MacroBasis/);
    }
  });

  it("both surfaces render the basis toggle (Per serving | Per 100 g) with matching test ids", () => {
    for (const src of [MOBILE_SRC, WEB_SRC]) {
      expect(src).toMatch(/Macros entered as/);
      expect(src).toMatch(/Per serving/);
      expect(src).toMatch(/Per 100 g/);
      // Both surfaces emit testIDs of the form `custom-food-basis-${opt.value}`
      // via a template literal in the radiogroup map.
      expect(src).toMatch(/custom-food-basis-\$\{opt\.value\}/);
    }
  });

  it("both surfaces gate per-serving on a valid serving (perServingAvailable)", () => {
    for (const src of [MOBILE_SRC, WEB_SRC]) {
      expect(src).toMatch(/perServingAvailable/);
    }
  });

  it("both surfaces persist the user's last-chosen basis across sessions", () => {
    expect(MOBILE_SRC).toMatch(/AsyncStorage/);
    expect(MOBILE_SRC).toMatch(/MACRO_BASIS_STORAGE_KEY/);
    expect(WEB_SRC).toMatch(/localStorage/);
    expect(WEB_SRC).toMatch(/MACRO_BASIS_STORAGE_KEY/);
  });

  it("both surfaces show a 'Values converted' notice when the toggle flips", () => {
    for (const src of [MOBILE_SRC, WEB_SRC]) {
      expect(src).toMatch(/Values converted to/);
      expect(src).toMatch(/conversionNotice/);
    }
  });

  it("both surfaces remove the standalone 'Macros per [N grams]' input (basis replaces it)", () => {
    for (const src of [MOBILE_SRC, WEB_SRC]) {
      expect(src).not.toMatch(/baseGramsText/);
      expect(src).not.toMatch(/setBaseGramsText/);
    }
  });

  it("both surfaces render Fibre as a same-row macro grid cell (not a full-width row)", () => {
    expect(MOBILE_SRC).toMatch(/Fibre \(g\)/);
    expect(WEB_SRC).toMatch(/Fibre \(g\)/);
    // Negative: web no longer has `col-span-2` on the Fibre row.
    expect(WEB_SRC).not.toMatch(/custom-food-fiber"[\s\S]{0,200}?col-span-2/);
  });

  // F-156 PR-2 (2026-05-10) — barcode-failure prefill (M2) +
  // unlimited multi-serving rows (M3).
  it("both surfaces accept an `initialBarcode` prop for the scan-not-found prefill", () => {
    for (const src of [MOBILE_SRC, WEB_SRC]) {
      expect(src).toMatch(/initialBarcode/);
    }
  });

  it("both surfaces auto-open the disclosure when initialBarcode is set", () => {
    for (const src of [MOBILE_SRC, WEB_SRC]) {
      // Both mobile + web flip detailsOpen to true on initialBarcode.
      expect(src).toMatch(/setDetailsOpen\(Boolean\(initialBarcode\)\)/);
    }
  });

  it("both surfaces hold an additionalServings array (unlimited rows beyond the first)", () => {
    for (const src of [MOBILE_SRC, WEB_SRC]) {
      expect(src).toMatch(/additionalServings/);
      expect(src).toMatch(/setAdditionalServings/);
    }
  });

  it("both surfaces validate every additional serving row both-or-neither", () => {
    for (const src of [MOBILE_SRC, WEB_SRC]) {
      expect(src).toMatch(/additionalServingsValid/);
      // The check pattern: each row's label and grams are both set or both empty.
      expect(src).toMatch(/additionalServings\.every/);
    }
  });

  it("both surfaces render an 'Add another serving' button with a matching test id", () => {
    for (const src of [MOBILE_SRC, WEB_SRC]) {
      expect(src).toMatch(/Add another serving/);
      expect(src).toMatch(/custom-food-add-serving/);
    }
  });

  it("both surfaces render a remove button per additional serving row", () => {
    for (const src of [MOBILE_SRC, WEB_SRC]) {
      expect(src).toMatch(/custom-food-additional-serving-remove-/);
    }
  });

  it("both surfaces collect first + additional rows into the saved servings[] payload", () => {
    for (const src of [MOBILE_SRC, WEB_SRC]) {
      expect(src).toMatch(/for \(const row of additionalServings\)/);
      expect(src).toMatch(/servings\.push/);
    }
  });

  // ENG-748 #15 (2026-05-27) — density-aware "1 cup → grams" converter must
  // exist on BOTH surfaces (MFP-parity gap). Pinned so it can't be added to
  // one platform and forgotten on the other.
  it("both surfaces wire the shared density-aware volume→grams converter", () => {
    for (const src of [MOBILE_SRC, WEB_SRC]) {
      expect(src).toMatch(/volumeToGrams/);
      expect(src).toMatch(/isVolumeUnit/);
      expect(src).toMatch(/parseIngredientLine/);
      // Both render the convert button + the unknown-density fallback hint.
      expect(src).toMatch(/custom-food-volume-convert/);
      expect(src).toMatch(/custom-food-volume-unknown/);
    }
  });

  it("the volume converter imports from the shared sourced density module (no per-platform density table)", () => {
    for (const src of [MOBILE_SRC, WEB_SRC]) {
      expect(src).toMatch(/(?:nutrition|nutrition-core)\/volumeToGrams/);
    }
  });

  // Recipe-vision contract (2026-06-11) — "Scan label" OCR pre-fill must
  // exist on BOTH surfaces (the wedge feature). Pinned so it can't ship on
  // one platform and silently drift on the other.
  it("both surfaces render a 'Scan label' OCR entry with the same test id", () => {
    for (const src of [MOBILE_SRC, WEB_SRC]) {
      expect(src).toMatch(/Scan label/);
      expect(src).toMatch(/custom-food-scan-label/);
    }
  });

  it("both surfaces POST the scan to /api/nutrition/scan-label", () => {
    for (const src of [MOBILE_SRC, WEB_SRC]) {
      expect(src).toMatch(/\/api\/nutrition\/scan-label/);
    }
  });

  it("both surfaces pre-fill in per-100g basis (form stays source of truth)", () => {
    for (const src of [MOBILE_SRC, WEB_SRC]) {
      // Both flip the basis to per_100g before pre-filling the macro fields.
      expect(src).toMatch(/setMacroBasis\("per_100g"\)/);
      expect(src).toMatch(/setCaloriesText\(/);
    }
  });

  it("both surfaces warn (never silently accept) on a flagged / implausible scan", () => {
    for (const src of [MOBILE_SRC, WEB_SRC]) {
      expect(src).toMatch(/scanWarning/);
      expect(src).toMatch(/[Dd]ouble-check/);
      // The implausible flag from the route drives the warning.
      expect(src).toMatch(/implausible/);
    }
  });

  it("both surfaces fire the same custom_food_label_scanned analytics event", () => {
    for (const src of [MOBILE_SRC, WEB_SRC]) {
      expect(src).toMatch(/custom_food_label_scanned/);
    }
  });

  it("the BarcodeScannerModal exposes an onAddAsCustomFood callback for the not-found CTA (mobile)", () => {
    const scanner = readFileSync(
      resolve(__dirname, "../../components/BarcodeScannerModal.tsx"),
      "utf8",
    );
    expect(scanner).toMatch(/onAddAsCustomFood\?/);
    // P1 (customer-lens 2026-05-11): copy changed from "Add as custom
    // food" (text link, near-synonym with "Enter manually") to
    // "Add this product" (primary CTA, communicates the save benefit).
    expect(scanner).toMatch(/Add this product/);
    expect(scanner).toMatch(/barcode-not-found-add-custom-food/);
  });

  it("the today-barcode-dialog exposes an onAddAsCustomFood callback for the not-found CTA (web)", () => {
    const dialog = readFileSync(
      resolve(__dirname, "../../../../src/app/components/suppr/today-barcode-dialog.tsx"),
      "utf8",
    );
    expect(dialog).toMatch(/onAddAsCustomFood\?/);
    expect(dialog).toMatch(/Add as custom food|Add this product/);
    expect(dialog).toMatch(/barcode-not-found-add-custom-food/);
  });
});
