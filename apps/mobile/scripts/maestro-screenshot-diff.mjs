#!/usr/bin/env node
/**
 * Maestro screenshot diff — visual-regression layer on top of the existing
 * Maestro suite. Compares `apps/mobile/screenshots/latest/<name>.png` against
 * `apps/mobile/screenshots/baseline/<name>.png` using pixelmatch and writes
 * a per-shot diff PNG plus an HTML report.
 *
 * Maestro CLI runs from `apps/mobile/` (see scripts/run-maestro-e2e.mjs `cwd`),
 * so a `takeScreenshot: screenshots/latest/<name>` step in any flow lands a
 * PNG at `apps/mobile/screenshots/latest/<name>.png`. This script consumes
 * that directory.
 *
 * Workflow:
 *   1. First-ever run, after a clean Maestro pass:
 *        npm run mobile:test:screens:update-baseline
 *      copies `latest/*.png` → `baseline/*.png` and exits.
 *   2. Subsequent runs, after each Maestro pass:
 *        npm run mobile:test:screens:diff
 *      compares `latest` vs `baseline`, writes diffs, opens (or surfaces)
 *      `apps/mobile/screenshots/diff/report.html`. Exits non-zero if any
 *      shot's diff ratio exceeds `--threshold` (default 0.1% of pixels).
 *
 * Flags:
 *   --update-baseline      Promote latest/ → baseline/ and exit.
 *   --threshold=<float>    Fraction of differing pixels above which a shot
 *                          counts as a regression. Default 0.001 (0.1%).
 *   --tolerance=<float>    Per-pixel pixelmatch tolerance (0.0–1.0). Default
 *                          0.1 — anti-aliasing is forgiven, real moves aren't.
 *
 * Dependencies (devDeps in apps/mobile/package.json): pngjs, pixelmatch.
 * If they're missing the script prints the install command and exits 1.
 */
import { existsSync, mkdirSync, promises as fs } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

let PNG;
let pixelmatch;
try {
  ({ PNG } = await import("pngjs"));
  pixelmatch = (await import("pixelmatch")).default;
} catch {
  console.error(
    "[screenshot-diff] Missing deps. From the repo root run:\n" +
      "  npm install --save-dev --prefix apps/mobile pngjs pixelmatch\n",
  );
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(__dirname, "..");
const screenshotsRoot = join(mobileRoot, "screenshots");
const latestDir = join(screenshotsRoot, "latest");
const baselineDir = join(screenshotsRoot, "baseline");
const diffDir = join(screenshotsRoot, "diff");

const args = process.argv.slice(2);
const updateBaseline = args.includes("--update-baseline");
const threshold = parseFloat(
  args.find((a) => a.startsWith("--threshold="))?.split("=")[1] ?? "0.001",
);
const tolerance = parseFloat(
  args.find((a) => a.startsWith("--tolerance="))?.split("=")[1] ?? "0.1",
);

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

async function listPngs(dir) {
  if (!existsSync(dir)) return [];
  const entries = await fs.readdir(dir);
  return entries.filter((f) => f.toLowerCase().endsWith(".png")).sort();
}

async function copyAll(srcDir, dstDir) {
  ensureDir(dstDir);
  const files = await listPngs(srcDir);
  for (const f of files) {
    await fs.copyFile(join(srcDir, f), join(dstDir, f));
  }
  return files;
}

async function readPng(path) {
  const buf = await fs.readFile(path);
  return PNG.sync.read(buf);
}

async function writePng(path, png) {
  ensureDir(dirname(path));
  await fs.writeFile(path, PNG.sync.write(png));
}

async function diffOne(name) {
  const baselinePath = join(baselineDir, name);
  const latestPath = join(latestDir, name);
  const diffPath = join(diffDir, name);

  if (!existsSync(baselinePath)) {
    return {
      name,
      status: "new",
      message: "no baseline — promote with --update-baseline once you've reviewed",
    };
  }
  if (!existsSync(latestPath)) {
    return {
      name,
      status: "missing",
      message: "baseline exists but latest is missing — flow may have failed before takeScreenshot",
    };
  }

  const baseline = await readPng(baselinePath);
  const latest = await readPng(latestPath);

  if (baseline.width !== latest.width || baseline.height !== latest.height) {
    return {
      name,
      status: "size-mismatch",
      message: `baseline ${baseline.width}x${baseline.height} vs latest ${latest.width}x${latest.height} — likely a device/simulator change`,
      baselineSize: [baseline.width, baseline.height],
      latestSize: [latest.width, latest.height],
    };
  }

  const { width, height } = baseline;
  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(
    baseline.data,
    latest.data,
    diff.data,
    width,
    height,
    { threshold: tolerance, includeAA: false },
  );
  const totalPixels = width * height;
  const ratio = diffPixels / totalPixels;
  await writePng(diffPath, diff);

  return {
    name,
    status: ratio > threshold ? "fail" : "pass",
    diffPixels,
    totalPixels,
    ratio,
  };
}

function statusBadge(status) {
  switch (status) {
    case "pass":
      return '<span style="color:#15803d;font-weight:600">PASS</span>';
    case "fail":
      return '<span style="color:#b91c1c;font-weight:600">FAIL</span>';
    case "new":
      return '<span style="color:#a16207;font-weight:600">NEW</span>';
    case "missing":
      return '<span style="color:#a16207;font-weight:600">MISSING</span>';
    case "size-mismatch":
      return '<span style="color:#b91c1c;font-weight:600">SIZE MISMATCH</span>';
    default:
      return status;
  }
}

function relForReport(absPath) {
  return relative(diffDir, absPath);
}

async function writeReport(results) {
  ensureDir(diffDir);
  const rows = results
    .map((r) => {
      const baselineImg = existsSync(join(baselineDir, r.name))
        ? `<img src="${relForReport(join(baselineDir, r.name))}" loading="lazy">`
        : "<em>none</em>";
      const latestImg = existsSync(join(latestDir, r.name))
        ? `<img src="${relForReport(join(latestDir, r.name))}" loading="lazy">`
        : "<em>none</em>";
      const diffImg = existsSync(join(diffDir, r.name))
        ? `<img src="${r.name}" loading="lazy">`
        : "<em>n/a</em>";
      const meta =
        r.status === "pass" || r.status === "fail"
          ? `${(r.ratio * 100).toFixed(3)}% (${r.diffPixels.toLocaleString()} / ${r.totalPixels.toLocaleString()} px)`
          : (r.message ?? "");
      return `<tr>
  <td><code>${r.name}</code><br>${statusBadge(r.status)}<br><small>${meta}</small></td>
  <td>${baselineImg}</td>
  <td>${latestImg}</td>
  <td>${diffImg}</td>
</tr>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html><head><meta charset="utf-8">
<title>Maestro screenshot diff — ${new Date().toISOString()}</title>
<style>
  body { font: 14px/1.5 -apple-system, system-ui, sans-serif; margin: 24px; color: #18181b; }
  h1 { margin: 0 0 4px; font-size: 20px; }
  .summary { color: #52525b; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 8px; vertical-align: top; border-bottom: 1px solid #e4e4e7; text-align: left; }
  th { background: #fafafa; position: sticky; top: 0; }
  td { width: 25%; }
  td:first-child { width: 18%; }
  img { max-width: 100%; height: auto; border: 1px solid #e4e4e7; border-radius: 6px; }
  code { background: #f4f4f5; padding: 1px 4px; border-radius: 3px; }
  small { color: #71717a; }
</style>
</head><body>
<h1>Maestro screenshot diff</h1>
<div class="summary">
  ${results.length} shot(s) · threshold ${(threshold * 100).toFixed(2)}% · tolerance ${tolerance}<br>
  baseline: <code>${relative(mobileRoot, baselineDir)}</code> ·
  latest: <code>${relative(mobileRoot, latestDir)}</code>
</div>
<table>
  <thead><tr><th>Shot</th><th>Baseline</th><th>Latest</th><th>Diff</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;
  await fs.writeFile(join(diffDir, "report.html"), html, "utf8");
}

async function main() {
  if (updateBaseline) {
    if (!existsSync(latestDir)) {
      console.error(
        `[screenshot-diff] No latest screenshots at ${latestDir}.\n` +
          "Run the Maestro suite first (npm run mobile:test:e2e), then re-run --update-baseline.",
      );
      process.exit(1);
    }
    const copied = await copyAll(latestDir, baselineDir);
    console.log(
      `[screenshot-diff] Promoted ${copied.length} shot(s) to baseline:\n  ${copied.join("\n  ")}`,
    );
    return;
  }

  ensureDir(screenshotsRoot);
  if (!existsSync(latestDir)) {
    console.error(
      `[screenshot-diff] No latest screenshots at ${latestDir}.\n` +
        "Did the Maestro suite run? Did the YAMLs include `takeScreenshot: screenshots/latest/...`?",
    );
    process.exit(1);
  }

  // Always start from a clean diff dir so stale diffs don't mislead.
  if (existsSync(diffDir)) await fs.rm(diffDir, { recursive: true, force: true });
  ensureDir(diffDir);

  const baselineFiles = new Set(await listPngs(baselineDir));
  const latestFiles = new Set(await listPngs(latestDir));
  const allShots = [...new Set([...baselineFiles, ...latestFiles])].sort();

  if (allShots.length === 0) {
    console.warn(
      "[screenshot-diff] No screenshots found in latest/ or baseline/. Nothing to diff.",
    );
    return;
  }

  const results = [];
  for (const name of allShots) {
    results.push(await diffOne(name));
  }

  await writeReport(results);

  // Console summary
  const counts = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
  const summary = Object.entries(counts)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  console.log(`[screenshot-diff] ${summary}`);
  console.log(`[screenshot-diff] Report: ${join(diffDir, "report.html")}`);

  for (const r of results) {
    if (r.status === "fail") {
      console.log(
        `  FAIL ${r.name} — ${(r.ratio * 100).toFixed(3)}% (${r.diffPixels} px) > threshold ${(threshold * 100).toFixed(2)}%`,
      );
    } else if (r.status === "size-mismatch") {
      console.log(`  SIZE MISMATCH ${r.name} — ${r.message}`);
    } else if (r.status === "missing") {
      console.log(`  MISSING ${r.name} — ${r.message}`);
    } else if (r.status === "new") {
      console.log(`  NEW ${r.name} — ${r.message}`);
    }
  }

  const fails = results.filter(
    (r) => r.status === "fail" || r.status === "size-mismatch" || r.status === "missing",
  );
  if (fails.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error("[screenshot-diff] Unexpected error:", err);
  process.exit(1);
});
