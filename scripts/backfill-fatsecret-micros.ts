/**
 * ENG-738 — backfill nutrition_micros on EXISTING FatSecret logs with the now-
 * emitted calcium/iron/vitamins (%DV→absolute) + the wider Premier panel.
 *
 * Re-find each product by name on FatSecret, CONFIRM same item via scale-
 * invariant macro ratios (carbs/kcal + fat/kcal vs the entry), then normalise
 * the serving micros (per-100g), scale by the entry's grams (derived from
 * calories), and MERGE into existing micros (never drop a real value).
 *
 * Dry-run (default):  node --env-file=.env.local --import tsx scripts/backfill-fatsecret-micros.ts
 * Apply:              ... --apply
 */
import { createClient } from "@supabase/supabase-js";
import { fatSecretConfigFromEnv, fatSecretFoodSearch, fatSecretFoodGet } from "../src/lib/fatsecret/client";
import { fatSecretServingMicrosPer100g, normalizeServingToMacros, pickBestServing } from "../src/lib/nutrition/fatsecretNormalize";
import { scaleMicrosForGrams } from "../src/lib/openFoodFacts/parseOffMicros";

const APPLY = process.argv.includes("--apply");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cleanQuery = (t: string) => t.replace(/\s*\([^)]*\)\s*$/, "").replace(/^.*·\s*/, "").trim() || t;
const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);
const within = (a: number, b: number, tol: number) => { const hi = Math.max(Math.abs(a), Math.abs(b)); return hi === 0 ? true : Math.abs(a - b) / hi <= tol; };

type Row = { id: string; recipe_title: string | null; calories: number; protein: number; carbs: number; fat: number; nutrition_micros: any };

async function main() {
  console.log(`ENG-738 FatSecret micros backfill — ${APPLY ? "APPLY" : "DRY RUN"}\n`);
  const cfg = fatSecretConfigFromEnv();
  const { data } = await sb.from("nutrition_entries")
    .select("id,recipe_title,calories,protein,carbs,fat,nutrition_micros").eq("source", "FatSecret").returns<Row[]>();
  const rows = data ?? [];
  let matched = 0, noMatch = 0;
  const planned: Array<{ id: string; title: string; grams: number; before: number; after: number; micros: Record<string, number> }> = [];

  for (const r of rows) {
    const existing = (r.nutrition_micros && typeof r.nutrition_micros === "object") ? r.nutrition_micros as Record<string, number> : {};
    let hits: any[] = [];
    try { hits = await fatSecretFoodSearch(cfg, cleanQuery(r.recipe_title ?? "")) ?? []; } catch { hits = []; }
    await sleep(250);
    let chosen: { micros100: Record<string, number>; kcal100: number } | null = null;
    for (const h of hits.slice(0, 5)) {
      const id = h.food_id ?? h.id; if (!id) continue;
      let food: any; try { food = await fatSecretFoodGet(cfg, String(id)); } catch { food = null; }
      await sleep(200);
      if (!food) continue;
      const serv = pickBestServing(food.servings?.serving ?? food.servings);
      const gramsPerServing = Number.parseFloat(String(serv?.metric_serving_amount ?? "")) || 0;
      if (gramsPerServing <= 0) continue;
      const m = normalizeServingToMacros(serv);
      const f = 100 / gramsPerServing;
      const kcal100 = m.calories * f, carbs100 = m.carbs * f, fat100 = m.fat * f, prot100 = m.protein * f;
      if (!(kcal100 > 0) || !(r.calories > 0)) continue;
      if (within(ratio(r.carbs, r.calories), ratio(carbs100, kcal100), 0.18) &&
          within(ratio(r.fat, r.calories), ratio(fat100, kcal100), 0.18) &&
          within(ratio(r.protein, r.calories), ratio(prot100, kcal100), 0.25)) {
        chosen = { micros100: fatSecretServingMicrosPer100g(serv, gramsPerServing), kcal100 };
        break;
      }
    }
    if (!chosen) { noMatch++; continue; }
    matched++;
    const grams = (r.calories / chosen.kcal100) * 100;
    const merged = { ...scaleMicrosForGrams(chosen.micros100, grams), ...existing };
    const beforeN = Object.keys(existing).length, afterN = Object.keys(merged).length;
    if (afterN <= beforeN) continue;
    planned.push({ id: r.id, title: r.recipe_title ?? "", grams: Math.round(grams * 10) / 10, before: beforeN, after: afterN, micros: merged });
  }

  console.log(`FatSecret entries ${rows.length} | matched ${matched} | no confident match ${noMatch} | to backfill ${planned.length}\n`);
  for (const p of planned) console.log(`  ${p.title.slice(0, 44).padEnd(44)} ${p.before}→${p.after} fields  ~${p.grams}g`);
  if (!APPLY) { console.log(`\nDRY RUN — --apply to write ${planned.length} rows.`); return; }
  let ok = 0, fail = 0;
  for (const p of planned) { const { error } = await sb.from("nutrition_entries").update({ nutrition_micros: p.micros }).eq("id", p.id); if (error) { fail++; console.error(`  FAIL ${p.id.slice(0,8)}: ${error.message}`); } else ok++; }
  console.log(`\nAPPLIED — ${ok} updated, ${fail} failed.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
