/**
 * TikTok / Reel import parse-rate benchmark — GROW-61 / GROW-62.
 *
 * Produces a TRUSTWORTHY number for the recipe-import success gate (GROW-62:
 * ≥90% usable imports on 100 random TikTok food Reels). Rewritten 2026-07-01
 * (recipe-import audit fix #2) after the audit found the previous version
 * scored the WRONG signal:
 *   - offline it checked `platform !== "other" && captionLen >= 40` and called
 *     that a "pass rate";
 *   - `--live` POSTed a `captionText` the `/api/recipe-import` route IGNORES,
 *     then treated any `res.ok` as a pass — so zero-macro shells scored as
 *     success.
 *
 * What it does now — scores each URL against THREE definitions (see the audit's
 * success-definition analysis) and reports all three:
 *
 *   A. Recipe-object-returned (vanity)  — `ok && ingredients > 0`.
 *   B. Strict success (the LAUNCH GATE) — `ok` AND ingredients AND per-serving
 *      calories > 0 AND ingredient_match_rate >= THRESHOLD (default 0.7).
 *   Caption-present rate                — how many URLs yielded extractable
 *      recipe text at all (the FM-1 structural ceiling: how much of the gap is
 *      the legal caption-only posture vs the parser).
 *
 * The Definition-B predicate + the three-way scoring live in the pure,
 * unit-tested module `scripts/lib/reelImportScore.mjs`.
 *
 * Usage:
 *   # Offline URL-shape precheck (no server, no auth) — NOT a success rate:
 *   node scripts/benchmark-tiktok-import.mjs --urls scripts/fixtures/reel-import-seed-urls.txt
 *
 *   # Live gate measurement (dev server + authed bearer token):
 *   npm run dev
 *   export BENCHMARK_BEARER=<supabase-session-jwt for a test account>
 *   node scripts/benchmark-tiktok-import.mjs --live \
 *     --urls scripts/fixtures/reel-import-seed-urls.txt \
 *     --base-url http://localhost:3000
 *
 * The route requires an AUTHED user and rate-limits 20 imports/min, so a real
 * GROW-62 run needs a valid bearer + a URL file the harness paces under the
 * limit. See docs/growth/reel-import-gate.md.
 *
 * The seed fixture ships 3–5 real-shaped TikTok food-Reel URLs so the harness
 * is runnable out of the box. The real GROW-62 run needs 100 RANDOM food-Reel
 * URLs sourced separately (owner: founder / growth) — do NOT hardcode 100 URLs
 * here.
 *
 * Exit code:
 *   - live mode:    0 iff Definition-B rate >= --gate (default 90), else 1.
 *   - offline mode: 0 iff every input URL is a well-formed social URL, else 1.
 *     (Offline is a shape precheck; it does NOT gate on a success rate.)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { parseArgs } from "node:util";
import {
  MATCH_RATE_THRESHOLD,
  classifyImportResult,
  summarise,
} from "./lib/reelImportScore.mjs";

const { values: args } = parseArgs({
  options: {
    urls: { type: "string" },
    live: { type: "boolean", default: false },
    "base-url": { type: "string", default: "http://localhost:3000" },
    "match-threshold": { type: "string" },
    gate: { type: "string", default: "90" },
    "throttle-ms": { type: "string", default: "3200" },
    out: { type: "string" },
    help: { type: "boolean", default: false },
  },
  strict: false,
});

if (args.help) {
  console.log(
    [
      "Usage: node scripts/benchmark-tiktok-import.mjs --urls <file> [options]",
      "",
      "  --urls <file>          URL list (newline-delimited or a JSON array). Required.",
      "  --live                 POST { url } to /api/recipe-import (needs a dev server + auth).",
      "  --base-url <url>       Dev server base URL (default http://localhost:3000).",
      "  --match-threshold <n>  Definition-B ingredient_match_rate floor (default " +
        MATCH_RATE_THRESHOLD +
        ").",
      "  --gate <pct>           Live exit-gate on Definition-B rate (default 90).",
      "  --throttle-ms <ms>     Delay between live requests (route limits 20/min; default 3200).",
      "  --out <file>           JSON report path.",
      "",
      "Auth (live): set BENCHMARK_BEARER (preferred) or BENCHMARK_TOKEN to a Supabase session JWT.",
    ].join("\n"),
  );
  process.exit(0);
}

const threshold =
  args["match-threshold"] != null
    ? Math.max(0, Math.min(1, Number.parseFloat(args["match-threshold"])))
    : MATCH_RATE_THRESHOLD;
const gatePct = Math.max(0, Math.min(100, Number.parseInt(args.gate, 10) || 90));
const throttleMs = Math.max(0, Number.parseInt(args["throttle-ms"], 10) || 0);

const today = new Date().toISOString().slice(0, 10);
const outPath =
  args.out ?? join("docs/testflight-feedback", `reel-import-benchmark-${today}.json`);

/** Parse a URL file: JSON array of strings, or newline-delimited (# comments). */
function loadUrls(file) {
  if (!file) {
    console.error(
      "Missing --urls <file>. Ship/point at a URL list, e.g. scripts/fixtures/reel-import-seed-urls.txt",
    );
    process.exit(1);
  }
  if (!existsSync(file)) {
    console.error(`URL file not found: ${file}`);
    process.exit(1);
  }
  const raw = readFileSync(file, "utf8").trim();
  let urls;
  if (raw.startsWith("[")) {
    try {
      urls = JSON.parse(raw);
    } catch {
      console.error(`URL file ${file} looks like JSON but did not parse.`);
      process.exit(1);
    }
  } else {
    urls = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
  }
  urls = (Array.isArray(urls) ? urls : []).map(String).filter(Boolean);
  if (urls.length === 0) {
    console.error(`No URLs found in ${file}.`);
    process.exit(1);
  }
  return urls;
}

/** Well-formed social URL check for the offline shape precheck. */
function isSocialUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.includes("tiktok.com") ||
      host.includes("instagram.com") ||
      host.includes("youtube.com") ||
      host === "youtu.be"
    );
  } catch {
    return false;
  }
}

/** POST { url } ONLY (the route ignores captionText — the old bug). */
async function runLive(url, token) {
  const res = await fetch(`${args["base-url"]}/api/recipe-import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ url }),
  });
  const json = await res.json().catch(() => ({}));
  const ok = res.ok && json && json.ok === true;
  return { status: res.status, ok, recipe: (json && json.recipe) ?? null };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const urls = loadUrls(args.urls);

// --------------------------------------------------------------------------
// OFFLINE MODE — URL-shape precheck. NOT a success rate. (relabelled per audit)
// --------------------------------------------------------------------------
if (!args.live) {
  const rows = urls.map((url) => ({ url, wellFormed: isSocialUrl(url) }));
  const wellFormed = rows.filter((r) => r.wellFormed).length;
  console.log(`Reel-import benchmark — OFFLINE URL-shape precheck (${urls.length} URLs)`);
  console.log(
    `  This checks URL shape only. It is NOT a parse-rate / success number —`,
  );
  console.log(`  run with --live against a dev server for Definition A/B/caption rates.`);
  console.log(`  Well-formed social URLs: ${wellFormed}/${urls.length}`);
  for (const r of rows) {
    console.log(`    ${r.wellFormed ? "OK " : "BAD"}  ${r.url}`);
  }
  const report = {
    date: today,
    mode: "offline_url_shape_precheck",
    urlCount: urls.length,
    wellFormedCount: wellFormed,
    note: "URL-shape precheck only — not a success rate. Live mode measures Definition A/B/caption.",
    rows,
  };
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`Report → ${outPath}`);
  process.exit(wellFormed === urls.length ? 0 : 1);
}

// --------------------------------------------------------------------------
// LIVE MODE — the real GROW-62 measurement.
// --------------------------------------------------------------------------
const token = process.env.BENCHMARK_BEARER ?? process.env.BENCHMARK_TOKEN ?? "";
if (!token) {
  console.error(
    "Live mode requires an auth bearer: set BENCHMARK_BEARER (preferred) or BENCHMARK_TOKEN to a Supabase session JWT for a test account. The /api/recipe-import route rejects unauthenticated requests (401).",
  );
  process.exit(1);
}

const rows = [];
for (let i = 0; i < urls.length; i++) {
  const url = urls[i];
  let live;
  try {
    live = await runLive(url, token);
  } catch (e) {
    live = { status: 0, ok: false, recipe: null, error: String(e?.message ?? e) };
  }
  const scored = classifyImportResult({ ok: live.ok, recipe: live.recipe, threshold });
  rows.push({ url, status: live.status, ...scored });
  // Pace under the route's 20/min rate limit (skip after the last URL).
  if (throttleMs > 0 && i < urls.length - 1) await sleep(throttleMs);
}

const summary = summarise(rows);

console.log(`Reel-import benchmark — LIVE (${rows.length} URLs, match-threshold ${threshold})`);
console.log("");
console.log("  Definition A — recipe-object-returned (vanity):");
console.log(`    ${summary.definitionA.count}/${summary.total}  (${summary.definitionA.pct}%)`);
console.log("  Definition B — STRICT success / usable macro-tracked recipe (LAUNCH GATE):");
console.log(`    ${summary.definitionB.count}/${summary.total}  (${summary.definitionB.pct}%)`);
console.log("  Caption-present — URL yielded extractable recipe text (structural ceiling):");
console.log(`    ${summary.captionPresent.count}/${summary.total}  (${summary.captionPresent.pct}%)`);
console.log("");
console.log("  Per-URL breakdown:");
for (const r of rows) {
  const hit = r.definitionB ? "B" : r.definitionA ? "A" : "-";
  const reason = r.failureReason ? `  reason=${r.failureReason}` : "";
  console.log(
    `    [${hit}] match=${r.matchRate.toFixed(2)} kcal=${r.perServingCalories} ings=${r.ingredientCount}${reason}  ${r.url}`,
  );
}

const report = {
  date: today,
  mode: "live",
  baseUrl: args["base-url"],
  urlCount: rows.length,
  matchThreshold: threshold,
  gatePct,
  summary,
  rows,
  note:
    "Definition B is the GROW-62 launch gate. The seed fixture is a smoke set — a real gate run needs 100 random food-Reel URLs sourced by founder/growth. Caption-present rate quantifies the FM-1 structural ceiling (legal caption-only posture) that bounds the achievable Definition-B ceiling until the flag-off caption-text path ships.",
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log("");
console.log(`Report → ${outPath}`);
console.log(`Exit gate: Definition-B ${summary.definitionB.pct}% vs required ${gatePct}%`);

process.exit(summary.definitionB.pct >= gatePct ? 0 : 1);
