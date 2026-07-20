#!/usr/bin/env node

/**
 * Calculate the Sloe Kitchen seed nutrition with the same ingredient
 * verification pipeline used by recipe import. The generated manifest is the
 * only source allowed to populate Discover's headline macros; hand-entered
 * estimates are deliberately unsupported.
 *
 * Usage:
 *   node --env-file=.env.local --import tsx scripts/verify-sloe-kitchen-recipes.ts
 *   node --env-file=.env.local --import tsx scripts/verify-sloe-kitchen-recipes.ts --write
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

import { verifyIngredients } from "../src/lib/nutrition/verifyIngredients";

// CI and the local project runtime are pinned to Node 20. Supabase's current
// client expects a WebSocket constructor even for read-only food lookup.
globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

type ContentIngredient = {
  item: string;
  grams: number;
  nutritionItem?: string;
  nutritionOverride?: {
    fdcId?: number;
    barcode?: string;
    description: string;
  };
};

type ContentRecipe = {
  slug: string;
  title: string;
  servings: number;
  ingredients: ContentIngredient[];
};

type ContentPack = {
  recipes: ContentRecipe[];
};

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_DIR = resolve(REPO_ROOT, "content/sloe-kitchen/v1");
const RECIPES_PATH = resolve(CONTENT_DIR, "recipes.json");
const OUTPUT_PATH = resolve(CONTENT_DIR, "nutrition.json");
const SHOULD_WRITE = process.argv.includes("--write");
const SHOW_DETAILS = process.argv.includes("--details");

const pack = JSON.parse(readFileSync(RECIPES_PATH, "utf8")) as ContentPack;
const results = [];
let failed = false;

for (const recipe of pack.recipes) {
  const result = await verifyIngredients({
    servings: recipe.servings,
    provider: "auto",
    ingredients: recipe.ingredients.map((ingredient) => ({
      name: ingredient.nutritionItem ?? ingredient.item,
      amount: String(ingredient.grams),
      unit: "g",
    })),
    overrides: recipe.ingredients.flatMap((ingredient, index) =>
      ingredient.nutritionOverride
        ? [{ index, ...ingredient.nutritionOverride }]
        : [],
    ),
  });

  const reviewRows = result.verified.filter(
    (row) => row.macros == null || row.belowAcceptFloor,
  );
  const recipePassed = reviewRows.length === 0;
  failed ||= !recipePassed;

  console.log(
    `${recipePassed ? "PASS" : "REVIEW"} ${recipe.slug}: ` +
      `${result.perServing.calories} kcal · ${result.perServing.protein}g protein · ` +
      `${result.minIngredientConfidence.toFixed(2)} minimum confidence`,
  );

  for (const row of reviewRows) {
    console.log(
      `  ${row.input.name} -> ${row.matchedName ?? "no match"} ` +
        `[${row.source}, ${row.confidence.toFixed(2)}]`,
    );
  }

  if (SHOW_DETAILS) {
    for (const row of result.verified) {
      const macros = row.macros;
      console.log(
        `  DETAIL ${row.input.name} -> ${row.matchedName ?? "no match"} ` +
          `[${row.source}, ${row.confidence.toFixed(2)}] ` +
          `${macros?.calories ?? "—"} kcal, ${macros?.protein ?? "—"}g protein`,
      );
    }
  }

  results.push({
    slug: recipe.slug,
    status: recipePassed ? "verified" : "review-required",
    servings: recipe.servings,
    perServing: result.perServing,
    verification: {
      engine: "verifyIngredients",
      primarySource: result.primarySource,
      sourceCounts: result.sourceCounts,
      minIngredientConfidence: result.minIngredientConfidence,
      avgIngredientConfidence: result.avgIngredientConfidence,
      belowAcceptFloorCount: result.belowAcceptFloorCount,
      ingredients: result.verified.map((row) => ({
        input: row.input.name,
        grams: Number(row.input.amount),
        matchedName: row.matchedName,
        source: row.source,
        confidence: row.confidence,
        accepted: row.macros != null && !row.belowAcceptFloor,
        macros: row.macros,
      })),
    },
  });
}

if (failed) {
  console.error("Nutrition manifest was not written: one or more ingredients require review.");
  process.exitCode = 1;
} else if (SHOULD_WRITE) {
  writeFileSync(
    OUTPUT_PATH,
    `${JSON.stringify(
      {
        version: 1,
        policy: "Calculated from weighed ingredients by Suppr's canonical verification pipeline; no hand-entered macro estimates.",
        recipes: results,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Wrote ${OUTPUT_PATH}`);
} else {
  console.log("All recipes passed. Re-run with --write to create nutrition.json.");
}
