/**
 * One-off script: re-fetch source URLs for recipes stuck at servings=1
 * and update them with the correct yield from JSON-LD.
 *
 * Usage: npx tsx scripts/fix-servings.ts [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { parseRecipeFromHtml } from "@/lib/recipe-import/parseRecipeFromHtml";

/** Load .env.local so script works without exporting secrets in the shell. */
function loadEnvLocal(): void {
  const p = ".env.local";
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const dryRun = process.argv.includes("--dry-run");

async function fetchServingsFromUrl(url: string): Promise<number | null> {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15_000);
    const res = await fetch(url, {
      signal: ac.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      redirect: "follow",
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const html = await res.text();
    const parsed = parseRecipeFromHtml(html);
    return parsed?.servings ?? null;
  } catch {
    return null;
  }
}

async function main() {
  console.log(dryRun ? "=== DRY RUN ===" : "=== UPDATING RECIPES ===");

  const { data: recipes, error } = await supabase
    .from("recipes")
    .select("id, title, servings, source_url")
    .eq("servings", 1)
    .not("source_url", "is", null);

  if (error) {
    console.error("Failed to query recipes:", error.message);
    process.exit(1);
  }

  if (!recipes || recipes.length === 0) {
    console.log("No recipes with servings=1 and a source_url found.");
    return;
  }

  console.log(`Found ${recipes.length} recipes with servings=1 to check.\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const recipe of recipes) {
    const url = recipe.source_url;
    if (!url) { skipped++; continue; }

    process.stdout.write(`  ${recipe.title?.slice(0, 50).padEnd(52)} `);
    const servings = await fetchServingsFromUrl(url);

    if (servings == null || servings <= 1) {
      console.log(`-> still ${servings ?? "null"}, skipping`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`-> would update to ${servings} servings`);
      updated++;
      continue;
    }

    // Update servings and recalculate per-serving macros
    // Current stored values are per-serving with servings=1 (i.e. they're actually totals)
    // We need to divide by the real servings count
    const { data: full } = await supabase
      .from("recipes")
      .select("calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg")
      .eq("id", recipe.id)
      .single();

    if (!full) {
      console.log(`-> failed to fetch macros`);
      failed++;
      continue;
    }

    const { error: updateErr } = await supabase
      .from("recipes")
      .update({
        servings,
        calories: Math.round((full.calories ?? 0) / servings),
        protein: Math.round((full.protein ?? 0) / servings),
        carbs: Math.round((full.carbs ?? 0) / servings),
        fat: Math.round((full.fat ?? 0) / servings),
        fiber_g: Math.round(((full.fiber_g ?? 0) / servings) * 10) / 10,
        sugar_g: Math.round(((full.sugar_g ?? 0) / servings) * 10) / 10,
        sodium_mg: Math.round((full.sodium_mg ?? 0) / servings),
      })
      .eq("id", recipe.id);

    if (updateErr) {
      console.log(`-> ERROR: ${updateErr.message}`);
      failed++;
    } else {
      console.log(`-> updated to ${servings} servings`);
      updated++;
    }

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
