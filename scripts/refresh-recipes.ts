/**
 * Re-fetch and re-verify every recipe that has a source_url.
 * Updates title, description, instructions, servings, image, and all nutrition data.
 * Replaces ingredient rows with fresh parsed + verified data.
 *
 * Usage:
 *   npx tsx scripts/refresh-recipes.ts [--dry-run]
 *
 * Requires dev server running on localhost:3000 (for nutrition verification).
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { parseRecipeFromHtml, siteNameFromUrl } from "@/lib/recipe-import/parseRecipeFromHtml";
import { parseIngredientLine } from "@/lib/recipe-ingredients/parseIngredientLine";
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
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
    redirect: "follow",
  });
  const html = await res.text();
  if (!html || html.length < 200) throw new Error(`Empty HTML (status ${res.status})`);
  return html;
}

type Parsed = NonNullable<ReturnType<typeof parseRecipeFromHtml>>;

async function verifyViaApi(baseUrl: string, parsed: Parsed) {
  const rows = parsed.ingredients.map((line) => {
    const p = parseIngredientLine(line);
    return { name: (p.name.trim() || line.trim()) ?? "", amount: p.amount, unit: p.unit };
  });
  const res = await fetch(`${baseUrl}/api/nutrition/verify-recipe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ingredients: rows, servings: Math.max(1, parsed.servings ?? 1), provider: "auto" }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    return { ok: false as const, message: json?.message ?? `verify failed (${res.status})` };
  }
  return { ok: true as const, verified: json.verified, totals: json.totals, perServing: json.perServing, primarySource: json.primarySource };
}

async function main() {
  loadEnvLocal();
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const baseUrl = process.env.PLATEMATE_BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const dryRun = process.argv.includes("--dry-run");

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  console.log(dryRun ? "=== DRY RUN ===" : "=== REFRESHING ALL RECIPES ===\n");

  const { data: recipes, error } = await sb
    .from("recipes")
    .select("id, title, source_url")
    .not("source_url", "is", null);

  if (error) { console.error("Query failed:", error.message); process.exit(1); }
  if (!recipes || recipes.length === 0) { console.log("No recipes with source_url found."); return; }

  console.log(`Found ${recipes.length} recipes to refresh.\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const recipe of recipes) {
    const url = recipe.source_url;
    if (!url) { skipped++; continue; }

    process.stdout.write(`  ${(recipe.title ?? "Untitled").slice(0, 50).padEnd(52)} `);

    // 1. Fetch & parse
    let html: string;
    try {
      html = await fetchHtml(url);
    } catch (e) {
      console.log(`-> fetch failed: ${e instanceof Error ? e.message : e}`);
      failed++;
      continue;
    }

    const parsed = parseRecipeFromHtml(html);
    if (!parsed || !parsed.ingredients || parsed.ingredients.length < 2) {
      console.log("-> parse failed or too few ingredients");
      failed++;
      continue;
    }

    const servings = Math.max(1, parsed.servings ?? 1);

    if (dryRun) {
      console.log(`-> would refresh (${parsed.ingredients.length} ingredients, ${servings} servings)`);
      updated++;
      continue;
    }

    // 2. Verify nutrition
    const verify = await verifyViaApi(baseUrl, parsed);

    // 3. Update recipe row
    const { error: updateErr } = await sb
      .from("recipes")
      .update({
        title: parsed.title,
        description: parsed.description,
        instructions: parsed.instructions.map((s, i) => `${i + 1}. ${s}`).join("\n"),
        image_url: parsed.imageUrl,
        source_name: parsed.sourceName ?? siteNameFromUrl(url),
        servings,
        prep_time_min: parsed.prepTimeMin,
        cook_time_min: parsed.cookTimeMin,
        meal_type: classifyMealType({
          title: parsed.title,
          ingredients: parsed.ingredients,
          caloriesPerServing: verify.ok ? Math.round(Number(verify.perServing.calories) || 0) : undefined,
        }),
        is_verified: verify.ok,
        calories: verify.ok ? Math.round(Number(verify.perServing.calories) || 0) : 0,
        protein: verify.ok ? Math.round(Number(verify.perServing.protein) || 0) : 0,
        carbs: verify.ok ? Math.round(Number(verify.perServing.carbs) || 0) : 0,
        fat: verify.ok ? Math.round(Number(verify.perServing.fat) || 0) : 0,
        fiber_g: verify.ok ? Math.round((Number(verify.perServing.fiberG) || 0) * 10) / 10 : 0,
        sugar_g: verify.ok ? Math.round((Number(verify.perServing.sugarG) || 0) * 10) / 10 : 0,
        sodium_mg: verify.ok ? Math.round(Number(verify.perServing.sodiumMg) || 0) : 0,
      })
      .eq("id", recipe.id);

    if (updateErr) {
      console.log(`-> update failed: ${updateErr.message}`);
      failed++;
      continue;
    }

    // 4. Replace ingredients: delete old, insert new
    await sb.from("recipe_ingredients").delete().eq("recipe_id", recipe.id);

    const ingredientsInsert = parsed.ingredients.map((line, idx) => {
      const p = parseIngredientLine(line);
      const name = p.name.trim() || line.trim();
      const v = verify.ok ? (verify.verified[idx]?.macros ?? null) : null;
      return {
        recipe_id: recipe.id,
        name,
        amount: p.amount ? Number(p.amount) : null,
        unit: p.unit || null,
        calories: v ? Math.round(Number(v.calories)) : 0,
        protein: v ? Math.round(Number(v.protein) * 10) / 10 : 0,
        carbs: v ? Math.round(Number(v.carbs) * 10) / 10 : 0,
        fat: v ? Math.round(Number(v.fat) * 10) / 10 : 0,
        fiber_g: v ? Math.round(Number(v.fiberG) * 10) / 10 : 0,
        sugar_g: v ? Math.round(Number(v.sugarG) * 10) / 10 : 0,
        sodium_mg: v ? Math.round(Number(v.sodiumMg)) : 0,
        is_verified: verify.ok,
        source: verify.ok ? (verify.verified[idx]?.source ?? null) : null,
      };
    });

    const { error: iErr } = await sb.from("recipe_ingredients").insert(ingredientsInsert);
    if (iErr) {
      console.log(`-> ingredients insert failed: ${iErr.message}`);
      failed++;
      continue;
    }

    console.log(`-> ok (${servings} srv, ${verify.ok ? verify.perServing.calories + " kcal/srv" : "unverified"})`);
    updated++;

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
