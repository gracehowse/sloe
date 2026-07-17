#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const forbidden = [/https?:\/\/[^\s"'`]+posthog\.com/gi, /https?:\/\/[^\s"'`]+i\.posthog\.com/gi];
const textExt = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".json", ".html", ".txt"]);

// posthog-js/posthog-node ship their own default host ("https://us.posthog.com" /
// "https://us.i.posthog.com") verbatim, string-identical, inside the exact dist
// files Next bundles client-side (confirmed: node_modules/posthog-js/dist/module.js).
// Dead code in our app (AnalyticsProvider.tsx always passes an explicit api_host),
// but present in every legitimate build regardless.
//
// ENG-1569: this file used to suppress a URL match as "vendor-owned" whenever it
// was also byte-identical to something in the installed SDK source. That's unsound
// in both directions: our own DEFAULT_POSTHOG_HOST (serverTrack.ts) intentionally
// reuses that exact literal, so a real leak of the official host from ANY of our
// modules — the two known ones or a future one — coincidentally matches vendor
// source and is waved through silently. No narrowing of which vendor file(s)
// supply the known-string set fixes this: the official default has to live
// somewhere in the SDK's own shipped code, and that's exactly the value a leak
// would use. String identity can't carry this distinction — only a distinctive
// identifier can.
//
// So the compiled client-bundle check no longer scans for the URL literal at all
// (see the `continue` below) — it would either always suppress (this bug) or
// always false-positive (the SDK's own default is unavoidably present in real
// output). Detection for "did a server-only module leak into the client" runs
// entirely on the module-marker deny-list below.
//
// This is a required pairing, not a courtesy: every source path carved out below
// (`ignore`) for legitimately holding the raw official host MUST have a matching
// entry here. A future server-only module that starts using the official host and
// skips this list reproduces the exact silent-pass ENG-1569 describes.
const serverOnlyModuleMarkers = [
  { module: "src/lib/analytics/serverTrack.ts", marker: "DEFAULT_POSTHOG_HOST" },
  { module: "src/lib/server/featureFlags.ts", marker: "system:killswitch" },
];

const checks = [
  {
    label: "web production client bundle",
    root: path.join(repoRoot, ".next", "static"),
    required: false,
    ignore: [],
  },
  {
    label: "web committed source (src/)",
    root: path.join(repoRoot, "src"),
    required: true,
    ignore: [
      // Documented server-only modules that intentionally hold the real
      // PostHog host as their own default. The module-marker deny-list above
      // independently catches either of these leaking into the client
      // bundle, so excluding them here (source, not output) doesn't weaken
      // enforcement — it just avoids flagging the legitimate server-only
      // source that defines the literal in the first place.
      path.join(repoRoot, "src", "lib", "analytics", "serverTrack.ts"),
      path.join(repoRoot, "src", "lib", "server", "featureFlags.ts"),
    ],
  },
  {
    label: "web committed source (app/)",
    root: path.join(repoRoot, "app"),
    required: true,
    ignore: [
      // Next.js route handlers under app/api/** are server-only by
      // framework convention — they never reach the client bundle — so they
      // get the same direct-host carve-out as the two src/ modules above.
      // Structural exclusion (an entire directory that is categorically
      // server-side), not a per-file judgment call.
      path.join(repoRoot, "app", "api"),
    ],
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
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    // Checked per-entry (not just once at the top on `dir`) so a
    // *file*-level ignore (e.g. a single excluded server-only module) is
    // honoured too, not just directory-level ignores.
    const resolved = path.resolve(full);
    if (ignore.some((entry) => resolved === entry || resolved.startsWith(`${entry}${path.sep}`))) continue;
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

    // ENG-1569: the module-marker deny-list is the SOLE gate for the compiled
    // client bundle. A server-only module's own distinctive identifier appearing
    // in client output is proof that module got bundled client-side — a stronger,
    // sound signal than the URL literal, which the SDK's own default makes useless
    // here (see header comment). The URL-literal scan below is skipped entirely for
    // this surface via the `continue`.
    if (check.label === "web production client bundle") {
      for (const { module, marker } of serverOnlyModuleMarkers) {
        if (text.includes(marker)) findings.push(`${rel}: contains "${marker}", which should only exist in server-only ${module} — this module appears to have been bundled into the client`);
      }
      continue;
    }

    for (const re of forbidden) {
      re.lastIndex = 0;
      const matches = [...new Set(text.match(re) ?? [])];
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
