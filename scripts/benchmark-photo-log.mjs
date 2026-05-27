/**
 * Photo-log accuracy benchmark — ENG-6
 *
 * Measures Suppr photo-log accuracy against manually weighed ground truth.
 * Pass rate target: midpoint calorie estimate within ±20% of actual for ≥75%
 * of meals (matching / exceeding Cal AI's reported accuracy).
 *
 * Usage:
 *   node scripts/benchmark-photo-log.mjs \
 *     --photos docs/testflight-feedback/photo-log-benchmark/photos \
 *     --ground-truth docs/testflight-feedback/photo-log-benchmark/ground-truth.csv \
 *     [--base-url http://localhost:3000] \
 *     [--token <supabase-anon-or-service-token>] \
 *     [--out docs/testflight-feedback/photo-log-benchmark-YYYY-MM-DD.json]
 *
 * Ground truth CSV columns (required):
 *   filename,actual_calories,actual_protein_g,actual_carbs_g,actual_fat_g
 *
 * Each "filename" must match a file in --photos dir.
 * actual_* values are the manually weighed totals for the whole plate.
 *
 * Exit 0 when ≥75% meals pass ±20% calorie threshold, else exit 1.
 */

import { readFileSync, createReadStream, existsSync, mkdirSync, writeFileSync } from "fs";
import { join, basename, extname } from "path";
import { createInterface } from "readline";
import { parseArgs } from "util";
import { FormData, File, fetch } from "undici";

// ── CLI args ────────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    photos: { type: "string" },
    "ground-truth": { type: "string" },
    "base-url": { type: "string", default: "http://localhost:3000" },
    token: { type: "string" },
    out: { type: "string" },
    concurrency: { type: "string", default: "2" },
    help: { type: "boolean", default: false },
  },
  strict: false,
});

if (args.help) {
  console.log(`Usage: node scripts/benchmark-photo-log.mjs \\
  --photos <dir>               Directory of meal photos (jpg/png/heic)
  --ground-truth <csv>         CSV with actual nutrition (see header in script)
  [--base-url http://...]      API base URL (default: http://localhost:3000)
  [--token <token>]            Bearer token for auth (falls back to SUPABASE_ANON_KEY env)
  [--out <json>]               Output JSON path (default: docs/testflight-feedback/photo-log-benchmark-DATE.json)
  [--concurrency N]            Parallel requests (default: 2)
`);
  process.exit(0);
}

const photosDir = args.photos;
const groundTruthPath = args["ground-truth"];
const baseUrl = args["base-url"] ?? "http://localhost:3000";
const token = args.token ?? process.env.SUPABASE_ANON_KEY ?? process.env.BENCHMARK_TOKEN ?? "";
const concurrency = parseInt(args.concurrency ?? "2", 10);
const today = new Date().toISOString().slice(0, 10);
const outPath =
  args.out ??
  join("docs/testflight-feedback", `photo-log-benchmark-${today}.json`);

if (!photosDir || !groundTruthPath) {
  console.error("Error: --photos and --ground-truth are required.\nRun with --help for usage.");
  process.exit(1);
}
if (!existsSync(photosDir)) {
  console.error(`Error: photos dir not found: ${photosDir}`);
  process.exit(1);
}
if (!existsSync(groundTruthPath)) {
  console.error(`Error: ground-truth CSV not found: ${groundTruthPath}`);
  process.exit(1);
}
if (!token) {
  console.error(
    "Error: provide --token or set SUPABASE_ANON_KEY / BENCHMARK_TOKEN in env.\n" +
    "Tip: in .env.local find NEXT_PUBLIC_SUPABASE_ANON_KEY — that works for local dev.",
  );
  process.exit(1);
}

// ── Parse ground truth CSV ───────────────────────────────────────────────────

/**
 * @typedef {{ filename: string, actual_calories: number, actual_protein_g: number,
 *             actual_carbs_g: number, actual_fat_g: number }} GroundTruth
 */

/** @returns {Promise<GroundTruth[]>} */
async function parseGroundTruth(path) {
  const lines = readFileSync(path, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    throw new Error("Ground truth CSV must have a header row and at least one data row.");
  }
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const required = ["filename", "actual_calories", "actual_protein_g", "actual_carbs_g", "actual_fat_g"];
  const missing = required.filter((r) => !header.includes(r));
  if (missing.length > 0) {
    throw new Error(`Ground truth CSV is missing columns: ${missing.join(", ")}`);
  }
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const row = {};
    for (let j = 0; j < header.length; j++) row[header[j]] = cells[j] ?? "";
    const filename = row["filename"];
    const cal = Number(row["actual_calories"]);
    const pro = Number(row["actual_protein_g"]);
    const carb = Number(row["actual_carbs_g"]);
    const fat = Number(row["actual_fat_g"]);
    if (!filename || isNaN(cal) || isNaN(pro) || isNaN(carb) || isNaN(fat)) {
      console.warn(`  [warn] skipping malformed row ${i + 1}: ${lines[i]}`);
      continue;
    }
    rows.push({ filename, actual_calories: cal, actual_protein_g: pro, actual_carbs_g: carb, actual_fat_g: fat });
  }
  return rows;
}

// ── Accuracy helpers ──────────────────────────────────────────────────────────

/** Percentage error of estimate vs actual. Returns null if actual = 0. */
function pctError(estimate, actual) {
  if (actual === 0) return null;
  return Math.abs((estimate - actual) / actual) * 100;
}

/** Midpoint of a {low,high} range. */
function mid(range) {
  if (!range) return null;
  return Math.round((range.low + range.high) / 2);
}

// ── API call ──────────────────────────────────────────────────────────────────

const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".heic": "image/heic",
  ".webp": "image/webp",
};

/** @returns {Promise<{ok:boolean, data?:any, error?:string, elapsedMs:number}>} */
async function runPhotoLog(photoPath) {
  const ext = extname(photoPath).toLowerCase();
  const mime = MIME_BY_EXT[ext] ?? "image/jpeg";
  const fileBytes = readFileSync(photoPath);
  const form = new FormData();
  form.append("image", new File([fileBytes], basename(photoPath), { type: mime }));

  const start = Date.now();
  let resp;
  try {
    resp = await fetch(`${baseUrl}/api/nutrition/photo-log`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch (e) {
    return { ok: false, error: String(e), elapsedMs: Date.now() - start };
  }
  const elapsedMs = Date.now() - start;
  let json;
  try {
    json = await resp.json();
  } catch {
    return { ok: false, error: `HTTP ${resp.status} — non-JSON body`, elapsedMs };
  }
  if (!resp.ok || !json.ok) {
    return { ok: false, error: json.error ?? `HTTP ${resp.status}`, data: json, elapsedMs };
  }
  return { ok: true, data: json, elapsedMs };
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`\nPhoto-log benchmark — ENG-6`);
  console.log(`  Photos dir  : ${photosDir}`);
  console.log(`  Ground truth: ${groundTruthPath}`);
  console.log(`  API base    : ${baseUrl}`);
  console.log(`  Concurrency : ${concurrency}`);
  console.log(`  Output      : ${outPath}\n`);

  const rows = await parseGroundTruth(groundTruthPath);
  console.log(`Loaded ${rows.length} ground-truth entries.\n`);

  const results = [];
  let passKcal = 0;
  let passProtein = 0;
  let passMacro = 0; // all 3 macros within ±25%
  let failures = 0;
  let errors = 0;
  const errorBreakdown = {};

  // Process in batches of `concurrency`
  for (let i = 0; i < rows.length; i += concurrency) {
    const batch = rows.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (gt) => {
        const photoPath = join(photosDir, gt.filename);
        if (!existsSync(photoPath)) {
          console.warn(`  [warn] photo not found: ${photoPath}`);
          return { gt, status: "photo_missing" };
        }
        process.stdout.write(`  [${i + batch.indexOf(gt) + 1}/${rows.length}] ${gt.filename} … `);
        const result = await runPhotoLog(photoPath);
        if (!result.ok) {
          console.log(`FAIL (${result.error}) ${result.elapsedMs}ms`);
          return { gt, status: "api_error", error: result.error, elapsedMs: result.elapsedMs };
        }
        const data = result.data;
        const estKcal = mid(data.totalKcal);
        const estProtein = data.items?.reduce((s, it) => s + (mid(it.protein) ?? 0), 0) ?? null;
        const estCarbs = data.items?.reduce((s, it) => s + (mid(it.carbs) ?? 0), 0) ?? null;
        const estFat = data.items?.reduce((s, it) => s + (mid(it.fat) ?? 0), 0) ?? null;

        const kcalErr = pctError(estKcal, gt.actual_calories);
        const proteinErr = pctError(estProtein, gt.actual_protein_g);
        const carbsErr = pctError(estCarbs, gt.actual_carbs_g);
        const fatErr = pctError(estFat, gt.actual_fat_g);

        const kcalPass = kcalErr !== null && kcalErr <= 20;
        const proteinPass = proteinErr !== null && proteinErr <= 25;
        const carbsPass = carbsErr !== null && carbsErr <= 25;
        const fatPass = fatErr !== null && fatErr <= 25;
        const macroAllPass = proteinPass && carbsPass && fatPass;

        console.log(
          `${kcalPass ? "✓" : "✗"} ${estKcal}kcal actual=${gt.actual_calories}kcal (${kcalErr?.toFixed(1) ?? "?"}% err) ${result.elapsedMs}ms`,
        );

        return {
          gt,
          status: "ok",
          estimate: { kcal: estKcal, protein: estProtein, carbs: estCarbs, fat: estFat },
          errors_pct: { kcal: kcalErr, protein: proteinErr, carbs: carbsErr, fat: fatErr },
          passes: { kcal: kcalPass, protein: proteinPass, carbs: carbsPass, fat: fatPass, macro_all: macroAllPass },
          itemCount: data.items?.length ?? 0,
          confidenceTier: data.items?.every((it) => it.confidence === "high")
            ? "high"
            : data.items?.some((it) => it.confidence === "low")
              ? "low"
              : "medium",
          elapsedMs: result.elapsedMs,
          rawResponse: data,
        };
      }),
    );

    for (const r of batchResults) {
      results.push(r);
      if (r.status === "ok") {
        if (r.passes.kcal) passKcal++;
        if (r.passes.protein) passProtein++;
        if (r.passes.macro_all) passMacro++;
      } else {
        if (r.status === "api_error") {
          errors++;
          const key = r.error ?? "unknown";
          errorBreakdown[key] = (errorBreakdown[key] ?? 0) + 1;
        } else {
          failures++;
        }
      }
    }
  }

  const total = rows.length;
  const attempted = results.filter((r) => r.status === "ok").length;
  const kcalPassRate = attempted > 0 ? (passKcal / attempted) * 100 : 0;
  const proteinPassRate = attempted > 0 ? (passProtein / attempted) * 100 : 0;
  const macroPassRate = attempted > 0 ? (passMacro / attempted) * 100 : 0;

  // MAPE over successful meals
  const kcalErrors = results
    .filter((r) => r.status === "ok" && r.errors_pct.kcal !== null)
    .map((r) => r.errors_pct.kcal);
  const kcalMape =
    kcalErrors.length > 0 ? kcalErrors.reduce((a, b) => a + b, 0) / kcalErrors.length : null;

  console.log(`\n${"─".repeat(60)}`);
  console.log(`RESULTS  (${attempted}/${total} meals attempted, ${errors} API errors, ${failures} missing photos)`);
  console.log(`  Calorie accuracy  (±20%): ${passKcal}/${attempted} = ${kcalPassRate.toFixed(1)}%  ${kcalPassRate >= 75 ? "✓ PASS" : "✗ FAIL"}`);
  console.log(`  Protein accuracy  (±25%): ${passProtein}/${attempted} = ${proteinPassRate.toFixed(1)}%`);
  console.log(`  All macros (±25%):        ${passMacro}/${attempted} = ${macroPassRate.toFixed(1)}%`);
  console.log(`  Calorie MAPE:             ${kcalMape !== null ? kcalMape.toFixed(1) + "%" : "n/a"}`);
  if (Object.keys(errorBreakdown).length > 0) {
    console.log(`  API errors: ${JSON.stringify(errorBreakdown)}`);
  }

  const TARGET_PASS_RATE = 75;
  const overallPass = kcalPassRate >= TARGET_PASS_RATE;
  console.log(`\n${"─".repeat(60)}`);
  console.log(`VERDICT: ${overallPass ? "✓ PASS (≥75% ±20% kcal)" : "✗ FAIL (<75% ±20% kcal)"}`);

  const report = {
    date: today,
    version: "1.0",
    target: { kcal_within_20pct: TARGET_PASS_RATE },
    summary: {
      total,
      attempted,
      errors,
      failures,
      passKcal,
      passProtein,
      passMacro,
      kcalPassRate: parseFloat(kcalPassRate.toFixed(2)),
      proteinPassRate: parseFloat(proteinPassRate.toFixed(2)),
      macroPassRate: parseFloat(macroPassRate.toFixed(2)),
      kcalMape: kcalMape !== null ? parseFloat(kcalMape.toFixed(2)) : null,
      overallPass,
      errorBreakdown,
    },
    meals: results.map((r) => ({
      filename: r.gt.filename,
      actual: { kcal: r.gt.actual_calories, protein: r.gt.actual_protein_g, carbs: r.gt.actual_carbs_g, fat: r.gt.actual_fat_g },
      estimate: r.estimate ?? null,
      errors_pct: r.errors_pct ?? null,
      passes: r.passes ?? null,
      status: r.status,
      error: r.error ?? null,
      itemCount: r.itemCount ?? null,
      confidenceTier: r.confidenceTier ?? null,
      elapsedMs: r.elapsedMs ?? null,
    })),
  };

  const outDir = outPath.split("/").slice(0, -1).join("/");
  if (outDir && !existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${outPath}`);

  process.exit(overallPass ? 0 : 1);
})();
