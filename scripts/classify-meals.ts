/**
 * Auto-classify meal_type for all recipes that don't have one set.
 *
 * Usage: npx tsx scripts/classify-meals.ts [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { classifyMealType } from "@/lib/recipe-import/classifyMealType";

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

async function main() {
  console.log(dryRun ? "=== DRY RUN ===" : "=== CLASSIFYING MEAL TYPES ===");

  const { data: recipes, error } = await supabase
    .from("recipes")
    .select("id, title, calories, meal_type");

  if (error) { console.error("Query failed:", error.message); process.exit(1); }
  if (!recipes?.length) { console.log("No recipes found."); return; }

  // Fetch ingredients for each recipe for better classification
  let classified = 0;
  let skipped = 0;

  for (const recipe of recipes) {
    // Skip recipes that already have a meal_type
    if (recipe.meal_type) {
      skipped++;
      continue;
    }

    const { data: ings } = await supabase
      .from("recipe_ingredients")
      .select("name")
      .eq("recipe_id", recipe.id);

    const ingredients = (ings ?? []).map((i: any) => i.name as string);

    const mealType = classifyMealType({
      title: recipe.title ?? "",
      ingredients,
      caloriesPerServing: recipe.calories ?? undefined,
    });

    if (!mealType || mealType.length === 0) {
      console.log(`  ${(recipe.title ?? "").slice(0, 50).padEnd(52)} -> unclassified`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  ${(recipe.title ?? "").slice(0, 50).padEnd(52)} -> ${mealType.join(", ")}`);
    } else {
      const { error: updateErr } = await supabase
        .from("recipes")
        .update({ meal_type: mealType })
        .eq("id", recipe.id);

      if (updateErr) {
        console.log(`  ${(recipe.title ?? "").slice(0, 50).padEnd(52)} -> ERROR: ${updateErr.message}`);
      } else {
        console.log(`  ${(recipe.title ?? "").slice(0, 50).padEnd(52)} -> ${mealType}`);
      }
    }
    classified++;
  }

  console.log(`\nDone. Classified: ${classified}, Skipped (already set or ambiguous): ${skipped}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
