import OAuth from "oauth-1.0a";
import crypto from "node:crypto";

type FatSecretConfig = {
  consumerKey: string;
  consumerSecret: string;
};

type FatSecretFoodSearchResult = {
  food_id: string;
  food_name: string;
  brand_name?: string;
  food_description?: string;
};

export type FatSecretServing = {
  serving_description?: string;
  metric_serving_amount?: string;
  metric_serving_unit?: string;
  number_of_units?: string;
  measurement_description?: string;
  calories?: string;
  protein?: string;
  carbohydrate?: string;
  fat?: string;
  fiber?: string;
  sugar?: string;
  sodium?: string;
};

export type FatSecretFood = {
  food_id: string;
  food_name: string;
  servings: { serving: FatSecretServing | FatSecretServing[] } | undefined;
};

const API_BASE = "https://platform.fatsecret.com/rest/server.api";
const OAUTH2_TOKEN_URL = "https://oauth.fatsecret.com/connect/token";

let oauth2Cache: { token: string; expiresAtMs: number } | null = null;

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

export function fatSecretConfigFromEnv(): FatSecretConfig {
  return {
    consumerKey: requiredEnv("FATSECRET_CONSUMER_KEY"),
    consumerSecret: requiredEnv("FATSECRET_CONSUMER_SECRET"),
  };
}

function oauthClient(cfg: FatSecretConfig) {
  return new OAuth({
    consumer: { key: cfg.consumerKey, secret: cfg.consumerSecret },
    signature_method: "HMAC-SHA1",
    hash_function(base, key) {
      return crypto.createHmac("sha1", key).update(base).digest("base64");
    },
  });
}

async function getOAuth2Token(cfg: FatSecretConfig): Promise<string | null> {
  const now = Date.now();
  if (oauth2Cache && oauth2Cache.expiresAtMs - now > 30_000) return oauth2Cache.token;

  // If the provided credentials are OAuth2 client_id/client_secret, this will succeed.
  // If they are legacy OAuth1 keys, this will fail and we fall back to OAuth1 signing.
  const basic = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString("base64");
  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("scope", "basic");

  const res = await fetch(OAUTH2_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": "PlatemateNutritionVerifier/1.0",
    },
    body,
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as unknown;
  if (typeof json !== "object" || json === null) return null;
  const token = (json as Record<string, unknown>).access_token;
  const expiresIn = (json as Record<string, unknown>).expires_in;
  if (typeof token !== "string" || !token) return null;
  const expSec = typeof expiresIn === "number" ? expiresIn : Number.parseInt(String(expiresIn ?? "0"), 10);
  const expiresAtMs = now + (Number.isFinite(expSec) && expSec > 0 ? expSec * 1000 : 10 * 60 * 1000);
  oauth2Cache = { token, expiresAtMs };
  return token;
}

async function fatSecretGet<T>(cfg: FatSecretConfig, params: Record<string, string>): Promise<T> {
  const oauth2 = await getOAuth2Token(cfg);
  if (oauth2) {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) body.set(k, v);
    body.set("format", params.format ?? "json");
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${oauth2}`,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "PlatemateNutritionVerifier/1.0",
      },
      body,
      cache: "no-store",
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`FatSecret HTTP ${res.status} ${txt.slice(0, 200)}`);
    }
    const json = (await res.json()) as unknown;
    if (typeof json === "object" && json !== null && "error" in json) {
      const err = (json as { error?: unknown }).error;
      const msg =
        typeof err === "object" && err !== null
          ? String((err as Record<string, unknown>).message ?? "FatSecret error")
          : "FatSecret error";
      const code =
        typeof err === "object" && err !== null ? String((err as Record<string, unknown>).code ?? "") : "";
      throw new Error(`FatSecret ${code ? `(${code}) ` : ""}${msg}`);
    }
    return json as T;
  }

  const oauth = oauthClient(cfg);
  // FatSecret OAuth1 signatures are most reliable via form-encoded POST.
  const authData = oauth.authorize({ url: API_BASE, method: "POST", data: params });
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) body.set(k, v);
  for (const [k, v] of Object.entries(authData)) {
    if (v == null) continue;
    body.set(k, String(v));
  }

  const res = await fetch(API_BASE, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "PlatemateNutritionVerifier/1.0",
    },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`FatSecret HTTP ${res.status} ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as unknown;
  if (typeof json === "object" && json !== null && "error" in json) {
    const err = (json as { error?: unknown }).error;
    const msg =
      typeof err === "object" && err !== null
        ? String((err as Record<string, unknown>).message ?? "FatSecret error")
        : "FatSecret error";
    const code =
      typeof err === "object" && err !== null ? String((err as Record<string, unknown>).code ?? "") : "";
    throw new Error(`FatSecret ${code ? `(${code}) ` : ""}${msg}`);
  }
  return json as T;
}

export async function fatSecretFoodSearch(cfg: FatSecretConfig, query: string): Promise<FatSecretFoodSearchResult[]> {
  const data = await fatSecretGet<{
    foods?: { food?: FatSecretFoodSearchResult[] | FatSecretFoodSearchResult };
  }>(cfg, {
    method: "foods.search",
    format: "json",
    search_expression: query,
    max_results: "10",
  });
  const f = data.foods?.food;
  if (!f) return [];
  return Array.isArray(f) ? f : [f];
}

export async function fatSecretFoodGet(cfg: FatSecretConfig, foodId: string): Promise<FatSecretFood | null> {
  const data = await fatSecretGet<{ food?: FatSecretFood }>(cfg, {
    method: "food.get",
    format: "json",
    food_id: foodId,
  });
  return data.food ?? null;
}

