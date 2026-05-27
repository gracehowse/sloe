/**
 * ENG-738 — bake real USDA Foundation/SR-Legacy micronutrients into the generic
 * food + beverage dictionaries.
 *
 * For each GENERIC_FOODS / GENERIC_BEVERAGES entry we search USDA FDC (Foundation
 * + SR Legacy only — no branded, no mixed-dish Survey rows), fetch the detail for
 * the top candidates, and pick the one whose kcal/100g is CLOSEST to the entry's
 * existing `per100g.calories`. That calorie anchor is the no-blind-match guard
 * (CLAUDE.md: don't guess nutrition) — a candidate is only accepted if its kcal
 * is within TOLERANCE of the dictionary value; otherwise it's flagged `review`.
 *
 * Output: scripts/out/generic-micros-bake.json — a review report. It does NOT
 * edit the dictionaries; a human splices the `micros` (with the cited fdcId) into
 * genericFoods.ts / genericBeverages.ts after eyeballing the report.
 *
 * Run:  node --env-file=.env.local --import tsx scripts/bake-generic-micros.ts
 * Needs a VALID USDA_FDC_API_KEY in .env.local (40 alphanumeric; api.data.gov).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fdcConfigFromEnv, fdcFoodsSearch, fdcFoodGet, type FdcFood } from "../src/lib/usda/fdcClient";
import { fdcFoodMacrosPer100g, fdcFoodMicrosPer100g } from "../src/lib/nutrition/usdaNormalize";
import { GENERIC_FOODS } from "../src/lib/nutrition/genericFoods";
import { GENERIC_BEVERAGES } from "../src/lib/nutrition/genericBeverages";

const TOLERANCE = 0.25; // accept a USDA row only if kcal within ±25% of the dict anchor
const CANDIDATES_PER_ENTRY = 6; // detail-fetch the top N search hits, pick best kcal match
const DELAY_MS = 120; // politeness between detail fetches

type Entry = { id: string; name: string; aliases: ReadonlyArray<string>; anchorKcal: number; subtitle?: string };

type Result = {
  kind: "food" | "beverage";
  id: string;
  name: string;
  query: string;
  anchorKcal: number;
  chosenFdcId: number | null;
  chosenDesc: string | null;
  chosenDataType: string | null;
  chosenKcal: number | null;
  kcalDeltaPct: number | null;
  microCount: number;
  micros: Record<string, number>;
  status: "ok" | "review";
  note?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function resolveEntry(cfg: ReturnType<typeof fdcConfigFromEnv>, kind: "food" | "beverage", e: Entry): Promise<Result> {
  const query = e.name;
  const anchorKcal = e.anchorKcal;
  const base: Result = {
    kind, id: e.id, name: e.name, query, anchorKcal,
    chosenFdcId: null, chosenDesc: null, chosenDataType: null, chosenKcal: null,
    kcalDeltaPct: null, microCount: 0, micros: {}, status: "review",
  };

  let hits;
  try {
    hits = await fdcFoodsSearch(cfg, query, { dataType: ["Foundation", "SR Legacy"], pageSize: CANDIDATES_PER_ENTRY });
  } catch (err) {
    return { ...base, note: `search failed: ${(err as Error).message}` };
  }
  if (!hits.length) return { ...base, note: "no Foundation/SR-Legacy hits" };

  // Prefer rows that match the subtitle hint (e.g. "Raw") on ties.
  const prefersRaw = (e.subtitle ?? "").toLowerCase().includes("raw");

  let best: { food: FdcFood; kcal: number; delta: number; raw: boolean } | null = null;
  for (const hit of hits.slice(0, CANDIDATES_PER_ENTRY)) {
    let detail: FdcFood | null;
    try {
      detail = await fdcFoodGet(cfg, hit.fdcId);
    } catch {
      detail = null;
    }
    await sleep(DELAY_MS);
    if (!detail) continue;
    const kcal = fdcFoodMacrosPer100g(detail).calories;
    if (!Number.isFinite(kcal) || kcal <= 0) continue;
    const delta = Math.abs(kcal - anchorKcal) / Math.max(1, anchorKcal);
    const raw = (detail.description ?? "").toLowerCase().includes("raw");
    const better =
      !best ||
      delta < best.delta - 0.02 || // clearly closer kcal
      (Math.abs(delta - best.delta) <= 0.02 && prefersRaw && raw && !best.raw); // tie → prefer raw
    if (better) best = { food: detail, kcal, delta, raw };
  }

  if (!best) return { ...base, note: "no candidate detail fetched" };

  const micros = fdcFoodMicrosPer100g(best.food);
  const microCount = Object.keys(micros).length;
  const withinTol = best.delta <= TOLERANCE;
  return {
    ...base,
    chosenFdcId: best.food.fdcId,
    chosenDesc: best.food.description,
    chosenDataType: best.food.dataType ?? null,
    chosenKcal: Math.round(best.kcal * 10) / 10,
    kcalDeltaPct: Math.round(best.delta * 1000) / 10,
    microCount,
    micros,
    status: withinTol && microCount > 0 ? "ok" : "review",
    note: !withinTol ? `kcal off by ${(best.delta * 100).toFixed(0)}% — verify match` : microCount === 0 ? "USDA row has no micros — verify" : undefined,
  };
}

async function main() {
  const cfg = fdcConfigFromEnv();
  const results: Result[] = [];
  const all: Array<["food" | "beverage", Entry]> = [
    ...GENERIC_FOODS.map(
      (f) =>
        ["food", { id: f.id, name: f.name, aliases: f.aliases, anchorKcal: f.per100g.calories, subtitle: f.subtitle }] as [
          "food",
          Entry,
        ],
    ),
    ...GENERIC_BEVERAGES.map(
      (b) =>
        ["beverage", { id: b.id, name: b.name, aliases: b.aliases, anchorKcal: b.per100ml.calories, subtitle: b.subtitle }] as [
          "beverage",
          Entry,
        ],
    ),
  ];
  console.log(`Baking micros for ${all.length} generic entries (${GENERIC_FOODS.length} foods + ${GENERIC_BEVERAGES.length} beverages)…\n`);
  for (const [kind, e] of all) {
    const r = await resolveEntry(cfg, kind, e);
    results.push(r);
    const flag = r.status === "ok" ? "✓" : "⚠";
    console.log(`${flag} ${e.id.padEnd(20)} ${String(r.microCount).padStart(2)} micros  kcal ${r.chosenKcal ?? "-"}/${r.anchorKcal} (Δ${r.kcalDeltaPct ?? "?"}%)  fdc ${r.chosenFdcId ?? "-"}  ${r.note ?? ""}`);
  }
  mkdirSync("scripts/out", { recursive: true });
  writeFileSync("scripts/out/generic-micros-bake.json", JSON.stringify(results, null, 2));
  const ok = results.filter((r) => r.status === "ok").length;
  console.log(`\nDone. ${ok}/${results.length} clean, ${results.length - ok} flagged for review.`);
  console.log("Report: scripts/out/generic-micros-bake.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
