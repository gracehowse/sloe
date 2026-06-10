/**
 * Nutrition search audit runner (2026-06-04 plan).
 *
 * Provider health + golden-query battery using live API clients (no HTTP auth).
 * Writes docs/testing/nutrition-search-golden-audit-2026-06-04.json + .md
 *
 * Usage: npx tsx scripts/audit-nutrition-search.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { hasFatSecretEnv } from "@/lib/env/integrationEnv";
import { edamamConfigFromEnv, edamamFoodSearch } from "@/lib/edamam/client";
import { fatSecretConfigFromEnv, fatSecretFoodSearch } from "@/lib/fatsecret/client";
import {
  foodSearchRankScore,
  searchMatchScore,
  searchRowConfidenceTier,
  type FoodSearchTrustSource,
} from "@/lib/nutrition/foodSearchRanking";
import { fdcConfigFromEnv, fdcFoodsSearch } from "@/lib/usda/fdcClient";
import { loadRepoEnvLocal } from "./load-repo-env-local.mjs";

const GOLDEN_QUERIES = [
  "Big Mac",
  "starbucks latte",
  "chipotle bowl",
  "salmon",
  "banana",
  "brown rice",
  "tesco chicken",
  "sainsbury's hummus",
] as const;

type ProviderRow = {
  name: string;
  source: FoodSearchTrustSource;
  verified?: boolean;
  kcal: string;
  portion: string;
  score: number;
  tier: string;
};

type QueryResult = {
  query: string;
  providerHits: { fatsecret: number; usda: number; edamam: number };
  providerErrors: string[];
  elapsedMs: number;
  top5: ProviderRow[];
};

function kcalLabel(hit: {
  macrosPerServing?: { calories?: number | null } | null;
  macrosPer100g?: { calories?: number | null } | null;
  servingLabel?: string | null;
}): string {
  const ps = hit.macrosPerServing?.calories;
  if (ps != null && Number.isFinite(ps)) return String(Math.round(ps));
  const p100 = hit.macrosPer100g?.calories;
  if (p100 != null && Number.isFinite(p100)) return `${Math.round(p100)}/100g`;
  return "—";
}

function portionLabel(hit: { servingLabel?: string | null; servingGrams?: number | null }): string {
  if (hit.servingLabel?.trim()) return hit.servingLabel.trim();
  if (hit.servingGrams != null) return `${hit.servingGrams}g`;
  return "—";
}

async function providerHealth(): Promise<Record<string, boolean>> {
  return {
    fatsecret_configured: hasFatSecretEnv(),
    FATSECRET_CONSUMER_KEY: Boolean(process.env.FATSECRET_CONSUMER_KEY),
    FATSECRET_CLIENT_SECRET: Boolean(process.env.FATSECRET_CLIENT_SECRET),
    FATSECRET_CONSUMER_SECRET: Boolean(process.env.FATSECRET_CONSUMER_SECRET),
    USDA_FDC_API_KEY: Boolean(process.env.USDA_FDC_API_KEY),
    EDAMAM_APP_ID: Boolean(process.env.EDAMAM_APP_ID),
    EDAMAM_APP_KEY: Boolean(process.env.EDAMAM_APP_KEY),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runQuery(query: string): Promise<QueryResult> {
  const t0 = Date.now();
  const providerErrors: string[] = [];
  const pool: Array<{
    name: string;
    source: FoodSearchTrustSource;
    verified?: boolean;
    kcal: string;
    portion: string;
  }> = [];

  let fsCount = 0;
  let usdaCount = 0;
  let edamamCount = 0;

  if (hasFatSecretEnv()) {
    try {
      const hits = await fatSecretFoodSearch(fatSecretConfigFromEnv(), query, { maxResults: 10 });
      fsCount = hits.length;
      for (const h of hits) {
        const brand = (h.brand_name ?? "").trim();
        const name = (h.food_name ?? "Unknown").trim();
        pool.push({
          name: brand ? `${brand} · ${name}` : name,
          source: "FatSecret",
          kcal: "—",
          portion: (h.food_description ?? "").slice(0, 60) || "—",
        });
      }
    } catch (e) {
      providerErrors.push(`FatSecret: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (process.env.USDA_FDC_API_KEY) {
    try {
      const hits = await fdcFoodsSearch(fdcConfigFromEnv(), query, { pageNumber: 1 });
      usdaCount = hits.length;
      for (const h of hits.slice(0, 15)) {
        const verified =
          h.dataType === "Foundation" ||
          h.dataType === "SR Legacy" ||
          h.dataType === "Survey (FNDDS)";
        const portion =
          h.householdServingFullText?.trim() ||
          (h.servingSize != null && h.servingSizeUnit
            ? `${h.servingSize} ${h.servingSizeUnit}`
            : "—");
        pool.push({
          name: h.description?.trim() || "Unknown",
          source: "USDA",
          verified,
          kcal:
            h.calories != null && Number.isFinite(h.calories)
              ? `${Math.round(h.calories)}/100g`
              : "—",
          portion,
        });
      }
    } catch (e) {
      providerErrors.push(`USDA: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (process.env.EDAMAM_APP_ID && process.env.EDAMAM_APP_KEY) {
    await sleep(800);
    try {
      const hits = await edamamFoodSearch(edamamConfigFromEnv(), query, { pageSize: 10 });
      edamamCount = hits.length;
      for (const h of hits) {
        pool.push({
          name: h.label ?? "Unknown",
          source: "Edamam",
          kcal: h.macrosPer100g?.calories != null ? `${Math.round(h.macrosPer100g.calories)}/100g` : "—",
          portion: "—",
        });
      }
    } catch (e) {
      providerErrors.push(`Edamam: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const ranked = pool
    .map((row) => {
      const score = foodSearchRankScore({
        query,
        name: row.name,
        source: row.source,
        verified: row.verified,
      });
      const tier = searchRowConfidenceTier({
        source: row.source,
        verified: row.verified,
        matchScore: searchMatchScore(query, row.name),
      });
      return { ...row, score, tier };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    query,
    providerHits: { fatsecret: fsCount, usda: usdaCount, edamam: edamamCount },
    providerErrors,
    elapsedMs: Date.now() - t0,
    top5: ranked,
  };
}

function toMarkdown(
  env: Record<string, boolean>,
  results: QueryResult[],
): string {
  const lines: string[] = [
    "# Nutrition search golden audit — 2026-06-04",
    "",
    "**Platform:** web (live API clients, ranked locally)  ",
    "**iOS:** pending native UI pass (ENG-877)",
    "",
    "## Provider env",
    "",
    ...Object.entries(env).map(([k, v]) => `- ${k}: ${v ? "yes" : "no"}`),
    "",
    "## Golden queries",
    "",
  ];

  for (const r of results) {
    lines.push(`### \`${r.query}\` (${r.elapsedMs}ms)`);
    lines.push(
      `FS hits: ${r.providerHits.fatsecret} · USDA: ${r.providerHits.usda} · Edamam: ${r.providerHits.edamam}`,
    );
    if (r.providerErrors.length) {
      lines.push(`Errors: ${r.providerErrors.join("; ")}`);
    }
    lines.push("");
    lines.push("| # | Name | Source | kcal | Portion | Score | Tier |");
    lines.push("|---|------|--------|------|---------|-------|------|");
    r.top5.forEach((row, i) => {
      lines.push(
        `| ${i + 1} | ${row.name.replace(/\|/g, "\\|")} | ${row.source} | ${row.kcal} | ${row.portion.replace(/\|/g, "\\|")} | ${row.score.toFixed(3)} | ${row.tier} |`,
      );
    });
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  loadRepoEnvLocal();
  const env = await providerHealth();
  const results: QueryResult[] = [];
  for (const q of GOLDEN_QUERIES) {
    results.push(await runQuery(q));
    process.stdout.write(`✓ ${q}\n`);
    await sleep(400);
  }

  const outDir = join(process.cwd(), "docs/testing");
  mkdirSync(outDir, { recursive: true });
  const jsonPath = join(outDir, "nutrition-search-golden-audit-2026-06-04.json");
  const mdPath = join(outDir, "nutrition-search-golden-audit-2026-06-04.md");
  const payload = { generatedAt: new Date().toISOString(), env, results };
  writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  writeFileSync(mdPath, toMarkdown(env, results));
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
