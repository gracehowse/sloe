/**
 * TikTok / social caption import benchmark — ENG-7
 *
 * Offline-first harness: validates caption fixtures against the import
 * pipeline's pre-LLM gates (platform detect, minimum length). When
 * OPENAI_API_KEY is set and --live is passed, also exercises
 * POST /api/recipe-import against a running dev server.
 *
 * Usage:
 *   node scripts/benchmark-tiktok-import.mjs
 *   node scripts/benchmark-tiktok-import.mjs --fixtures docs/testflight-feedback/tiktok-import-benchmark/captions
 *   node scripts/benchmark-tiktok-import.mjs --live --base-url http://localhost:3000
 *
 * Exit 0 when offline gate pass rate ≥ 90% on fixtures, else exit 1.
 * Live mode requires auth token via BENCHMARK_TOKEN or SUPABASE_ANON_KEY.
 */

import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    fixtures: {
      type: "string",
      default: "docs/testflight-feedback/tiktok-import-benchmark/captions",
    },
    live: { type: "boolean", default: false },
    "base-url": { type: "string", default: "http://localhost:3000" },
    out: { type: "string" },
    help: { type: "boolean", default: false },
  },
  strict: false,
});

if (args.help) {
  console.log(`Usage: node scripts/benchmark-tiktok-import.mjs [--fixtures <dir>] [--live] [--base-url URL]`);
  process.exit(0);
}

const fixturesDir = args.fixtures;
const today = new Date().toISOString().slice(0, 10);
const outPath =
  args.out ??
  join("docs/testflight-feedback", `tiktok-import-benchmark-${today}.json`);

/** Minimum caption length — mirrors parseCaption guard. */
const MIN_CAPTION_CHARS = 40;

function detectPlatform(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("tiktok.com")) return "tiktok";
    if (host.includes("instagram.com")) return "instagram";
    if (host.includes("youtube.com") || host === "youtu.be") return "youtube";
    return "other";
  } catch {
    return "other";
  }
}

function loadFixtures(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const raw = JSON.parse(readFileSync(join(dir, f), "utf8"));
      return {
        id: basename(f, ".json"),
        sourceUrl: raw.sourceUrl ?? "https://www.tiktok.com/@chef/video/1",
        captionText: raw.captionText ?? "",
        expectParse: raw.expectParse !== false,
      };
    });
}

async function runLive(url, captionText, token) {
  const res = await fetch(`${args["base-url"]}/api/recipe-import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ url, captionText }),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, json };
}

const fixtures = loadFixtures(fixturesDir);
if (fixtures.length === 0) {
  console.error(
    `No caption fixtures in ${fixturesDir}. Add *.json files with { sourceUrl, captionText, expectParse }.`,
  );
  process.exit(1);
}

const token = process.env.BENCHMARK_TOKEN ?? process.env.SUPABASE_ANON_KEY ?? "";
const results = [];

for (const fixture of fixtures) {
  const platform = detectPlatform(fixture.sourceUrl);
  const captionLen = fixture.captionText.trim().length;
  const offlinePass = platform !== "other" && captionLen >= MIN_CAPTION_CHARS;
  const row = {
    id: fixture.id,
    platform,
    captionChars: captionLen,
    offlinePass,
    expectParse: fixture.expectParse,
    live: null,
  };

  if (args.live) {
    if (!token) {
      console.error("Live mode requires BENCHMARK_TOKEN or SUPABASE_ANON_KEY.");
      process.exit(1);
    }
    row.live = await runLive(fixture.sourceUrl, fixture.captionText, token);
    row.livePass = row.live.ok === true;
  }

  results.push(row);
}

const offlineCorrect = results.filter((r) => r.offlinePass === r.expectParse).length;
const offlineRate = Math.round((offlineCorrect / results.length) * 100);
const liveResults = results.filter((r) => r.live);
const liveRate =
  liveResults.length > 0
    ? Math.round((liveResults.filter((r) => r.livePass).length / liveResults.length) * 100)
    : null;

const report = {
  date: today,
  fixtureCount: results.length,
  offlinePassRatePct: offlineRate,
  livePassRatePct: liveRate,
  minCaptionChars: MIN_CAPTION_CHARS,
  results,
  blockers: liveResults.length === 0
    ? [
        "Live LLM parse rate not measured — run with --live against `npm run dev` and a valid token.",
        "Target sample set is 100 Reels (ENG-670); current fixtures are a smoke subset only.",
      ]
    : [],
};

mkdirSync(join("docs/testflight-feedback"), { recursive: true });
writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(`TikTok import benchmark — ${results.length} fixtures`);
console.log(`Offline gate pass rate: ${offlineRate}% (platform + min ${MIN_CAPTION_CHARS} chars)`);
if (liveRate != null) console.log(`Live API pass rate: ${liveRate}%`);
console.log(`Report → ${outPath}`);

const passThreshold = 90;
process.exit(offlineRate >= passThreshold ? 0 : 1);
