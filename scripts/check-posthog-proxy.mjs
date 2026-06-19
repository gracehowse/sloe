#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const forbidden = [/https?:\/\/[^\s"'`]+posthog\.com/gi, /https?:\/\/[^\s"'`]+i\.posthog\.com/gi];
const textExt = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".json", ".html", ".txt"]);

const checks = [
  {
    label: "web production client bundle",
    root: path.join(repoRoot, ".next", "static"),
    required: false,
    ignore: [],
  },
  {
    label: "mobile committed config/source",
    root: path.join(repoRoot, "apps", "mobile"),
    required: true,
    ignore: [
      path.join(repoRoot, "apps", "mobile", "node_modules"),
      path.join(repoRoot, "apps", "mobile", ".expo"),
      path.join(repoRoot, "apps", "mobile", "coverage"),
      path.join(repoRoot, "apps", "mobile", "tests"),
    ],
  },
];

function* walk(dir, ignore) {
  if (!existsSync(dir)) return;
  const resolved = path.resolve(dir);
  if (ignore.some((entry) => resolved === entry || resolved.startsWith(`${entry}${path.sep}`))) return;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full, ignore);
    else if (textExt.has(path.extname(full))) yield full;
  }
}

const findings = [];
for (const check of checks) {
  if (!existsSync(check.root)) {
    if (check.required) findings.push(`${check.label}: missing ${path.relative(repoRoot, check.root)}`);
    else console.warn(`[posthog-proxy] Skipping ${check.label}; ${path.relative(repoRoot, check.root)} does not exist. Run after next build for bundle coverage.`);
    continue;
  }
  for (const file of walk(check.root, check.ignore.map((entry) => path.resolve(entry)))) {
    const rel = path.relative(repoRoot, file);
    const text = readFileSync(file, "utf8");
    for (const re of forbidden) {
      re.lastIndex = 0;
      const matches = text.match(re);
      if (matches?.length) findings.push(`${rel}: ${[...new Set(matches)].join(", ")}`);
    }
  }
}

if (findings.length) {
  console.error("[posthog-proxy] Direct PostHog host literal found in a client-reachable surface:");
  for (const finding of findings) console.error(`  - ${finding}`);
  console.error("Route analytics/flag traffic through /ingest (web) or https://suppr-club.com/ingest (mobile), and keep direct PostHog hosts server-only.");
  process.exit(1);
}
console.log("[posthog-proxy] OK: no direct PostHog host literal found in checked client surfaces.");
