import { describe, it, expect, vi, afterEach } from "vitest";
import {
  edamamFoodMacrosPer100g,
  mapEdamamNutrientsToMicros,
  fetchEdamamMicrosPer100g,
} from "@/lib/edamam/client";

describe("edamamFoodMacrosPer100g", () => {
  it("extracts macros from Edamam food nutrients", () => {
    const food = {
      foodId: "food_test",
      label: "Chicken Breast",
      category: "Generic",
      categoryLabel: "food",
      nutrients: {
        ENERC_KCAL: 165,
        PROCNT: 31,
        FAT: 3.6,
        CHOCDF: 0,
        FIBTG: 0,
        SUGAR: 0,
        NA: 74,
      },
    };

    const macros = edamamFoodMacrosPer100g(food);
    expect(macros.calories).toBe(165);
    expect(macros.protein).toBe(31);
    expect(macros.fat).toBe(3.6);
    expect(macros.carbs).toBe(0);
    expect(macros.fiberG).toBe(0);
    expect(macros.sodiumMg).toBe(74);
  });

  it("defaults to 0 for missing nutrients", () => {
    const food = {
      foodId: "food_empty",
      label: "Water",
      category: "Generic",
      categoryLabel: "food",
      nutrients: {},
    };

    const macros = edamamFoodMacrosPer100g(food);
    expect(macros.calories).toBe(0);
    expect(macros.protein).toBe(0);
    expect(macros.carbs).toBe(0);
    expect(macros.fat).toBe(0);
  });
});

describe("mapEdamamNutrientsToMicros (ENG-738)", () => {
  // A realistic `/nutrients` totalNutrients payload for a 100 g basis
  // (so quantities ARE per-100g). Units match our canonical keys: mg for
  // minerals/most vitamins, mcg for trace vitamins, g for fat breakdown.
  // Values from a chicken-breast-shaped food; chosen so we can assert the
  // mapping AND that quantities are emitted verbatim (no unit scaling).
  const TOTAL_NUTRIENTS = {
    ENERC_KCAL: { label: "Energy", quantity: 165, unit: "kcal" },
    PROCNT: { label: "Protein", quantity: 31, unit: "g" },
    FAT: { label: "Fat", quantity: 3.6, unit: "g" },
    CHOCDF: { label: "Carbs, by difference", quantity: 0, unit: "g" },
    FIBTG: { label: "Fiber, total dietary", quantity: 2.4, unit: "g" },
    SUGAR: { label: "Sugars, total", quantity: 1.1, unit: "g" },
    FASAT: { label: "Fatty acids, total saturated", quantity: 1.01, unit: "g" },
    FAMS: { label: "Fatty acids, total monounsaturated", quantity: 1.24, unit: "g" },
    FAPU: { label: "Fatty acids, total polyunsaturated", quantity: 0.77, unit: "g" },
    FATRN: { label: "Fatty acids, total trans", quantity: 0.02, unit: "g" },
    CHOLE: { label: "Cholesterol", quantity: 85, unit: "mg" },
    NA: { label: "Sodium, Na", quantity: 74, unit: "mg" },
    CA: { label: "Calcium, Ca", quantity: 15, unit: "mg" },
    MG: { label: "Magnesium, Mg", quantity: 29, unit: "mg" },
    K: { label: "Potassium, K", quantity: 256, unit: "mg" },
    FE: { label: "Iron, Fe", quantity: 1.04, unit: "mg" },
    ZN: { label: "Zinc, Zn", quantity: 1.02, unit: "mg" },
    P: { label: "Phosphorus, P", quantity: 228, unit: "mg" },
    VITA_RAE: { label: "Vitamin A, RAE", quantity: 9, unit: "µg" },
    VITC: { label: "Vitamin C", quantity: 1.2, unit: "mg" },
    THIA: { label: "Thiamin", quantity: 0.07, unit: "mg" },
    RIBF: { label: "Riboflavin", quantity: 0.18, unit: "mg" },
    NIA: { label: "Niacin", quantity: 13.7, unit: "mg" },
    VITB6A: { label: "Vitamin B6", quantity: 0.6, unit: "mg" },
    FOLDFE: { label: "Folate, DFE", quantity: 6, unit: "µg" },
    VITB12: { label: "Vitamin B12", quantity: 0.34, unit: "µg" },
    VITD: { label: "Vitamin D", quantity: 0.1, unit: "µg" },
    TOCPHA: { label: "Vitamin E", quantity: 0.27, unit: "mg" },
    VITK1: { label: "Vitamin K", quantity: 2.4, unit: "µg" },
    // Codes NOT in our map — must be dropped.
    FATRN_TS: { label: "junk", quantity: 99, unit: "g" },
    WATER: { label: "Water", quantity: 65, unit: "g" },
  };

  it("maps every code in the table to its canonical key with units verbatim", () => {
    const out = mapEdamamNutrientsToMicros(TOTAL_NUTRIENTS);

    // Minerals — emitted verbatim (Edamam mg == our *Mg key).
    expect(out.sodiumMg).toBe(74);
    expect(out.calciumMg).toBe(15);
    expect(out.magnesiumMg).toBe(29);
    expect(out.potassiumMg).toBe(256);
    expect(out.ironMg).toBe(1); // 1.04 → 1dp → 1.0
    expect(out.zincMg).toBe(1); // 1.02 → 0dp → 1
    expect(out.phosphorusMg).toBe(228);

    // Vitamins — verbatim, no conversion.
    expect(out.vitaminAMcgRae).toBe(9);
    expect(out.vitaminCMg).toBe(1.2);
    expect(out.thiaminMg).toBe(0.1); // 0.07 → 1dp
    expect(out.riboflavinMg).toBe(0.2); // 0.18 → 1dp
    expect(out.niacinMg).toBe(13.7);
    expect(out.vitaminB6Mg).toBe(0.6);
    expect(out.folateMcg).toBe(6);
    expect(out.vitaminB12Mcg).toBe(0.3); // 0.34 → 1dp
    expect(out.vitaminDMcg).toBe(0.1);
    expect(out.vitaminEMg).toBe(0.3); // 0.27 → 1dp
    expect(out.vitaminKMcg).toBe(2); // 2.4 → 0dp

    // Fat breakdown + cholesterol.
    expect(out.saturatedFatG).toBe(1); // 1.01 → 1dp → 1.0
    expect(out.monoFatG).toBe(1.2); // 1.24 → 1dp
    expect(out.polyFatG).toBe(0.8); // 0.77 → 1dp
    expect(out).not.toHaveProperty("transFatG"); // 0.02 → 1dp → 0.0 → dropped
    expect(out.cholesterolMg).toBe(85);

    // Macros-as-micros.
    expect(out.fiberG).toBe(2.4);
    expect(out.sugarG).toBe(1.1);
  });

  it("drops codes not in the canonical map", () => {
    const out = mapEdamamNutrientsToMicros(TOTAL_NUTRIENTS);
    // ENERC_KCAL / PROCNT / FAT / CHOCDF are macros (top-level columns),
    // not micros — never emitted here.
    expect(out).not.toHaveProperty("calories");
    expect(out).not.toHaveProperty("protein");
    // Unknown codes (WATER, junk) are dropped.
    expect(Object.values(out)).not.toContain(65);
    expect(Object.values(out)).not.toContain(99);
  });

  it("drops zero / non-finite quantities (shared emit convention)", () => {
    const out = mapEdamamNutrientsToMicros({
      NA: { label: "Sodium", quantity: 0, unit: "mg" },
      CA: { label: "Calcium", quantity: Number.NaN, unit: "mg" },
      MG: { label: "Magnesium", quantity: -5, unit: "mg" },
      K: { label: "Potassium", quantity: 200, unit: "mg" },
    });
    expect(out).not.toHaveProperty("sodiumMg");
    expect(out).not.toHaveProperty("calciumMg");
    expect(out).not.toHaveProperty("magnesiumMg");
    expect(out.potassiumMg).toBe(200);
  });

  it("returns {} for null / undefined / empty totalNutrients", () => {
    expect(mapEdamamNutrientsToMicros(null)).toEqual({});
    expect(mapEdamamNutrientsToMicros(undefined)).toEqual({});
    expect(mapEdamamNutrientsToMicros({})).toEqual({});
  });
});

describe("fetchEdamamMicrosPer100g (ENG-738)", () => {
  const cfg = { appId: "test-id", appKey: "test-key" };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs the food at a 100 g gram-measure basis and maps the panel", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(
        JSON.stringify({
          totalNutrients: {
            NA: { label: "Sodium", quantity: 74, unit: "mg" },
            CA: { label: "Calcium", quantity: 15, unit: "mg" },
            VITC: { label: "Vitamin C", quantity: 1.2, unit: "mg" },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const micros = await fetchEdamamMicrosPer100g(cfg, "food_abc123");

    expect(micros).toEqual({ sodiumMg: 74, calciumMg: 15, vitaminCMg: 1.2 });

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toContain("/api/food-database/v2/nutrients");
    expect(String(url)).toContain("app_id=test-id");
    expect(String(url)).toContain("app_key=test-key");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body));
    expect(body.ingredients[0]).toMatchObject({
      quantity: 100,
      measureURI: "http://www.edamam.com/ontologies/edamam.owl#Measure_gram",
      foodId: "food_abc123",
    });
  });

  it("returns {} (never throws) on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 429 })));
    await expect(fetchEdamamMicrosPer100g(cfg, "food_x")).resolves.toEqual({});
  });

  it("returns {} (never throws) on a network error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("boom"); }));
    await expect(fetchEdamamMicrosPer100g(cfg, "food_x")).resolves.toEqual({});
  });

  it("returns {} for an empty foodId without calling the network", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(fetchEdamamMicrosPer100g(cfg, "  ")).resolves.toEqual({});
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
