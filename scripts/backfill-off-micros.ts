/**
 * ENG-738 — backfill nutrition_micros on EXISTING Open Food Facts logs that
 * were written before full OFF micros were wired into the log path (they stored
 * only fiber, or nothing, even though OFF has sugar/sodium/sat-fat/etc).
 *
 * These entries have NO source_id (barcode), so we re-find the product by name
 * on OFF and CONFIRM it's the same item with a scale-invariant MACRO-RATIO match
 * (carbs/kcal + fat/kcal + protein/kcal within tolerance) before trusting it.
 * Then derive grams from the logged calories vs the product's per-100g energy,
 * reconcile (serving→per-100g), parse the full micro set, scale, and MERGE into
 * the existing micros (never drop a real value; fill the gaps).
 *
 * Dry-run (default): prints matches + what would be written.
 *   node --env-file=.env.local --import tsx scripts/backfill-off-micros.ts
 * Apply:  ... scripts/backfill-off-micros.ts --apply
 */
import { createClient } from "@supabase/supabase-js";
import { reconcileOffPer100g } from "../src/lib/openFoodFacts/reconcilePer100g";
import { parseOffMicrosPer100g, scaleMicrosForGrams } from "../src/lib/openFoodFacts/parseOffMicros";

const APPLY = process.argv.includes("--apply");
const UA = { "User-Agent": "Suppr/1.0 (gracehowse@outlook.com)" };
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Row = { id: string; recipe_title: string | null; calories: number; protein: number; carbs: number; fat: number; nutrition_micros: any };

// Strip "Brand · " prefix + "(123 g)"/"(4 pieces)" suffix to a clean search query.
function cleanQuery(title: string): string {
  return title.replace(/\s*\([^)]*\)\s*$/, "").replace(/^.*·\s*/, "").trim() || title;
}
function ratio(a: number, b: number): number { return b > 0 ? a / b : 0; }
function within(a: number, b: number, tol: number): boolean {
  if (a === 0 && b === 0) return true;
  const hi = Math.max(Math.abs(a), Math.abs(b));
  return hi === 0 ? true : Math.abs(a - b) / hi <= tol;
}

async function offSearch(q: string): Promise<any[]> {
  try {
    const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=10&fields=code,product_name,brands,nutriments,nutrition_data_per,serving_quantity`;
    const r = await fetch(url, { headers: UA });
    const j: any = await r.json();
    return j.hits || [];
  } catch { return []; }
}

async function main() {
  console.log(`ENG-738 OFF micros backfill — ${APPLY ? "APPLY" : "DRY RUN"}\n`);
  const { data } = await sb.from("nutrition_entries")
    .select("id,recipe_title,calories,protein,carbs,fat,nutrition_micros")
    .eq("source", "Open Food Facts").returns<Row[]>();
  const rows = data ?? [];
  let matched = 0, noMatch = 0, alreadyFull = 0;
  const planned: Array<{ id: string; title: string; code: string; grams: number; before: number; after: number; micros: Record<string, number> }> = [];

  for (const r of rows) {
    const existing = (r.nutrition_micros && typeof r.nutrition_micros === "object") ? r.nutrition_micros as Record<string, number> : {};
    const hits = await offSearch(cleanQuery(r.recipe_title ?? ""));
    await sleep(200);
    // Confirm same product via scale-invariant macro ratios vs the entry.
    let best: { p: any; kcal100: number } | null = null;
    for (const p of hits) {
      const n = p.nutriments || {};
      const recon = reconcileOffPer100g(n, p);
      const kcal100 = recon.calories;
      if (!(kcal100 > 0) || !(r.calories > 0)) continue;
      const okC = within(ratio(r.carbs, r.calories), ratio(recon.carbs, kcal100), 0.18);
      const okF = within(ratio(r.fat, r.calories), ratio(recon.fat, kcal100), 0.18);
      const okP = within(ratio(r.protein, r.calories), ratio(recon.protein, kcal100), 0.25);
      if (okC && okF && okP) { best = { p, kcal100 }; break; }
    }
    if (!best) { noMatch++; continue; }
    matched++;
    const n = best.p.nutriments || {};
    const recon = reconcileOffPer100g(n, best.p);
    const grams = (r.calories / best.kcal100) * 100;
    const micros100 = parseOffMicrosPer100g(n, recon.per100gFactor);
    const scaled = scaleMicrosForGrams(micros100, grams);
    // Merge: keep every existing real value, add the gaps.
    const merged = { ...scaled, ...existing };
    const beforeN = Object.keys(existing).length, afterN = Object.keys(merged).length;
    if (afterN <= beforeN) { alreadyFull++; continue; }
    planned.push({ id: r.id, title: r.recipe_title ?? "", code: best.p.code, grams: Math.round(grams * 10) / 10, before: beforeN, after: afterN, micros: merged });
  }

  console.log(`OFF entries ${rows.length} | matched ${matched} | no confident match ${noMatch} | already complete ${alreadyFull} | to backfill ${planned.length}\n`);
  for (const p of planned) console.log(`  ${p.title.slice(0, 42).padEnd(42)} ${p.before}→${p.after} fields  ~${p.grams}g  [off ${p.code}]`);

  if (!APPLY) { console.log(`\nDRY RUN — nothing written. --apply to backfill ${planned.length} rows.`); return; }
  let ok = 0, fail = 0;
  for (const p of planned) {
    const { error } = await sb.from("nutrition_entries").update({ nutrition_micros: p.micros }).eq("id", p.id);
    if (error) { fail++; console.error(`  FAIL ${p.id.slice(0,8)}: ${error.message}`); } else ok++;
  }
  console.log(`\nAPPLIED — ${ok} updated, ${fail} failed.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
