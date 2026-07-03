/**
 * ENG-1326 — sample OFF `last_modified_t` for Suppr-shaped queries and emit
 * percentile stats used to derive the staleness confidence penalty curve.
 *
 * Usage: node scripts/analyze-off-staleness-corpus.mjs
 * Output: docs/testing/off-staleness-corpus-YYYY-MM-DD.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { loadRepoEnvLocal, REPO_ROOT } from "./load-repo-env-local.mjs";

/** Ingredient + branded queries that mirror verify/search traffic. */
const CORPUS_QUERIES = [
  "chicken breast",
  "olive oil",
  "plain flour",
  "caster sugar",
  "greek yogurt",
  "cheddar cheese",
  "tinned tomatoes",
  "coconut milk",
  "soy sauce",
  "butter",
  "oats",
  "banana",
  "avocado",
  "hummus",
  "tesco chicken",
  "sainsbury hummus",
  "heinz baked beans",
  "weetabix",
  "nutella",
  "coca cola",
  "digestive biscuits",
  "whole milk",
  "brown rice",
  "salmon fillet",
  "black pepper",
  "garlic",
  "onion",
  "courgette",
  "aubergine",
  "za'atar",
];

const PAGE_SIZE = 5;
const QUERY_DELAY_MS = 300;
const MAX_RETRIES = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(fn) {
  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      await sleep(QUERY_DELAY_MS * (attempt + 1));
    }
  }
  throw lastErr;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

async function searchOffRaw(query) {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: String(PAGE_SIZE),
    page: "1",
    fields: "code,product_name,brands,last_modified_t",
  });
  const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "SupprOffStalenessCorpus/1.0 (ENG-1326)",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`OFF search HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.products) ? data.products : [];
}

async function searchOffV2Tail(query) {
  const params = new URLSearchParams({
    fields: "code,product_name,brands,last_modified_t",
    page_size: String(PAGE_SIZE),
    page: "1",
    sort_by: "last_modified_t",
    search_terms: query,
  });
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/search?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "SupprOffStalenessCorpus/1.0 (ENG-1326)",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.products) ? data.products : [];
}

async function loadProductionOffCodes() {
  loadRepoEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { codes: [], note: "no_supabase_service_role" };
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const codes = new Set();
  const { data: ingredients } = await sb
    .from("recipe_ingredients")
    .select("fatsecret_food_id")
    .eq("source", "OFF")
    .not("fatsecret_food_id", "is", null)
    .limit(500);
  for (const row of ingredients ?? []) {
    if (row.fatsecret_food_id) codes.add(String(row.fatsecret_food_id));
  }
  const { data: barcodes } = await sb
    .from("barcode_mappings")
    .select("barcode, external_id")
    .eq("source", "OpenFoodFacts")
    .limit(500);
  for (const row of barcodes ?? []) {
    if (row.external_id) codes.add(String(row.external_id));
    else if (row.barcode) codes.add(String(row.barcode));
  }
  return { codes: [...codes], note: "supabase_sample" };
}

async function fetchOffProductByCode(code) {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=code,product_name,brands,last_modified_t`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "SupprOffStalenessCorpus/1.0 (ENG-1326)",
      },
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  return data.product;
}

function deriveCurve(ageDaysSorted, nowIso) {
  const p75 = percentile(ageDaysSorted, 0.75);
  const p95 = percentile(ageDaysSorted, 0.95);
  const msPerDay = 24 * 60 * 60 * 1000;

  const penaltyStartDays = Math.round(p75 ?? 365);
  const penaltyFullDays = Math.round(Math.max(penaltyStartDays + 30, p95 ?? 3 * 365));

  return {
    analyzedAt: nowIso,
    percentilesDays: {
      p50: percentile(ageDaysSorted, 0.5),
      p75,
      p90: percentile(ageDaysSorted, 0.9),
      p95,
      p99: percentile(ageDaysSorted, 0.99),
      max: ageDaysSorted.length ? ageDaysSorted[ageDaysSorted.length - 1] : null,
    },
    recommended: {
      penaltyStartMs: penaltyStartDays * msPerDay,
      penaltyFullMs: penaltyFullDays * msPerDay,
      maxPenalty: 0.08,
      rationale:
        "Linear confidence downgrade from 0 at P75 age to maxPenalty at P95+ age; missing last_modified_t → 0 penalty.",
    },
  };
}

function pushSample(samples, seen, row) {
  if (row.code && seen.has(row.code)) return;
  if (row.code) seen.add(row.code);
  samples.push(row);
}

async function main() {
  const prod = await loadProductionOffCodes();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const samples = [];
  const errors = [];
  const seen = new Set();

  for (const query of CORPUS_QUERIES) {
    try {
      const [primary, tail] = await Promise.all([
        fetchWithRetry(() => searchOffRaw(query)),
        fetchWithRetry(() => searchOffV2Tail(query)).catch(() => []),
      ]);
      for (const p of [...primary, ...tail]) {
        const lastModifiedT =
          typeof p.last_modified_t === "number" && Number.isFinite(p.last_modified_t)
            ? p.last_modified_t
            : null;
        const ageMs = lastModifiedT ? now - lastModifiedT * 1000 : null;
        pushSample(samples, seen, {
          query,
          code: p.code ?? null,
          name: p.product_name ?? null,
          brand: (p.brands ?? "").split(",")[0]?.trim() || null,
          lastModifiedT,
          ageDays: ageMs != null ? ageMs / (24 * 60 * 60 * 1000) : null,
        });
      }
    } catch (e) {
      errors.push({ query, error: e instanceof Error ? e.message : String(e) });
    }
    await sleep(QUERY_DELAY_MS);
  }

  for (const code of prod.codes.slice(0, 80)) {
    try {
      const p = await fetchWithRetry(() => fetchOffProductByCode(code));
      if (!p) continue;
      const lastModifiedT =
        typeof p.last_modified_t === "number" && Number.isFinite(p.last_modified_t)
          ? p.last_modified_t
          : null;
      const ageMs = lastModifiedT ? now - lastModifiedT * 1000 : null;
      pushSample(samples, seen, {
        query: "production:barcode",
        code: p.code ?? code,
        name: p.product_name ?? null,
        brand: (p.brands ?? "").split(",")[0]?.trim() || null,
        lastModifiedT,
        ageDays: ageMs != null ? ageMs / (24 * 60 * 60 * 1000) : null,
      });
      await sleep(120);
    } catch (e) {
      errors.push({ query: `production:${code}`, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const withTimestamp = samples.filter((s) => s.ageDays != null);
  const ageDaysSorted = withTimestamp.map((s) => s.ageDays).sort((a, b) => a - b);

  const report = {
    ticket: "ENG-1326",
    corpusQueries: CORPUS_QUERIES.length,
    productionOffCodesSampled: prod.codes.length,
    productionSampleNote: prod.note,
    hitsSampled: samples.length,
    hitsWithTimestamp: withTimestamp.length,
    hitsMissingTimestamp: samples.length - withTimestamp.length,
    errors,
    curve: deriveCurve(ageDaysSorted, nowIso),
    samples,
  };

  const outDir = join(REPO_ROOT, "docs/testing");
  mkdirSync(outDir, { recursive: true });
  const dateSlug = nowIso.slice(0, 10);
  const outPath = join(outDir, `off-staleness-corpus-${dateSlug}.json`);
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[analyze-off-staleness-corpus] wrote ${outPath}`);
  console.log(
    `[analyze-off-staleness-corpus] P75=${report.curve.percentilesDays.p75?.toFixed(0)}d P95=${report.curve.percentilesDays.p95?.toFixed(0)}d → start=${Math.round(report.curve.recommended.penaltyStartMs / (24 * 60 * 60 * 1000))}d full=${Math.round(report.curve.recommended.penaltyFullMs / (24 * 60 * 60 * 1000))}d`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
