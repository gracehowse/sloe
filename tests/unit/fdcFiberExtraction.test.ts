/**
 * Build-40 (2026-05-01) — TestFlight Build 40 feedback "Fibre and other
 * nutrients not pulling in". Pin the new fiber/sugar/sodium extraction
 * path in `fdcFoodsSearch` so search results carry these fields without
 * waiting for the on-tap food-detail fetch.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fdcFoodsSearch } from "../../src/lib/usda/fdcClient";

const FDC_CLIENT = resolve(__dirname, "../../src/lib/usda/fdcClient.ts");
const SRC = readFileSync(FDC_CLIENT, "utf8");

describe("Build-40 — fdcFoodsSearch fiber/sugar/sodium extraction", () => {
  it("extracts fiber via USDA nutrient number 291 ('Fiber, total dietary')", () => {
    expect(SRC).toMatch(/num === "291"/);
  });

  it("extracts sugar via USDA nutrient number 269 ('Sugars, total')", () => {
    expect(SRC).toMatch(/num === "269"/);
  });

  it("extracts sodium via USDA nutrient number 307 ('Sodium, Na')", () => {
    expect(SRC).toMatch(/num === "307"/);
  });

  it("FdcFoodSearchHit type carries optional fiberG / sugarG / sodiumMg fields", () => {
    expect(SRC).toMatch(/fiberG\?\s*:\s*number/);
    expect(SRC).toMatch(/sugarG\?\s*:\s*number/);
    expect(SRC).toMatch(/sodiumMg\?\s*:\s*number/);
  });

  it("falls back to a 'Fiber' name match when 291 isn't present (branded products)", () => {
    expect(SRC).toMatch(/name === "fiber"/);
  });

  it("returns fiberG / sugarG / sodiumMg only when the value was actually found (no zero-injection)", () => {
    // Conditional spread keeps undefined out of the row — search-merge layer
    // maps undefined → 0 for display but keeps the distinction for backfill
    // / debugging.
    expect(SRC).toMatch(/\.\.\.\(fiberG != null \? \{ fiberG \} : \{\}\)/);
    expect(SRC).toMatch(/\.\.\.\(sugarG != null \? \{ sugarG \} : \{\}\)/);
    expect(SRC).toMatch(/\.\.\.\(sodiumMg != null \? \{ sodiumMg \} : \{\}\)/);
  });
});

describe("Build-40 — fiber surfacing through the merge pipeline", () => {
  const PANEL_SRC = readFileSync(
    resolve(__dirname, "../../src/app/components/food-search/FoodSearchPanel.tsx"),
    "utf8",
  );

  it("web FoodSearchPanel forwards fiber/sugar/sodium from API hits to the search row macros", () => {
    expect(PANEL_SRC).toMatch(/fiberG: typeof h\.fiberG === "number" \? h\.fiberG : 0/);
    expect(PANEL_SRC).toMatch(/sugarG: typeof h\.sugarG === "number" \? h\.sugarG : 0/);
    expect(PANEL_SRC).toMatch(/sodiumMg: typeof h\.sodiumMg === "number" \? h\.sodiumMg : 0/);
  });

  const VERIFY_SRC = readFileSync(
    resolve(__dirname, "../../apps/mobile/lib/verifyRecipe.ts"),
    "utf8",
  );

  it("mobile searchUsda forwards fiber/sugar/sodium from API hits", () => {
    expect(VERIFY_SRC).toMatch(/typeof h\.fiberG === "number" \? \{ fiberG: h\.fiberG \} : \{\}/);
    expect(VERIFY_SRC).toMatch(/typeof h\.sugarG === "number" \? \{ sugarG: h\.sugarG \} : \{\}/);
    expect(VERIFY_SRC).toMatch(/typeof h\.sodiumMg === "number" \? \{ sodiumMg: h\.sodiumMg \} : \{\}/);
  });

  it("mobile mergeResults uses item.fiberG ?? 0 (no longer hard-coded to 0)", () => {
    expect(VERIFY_SRC).toMatch(/fiberG: item\.fiberG \?\? 0/);
    expect(VERIFY_SRC).toMatch(/sugarG: item\.sugarG \?\? 0/);
    expect(VERIFY_SRC).toMatch(/sodiumMg: item\.sodiumMg \?\? 0/);
  });
});

describe("Build-40 — fdcFoodsSearch behaviour: apple fixture surfaces fiber", () => {
  // Behaviour test (vs source-grep above): mock USDA `/foods/search` and
  // assert that fiber lands on the returned hit. Brief item 4 — "log a
  // USDA fruit (apple) and assert fiber appears in the result row macros".
  // 2.4g fiber/100g is the SR Legacy "Apples, raw, with skin" value.
  const APPLE_RAW_FIXTURE = {
    foods: [
      {
        fdcId: 171688,
        description: "Apples, raw, with skin",
        dataType: "SR Legacy",
        foodNutrients: [
          { nutrientNumber: "1008", nutrientName: "Energy", value: 52, unitName: "KCAL" },
          { nutrientNumber: "203", nutrientName: "Protein", value: 0.26, unitName: "G" },
          { nutrientNumber: "204", nutrientName: "Total lipid (fat)", value: 0.17, unitName: "G" },
          { nutrientNumber: "205", nutrientName: "Carbohydrate, by difference", value: 13.81, unitName: "G" },
          { nutrientNumber: "291", nutrientName: "Fiber, total dietary", value: 2.4, unitName: "G" },
          { nutrientNumber: "269", nutrientName: "Sugars, total including NLEA", value: 10.39, unitName: "G" },
          { nutrientNumber: "307", nutrientName: "Sodium, Na", value: 1, unitName: "MG" },
        ],
      },
    ],
  };

  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("apple search hit carries fiberG (2.4) + sugarG (10.4) + sodiumMg (1) per 100g", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      async json() {
        return APPLE_RAW_FIXTURE;
      },
      async text() {
        return "";
      },
    })) as unknown as typeof globalThis.fetch;

    const hits = await fdcFoodsSearch(
      { apiKey: "test" },
      "apple",
      // Caller-provided dataType bypasses two-stage path — keeps this
      // test single-fetch + deterministic.
      { dataType: ["SR Legacy"] },
    );

    expect(hits.length).toBe(1);
    const hit = hits[0]!;
    expect(hit.description).toBe("Apples, raw, with skin");
    expect(hit.calories).toBe(52);
    // The bug this PR fixes: previously fiberG/sugarG/sodiumMg were
    // never extracted, leading to "Fibre not pulling in" on TestFlight.
    expect(hit.fiberG).toBe(2.4);
    expect(hit.sugarG).toBe(10.4);
    expect(hit.sodiumMg).toBe(1);
  });

  it("apple search hit with no fiber nutrient leaves fiberG undefined (not zero)", async () => {
    const APPLE_NO_FIBER = {
      foods: [
        {
          fdcId: 1,
          description: "Apple, branded missing fiber",
          dataType: "Branded",
          foodNutrients: [
            { nutrientNumber: "1008", value: 52, unitName: "KCAL" },
            { nutrientNumber: "203", value: 0.3, unitName: "G" },
            { nutrientNumber: "205", value: 13.8, unitName: "G" },
          ],
        },
      ],
    };
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      async json() {
        return APPLE_NO_FIBER;
      },
      async text() {
        return "";
      },
    })) as unknown as typeof globalThis.fetch;

    const hits = await fdcFoodsSearch({ apiKey: "test" }, "apple", { dataType: ["Branded"] });
    expect(hits.length).toBe(1);
    // Conditional spread — undefined preserved so the merge layer can
    // distinguish "0g fiber" (chicken breast) from "fiber not published".
    expect(hits[0]!.fiberG).toBeUndefined();
  });

  it("branded fiber under 'Fiber' (no 'total dietary' suffix) is still picked up", async () => {
    const BRANDED_FIBER = {
      foods: [
        {
          fdcId: 2,
          description: "Branded oat cereal",
          dataType: "Branded",
          foodNutrients: [
            { nutrientNumber: "1008", value: 380, unitName: "KCAL" },
            { nutrientNumber: "203", value: 12, unitName: "G" },
            { nutrientNumber: "204", value: 6, unitName: "G" },
            { nutrientNumber: "205", value: 65, unitName: "G" },
            // Branded products use just "Fiber" (no number 291).
            { nutrientName: "Fiber", value: 8, unitName: "G" },
          ],
        },
      ],
    };
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      async json() {
        return BRANDED_FIBER;
      },
      async text() {
        return "";
      },
    })) as unknown as typeof globalThis.fetch;

    const hits = await fdcFoodsSearch({ apiKey: "test" }, "oats", { dataType: ["Branded"] });
    expect(hits[0]!.fiberG).toBe(8);
  });
});
