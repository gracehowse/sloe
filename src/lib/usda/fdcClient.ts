type FdcConfig = {
  apiKey: string;
};

export type FdcFoodSearchHit = {
  fdcId: number;
  description: string;
  dataType?: string;
  brandName?: string;
  score?: number;
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
  opts?: { dataType?: string[] },
): Promise<FdcFoodSearchHit[]> {
  const url = new URL(`${API_BASE}/foods/search`);
  url.searchParams.set("api_key", cfg.apiKey);

  const body: Record<string, unknown> = { query, pageSize: 25 };
  if (opts?.dataType?.length) {
    body.dataType = opts.dataType;
  }

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "PlatemateNutritionVerifier/1.0",
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
    .map((f) => ({
      fdcId: f.fdcId,
      description: f.description,
      dataType: typeof f.dataType === "string" ? f.dataType : undefined,
      brandName: typeof f.brandName === "string" ? f.brandName : undefined,
      score: typeof f.score === "number" ? f.score : undefined,
    }));
}

export async function fdcFoodGet(cfg: FdcConfig, fdcId: number): Promise<FdcFood | null> {
  const url = new URL(`${API_BASE}/food/${fdcId}`);
  url.searchParams.set("api_key", cfg.apiKey);
  // Request full nutrient set (we’ll pick what we need).
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json", "User-Agent": "PlatemateNutritionVerifier/1.0" },
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

