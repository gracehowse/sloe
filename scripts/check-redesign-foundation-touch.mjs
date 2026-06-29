#!/usr/bin/env node

/**
 * ENG-1221 §2 — Redesign FOUNDATION-touch classifier.
 *
 * WHY THIS EXISTS
 * ---------------
 * The 2026 redesign ships behind per-surface feature flags so work can be
 * page-scoped and captured surface-by-surface. That model holds for *leaf*
 * changes — touch one screen, capture that screen. It breaks the moment a
 * change reaches a shared DESIGN FOUNDATION: a design token
 * (`apps/mobile/constants/theme.ts`, `src/styles/theme.css` / the Tailwind v4
 * `@theme` block), a shared theme helper (`src/lib/theme/*`), or a primitive
 * UI component (`apps/mobile/components/ui/*`, `src/app/components/ui/*`).
 * A token or primitive change has WHOLE-APP blast radius — every surface that
 * consumes it can shift — so it cannot be verified by one page-scoped capture.
 * It requires a FULL Chromatic sweep and serialised (non-page-scoped) work.
 *
 * This gate classifies the current git diff (vs `origin/main` or a passed base)
 * and, if it touches foundation, LOUDLY asserts that requirement so the author
 * sees it at write time — not in a review sweep after the blast already landed.
 *
 * ROLLOUT POSTURE (advisory-LOUD first; teeth opt-in)
 * ---------------------------------------------------
 * - Default: prints a clear ⚠ banner listing the foundation files touched and
 *   what's required, then EXITS 0. Non-blocking so it can land in `ci` today
 *   without gating unrelated PRs while the Chromatic + serialisation harness is
 *   still being wired (that harness is §3, see below — still open on ENG-1221).
 * - `--strict` (or `REDESIGN_FOUNDATION_STRICT=1`): EXITS 1 when foundation was
 *   touched UNLESS a full-sweep marker is present, so the teeth can be turned on
 *   later by flipping one flag in CI. Marker = either a commit-message trailer
 *   `Full-sweep: yes` anywhere in the diff range, or a sentinel file
 *   `.redesign-full-sweep` at the repo root. The marker is the author's
 *   explicit attestation that a full Chromatic sweep + serialised review was
 *   done for this foundation change.
 *
 * CI WIRING CHOICE
 * ----------------
 * Wired into `npm run ci` in ADVISORY (non-strict) mode — it always runs, always
 * prints, never blocks. Rationale: a token/primitive change is the EXACT case
 * where we want the loud reminder visible in every CI log, but a hard fail here
 * before the §3 Chromatic-sweep harness exists would block legitimate foundation
 * work with no green path. Flip to `--strict` once §3 lands and the marker
 * convention is documented for contributors.
 *
 * Mirrors the structure of the existing check scripts (pure exported classifier
 * + thin `main()` CLI behind an `invokedDirectly` guard, e.g.
 * `scripts/check-screen-line-budget.mjs`), so the test can drive the pure
 * `classifyFoundationTouch()` over fixtures without shelling out to git.
 *
 * ENG-1221 SCOPE NOTE — this change is §2 ONLY.
 *   §1 (excluded-flag triage — moving ~65 registry flags to `captured`) and
 *   §3 (bundle≠HEAD hard-fail + the Chromatic/serialisation harness) are NOT in
 *   this change and REMAIN OPEN on ENG-1221. They carry CI-blast-radius /
 *   capture-harness-internals risk that needs a dedicated pass; this change does
 *   not touch the capture spec or the flag registry.
 *
 * Exit 0 on clean / advisory. Exit 1 only in `--strict` with foundation touched
 * and no full-sweep marker.
 */

import { existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Foundation surfaces, in priority order. Each entry classifies a changed path
 * into a human-readable CATEGORY explaining the blast radius. A path matches the
 * FIRST rule whose `match(path)` returns true.
 *
 * Paths are repo-root-relative, forward-slash, as emitted by `git diff
 * --name-only`. Globs are intentionally avoided — explicit predicates are
 * easier to reason about and to unit-test than a glob engine.
 */
export const FOUNDATION_RULES = [
  {
    category: "design-token (mobile theme)",
    reason:
      "every mobile surface reads these tokens — colour/spacing/radius/type changes ripple app-wide",
    match: (p) => p === "apps/mobile/constants/theme.ts",
  },
  {
    category: "design-token (web theme.css / Tailwind @theme)",
    reason:
      "the Tailwind v4 @theme block + CSS custom properties back every web surface",
    match: (p) => p === "src/styles/theme.css",
  },
  {
    category: "shared theme helper (src/lib/theme/*)",
    reason:
      "cross-surface theme helpers (brand gradient, macro colours, overlay) — consumed by many screens",
    match: (p) => p.startsWith("src/lib/theme/"),
  },
  {
    category: "shared package (packages/*)",
    reason: "shared cross-platform package — imported by both web and mobile",
    match: (p) => p.startsWith("packages/"),
  },
  {
    category: "primitive UI component (mobile components/ui/*)",
    reason:
      "a mobile UI primitive — reused across screens, so a restyle changes every consumer",
    match: (p) => p.startsWith("apps/mobile/components/ui/"),
  },
  {
    category: "primitive UI component (web app/components/ui/*)",
    reason:
      "a web UI primitive — reused across surfaces, so a restyle changes every consumer",
    match: (p) => p.startsWith("src/app/components/ui/"),
  },
];

/**
 * Pure classifier. Given a list of changed repo-root-relative paths, returns
 * whether any touch the design foundation, the per-file classification, and the
 * distinct categories involved.
 *
 * Side-effect-free and deterministic so tests can drive it with synthetic
 * fixtures (no git, no fs).
 *
 * @param {string[]} changedPaths
 * @returns {{
 *   touched: boolean,
 *   files: Array<{ path: string, category: string, reason: string }>,
 *   categories: string[],
 * }}
 */
export function classifyFoundationTouch(changedPaths) {
  const files = [];
  for (const raw of changedPaths ?? []) {
    if (typeof raw !== "string" || raw.length === 0) continue;
    const path = raw.replace(/\\/g, "/").trim();
    if (path.length === 0) continue;
    const rule = FOUNDATION_RULES.find((r) => r.match(path));
    if (rule) {
      files.push({ path, category: rule.category, reason: rule.reason });
    }
  }
  // Stable order: by path, so banners are deterministic across runs.
  files.sort((a, b) => a.path.localeCompare(b.path));
  const categories = [...new Set(files.map((f) => f.category))];
  return { touched: files.length > 0, files, categories };
}

/**
 * Collect changed paths vs a base ref. Includes committed-on-branch, staged,
 * and unstaged changes so the gate is useful mid-development (before commit) and
 * post-commit (in CI). Best-effort: if git fails (detached/odd state), returns
 * an empty set rather than throwing — the gate must never wedge a build.
 *
 * @param {string} [base="origin/main"]
 * @returns {string[]} de-duplicated, sorted repo-root-relative paths
 */
export function collectChangedPaths(base = "origin/main") {
  const out = new Set();
  const run = (args) => {
    try {
      const stdout = execFileSync("git", args, {
        cwd: REPO_ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      for (const line of stdout.split("\n")) {
        const t = line.trim();
        if (t) out.add(t);
      }
    } catch {
      // ignore — partial diff is fine; gate is advisory by default
    }
  };
  // Committed on this branch vs the base's merge-base (three-dot).
  run(["diff", "--name-only", `${base}...HEAD`]);
  // Staged (index vs HEAD) and unstaged (working tree vs index).
  run(["diff", "--name-only", "--cached"]);
  run(["diff", "--name-only"]);
  return [...out].sort();
}

/**
 * Whether the author has attested a full Chromatic sweep + serialised review.
 * Two equivalent signals:
 *   1. a `Full-sweep: yes` trailer in any commit message in `${base}..HEAD`, or
 *   2. a `.redesign-full-sweep` sentinel file at the repo root.
 *
 * @param {string} [base="origin/main"]
 * @returns {boolean}
 */
export function hasFullSweepMarker(base = "origin/main") {
  if (existsSync(join(REPO_ROOT, ".redesign-full-sweep"))) return true;
  try {
    const log = execFileSync(
      "git",
      ["log", "--format=%B", `${base}..HEAD`],
      { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return /^\s*Full-sweep:\s*yes\s*$/im.test(log);
  } catch {
    return false;
  }
}

function parseArgs(argv) {
  const strict =
    argv.includes("--strict") || process.env.REDESIGN_FOUNDATION_STRICT === "1";
  const baseFlagIdx = argv.findIndex((a) => a === "--base");
  let base = "origin/main";
  if (baseFlagIdx !== -1 && argv[baseFlagIdx + 1]) {
    base = argv[baseFlagIdx + 1];
  } else {
    const eq = argv.find((a) => a.startsWith("--base="));
    if (eq) base = eq.slice("--base=".length);
  }
  return { strict, base };
}

function printAdvisoryBanner(result, { strict, markerPresent }) {
  const line = "═".repeat(72);
  console.error(`\n${line}`);
  console.error("⚠  REDESIGN FOUNDATION TOUCHED — whole-app blast radius");
  console.error(line);
  console.error(
    "\nThis diff changes shared design FOUNDATION (token / theme helper /\n" +
      "shared package / UI primitive). A page-scoped capture is NOT enough.\n",
  );
  console.error("Foundation files touched:");
  const byCategory = new Map();
  for (const f of result.files) {
    if (!byCategory.has(f.category)) {
      byCategory.set(f.category, { reason: f.reason, paths: [] });
    }
    byCategory.get(f.category).paths.push(f.path);
  }
  for (const [category, { reason, paths }] of byCategory) {
    console.error(`\n  • ${category}`);
    console.error(`    ${reason}`);
    for (const p of paths) console.error(`      - ${p}`);
  }
  console.error("\nRequired before this lands:");
  console.error("  1. A FULL Chromatic sweep (not a page-scoped capture).");
  console.error("  2. Serialised (non-page-scoped) review — token/primitive");
  console.error("     changes cannot be parallelised against page work.");
  console.error(
    "\nAttest by adding a `Full-sweep: yes` trailer to a commit in this\n" +
      "range, or a `.redesign-full-sweep` sentinel file at the repo root.",
  );
  if (strict) {
    console.error(
      markerPresent
        ? "\n[strict] Full-sweep marker present — passing.\n"
        : "\n[strict] No full-sweep marker — FAILING.\n",
    );
  } else {
    console.error(
      "\n[advisory] Non-blocking for now (exit 0). Re-run with --strict\n" +
        "(or REDESIGN_FOUNDATION_STRICT=1) to enforce once §3 lands.\n",
    );
  }
  console.error(line + "\n");
}

function main() {
  const { strict, base } = parseArgs(process.argv.slice(2));
  const changed = collectChangedPaths(base);
  const result = classifyFoundationTouch(changed);

  if (!result.touched) {
    console.log(
      `[check:redesign-foundation-touch] OK — no shared design foundation ` +
        `touched (vs ${base}; ${changed.length} changed file(s) scanned).`,
    );
    return;
  }

  const markerPresent = hasFullSweepMarker(base);
  printAdvisoryBanner(result, { strict, markerPresent });

  if (strict && !markerPresent) {
    process.exit(1);
  }
}

// Only run when invoked directly (not when imported by the test).
const invokedDirectly =
  process.argv[1] &&
  statSync(process.argv[1]).isFile() &&
  fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) main();
