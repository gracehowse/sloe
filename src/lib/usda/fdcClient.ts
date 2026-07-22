/**
 * USDA FoodData Central (FDC) API client.
 *
 * Rate limits (re-verified ENG-1412, 2026-07-22 — https://fdc.nal.usda.gov/api-guide):
 *   - Registered api.data.gov key: 1,000 requests / hour / IP (HTTP 429 + 1h block
 *     when exceeded; `X-RateLimit-Limit` / `X-RateLimit-Remaining` on responses).
 *   - DEMO_KEY (dev only): 30 requests / hour / IP.
 *
 * Env: `USDA_FDC_API_KEY`
 */
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

/**
 * F-87 (2026-04-25) — generic-name searches (e.g. "eggs") were dominated
 * by USDA Branded rows because USDA's default scoring boosts exact-name
 * matches against branded products. The result: a misnamed branded product
 * called "EGGS" (525 kcal / 100g, a baked/glazed product) outranked the
 * verified Foundation row "Eggs, Grade A, Large, egg whole" (~143 kcal /
 * 100g), and the tester saw "1 egg 40g · 210 kcal" — physically impossible.
 *
 * Two-stage fetch: pull verified rows first (Foundation / SR Legacy /
 * Survey (FNDDS)), then top up with branded for queries where users want
 * a brand ("Cheerios", "Lay's"). Verified rows always lead the merged list.
 *
 * If the caller passes an explicit `dataType` filter we honour it and
 * skip the two-stage path (used by audit / verify-ingredient flows that
 * deliberately scope to one corpus).
 */
const VERIFIED_DATA_TYPES = ["Foundation", "SR Legacy", "Survey (FNDDS)"];

async function fdcFetchSingle(
  cfg: FdcConfig,
  body: Record<string, unknown>,
): Promise<unknown[]> {
  const url = new URL(`${API_BASE}/foods/search`);
  url.searchParams.set("api_key", cfg.apiKey);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "SupprNutritionVerifier/1.0",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`USDA FDC HTTP ${res.status} ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as unknown;
  const foods = (json as { foods?: unknown }).foods;
  return Array.isArray(foods) ? foods : [];
}

export async function fdcFoodsSearch(
  cfg: FdcConfig,
  query: string,
  opts?: { dataType?: string[]; pageNumber?: number; pageSize?: number },
): Promise<FdcFoodSearchHit[]> {
  // `pageNumber` is 1-indexed in USDA FDC. Forwarded from the search
  // route so the food-search UI can scroll through additional pages
  // (TestFlight F-10, `AHnI_fIc7SKbaRcdd5SZB9Q`, 2026-04-19). Pre-existing
  // single-page callers pass no opts and keep the historical page 1 /
  // size 10 behaviour.
  const pageSize = opts?.pageSize && opts.pageSize > 0 ? opts.pageSize : 10;
  const pageNumber = opts?.pageNumber && opts.pageNumber > 0 ? opts.pageNumber : 1;

  // F-87 — explicit dataType from caller bypasses the two-stage path.
  let foods: unknown[];
  if (opts?.dataType?.length) {
    foods = await fdcFetchSingle(cfg, {
      query,
      pageSize,
      pageNumber,
      dataType: opts.dataType,
    });
  } else {
    // Two-stage fetch on page 1 only — page 2+ is branded long-tail.
    if (pageNumber === 1) {
      const verifiedSlice = Math.max(3, Math.floor(pageSize * 0.6));
      const brandedSlice = Math.max(2, pageSize - verifiedSlice);
      const [verified, branded] = await Promise.all([
        fdcFetchSingle(cfg, {
          query,
          pageSize: verifiedSlice,
          pageNumber: 1,
          dataType: VERIFIED_DATA_TYPES,
        }),
        fdcFetchSingle(cfg, {
          query,
          pageSize: brandedSlice,
          pageNumber: 1,
        }),
      ]);
      // Drop branded rows that already appeared in the verified slice
      // (USDA returns the same row across both queries when it matches).
      const seenIds = new Set(
        verified
          .map((f: any) => (typeof f?.fdcId === "number" ? f.fdcId : null))
          .filter((id): id is number => id != null),
      );
      const dedupedBranded = branded.filter((f: any) => {
        const id = typeof f?.fdcId === "number" ? f.fdcId : null;
        return id == null || !seenIds.has(id);
      });
      foods = [...verified, ...dedupedBranded];
    } else {
      foods = await fdcFetchSingle(cfg, { query, pageSize, pageNumber });
    }
  }
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
    signal: AbortSignal.timeout(5_000),
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

