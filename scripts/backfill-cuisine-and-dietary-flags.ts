#!/usr/bin/env tsx
/**
 * B5 Phase 2b (2026-04-27) — one-off backfill for `recipes.cuisine`
 * + `recipes.dietary_flags` after migration 20260503105000_recipes_cuisine_dietary_flags.sql.
 *
 * Runs in two passes per recipe row:
 *
 * 1. classifyRecipeCuisine(title, tags, source_name) → recipes.cuisine.
 *    Rows the heuristic can't classify stay null — caller is fine, the
 *    filter sheet treats null as "doesn't match the selected cuisine".
 *
 * 2. derive dietary flags from existing tags + structured fields:
 *      - tags contain "vegan" or "vegetarian" → carry through
 *      - title/tags contain "gluten-free" / "GF" → gluten-free
 *      - tags contain "dairy-free" or "DF" → dairy-free
 *      - protein per serving ≥ 25g → high-protein
 *      - tags contain "keto" → keto
 *      - tags contain "paleo" → paleo
 *      - tags contain "low-fodmap" or "fodmap" → low-fodmap
 *
 * Idempotent — safe to re-run. Existing non-null cuisine is left
 * alone; existing dietary_flags is overwritten with the recomputed
 * set so newly-added rules take effect.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/backfill-cuisine-and-dietary-flags.ts
 *
 * The script must run with service-role credentials because the
 * update path bypasses RLS. There is no dry-run flag — Supabase row-
 * count tells you what changed; run with `LIMIT_ROWS=10` first to
 * spot-check before the full pass.
 */

import { createClient } from "@supabase/supabase-js";
import { classifyRecipeCuisine } from "../src/lib/recipes/normalizeCuisine";
import {
  CUISINE_OPTIONS,
  DIETARY_PRESETS,
  type CuisineOption,
  type DietaryPreset,
} from "../src/lib/discover/filterRecipes";

const supabaseUrl = process.env.SUPABASE_URL || `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co`;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is required");
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceRoleKey);
const limitRows = process.env.LIMIT_ROWS ? Number.parseInt(process.env.LIMIT_ROWS, 10) : null;

interface RecipeRow {
  id: string;
  title: string | null;
  tags: unknown;
  source_name: string | null;
  cuisine: string | null;
  dietary_flags: unknown;
  protein: number | null;
  servings: number | null;
}

function deriveDietaryFlags(row: RecipeRow): DietaryPreset[] {
  const tags = Array.isArray(row.tags)
    ? (row.tags as unknown[]).map((t) => String(t).toLowerCase())
    : [];
  const titleLower = (row.title ?? "").toLowerCase();
  const out = new Set<DietaryPreset>();

  if (tags.includes("vegan") || titleLower.includes("vegan")) out.add("vegan");
  if (tags.includes("vegetarian") || titleLower.includes("vegetarian")) out.add("vegetarian");
  if (
    tags.some((t) => t === "gluten-free" || t === "gf" || t.includes("gluten free")) ||
    titleLower.includes("gluten-free") ||
    titleLower.includes("gluten free")
  ) {
    out.add("gluten-free");
  }
  if (
    tags.some((t) => t === "dairy-free" || t === "df" || t.includes("dairy free")) ||
    titleLower.includes("dairy-free") ||
    titleLower.includes("dairy free")
  ) {
    out.add("dairy-free");
  }
  // High-protein heuristic: ≥25g/serving. We use the per-recipe
  // protein column (not per-serving) when servings is known.
  const proteinPerServing =
    row.protein != null && row.servings && row.servings > 0
      ? row.protein / row.servings
      : (row.protein ?? 0);
  if (proteinPerServing >= 25 || tags.includes("high-protein")) out.add("high-protein");
  if (tags.includes("keto") || titleLower.includes("keto")) out.add("keto");
  if (tags.includes("paleo") || titleLower.includes("paleo")) out.add("paleo");
  if (
    tags.some((t) => t === "low-fodmap" || t.includes("fodmap")) ||
    titleLower.includes("low fodmap")
  ) {
    out.add("low-fodmap");
  }

  // Keep order stable per the canonical preset list so the JSONB is
  // diff-friendly across re-runs.
  return DIETARY_PRESETS.filter((p) => out.has(p));
}

async function main() {
  let from = 0;
  const pageSize = 500;
  let totalSeen = 0;
  let totalUpdated = 0;

  while (true) {
    const limit = limitRows ? Math.min(pageSize, limitRows - totalSeen) : pageSize;
    if (limit <= 0) break;
    const { data, error } = await sb
      .from("recipes")
      .select("id, title, tags, source_name, cuisine, dietary_flags, protein, servings")
      .order("created_at", { ascending: true })
      .range(from, from + limit - 1)
      .returns<RecipeRow[]>();
    if (error) {
      console.error("[backfill] select failed:", error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;

    for (const row of data) {
      totalSeen += 1;

      const tags = Array.isArray(row.tags) ? row.tags.map((t) => String(t)) : null;

      // Don't clobber a manually-set cuisine.
      const cuisine: CuisineOption | null =
        row.cuisine && (CUISINE_OPTIONS as readonly string[]).includes(row.cuisine)
          ? (row.cuisine as CuisineOption)
          : classifyRecipeCuisine({
              title: row.title,
              tags,
              sourceName: row.source_name,
            });

      const dietaryFlags = deriveDietaryFlags(row);

      // Only update when something would change. JSONB equality is
      // order-sensitive in PostgREST; sorted list above + sorted
      // existing → string equality.
      const existingFlags = Array.isArray(row.dietary_flags)
        ? (row.dietary_flags as unknown[]).map((f) => String(f).toLowerCase()).sort().join(",")
        : "";
      const newFlagsStr = dietaryFlags.join(",");

      if (cuisine === row.cuisine && existingFlags === newFlagsStr) {
        continue;
      }

      const { error: updateErr } = await sb
        .from("recipes")
        .update({
          cuisine,
          dietary_flags: dietaryFlags,
        })
        .eq("id", row.id);
      if (updateErr) {
        console.error(`[backfill] update failed for ${row.id}:`, updateErr.message);
        continue;
      }
      totalUpdated += 1;
      if (totalUpdated % 50 === 0) {
        console.log(`[backfill] updated ${totalUpdated} of ${totalSeen} so far`);
      }
    }

    if (data.length < limit) break;
    from += data.length;
  }

  console.log(`[backfill] done. Saw ${totalSeen} rows, updated ${totalUpdated}.`);
}

main().catch((e) => {
  console.error("[backfill] crashed:", e);
  process.exit(1);
});
