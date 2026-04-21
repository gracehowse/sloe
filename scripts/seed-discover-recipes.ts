/**
 * TEMPORARY Discover-feed seeder (2026-04-21, authorised by Grace for solo-tester
 * testing only). Reads URLs from scripts/seed-recipe-urls.txt, fetches each page,
 * parses schema.org JSON-LD via the existing importer, and inserts into
 * public.recipes as published+verified seed rows under SEED_AUTHOR_ID.
 *
 * These rows hotlink publisher CDN images and store recipe text that is not
 * licensed for redistribution. Every row is tagged with description prefix
 * "[TEMP SEED]" AND source_url — either of which is sufficient for cleanup via
 * scripts/delete-seeded-recipes.ts. MUST be purged before any external launch.
 *
 * Usage: npx tsx scripts/seed-discover-recipes.ts [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { parseRecipeFromHtml, siteNameFromUrl } from "../src/lib/recipe-import/parseRecipeFromHtml";

const SEED_AUTHOR_ID = "e9f85055-876b-4bde-9267-476567b16884";
const SEED_DESCRIPTION_PREFIX = "[TEMP SEED] ";
const USER_AGENT = "SupprBot/1.0 (+https://suppr-club.com/bot)";

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

function readSeedUrls(): string[] {
  const file = `${process.cwd()}/scripts/seed-recipe-urls.txt`;
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": USER_AGENT,
      },
    });
    if (!res.ok) {
      console.warn(`  ! ${url} → HTTP ${res.status}`);
      return null;
    }
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.toLowerCase().includes("text/html")) {
      console.warn(`  ! ${url} → not HTML (${ct})`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`  ! ${url} → ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

function classifySimpleMealType(title: string): string[] {
  const t = title.toLowerCase();
  if (/\b(breakfast|pancake|waffle|oat|granola|smoothie|yogurt|shakshuka|avocado toast|egg)\b/.test(t))
    return ["breakfast"];
  if (/\b(salad|sandwich|wrap|soup|bowl|toast)\b/.test(t)) return ["lunch"];
  if (/\b(curry|dahl|tacos?|pasta|salmon|chicken|stew|roast|sheet pan|fajitas?)\b/.test(t))
    return ["dinner"];
  return ["dinner"];
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const urls = readSeedUrls();
  if (!urls.length) {
    console.error("No URLs in scripts/seed-recipe-urls.txt");
    process.exit(1);
  }

  console.log(
    `${dryRun ? "[dry-run] " : ""}Seeding ${urls.length} Discover recipes as author ${SEED_AUTHOR_ID}…`,
  );

  let inserted = 0;
  let skipped = 0;

  for (const url of urls) {
    process.stdout.write(`• ${url}\n`);
    const html = await fetchHtml(url);
    if (!html) {
      skipped++;
      continue;
    }
    const parsed = parseRecipeFromHtml(html);
    if (!parsed || !parsed.title || !parsed.ingredients.length) {
      console.warn("  ! no Recipe JSON-LD with ingredients — skipping");
      skipped++;
      continue;
    }

    const servings = parsed.servings ?? 1;
    const sn = parsed.siteNutrition;
    const mealType = classifySimpleMealType(parsed.title);
    const description =
      SEED_DESCRIPTION_PREFIX +
      (parsed.description ?? `Seeded from ${siteNameFromUrl(url)} for Discover testing.`);

    // author_id intentionally null: the notify_followers_on_recipe_publish trigger
    // references public.author_follows which is missing from the live DB (migration
    // 20260408180000_phase_4b_creator_social.sql not applied). The trigger guards
    // "IF new.author_id IS NOT NULL" so null skips the broken branch. The delete
    // script matches these rows by source_url (seed-recipe-urls.txt), not author_id.
    const recipeRow = {
      author_id: null as string | null,
      title: parsed.title,
      description,
      instructions: parsed.instructions.join("\n\n"),
      image_url: parsed.imageUrl,
      servings,
      prep_time_min: parsed.prepTimeMin,
      cook_time_min: parsed.cookTimeMin,
      meal_type: mealType,
      published: true,
      is_verified: true,
      calories: Math.round(sn?.calories ?? 0),
      protein: Math.round(sn?.protein ?? 0),
      carbs: Math.round(sn?.carbs ?? 0),
      fat: Math.round(sn?.fat ?? 0),
      fiber_g: sn?.fiberG ?? 0,
      sugar_g: sn?.sugarG ?? 0,
      sodium_mg: sn?.sodiumMg ?? 0,
      source_url: url,
      source_name: parsed.sourceName ?? siteNameFromUrl(url),
    };

    if (dryRun) {
      console.log(
        `  [dry] ${parsed.title} — ${parsed.ingredients.length} ingredients, ${sn?.calories ?? "?"} kcal/serving, image=${parsed.imageUrl ? "yes" : "no"}`,
      );
      inserted++;
      continue;
    }

    // Idempotency: if recipe already exists, reuse id and only backfill ingredients if missing.
    let recipeId: string | null = null;
    const { data: existing } = await sb
      .from("recipes")
      .select("id")
      .eq("source_url", url)
      .limit(1);
    if (existing && existing.length > 0) {
      recipeId = existing[0]!.id;
      console.log(`  = recipe exists (${recipeId}), checking ingredients`);
    } else {
      const { data: rRow, error: rErr } = await sb
        .from("recipes")
        .insert(recipeRow)
        .select("id")
        .single();
      if (rErr || !rRow) {
        console.error(`  ! insert recipe failed: ${rErr?.message ?? "no row"}`);
        skipped++;
        continue;
      }
      recipeId = rRow.id;
    }

    const { count: existingIngCount } = await sb
      .from("recipe_ingredients")
      .select("id", { count: "exact", head: true })
      .eq("recipe_id", recipeId);
    if ((existingIngCount ?? 0) > 0) {
      console.log(`  = ingredients already present (${existingIngCount})`);
      inserted++;
      continue;
    }

    const ingRows = parsed.ingredients.map((line) => ({
      recipe_id: recipeId,
      name: line.slice(0, 500),
      amount: null,
      unit: null,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber_g: 0,
      sugar_g: 0,
      sodium_mg: 0,
      is_verified: false,
      source: "seed",
    }));
    const { error: iErr } = await sb.from("recipe_ingredients").insert(ingRows);
    if (iErr) {
      console.error(`  ! insert ingredients failed: ${iErr.message}`);
    }

    console.log(`  + inserted ${recipeId} (${parsed.ingredients.length} ingredients)`);
    inserted++;
  }

  console.log(
    `\n${dryRun ? "[dry-run] " : ""}Done. inserted=${inserted} skipped=${skipped} total=${urls.length}`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exit(1);
});
