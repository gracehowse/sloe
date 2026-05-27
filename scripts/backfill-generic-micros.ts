/**
 * ENG-738 backfill — populate `nutrition_micros` on EXISTING generic-food logs
 * that were written before the micros bake (they stored empty micros).
 *
 * nutrition_entries has no grams column, so we DERIVE the logged grams exactly
 * from the stored calories: grams = calories / genericFood.per100g.calories * 100
 * (the calories were computed from those same per-100g macros at log time, so
 * this reconstruction is exact, not an estimate). Then scale GENERIC_FOOD_MICROS
 * by those grams — identical to what the log path now does for new entries.
 *
 * SAFE BY CONSTRUCTION: only touches rows whose micros are EMPTY and whose name
 * exact-alias-matches a baked generic FOOD. Existing micros are never overwritten;
 * beverages and unmatched names are skipped.
 *
 * Dry-run (default): prints what would change, writes nothing.
 *   node --env-file=.env.local --import tsx scripts/backfill-generic-micros.ts
 * Apply:
 *   node --env-file=.env.local --import tsx scripts/backfill-generic-micros.ts --apply
 */
import { createClient } from "@supabase/supabase-js";
import { matchGenericFood } from "../src/lib/nutrition/genericFoods";
import { GENERIC_FOOD_MICROS } from "../src/lib/nutrition/genericFoodMicros";
import { scaleMicrosForGrams } from "../src/lib/openFoodFacts/parseOffMicros";

const APPLY = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

type Row = { id: string; name: string; recipe_title: string | null; calories: number; source: string | null; nutrition_micros: unknown };

function isEmptyMicros(m: unknown): boolean {
  return m == null || (typeof m === "object" && Object.keys(m as object).length === 0);
}

async function main() {
  console.log(`ENG-738 micros backfill — ${APPLY ? "APPLY (writing)" : "DRY RUN (no writes)"}\n`);

  // Page through all entries (service-role bypasses RLS → all users).
  const planned: Array<{ id: string; name: string; cal: number; grams: number; microCount: number; micros: Record<string, number> }> = [];
  let scanned = 0, withMicros = 0, unmatched = 0;
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("nutrition_entries")
      .select("id,name,recipe_title,calories,source,nutrition_micros")
      .range(from, from + PAGE - 1)
      .returns<Row[]>();
    if (error) { console.error("query failed:", error.message); process.exit(1); }
    if (!data?.length) break;
    scanned += data.length;
    for (const r of data) {
      if (!isEmptyMicros(r.nutrition_micros)) { withMicros++; continue; }
      // Food name lives in recipe_title; `name` is the meal slot (Breakfast/…).
      const food = matchGenericFood(r.recipe_title ?? "");
      const micros100 = food ? GENERIC_FOOD_MICROS[food.id] : undefined;
      if (!food || !micros100) { unmatched++; continue; }
      const per100Cal = food.per100g.calories;
      if (!(per100Cal > 0) || !(r.calories > 0)) { unmatched++; continue; }
      const grams = (r.calories / per100Cal) * 100;
      const scaled = scaleMicrosForGrams(micros100, grams);
      if (Object.keys(scaled).length === 0) { unmatched++; continue; }
      planned.push({ id: r.id, name: r.recipe_title ?? r.name, cal: r.calories, grams: Math.round(grams * 10) / 10, microCount: Object.keys(scaled).length, micros: scaled });
    }
    if (data.length < PAGE) break;
  }

  console.log(`Scanned ${scanned} entries | ${withMicros} already had micros | ${unmatched} skipped (not a baked generic food) | ${planned.length} to backfill\n`);
  for (const p of planned) {
    console.log(`  ${p.name.padEnd(18)} ${String(p.cal).padStart(5)}kcal → ~${p.grams}g → ${p.microCount} micros   [${p.id.slice(0, 8)}]`);
  }

  if (!APPLY) {
    console.log(`\nDRY RUN — nothing written. Re-run with --apply to backfill these ${planned.length} rows.`);
    return;
  }

  let ok = 0, fail = 0;
  for (const p of planned) {
    const { error } = await sb.from("nutrition_entries").update({ nutrition_micros: p.micros }).eq("id", p.id);
    if (error) { fail++; console.error(`  FAIL ${p.id.slice(0, 8)} ${p.name}: ${error.message}`); }
    else ok++;
  }
  console.log(`\nAPPLIED — ${ok} updated, ${fail} failed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
