import OAuth from "oauth-1.0a";
import crypto from "node:crypto";

/**
 * FatSecret Platform API client.
 *
 * Tiers (2026-04-30 — Premier Free approval):
 *   - "basic"   : foods.search + food.get only. 7 nutrients per food.
 *                 Macro caching prohibited by the Basic-tier ToS.
 *   - "premier" : Premier Free unlocks /foods.autocomplete.v2,
 *                 /food_categories.get, full nutrient panel (32+
 *                 fields), barcode endpoints, and permits caching.
 *
 * The tier is read from `FATSECRET_TIER` (default `"basic"`). Premier-
 * only methods throw {@link FatSecretTierError} when called on Basic so
 * callers can fall back to the Basic-tier search path without leaking
 * a Premier-only failure to the user.
 *
 * See `docs/decisions/2026-04-26-fatsecret-upgrade.md`.
 */

export type FatSecretTier = "basic" | "premier";

export type FatSecretConfig = {
  consumerKey: string;
  consumerSecret: string;
  /** "basic" (default) — foods.search + food.get only.
   *  "premier" — Premier Free unlocks autocomplete, categories,
   *  full nutrient panel, and permits macro caching. */
  tier: FatSecretTier;
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
  /** Premier-tier extended panel (only populated on Premier). */
  saturated_fat?: string;
  polyunsaturated_fat?: string;
  monounsaturated_fat?: string;
  trans_fat?: string;
  cholesterol?: string;
  potassium?: string;
  iron?: string;
  calcium?: string;
  vitamin_a?: string;
  vitamin_c?: string;
  vitamin_d?: string;
};

export type FatSecretFood = {
  food_id: string;
  food_name: string;
  servings: { serving: FatSecretServing | FatSecretServing[] } | undefined;
};

/** Premier-only autocomplete suggestion. */
export type FatSecretAutocompleteSuggestion = {
  /** Suggested completion string. */
  suggestion: string;
};

/** Premier-only food category. */
export type FatSecretFoodCategory = {
  food_category_id: string;
  food_category_name: string;
  food_category_description?: string;
};

const API_BASE = "https://platform.fatsecret.com/rest/server.api";
const OAUTH2_TOKEN_URL = "https://oauth.fatsecret.com/connect/token";

let oauth2Cache: { token: string; expiresAtMs: number } | null = null;
let oauth2Inflight: Promise<string | null> | null = null;

/**
 * Hash a string with SHA-256 and return the hex digest. Used to log a
 * deterministic-but-non-revealing fingerprint of the FatSecret
 * client_id when OAuth 2.0 token requests fail. SHA-256 over a 32-char
 * hex client_id has uniform 64-char hex output; we slice the first 8
 * for log compactness — that's 32 bits of entropy, enough to correlate
 * "is this the rotated key?" without exposing the literal value.
 */
async function sha256Hex(input: string): Promise<string> {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Return the first non-empty env var value out of the provided list.
 * Used to support both the canonical OAuth 2.0 env var names
 * (FATSECRET_CLIENT_ID / FATSECRET_CLIENT_SECRET) and the legacy
 * OAuth 1.0a names (FATSECRET_CONSUMER_KEY / FATSECRET_CONSUMER_SECRET)
 * during the rename rollout.
 */
function firstEnv(...names: string[]): string {
  for (const n of names) {
    const v = process.env[n];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  throw new Error(`Missing env var (none of: ${names.join(", ")})`);
}

/**
 * Read tier from `FATSECRET_TIER`. Unset or unrecognised → "basic"
 * (safe default — Basic-tier callers must keep working when the env
 * var is absent).
 */
export function fatSecretTierFromEnv(): FatSecretTier {
  const raw = (process.env.FATSECRET_TIER ?? "").trim().toLowerCase();
  return raw === "premier" ? "premier" : "basic";
}

export function fatSecretConfigFromEnv(): FatSecretConfig {
  // OAuth 2.0 names take precedence; fall back to the OAuth 1.0a-era
  // names so envs that haven't been renamed yet keep working. Internal
  // config field names stay as `consumerKey`/`consumerSecret` because
  // the OAuth 1.0a fallback path inside this client uses them as
  // OAuth 1.0a consumer credentials when OAuth 2.0 token exchange fails.
  return {
    consumerKey: firstEnv("FATSECRET_CLIENT_ID", "FATSECRET_CONSUMER_KEY"),
    consumerSecret: firstEnv("FATSECRET_CLIENT_SECRET", "FATSECRET_CONSUMER_SECRET"),
    tier: fatSecretTierFromEnv(),
  };
}

/**
 * Thrown when a Premier-only endpoint is invoked on a Basic-tier
 * config. Callers should catch and fall back to the Basic search path.
 */
export class FatSecretTierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FatSecretTierError";
  }
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
  if (oauth2Inflight) return oauth2Inflight;

  oauth2Inflight = fetchOAuth2Token(cfg, now).finally(() => {
    oauth2Inflight = null;
  });
  return oauth2Inflight;
}

async function fetchOAuth2Token(cfg: FatSecretConfig, now: number): Promise<string | null> {
  // If the provided credentials are OAuth2 client_id/client_secret, this will succeed.
  // If they are legacy OAuth1 keys, this will fail and we fall back to OAuth1 signing.
  const basic = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString("base64");
  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  // Premier scope unlocks autocomplete + categories. Basic falls back to
  // the "basic" scope. FatSecret accepts a multi-scope string for
  // Premier accounts — when we ask for a scope the account doesn't have
  // it errors at request time (not token time), so requesting "premier"
  // on a Basic account would still issue a token but every Premier
  // endpoint call would 401. The tier flag prevents that round trip.
  body.set("scope", cfg.tier === "premier" ? "basic premier" : "basic");

  const res = await fetch(OAUTH2_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": "SupprNutritionVerifier/1.0",
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) {
    // 2026-05-06 — surface the failure mode so production logs say
    // *why* we fell through to OAuth 1.0a signing (which then fails
    // with "Invalid consumer key" because the OAuth 2.0 client
    // secret is not a valid OAuth 1.0a consumer secret).
    //   401 / invalid_client → credentials wrong in this env
    //   403 / forbidden      → likely IP allowlist on token endpoint
    //   429                  → token endpoint rate limit
    //
    // 2026-05-06 audit (B1, B2): credential-safety hardening.
    //   - log a SHA-256 hash prefix of the client_id, not the
    //     literal tail. Hash is deterministic across runs (lets us
    //     correlate logs to "yes, this is the rotated key") but
    //     reveals zero substring of the secret prefix.
    //   - parse the response body for known OAuth-error fields
    //     (`error`, `error_description`) instead of dumping raw
    //     text. FatSecret normally returns
    //     `{"error":"invalid_client"}` — known JSON shape — but
    //     belt-and-braces against a future server change that might
    //     echo the request (some OAuth providers do this on
    //     `invalid_grant`, which would surface the base64
    //     `client_id:client_secret` from the Authorization header).
    let bodyForLog = "";
    try {
      const txt = await res.text();
      try {
        const j = JSON.parse(txt) as Record<string, unknown>;
        const errCode = typeof j.error === "string" ? j.error : "";
        const errDesc = typeof j.error_description === "string" ? j.error_description : "";
        bodyForLog = `error=${errCode}${errDesc ? ` desc=${errDesc.slice(0, 80)}` : ""}`;
      } catch {
        // Non-JSON response — emit length only, not contents.
        bodyForLog = `non_json len=${txt.length}`;
      }
    } catch {
      bodyForLog = "body_read_failed";
    }
    const keyHash = await sha256Hex(cfg.consumerKey ?? "");
    console.warn(
      `[fatsecret oauth2] token request failed — status=${res.status} key_hash=${keyHash.slice(0, 8)} ${bodyForLog}`,
    );
    return null;
  }
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
        "User-Agent": "SupprNutritionVerifier/1.0",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
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
      "User-Agent": "SupprNutritionVerifier/1.0",
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
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

export async function fatSecretFoodSearch(
  cfg: FatSecretConfig,
  query: string,
  opts?: { maxResults?: number; pageNumber?: number },
): Promise<FatSecretFoodSearchResult[]> {
  // Defaults preserve historical behaviour for `verifyIngredients` callers
  // (10 results, page 1). The food-search merge pipeline overrides both —
  // see `app/api/fatsecret/search/route.ts`.
  const max = Math.max(1, Math.min(50, opts?.maxResults ?? 10));
  const page = Math.max(0, Math.floor(opts?.pageNumber ?? 0));
  const params: Record<string, string> = {
    method: "foods.search",
    format: "json",
    search_expression: query,
    max_results: String(max),
  };
  if (page > 0) params.page_number = String(page);
  const data = await fatSecretGet<{
    foods?: {
      food?: FatSecretFoodSearchResult[] | FatSecretFoodSearchResult;
      total_results?: string;
      max_results?: string;
      page_number?: string;
    };
  }>(cfg, params);
  const f = data.foods?.food;
  if (!f) {
    // 2026-05-06: log when FatSecret returns success but no food
    // entries — distinguishes "FatSecret rejected the request silently"
    // (no `foods` key at all) from "FatSecret returned 0 matches"
    // (foods.total_results === "0"). Vercel's rotating egress IPs may
    // hit FatSecret's data-endpoint allowlist while the token endpoint
    // remains open; a missing `foods` key would point at that.
    const shape =
      data.foods === undefined
        ? "no_foods_key"
        : `total_results=${data.foods.total_results ?? "?"}`;
    console.warn(
      `[fatsecret foods.search] no food entries — query="${query.slice(0, 40)}" shape=${shape}`,
    );
    return [];
  }
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

/**
 * Premier-only typeahead suggestion endpoint. Returns a ranked list of
 * suggestion strings — much faster + lighter than the full
 * `foods.search` payload, suitable for keypress-driven UX.
 *
 * Throws {@link FatSecretTierError} on Basic tier so the caller can
 * fall back to `fatSecretFoodSearch` without showing a user-facing
 * failure.
 *
 * Spec: https://platform.fatsecret.com/api/Default.aspx?api=foods.autocomplete.v2
 */
export async function fatSecretFoodsAutocomplete(
  cfg: FatSecretConfig,
  query: string,
  opts?: { maxResults?: number },
): Promise<FatSecretAutocompleteSuggestion[]> {
  if (cfg.tier !== "premier") {
    throw new FatSecretTierError(
      "fatSecretFoodsAutocomplete requires Premier tier (FATSECRET_TIER=premier).",
    );
  }
  const q = query.trim();
  if (!q) return [];
  const max = Math.max(1, Math.min(10, opts?.maxResults ?? 4));
  const data = await fatSecretGet<{
    suggestions?: { suggestion?: string[] | string };
  }>(cfg, {
    method: "foods.autocomplete.v2",
    format: "json",
    expression: q,
    max_results: String(max),
  });
  const raw = data.suggestions?.suggestion;
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.filter((s): s is string => typeof s === "string" && s.length > 0).map((suggestion) => ({ suggestion }));
}

/**
 * Premier-only food categories endpoint. Useful for filter-chip UI
 * (e.g. "Cereal", "Beverages"). Throws {@link FatSecretTierError} on
 * Basic.
 *
 * Spec: https://platform.fatsecret.com/api/Default.aspx?api=food_categories.get
 */
export async function fatSecretFoodCategoriesGet(
  cfg: FatSecretConfig,
): Promise<FatSecretFoodCategory[]> {
  if (cfg.tier !== "premier") {
    throw new FatSecretTierError(
      "fatSecretFoodCategoriesGet requires Premier tier (FATSECRET_TIER=premier).",
    );
  }
  const data = await fatSecretGet<{
    food_categories?: { food_category?: FatSecretFoodCategory[] | FatSecretFoodCategory };
  }>(cfg, {
    method: "food_categories.get",
    format: "json",
  });
  const raw = data.food_categories?.food_category;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

/**
 * Test-only hook — clears the OAuth2 token cache so unit tests can
 * verify scope-string + tier flag behaviour without leaking state
 * across cases. Not exported in production type-flows but available
 * for `vi.spyOn`-style overrides via the named export.
 */
export function __resetFatSecretOAuth2CacheForTests(): void {
  oauth2Cache = null;
  oauth2Inflight = null;
}
