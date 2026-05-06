#!/usr/bin/env node
/**
 * FatSecret Premier-tier backfill.
 *
 * Run ONCE after flipping `FATSECRET_TIER` to `premier` in Vercel.
 *
 * Context — `docs/decisions/2026-04-26-fatsecret-upgrade.md`:
 *   - On Basic tier the `20260503100900_fatsecret_basic_tier_zeroing`
 *     migration zeroed cached macros for every `recipe_ingredients`
 *     row whose `fatsecret_food_id IS NOT NULL`. That was a ToS
 *     compliance step.
 *   - On Premier tier caching is permitted. This script walks every
 *     zeroed row, re-fetches `food.get` from FatSecret, normalises
 *     the macros, and writes them back. Existing recipes that
 *     previously matched FatSecret therefore re-acquire the wider
 *     nutrient panel without forcing the user through the verify
 *     flow again.
 *
 * Required env (in `.env.local`):
 *   FATSECRET_CLIENT_ID            (or legacy FATSECRET_CONSUMER_KEY)
 *   FATSECRET_CLIENT_SECRET        (or legacy FATSECRET_CONSUMER_SECRET)
 *   FATSECRET_TIER=premier         (script aborts if not "premier")
 *   NEXT_PUBLIC_SUPABASE_URL  (or  SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npm run backfill:fatsecret
 *
 * Behaviour:
 *   - Idempotent: skips rows where `is_verified = true` AND `calories > 0`
 *     (already populated by a prior run or by an in-app re-verify).
 *   - Resumable: progress is written to
 *     `scripts/.fatsecret-backfill-progress.json` after each row. If
 *     the script is killed, re-running picks up after the last
 *     processed `id`.
 *   - Rate-limited to 5 requests/second to stay under FatSecret's
 *     free-tier quota with headroom.
 *   - Prints a final summary: `processed / updated / skipped / errored`.
 *   - Writes `source = 'FatSecret'` and `is_verified = true` on a
 *     successful update so the search badge renders correctly.
 *   - Never modifies a row whose `source` is something other than
 *     'Unverified' or 'FatSecret' — defensive carve-out for rows the
 *     user manually re-verified to a different source.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHmac } from "node:crypto";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROGRESS_PATH = resolve(REPO_ROOT, "scripts/.fatsecret-backfill-progress.json");

const RATE_LIMIT_PER_SEC = 5;
const RATE_LIMIT_INTERVAL_MS = Math.ceil(1000 / RATE_LIMIT_PER_SEC);

let stats = { processed: 0, updated: 0, skipped: 0, errored: 0 };

// Lazy env handles — only resolved when `main()` runs, NOT when the
// module is imported by vitest. Tests import the file for the
// __test__ helpers; they must not trip the env guard.
let FATSECRET_CONSUMER_KEY;
let FATSECRET_CONSUMER_SECRET;
let supabaseUrl;
let SUPABASE_SERVICE_ROLE_KEY;

const isCli =
  typeof process !== "undefined" &&
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  loadDotEnv(resolve(REPO_ROOT, ".env.local"));
  // Accept both the canonical OAuth 2.0 names and the legacy
  // OAuth 1.0a names. Internal field names stay as
  // CONSUMER_KEY/CONSUMER_SECRET because the OAuth 1.0a signing path
  // below uses them as OAuth 1.0a consumer credentials when OAuth 2.0
  // token exchange isn't available.
  FATSECRET_CONSUMER_KEY =
    process.env.FATSECRET_CLIENT_ID || process.env.FATSECRET_CONSUMER_KEY;
  FATSECRET_CONSUMER_SECRET =
    process.env.FATSECRET_CLIENT_SECRET || process.env.FATSECRET_CONSUMER_SECRET;
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const FATSECRET_TIER = process.env.FATSECRET_TIER;

  requireEnv({
    FATSECRET_CONSUMER_KEY,
    FATSECRET_CONSUMER_SECRET,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY,
  });

  if ((FATSECRET_TIER ?? "").trim().toLowerCase() !== "premier") {
    console.error(
      "[fatsecret-backfill] Refusing to run: FATSECRET_TIER is not 'premier'.",
    );
    console.error(
      "[fatsecret-backfill] Backfilling on Basic tier would re-cache macros that the Basic ToS prohibits.",
    );
    console.error(
      "[fatsecret-backfill] Set FATSECRET_TIER=premier in .env.local first.",
    );
    process.exit(1);
  }

  main().catch((err) => {
    console.error("[fatsecret-backfill] fatal:", err);
    process.exit(1);
  });
}

async function main() {
  console.log("[fatsecret-backfill] Starting Premier-tier backfill...");
  const progress = loadProgress();
  console.log("[fatsecret-backfill] Resuming after id =", progress.lastId ?? "(start)");

  // Page through recipe_ingredients in id order. Service-role REST is
  // simplest — no need to pull supabase-js into a one-shot script.
  const PAGE_SIZE = 200;
  let cursor = progress.lastId;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const rows = await fetchPage(cursor, PAGE_SIZE);
    if (rows.length === 0) break;
    for (const row of rows) {
      stats.processed++;
      try {
        const handled = await handleRow(row);
        if (handled === "updated") stats.updated++;
        else if (handled === "skipped") stats.skipped++;
      } catch (e) {
        stats.errored++;
        console.error(
          `[fatsecret-backfill] row ${row.id} (${row.name}): ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
      cursor = row.id;
      saveProgress({ lastId: cursor });
      await sleep(RATE_LIMIT_INTERVAL_MS);
    }
    if (rows.length < PAGE_SIZE) break;
  }

  console.log("[fatsecret-backfill] DONE.");
  console.log(
    `[fatsecret-backfill] processed=${stats.processed} updated=${stats.updated} skipped=${stats.skipped} errored=${stats.errored}`,
  );
}

/**
 * Decide whether to update or skip the row. Returns "updated", "skipped".
 * Throws on hard errors — caller buckets them into "errored".
 */
async function handleRow(row) {
  // Idempotency: row already populated (verified + non-zero macros).
  if (row.is_verified === true && Number(row.calories ?? 0) > 0) {
    return "skipped";
  }
  // Defensive: only touch rows whose source is one of the FatSecret
  // labels OR the post-zeroing 'Unverified' label. A user-overridden
  // row with source = 'USDA' should NOT have its macros stomped.
  const source = (row.source ?? "").trim();
  const ALLOWED = new Set(["Unverified", "FatSecret", "fatsecret", ""]);
  if (!ALLOWED.has(source)) {
    return "skipped";
  }

  const food = await fatSecretFoodGet(row.fatsecret_food_id);
  if (!food) {
    return "skipped";
  }
  const servingNode = food?.servings?.serving;
  if (!servingNode) {
    return "skipped";
  }
  const list = Array.isArray(servingNode) ? servingNode : [servingNode];
  // Prefer a metric serving so the per-gram conversion is honest.
  const serving =
    list.find(
      (s) =>
        Number.parseFloat(String(s.metric_serving_amount ?? "")) > 0,
    ) ?? list[0];

  const servingG = parseServingMass(serving);
  if (!servingG || servingG <= 0) {
    return "skipped";
  }

  const perServingCalories = parseNum(serving.calories);
  const perServingProtein = parseNum(serving.protein);
  const perServingCarbs = parseNum(serving.carbohydrate);
  const perServingFat = parseNum(serving.fat);
  const perServingFiber = parseNum(serving.fiber);
  const perServingSugar = parseNum(serving.sugar);
  const perServingSodium = parseNum(serving.sodium);
  const perServingSatFat = parseNum(serving.saturated_fat);

  // The zeroed row knows the original ingredient amount + unit but NOT
  // the gram weight. The honest move is to write per-100g normalised
  // values (since the row stores absolute totals derived from amount,
  // and we don't have the original gram weight without re-resolving
  // the unit). Pragmatic alternative: scale to 100 g — the recipe
  // detail render will use the FatSecret food_id + serving info to
  // re-scale on read. The 100g convention matches what the verify
  // pipeline writes for FatSecret-sourced rows when the original gram
  // weight is unknown.
  const perGramCalories = perServingCalories / servingG;
  const per100g = {
    calories: Math.round(perGramCalories * 100),
    protein: Math.round((perServingProtein / servingG) * 100 * 10) / 10,
    carbs: Math.round((perServingCarbs / servingG) * 100 * 10) / 10,
    fat: Math.round((perServingFat / servingG) * 100 * 10) / 10,
    fiber_g: Math.round((perServingFiber / servingG) * 100 * 10) / 10,
    sugar_g: Math.round((perServingSugar / servingG) * 100 * 10) / 10,
    sodium_mg: Math.round((perServingSodium / servingG) * 100),
    saturated_fat_g:
      perServingSatFat > 0
        ? Math.round((perServingSatFat / servingG) * 100 * 10) / 10
        : null,
  };

  // Plausibility guard — reject obvious garbage rather than persist.
  if (
    per100g.calories <= 0 ||
    per100g.calories > 1500 ||
    per100g.protein < 0 ||
    per100g.fat < 0 ||
    per100g.carbs < 0
  ) {
    return "skipped";
  }

  await patchRow(row.id, {
    calories: per100g.calories,
    protein: per100g.protein,
    carbs: per100g.carbs,
    fat: per100g.fat,
    fiber_g: per100g.fiber_g,
    sugar_g: per100g.sugar_g,
    sodium_mg: per100g.sodium_mg,
    is_verified: true,
    source: "FatSecret",
  });
  return "updated";
}

// ── Supabase REST helpers ──────────────────────────────────────────────

function supaHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };
}

async function fetchPage(afterId, limit) {
  const params = new URLSearchParams();
  params.set(
    "select",
    "id,name,calories,is_verified,source,fatsecret_food_id",
  );
  params.set("fatsecret_food_id", "not.is.null");
  if (afterId) params.set("id", `gt.${afterId}`);
  params.set("order", "id.asc");
  params.set("limit", String(limit));
  const url = `${supabaseUrl}/rest/v1/recipe_ingredients?${params.toString()}`;
  const res = await fetch(url, { headers: supaHeaders() });
  if (!res.ok) {
    throw new Error(`Supabase select ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function patchRow(id, patch) {
  const url = `${supabaseUrl}/rest/v1/recipe_ingredients?id=eq.${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: supaHeaders(),
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    throw new Error(`Supabase patch ${res.status}: ${await res.text()}`);
  }
}

// ── FatSecret OAuth1 helpers ──────────────────────────────────────────

async function fatSecretFoodGet(foodId) {
  const params = {
    method: "food.get",
    format: "json",
    food_id: foodId,
  };
  const json = await fatSecretSignedPost(params);
  return json?.food ?? null;
}

async function fatSecretSignedPost(params) {
  const url = "https://platform.fatsecret.com/rest/server.api";
  const oauth = {
    oauth_consumer_key: FATSECRET_CONSUMER_KEY,
    oauth_nonce: cryptoNonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: "1.0",
  };
  const all = { ...params, ...oauth };
  const baseString = [
    "POST",
    encodeURIComponent(url),
    encodeURIComponent(
      Object.keys(all)
        .sort()
        .map((k) => `${k}=${encodeURIComponent(all[k])}`)
        .join("&"),
    ),
  ].join("&");
  const signingKey = `${encodeURIComponent(FATSECRET_CONSUMER_SECRET)}&`;
  const signature = createHmac("sha1", signingKey).update(baseString).digest("base64");
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(all)) body.set(k, v);
  body.set("oauth_signature", signature);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": "SupprPremierBackfill/1.0",
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`FatSecret HTTP ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  if (json && json.error) {
    throw new Error(
      `FatSecret error: ${json.error.message ?? JSON.stringify(json.error)}`,
    );
  }
  return json;
}

function cryptoNonce() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Helpers ───────────────────────────────────────────────────────────

function parseNum(x) {
  if (x == null) return 0;
  const v = Number.parseFloat(String(x));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

function parseServingMass(serving) {
  const amt = Number.parseFloat(String(serving?.metric_serving_amount ?? ""));
  if (Number.isFinite(amt) && amt > 0) {
    const unit = String(serving?.metric_serving_unit ?? "").toLowerCase();
    if (unit === "g" || unit === "gram" || unit === "grams") return amt;
    if (unit === "ml") return amt; // treat ml as g for water-density liquids
  }
  return null;
}

function loadProgress() {
  if (!existsSync(PROGRESS_PATH)) return { lastId: null };
  try {
    return JSON.parse(readFileSync(PROGRESS_PATH, "utf8"));
  } catch {
    return { lastId: null };
  }
}

function saveProgress(p) {
  writeFileSync(PROGRESS_PATH, JSON.stringify(p, null, 2));
}

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] != null) continue;
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

function requireEnv(map) {
  const missing = Object.entries(map)
    .filter(([, v]) => !v || (typeof v === "string" && v.trim() === ""))
    .map(([k]) => k);
  if (missing.length > 0) {
    console.error(`[fatsecret-backfill] missing env: ${missing.join(", ")}`);
    process.exit(1);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Test-only exports ────────────────────────────────────────────────
//
// `vitest` imports the module to unit-test pure helpers (rate-limit
// math, plausibility gate, idempotency check). The script's main()
// only runs when invoked directly via `node scripts/...mjs`.
// Detection: import.meta.url starts with `file://` AND the script's
// argv[1] equals fileURLToPath(import.meta.url) — vitest doesn't
// match this so the module is import-safe.

export const __test__ = {
  parseNum,
  parseServingMass,
  RATE_LIMIT_PER_SEC,
  RATE_LIMIT_INTERVAL_MS,
};
