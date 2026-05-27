/**
 * ENG-738 — backfill nutrition_micros on EXISTING Edamam logs that were
 * written before the full Edamam micro panel was wired into the log path
 * (they stored only fiber/sugar/sodium because the SELECT path read the
 * minimal `/parser` hit, not the full `/nutrients` panel).
 *
 * These entries have no stable foodId stored, so we re-find the food by name
 * on Edamam's `/parser` endpoint and CONFIRM it's the same item with a
 * scale-invariant MACRO-RATIO match (carbs/kcal + fat/kcal vs the entry,
 * within tolerance) before trusting it. Then call `/nutrients` (100 g gram
 * basis → per-100g panel), derive grams from the logged calories vs the
 * food's per-100g energy, scale the per-100g micros, and MERGE into the
 * existing micros (never drop a real value; fill the gaps).
 *
 * Dry-run (default): prints matches + what would be written.
 *   node --env-file=.env.local --import tsx scripts/backfill-edamam-micros.ts
 * Apply:  ... scripts/backfill-edamam-micros.ts --apply
 */
import { createClient } from "@supabase/supabase-js";
import {
  edamamConfigFromEnv,
  edamamFoodSearch,
  edamamFoodMacrosPer100g,
  fetchEdamamMicrosPer100g,
} from "../src/lib/edamam/client";
import { scaleMicrosForGrams } from "../src/lib/openFoodFacts/parseOffMicros";

const APPLY = process.argv.includes("--apply");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Row = {
  id: string;
  recipe_title: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  nutrition_micros: unknown;
};

// Strip "Brand · " prefix + "(123 g)" / "(4 pieces)" suffix to a clean query.
function cleanQuery(title: string): string {
  return title
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/^.*·\s*/, "")
    .trim() || title;
}
function ratio(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}
function within(a: number, b: number, tol: number): boolean {
  if (a === 0 && b === 0) return true;
  const hi = Math.max(Math.abs(a), Math.abs(b));
  return hi === 0 ? true : Math.abs(a - b) / hi <= tol;
}

async function main() {
  console.log(`ENG-738 Edamam micros backfill — ${APPLY ? "APPLY" : "DRY RUN"}\n`);

  const cfg = edamamConfigFromEnv();
  if (!cfg) {
    console.error("Missing EDAMAM_APP_ID / EDAMAM_APP_KEY — aborting.");
    process.exit(1);
  }

  const { data } = await sb
    .from("nutrition_entries")
    .select("id,recipe_title,calories,protein,carbs,fat,nutrition_micros")
    .eq("source", "Edamam")
    .returns<Row[]>();
  const rows = data ?? [];

  let matched = 0,
    noMatch = 0,
    alreadyFull = 0;
  const planned: Array<{
    id: string;
    title: string;
    foodId: string;
    grams: number;
    before: number;
    after: number;
    micros: Record<string, number>;
  }> = [];

  for (const r of rows) {
    const existing =
      r.nutrition_micros && typeof r.nutrition_micros === "object"
        ? (r.nutrition_micros as Record<string, number>)
        : {};

    // Re-find the food by name on `/parser`.
    let hits: Awaited<ReturnType<typeof edamamFoodSearch>> = [];
    try {
      hits = await edamamFoodSearch(cfg, cleanQuery(r.recipe_title ?? ""), { pageSize: 10 });
    } catch {
      hits = [];
    }
    await sleep(200);

    // Confirm same product via scale-invariant macro ratios vs the entry.
    let best: { foodId: string; kcal100: number } | null = null;
    for (const h of hits) {
      const m = edamamFoodMacrosPer100g(h.food);
      const kcal100 = m.calories;
      if (!(kcal100 > 0) || !(r.calories > 0)) continue;
      const okC = within(ratio(r.carbs, r.calories), ratio(m.carbs, kcal100), 0.18);
      const okF = within(ratio(r.fat, r.calories), ratio(m.fat, kcal100), 0.18);
      const okP = within(ratio(r.protein, r.calories), ratio(m.protein, kcal100), 0.25);
      if (okC && okF && okP) {
        best = { foodId: h.food.foodId, kcal100 };
        break;
      }
    }
    if (!best) {
      noMatch++;
      continue;
    }
    matched++;

    // Pull the full per-100g panel from `/nutrients`, scale by derived grams.
    let micros100: Record<string, number> = {};
    try {
      micros100 = await fetchEdamamMicrosPer100g(cfg, best.foodId);
    } catch {
      micros100 = {};
    }
    await sleep(200);

    const grams = (r.calories / best.kcal100) * 100;
    const scaled = scaleMicrosForGrams(micros100, grams);
    // Merge: keep every existing real value, add the gaps.
    const merged = { ...scaled, ...existing };
    const beforeN = Object.keys(existing).length;
    const afterN = Object.keys(merged).length;
    if (afterN <= beforeN) {
      alreadyFull++;
      continue;
    }
    planned.push({
      id: r.id,
      title: r.recipe_title ?? "",
      foodId: best.foodId,
      grams: Math.round(grams * 10) / 10,
      before: beforeN,
      after: afterN,
      micros: merged,
    });
  }

  console.log(
    `Edamam entries ${rows.length} | matched ${matched} | no confident match ${noMatch} | already complete ${alreadyFull} | to backfill ${planned.length}\n`,
  );
  for (const p of planned) {
    console.log(`  ${p.title.slice(0, 42).padEnd(42)} ${p.before}→${p.after} fields  ~${p.grams}g  [edamam ${p.foodId}]`);
  }

  if (!APPLY) {
    console.log(`\nDRY RUN — nothing written. --apply to backfill ${planned.length} rows.`);
    return;
  }
  let ok = 0,
    fail = 0;
  for (const p of planned) {
    const { error } = await sb.from("nutrition_entries").update({ nutrition_micros: p.micros }).eq("id", p.id);
    if (error) {
      fail++;
      console.error(`  FAIL ${p.id.slice(0, 8)}: ${error.message}`);
    } else ok++;
  }
  console.log(`\nAPPLIED — ${ok} updated, ${fail} failed.`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
