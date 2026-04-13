/**
 * One-off script: decode HTML entities in existing recipe data.
 * Fixes &amp; → &, &#039; → ', etc. in titles, descriptions, ingredients, instructions.
 *
 * Usage: npx tsx scripts/fix-html-entities.ts [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

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
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error("Missing env vars"); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const dryRun = process.argv.includes("--dry-run");

function decode(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&ndash;/gi, "\u2013")
    .replace(/&mdash;/gi, "\u2014")
    .replace(/&frac12;/gi, "\u00BD")
    .replace(/&frac14;/gi, "\u00BC")
    .replace(/&frac34;/gi, "\u00BE")
    .replace(/&deg;/gi, "\u00B0");
}

function hasEntities(s: string): boolean {
  return /&(?:amp|lt|gt|quot|apos|nbsp|ndash|mdash|frac\d\d|deg|#\d+);/i.test(s);
}

async function main() {
  console.log(dryRun ? "=== DRY RUN ===" : "=== FIXING HTML ENTITIES ===");

  // Fix recipes table: title, description, instructions
  const { data: recipes, error: rErr } = await supabase
    .from("recipes")
    .select("id, title, description, instructions");
  if (rErr) { console.error("Failed to query recipes:", rErr.message); process.exit(1); }

  let recipesFixed = 0;
  for (const r of recipes ?? []) {
    const updates: Record<string, string> = {};
    if (r.title && hasEntities(r.title)) updates.title = decode(r.title);
    if (r.description && hasEntities(r.description)) updates.description = decode(r.description);
    if (r.instructions && hasEntities(r.instructions)) updates.instructions = decode(r.instructions);

    if (Object.keys(updates).length === 0) continue;

    if (dryRun) {
      console.log(`  Recipe: "${r.title?.slice(0, 50)}" — would fix: ${Object.keys(updates).join(", ")}`);
    } else {
      const { error } = await supabase.from("recipes").update(updates).eq("id", r.id);
      if (error) console.error(`  ERROR on recipe ${r.id}: ${error.message}`);
      else console.log(`  Fixed recipe: "${r.title?.slice(0, 50)}" — ${Object.keys(updates).join(", ")}`);
    }
    recipesFixed++;
  }

  // Fix recipe_ingredients table: name
  const { data: ingredients, error: iErr } = await supabase
    .from("recipe_ingredients")
    .select("id, name");
  if (iErr) { console.error("Failed to query ingredients:", iErr.message); process.exit(1); }

  let ingredientsFixed = 0;
  for (const ing of ingredients ?? []) {
    if (!ing.name || !hasEntities(ing.name)) continue;

    if (dryRun) {
      console.log(`  Ingredient: "${ing.name?.slice(0, 60)}" → "${decode(ing.name).slice(0, 60)}"`);
    } else {
      const { error } = await supabase.from("recipe_ingredients").update({ name: decode(ing.name) }).eq("id", ing.id);
      if (error) console.error(`  ERROR on ingredient ${ing.id}: ${error.message}`);
    }
    ingredientsFixed++;
  }

  console.log(`\nDone. Recipes fixed: ${recipesFixed}, Ingredients fixed: ${ingredientsFixed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
