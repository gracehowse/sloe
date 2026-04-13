import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { parseRecipeFromHtml, siteNameFromUrl } from "@/lib/recipe-import/parseRecipeFromHtml";
import { parseIngredientLine } from "@/lib/recipe-ingredients/parseIngredientLine";
import { classifyMealType } from "@/lib/recipe-import/classifyMealType";

type Parsed = NonNullable<ReturnType<typeof parseRecipeFromHtml>>;

/** Load `.env.local` when present so `npm run seed:discover` works without exporting secrets in the shell. */
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
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
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

function readUrls(): string[] {
  const file = `${process.cwd()}/scripts/seed-recipe-urls.txt`;
  const txt = readFileSync(file, "utf8");
  return txt
    .split("\n")
    .map((l: string) => l.trim())
    .filter((l: string) => l && !l.startsWith("#"));
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
  if (!html || html.length < 200) throw new Error(`Empty HTML for ${url} (status ${res.status})`);
  return html;
}

async function verifyViaApi(baseUrl: string, parsed: Parsed) {
  const rows = parsed.ingredients.map((line) => {
    const p = parseIngredientLine(line);
    return { name: (p.name.trim() || line.trim()) ?? "", amount: p.amount, unit: p.unit };
  });
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/nutrition/verify-recipe`, {
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
  const baseUrl =
    process.env.PLATEMATE_BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const urls = readUrls();
  if (urls.length === 0) throw new Error("No URLs found in scripts/seed-recipe-urls.txt");

  for (const url of urls) {
    // Skip if already seeded (check by source_url)
    const { data: existing } = await sb.from("recipes").select("id").eq("source_url", url).limit(1);
    if (existing && existing.length > 0) {
      console.info(`  - already seeded, skipping: ${url}`);
      continue;
    }

    // eslint-disable-next-line no-console
    console.info(`Seeding: ${url}`);
    let html: string;
    try {
      html = await fetchHtml(url);
    } catch (e) {
      console.warn(`  - fetch failed, skipping: ${url} (${e instanceof Error ? e.message : e})`);
      continue;
    }
    const parsed = parseRecipeFromHtml(html);
    if (!parsed) {
      console.warn(`  - skipped (no Recipe JSON-LD): ${url}`);
      continue;
    }
    if (!parsed.ingredients || parsed.ingredients.length < 2) {
      console.warn(`  - skipped (no/too few ingredients: ${parsed.ingredients?.length ?? 0}): ${url}`);
      continue;
    }
    if (!parsed.instructions || parsed.instructions.length === 0) {
      console.warn(`  - skipped (no instructions): ${url}`);
      continue;
    }

    const verify = await verifyViaApi(baseUrl, parsed);
    const servings = Math.max(1, parsed.servings ?? 1);

    const seedAuthorId = process.env.PLATEMATE_SEED_AUTHOR_ID?.trim() || null;
    if (!seedAuthorId) {
      // eslint-disable-next-line no-console
      console.warn(
        "  - PLATEMATE_SEED_AUTHOR_ID not set: recipe will have author_id null and will not appear in Discover (query requires published + author_id).",
      );
    }

    const recipeInsert = {
      creator_id: null,
      author_id: seedAuthorId,
      title: parsed.title,
      description: parsed.description,
      instructions: parsed.instructions.map((s, i) => `${i + 1}. ${s}`).join("\n"),
      image_url: parsed.imageUrl,
      source_url: url,
      source_name: parsed.sourceName ?? siteNameFromUrl(url),
      servings,
      prep_time_min: parsed.prepTimeMin,
      cook_time_min: parsed.cookTimeMin,
      meal_type: classifyMealType({
        title: parsed.title,
        ingredients: parsed.ingredients,
        caloriesPerServing: verify.ok ? Math.round(Number(verify.perServing.calories) || 0) : undefined,
      }),
      dietary: [],
      published: true,
      is_verified: verify.ok,
      calories: verify.ok ? Math.round(Number(verify.perServing.calories) || 0) : 0,
      protein: verify.ok ? Math.round(Number(verify.perServing.protein) || 0) : 0,
      carbs: verify.ok ? Math.round(Number(verify.perServing.carbs) || 0) : 0,
      fat: verify.ok ? Math.round(Number(verify.perServing.fat) || 0) : 0,
    };

    const { data: recipeRow, error: rErr } = await sb.from("recipes").insert(recipeInsert).select("id").single();
    if (rErr || !recipeRow) throw new Error(rErr?.message ?? "recipe insert failed");

    const recipeId = recipeRow.id as string;

    // Ingredients
    const ingredientsInsert = parsed.ingredients.map((line, idx) => {
      const p = parseIngredientLine(line);
      const name = p.name.trim() || line.trim();
      const v = verify.ok ? (verify.verified[idx]?.macros ?? null) : null;
      return {
        recipe_id: recipeId,
        name,
        amount: p.amount ? Number(p.amount) : null,
        unit: p.unit || null,
        calories: v ? Number(v.calories) : 0,
        protein: v ? Number(v.protein) : 0,
        carbs: v ? Number(v.carbs) : 0,
        fat: v ? Number(v.fat) : 0,
      };
    });

    const { error: iErr } = await sb.from("recipe_ingredients").insert(ingredientsInsert);
    if (iErr) throw new Error(iErr.message);

    // eslint-disable-next-line no-console
    console.info(`  - ok: ${parsed.title} (${verify.ok ? "verified" : "unverified"})`);
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

