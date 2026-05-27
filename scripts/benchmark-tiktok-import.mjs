/**
 * ENG-7 — TikTok recipe import benchmark.
 *
 * Runs a list of TikTok URLs through the local recipe import API and
 * reports the pass/fail breakdown needed to confirm ≥90% success rate.
 *
 * Usage:
 *   1. Ensure `npm run dev` is running (defaults to http://localhost:3000)
 *   2. Create a file with one TikTok URL per line (see --input flag)
 *   3. node scripts/benchmark-tiktok-import.mjs --input urls.txt
 *
 * Options:
 *   --input <file>   Path to file with one TikTok URL per line (default: scripts/tiktok-benchmark-urls.txt)
 *   --base  <url>    API base URL (default: http://localhost:3000)
 *   --token <jwt>    Bearer token for auth (reads from .env.local BENCHMARK_JWT if absent)
 *   --concurrency    Max parallel requests (default: 3)
 *   --out   <file>   Write JSON results to file (default: docs/testflight-feedback/tiktok-benchmark-YYYY-MM-DD.json)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
};

const inputFile = getArg("--input") ?? path.join(ROOT, "scripts/tiktok-benchmark-urls.txt");
const baseUrl = getArg("--base") ?? "http://localhost:3000";
const concurrency = parseInt(getArg("--concurrency") ?? "3", 10);
const datestamp = new Date().toISOString().slice(0, 10);
const defaultOut = path.join(ROOT, `docs/testflight-feedback/tiktok-benchmark-${datestamp}.json`);
const outFile = getArg("--out") ?? defaultOut;

// Read bearer token
let token = getArg("--token");
if (!token) {
  const envPath = path.join(ROOT, ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const m = envContent.match(/^BENCHMARK_JWT=(.+)$/m);
    if (m) token = m[1].trim();
  }
}
if (!token) {
  console.error(
    "No auth token. Set BENCHMARK_JWT in .env.local or pass --token <jwt>.\n" +
      "Generate one: sign in to the app, open DevTools → Application → Cookies → supabase-auth-token → copy the access_token value.",
  );
  process.exit(1);
}

// Read URLs
if (!fs.existsSync(inputFile)) {
  console.error(
    `Input file not found: ${inputFile}\n` +
      "Create it with one TikTok URL per line, e.g.:\n" +
      "  https://www.tiktok.com/@user/video/1234567890\n" +
      "  https://vm.tiktok.com/XXXXXXXX/",
  );
  process.exit(1);
}

const rawUrls = fs
  .readFileSync(inputFile, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

if (rawUrls.length === 0) {
  console.error("No URLs found in input file.");
  process.exit(1);
}

console.log(`Benchmarking ${rawUrls.length} URLs against ${baseUrl}/api/recipe-import`);
console.log(`Concurrency: ${concurrency}\n`);

// Run in batches
async function testUrl(url) {
  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}/api/recipe-import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url }),
    });
    const elapsed = Date.now() - start;
    const body = await res.json().catch(() => ({}));

    if (!res.ok || !body.ok) {
      return {
        url,
        ok: false,
        status: res.status,
        error: body.error ?? "unknown",
        message: body.message ?? null,
        elapsedMs: elapsed,
      };
    }

    const r = body.recipe ?? {};
    return {
      url,
      ok: true,
      status: res.status,
      title: r.title ?? null,
      ingredientCount: (r.ingredients ?? []).length,
      stepCount: (r.instructions ?? []).length,
      calories: r.calories ?? 0,
      imageUsed: body.imageUsed ?? null,
      elapsedMs: elapsed,
    };
  } catch (e) {
    return {
      url,
      ok: false,
      status: 0,
      error: "network_error",
      message: e.message,
      elapsedMs: Date.now() - start,
    };
  }
}

async function runBatch(urls) {
  return Promise.all(urls.map(testUrl));
}

const results = [];
let done = 0;
const total = rawUrls.length;

for (let i = 0; i < total; i += concurrency) {
  const batch = rawUrls.slice(i, i + concurrency);
  const batchResults = await runBatch(batch);
  results.push(...batchResults);
  done += batchResults.length;

  for (const r of batchResults) {
    const badge = r.ok ? "✓" : "✗";
    const detail = r.ok
      ? `${r.ingredientCount} ingredients, ${r.stepCount} steps — "${r.title ?? "(no title)"}"`
      : `${r.error}: ${r.message ?? ""}`;
    console.log(`[${done}/${total}] ${badge} ${r.url.slice(0, 70)} (${r.elapsedMs}ms)`);
    if (!r.ok) console.log(`       → ${detail}`);
  }
}

// Summary
const passed = results.filter((r) => r.ok && r.ingredientCount > 0);
const passedNoIngredients = results.filter((r) => r.ok && r.ingredientCount === 0);
const failed = results.filter((r) => !r.ok);
const successRate = (passed.length / total) * 100;

const errorBreakdown = {};
for (const f of failed) {
  errorBreakdown[f.error ?? "unknown"] = (errorBreakdown[f.error ?? "unknown"] ?? 0) + 1;
}

console.log("\n─────────────────────────────────────────");
console.log(`Total URLs:           ${total}`);
console.log(`✓ With ingredients:   ${passed.length} (${successRate.toFixed(1)}%)`);
console.log(`~ OK but no ingredients: ${passedNoIngredients.length}`);
console.log(`✗ Failed:             ${failed.length}`);
if (Object.keys(errorBreakdown).length > 0) {
  console.log("\nError breakdown:");
  for (const [err, count] of Object.entries(errorBreakdown)) {
    console.log(`  ${err}: ${count}`);
  }
}
console.log("─────────────────────────────────────────");
if (successRate >= 90) {
  console.log(`✓ PASSES ≥90% target (${successRate.toFixed(1)}%)`);
} else {
  console.log(`✗ BELOW target — need ${Math.ceil(total * 0.9 - passed.length)} more to pass (${successRate.toFixed(1)}%)`);
}

// Write JSON output
const output = {
  runAt: new Date().toISOString(),
  total,
  passedWithIngredients: passed.length,
  passedNoIngredients: passedNoIngredients.length,
  failed: failed.length,
  successRate: parseFloat(successRate.toFixed(1)),
  targetMet: successRate >= 90,
  errorBreakdown,
  results,
};

const outDir = path.dirname(outFile);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(output, null, 2));
console.log(`\nResults written to ${outFile}`);
