type FdcConfig = {
  apiKey: string;
};

export type FdcFoodSearchHit = {
  fdcId: number;
  description: string;
  dataType?: string;
  brandName?: string;
  score?: number;
  /** Inline macros extracted from search results (per 100g) */
  calories?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  /**
   * Branded-food per-serving size (number + unit). USDA exposes these
   * directly on branded search hits so we pass them through — the
   * display layer uses them to show a per-portion kcal line alongside
   * the /100g reference. TestFlight `APo0qS9vcFvmBJEJJ_-61YA`.
   */
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  /**
   * Non-branded `foodPortions[]` — Survey/Foundation/SR Legacy. Empty
   * for branded hits (they use the serving fields above). Forwarded as
   * a narrow subset of the full USDA shape so the display helper can
   * pick the first non-placeholder row.
   */
  foodPortions?: Array<{
    gramWeight?: number;
    amount?: number;
    modifier?: string;
    portionDescription?: string;
    measureUnit?: { name?: string; abbreviation?: string };
  }>;
};

export type FdcNutrient = {
  nutrient?: {
    id?: number;
    name?: string;
    number?: string;
    unitName?: string;
  };
  nutrientName?: string;
  unitName?: string;
  amount?: number;
};

export type FdcFoodPortion = {
  id?: number;
  amount?: number;
  gramWeight?: number;
  modifier?: string;
  measureUnit?: { name?: string; abbreviation?: string };
  portionDescription?: string;
};

export type FdcFood = {
  fdcId: number;
  description: string;
  dataType?: string;
  foodNutrients?: FdcNutrient[];
  foodPortions?: FdcFoodPortion[];
};

const API_BASE = "https://api.nal.usda.gov/fdc/v1";

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

export function fdcConfigFromEnv(): FdcConfig {
  return { apiKey: requiredEnv("USDA_FDC_API_KEY") };
}

export async function fdcFoodsSearch(
  cfg: FdcConfig,
  query: string,
  opts?: { dataType?: string[]; pageNumber?: number; pageSize?: number },
): Promise<FdcFoodSearchHit[]> {
  const url = new URL(`${API_BASE}/foods/search`);
  url.searchParams.set("api_key", cfg.apiKey);

  // `pageNumber` is 1-indexed in USDA FDC. Forwarded from the search
  // route so the food-search UI can scroll through additional pages
  // (TestFlight F-10, `AHnI_fIc7SKbaRcdd5SZB9Q`, 2026-04-19). Pre-existing
  // single-page callers pass no opts and keep the historical page 1 /
  // size 10 behaviour.
  const pageSize = opts?.pageSize && opts.pageSize > 0 ? opts.pageSize : 10;
  const pageNumber = opts?.pageNumber && opts.pageNumber > 0 ? opts.pageNumber : 1;
  const body: Record<string, unknown> = { query, pageSize, pageNumber };
  if (opts?.dataType?.length) {
    body.dataType = opts.dataType;
  }

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "SupprNutritionVerifier/1.0",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`USDA FDC HTTP ${res.status} ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as unknown;
  const foods = (json as { foods?: unknown }).foods;
  if (!Array.isArray(foods)) return [];
  return foods
    .map((f) => f as Partial<FdcFoodSearchHit>)
    .filter((f): f is FdcFoodSearchHit => typeof f.fdcId === "number" && typeof f.description === "string")
    .map((f) => {
      // Extract inline nutrients from search results (per 100g).
      // Match by nutrientNumber (stable across data types) OR nutrientName (fallback).
      // Numbers: 1008/208 = Energy(kcal), 2047/2048 = Energy(kJ), 203 = Protein, 204 = Fat, 205 = Carbs
      const nutrients = (f as any).foodNutrients as {
        nutrientName?: string; value?: number; unitName?: string;
        nutrientNumber?: string | number; nutrientId?: number;
      }[] | undefined;
      let calories: number | undefined;
      let protein: number | undefined;
      let fat: number | undefined;
      let carbs: number | undefined;
      if (Array.isArray(nutrients)) {
        for (const n of nutrients) {
          const name = (n.nutrientName ?? "").toLowerCase();
          const val = n.value ?? 0;
          const unit = (n.unitName ?? "").toLowerCase();
          const num = String(n.nutrientNumber ?? n.nutrientId ?? "");

          if (num === "1008" || num === "208" || (name === "energy" && unit === "kcal")) {
            calories = Math.round(val);
          } else if ((num === "2047" || num === "2048" || (name === "energy" && unit === "kj")) && calories == null) {
            calories = Math.round(val / 4.184);
          } else if (num === "203" || name === "protein") {
            protein = Math.round(val * 10) / 10;
          } else if (num === "204" || name.includes("total lipid") || name === "fat") {
            fat = Math.round(val * 10) / 10;
          } else if (num === "205" || name.includes("carbohydrate")) {
            carbs = Math.round(val * 10) / 10;
          }
        }
      }
      // Branded-food per-serving fields (TestFlight `APo0qS9vcFvmBJEJJ_-61YA`,
      // 2026-04-19). Present on Branded hits; absent on Foundation /
      // SR Legacy / Survey where `foodPortions[]` is the equivalent.
      const rawServingSize = (f as any).servingSize;
      const servingSize = typeof rawServingSize === "number" && rawServingSize > 0
        ? rawServingSize
        : undefined;
      const rawServingUnit = (f as any).servingSizeUnit;
      const servingSizeUnit = typeof rawServingUnit === "string" && rawServingUnit.trim()
        ? rawServingUnit.trim()
        : undefined;
      const rawHousehold = (f as any).householdServingFullText;
      const householdServingFullText = typeof rawHousehold === "string" && rawHousehold.trim()
        ? rawHousehold.trim()
        : undefined;
      // `foodPortions[]` — narrow to the fields the display helper needs.
      const rawPortions = (f as any).foodPortions;
      const foodPortions = Array.isArray(rawPortions)
        ? rawPortions
            .map((p: any) => {
              const gramWeight = typeof p?.gramWeight === "number" && p.gramWeight > 0
                ? p.gramWeight : undefined;
              if (gramWeight == null) return null;
              const out: NonNullable<FdcFoodSearchHit["foodPortions"]>[number] = { gramWeight };
              if (typeof p?.amount === "number" && p.amount > 0) out.amount = p.amount;
              if (typeof p?.modifier === "string" && p.modifier.trim()) out.modifier = p.modifier.trim();
              if (typeof p?.portionDescription === "string" && p.portionDescription.trim()) {
                out.portionDescription = p.portionDescription.trim();
              }
              if (p?.measureUnit && typeof p.measureUnit === "object") {
                const mu: { name?: string; abbreviation?: string } = {};
                if (typeof p.measureUnit.name === "string") mu.name = p.measureUnit.name;
                if (typeof p.measureUnit.abbreviation === "string") mu.abbreviation = p.measureUnit.abbreviation;
                if (mu.name || mu.abbreviation) out.measureUnit = mu;
              }
              return out;
            })
            .filter(Boolean) as NonNullable<FdcFoodSearchHit["foodPortions"]>
        : undefined;

      return {
        fdcId: f.fdcId,
        description: f.description,
        dataType: typeof f.dataType === "string" ? f.dataType : undefined,
        brandName: typeof f.brandName === "string" ? f.brandName : undefined,
        score: typeof f.score === "number" ? f.score : undefined,
        calories,
        protein,
        fat,
        carbs,
        ...(servingSize != null ? { servingSize } : {}),
        ...(servingSizeUnit != null ? { servingSizeUnit } : {}),
        ...(householdServingFullText != null ? { householdServingFullText } : {}),
        ...(foodPortions && foodPortions.length > 0 ? { foodPortions } : {}),
      };
    });
}

export async function fdcFoodGet(cfg: FdcConfig, fdcId: number): Promise<FdcFood | null> {
  const url = new URL(`${API_BASE}/food/${fdcId}`);
  url.searchParams.set("api_key", cfg.apiKey);
  // Request full nutrient set (we'll pick what we need).
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json", "User-Agent": "SupprNutritionVerifier/1.0" },
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`USDA FDC HTTP ${res.status} ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as unknown;
  if (typeof json !== "object" || json === null) return null;
  const f = json as Partial<FdcFood>;
  if (typeof f.fdcId !== "number" || typeof f.description !== "string") return null;
  return {
    fdcId: f.fdcId,
    description: f.description,
    dataType: typeof f.dataType === "string" ? f.dataType : undefined,
    foodNutrients: Array.isArray(f.foodNutrients) ? (f.foodNutrients as FdcNutrient[]) : undefined,
    foodPortions: Array.isArray((f as any).foodPortions) ? ((f as any).foodPortions as FdcFoodPortion[]) : undefined,
  };
}

