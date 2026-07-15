#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const forbidden = [/https?:\/\/[^\s"'`]+posthog\.com/gi, /https?:\/\/[^\s"'`]+i\.posthog\.com/gi];
const textExt = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".json", ".html", ".txt"]);

// posthog-js/posthog-node ship internal fallback/region-normalization constants
// (e.g. a default api_host used only when a caller omits one, and a support-ticket
// URL in their error logger) that always appear verbatim in ANY client bundle that
// includes the SDK — regardless of what host our own code configures. Our app
// always passes an explicit api_host (see AnalyticsProvider.tsx), so those SDK
// defaults are dead code, not a live endpoint we introduced. Rather than trust a
// literal-string regex to tell "our hardcoded host" apart from "the SDK's own
// hardcoded host", treat any match that also appears byte-for-byte inside the
// installed SDK's own package source as vendor-owned and not a finding — a host we
// hardcode ourselves won't coincidentally match the SDK's source verbatim.
//
// Hardening (2026-07-12 review): a vendor-string match is NOT proof our own code
// is clean — `serverTrack.ts`'s DEFAULT_POSTHOG_HOST intentionally reuses the same
// literal ("https://us.i.posthog.com") the SDK ships as its own default, so a real
// leak of that server-only module into a client bundle would coincidentally match
// vendor source too and get suppressed. So independent of the URL-literal scan,
// hard-fail if a distinctive identifier unique to a documented server-only module
// shows up in client output — that's proof the module itself got bundled
// client-side, a more serious bug than which URL string it happens to contain.
const serverOnlyModuleMarkers = [
  { module: "src/lib/analytics/serverTrack.ts", marker: "DEFAULT_POSTHOG_HOST" },
];
const vendorPkgDirs = [path.join(repoRoot, "node_modules", "posthog-js"), path.join(repoRoot, "node_modules", "posthog-node")];

function loadVendorStrings() {
  const known = new Set();
  for (const pkgDir of vendorPkgDirs) {
    if (!existsSync(pkgDir)) continue;
    for (const file of walk(pkgDir, [])) {
      const text = readFileSync(file, "utf8");
      for (const re of forbidden) {
        re.lastIndex = 0;
        for (const match of text.match(re) ?? []) known.add(match);
      }
    }
  }
  return known;
}

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
      // Native build dir (gitignored). CocoaPods seeds it with header
      // symlinks into node_modules that go dangling whenever a native dep
      // bumps versions — and statSync follows them, crashing the whole gate.
      // It holds no committed JS/TS, so there are no PostHog URLs to scan.
      path.join(repoRoot, "apps", "mobile", "ios"),
      path.join(repoRoot, "apps", "mobile", "android"),
    ],
  },
];

function* walk(dir, ignore) {
  if (!existsSync(dir)) return;
  const resolved = path.resolve(dir);
  if (ignore.some((entry) => resolved === entry || resolved.startsWith(`${entry}${path.sep}`))) return;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    // Use lstat so a dangling symlink (e.g. stale CocoaPods header links)
    // anywhere in the tree is skipped rather than crashing the scan.
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) yield* walk(full, ignore);
    else if (textExt.has(path.extname(full))) yield full;
  }
}

const vendorStrings = loadVendorStrings();
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

    // Deny-list wins over the vendor allow-list: a server-only module's own
    // identifier appearing in client output is a real leak regardless of
    // whether its URL literal happens to also match vendor source.
    if (check.label === "web production client bundle") {
      for (const { module, marker } of serverOnlyModuleMarkers) {
        if (text.includes(marker)) findings.push(`${rel}: contains "${marker}", which should only exist in server-only ${module} — this module appears to have been bundled into the client`);
      }
    }

    for (const re of forbidden) {
      re.lastIndex = 0;
      const matches = [...new Set(text.match(re) ?? [])].filter((m) => !vendorStrings.has(m));
      if (matches.length) findings.push(`${rel}: ${matches.join(", ")}`);
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
