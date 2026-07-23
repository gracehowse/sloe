#!/usr/bin/env node

/**
 * ENG-1499 — Web `rounded-*` radius census + only-shrink ratchet.
 * ENG-1589 (2026-07-20) — added the value-based `--radius-*` token-ladder
 * gate (see below); rewrote the stale name-based allowlist comment this
 * replaced.
 *
 * The 2026-07-10 card-grammar ruling
 * (`docs/decisions/2026-07-10-card-grammar-rounder-flat.md`) sets ONE card
 * corner (24px, `rounded-card` / `rounded-card-lg`) and a 12px inner
 * standard (the 12-inside-24 concentric inset). The census found the web
 * `rounded-*` namespace entirely ungated — ~9 distinct radius values lived
 * on card-like elements. This is the write-time / CI gate that stops new
 * off-grammar radii landing.
 *
 * What it flags (a "web-radius violation"):
 *   1. An arbitrary `rounded-[Npx]` value (any directional variant, e.g.
 *      `rounded-t-[24px]`) whose N is NOT in the legal px set {12, 24}
 *      (12 = inner standard, 24 = the card corner — both on the canonical
 *      snap scale 4/6/8/12/24/full; the sub-12 chrome steps route through
 *      the NAMED classes below, never arbitrary px).
 *   2. The retired named classes `rounded-2xl` (16px — the retired
 *      "secondary card" tier) and `rounded-3xl` (24px spelled off-token),
 *      including directional variants like `rounded-t-2xl`. Cards use
 *      `rounded-card` / `rounded-card-lg`; 24px must be spelled ONE way.
 *   3. (ENG-1589) A `--radius-*` custom property in `src/styles/theme.css`
 *      whose RESOLVED px value is off the legal 4/6/8/12/24/full ladder —
 *      checked by VALUE, not by class name. This is what would have caught
 *      the original bug: `--radius-sm`/`--radius-xl` were `calc()`-derived
 *      from a single 6px base and silently resolved to illegal 2px/10px
 *      while `rounded-sm`/`rounded-xl` sat on the name-based allowlist
 *      below the whole time. Unlike #1/#2, this check is NOT part of the
 *      per-file pin/allow ratchet — a design-token definition is either on
 *      the ladder or it isn't; there is no legacy population to grandfather
 *      and no file to pin. It fails CI immediately, in both check and
 *      `--write` mode, regardless of `web-radius-budget.json`.
 *
 * Allowlisted (NOT gated by #1/#2 — but IS covered by #3): the token-mapped
 * named classes `rounded-card`, `rounded-card-lg`, `rounded-sm/md/lg/xl`,
 * `rounded-full`, `rounded-none`, and `rounded-[var(--…)]` token-routed
 * arbitrary values. These class-name checks were always going to miss an
 * off-ladder token value — #3 is the structural fix that closes that gap by
 * validating what the token actually resolves to.
 *
 * Ratchet model (same as `check-token-scale.mjs`) for #1/#2 only: the
 * current violation population is pinned PER FILE in
 * `scripts/web-radius-budget.json` (`{ pins, allow }`). A pinned file may
 * only SHRINK; a violation in an un-pinned file fails CI. `allow` entries
 * MUST carry a rationale.
 *
 * Usage:
 *   node scripts/check-web-radius.mjs            # check (CI)
 *   node scripts/check-web-radius.mjs --write    # regenerate pins (#1/#2 only)
 *
 * Wired into `npm run check:web-radius` and `npm run ci`.
 */

import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import {
  REPO_ROOT,
  stripComments,
  walk as sharedWalk,
  nearestLegal,
  evaluateKeyed as evaluate,
  runKeyedCli,
  isInvokedDirectly,
  readLegalRadius,
} from "./lib/ratchet.mjs";

const BUDGET_FILE = join(REPO_ROOT, "scripts", "web-radius-budget.json");
const THEME_CSS_FILE = join(REPO_ROOT, "src", "styles", "theme.css");

/** Web surfaces only — mobile radii are gated by `check:token-scale`. */
export const SCAN_DIRS = ["src/app", "app"];

const SCAN_EXTS = [".tsx"];

/** Legal arbitrary px values: 24 = THE card corner (`--radius-card-lg`),
 *  12 = the nested/inner standard (12-inside-24 concentric). Everything
 *  else must come from a named token class. Decision:
 *  docs/decisions/2026-07-10-card-grammar-rounder-flat.md */
export const LEGAL_ARBITRARY_PX = new Set([12, 24]);

// Directional variant segment shared by both patterns (rounded-t-, -tl-, …).
const DIR = "(?:(?:t|b|l|r|tl|tr|bl|br|s|e|ss|se|es|ee)-)?";
// Arbitrary px value, e.g. rounded-[14px], rounded-t-[24px].
const ARBITRARY_PX_RE = new RegExp(`\\brounded-${DIR}\\[(\\d+(?:\\.\\d+)?)px\\]`, "g");
// Retired named tiers, e.g. rounded-2xl, sm:rounded-3xl, rounded-t-2xl.
const RETIRED_CLASS_RE = new RegExp(`\\brounded-${DIR}(?:2xl|3xl)\\b`, "g");

/**
 * Scan one file's text → `[{ line, kind, token, nearest? }]`.
 * Pure (no filesystem) so tests can drive it with synthetic source.
 *   kind: "arbitrary-px" | "retired-class"
 */
export function findViolations(src, legalPx = LEGAL_ARBITRARY_PX) {
  const code = stripComments(src);
  const lines = code.split("\n");
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    ARBITRARY_PX_RE.lastIndex = 0;
    while ((m = ARBITRARY_PX_RE.exec(line)) !== null) {
      const value = parseFloat(m[1]);
      if (!legalPx.has(value)) {
        hits.push({
          line: i + 1,
          kind: "arbitrary-px",
          token: m[0],
          nearest: nearestLegal(value, legalPx),
        });
      }
    }
    RETIRED_CLASS_RE.lastIndex = 0;
    while ((m = RETIRED_CLASS_RE.exec(line)) !== null) {
      hits.push({ line: i + 1, kind: "retired-class", token: m[0] });
    }
  }
  return hits;
}

/** Walk the tree and return `{ "<repo-relative path>": [hits] }`. */
export function scanTree(repoRoot = REPO_ROOT, scanDirs = SCAN_DIRS, legalPx = LEGAL_ARBITRARY_PX) {
  const byFile = {};
  for (const d of scanDirs) {
    for (const abs of sharedWalk(join(repoRoot, d), [], SCAN_EXTS)) {
      const rel = relative(repoRoot, abs).replaceAll("\\", "/");
      // Storybook canvases + story-only scaffolding (same carve-out as token-scale).
      if (
        rel.includes("/stories/") ||
        rel.includes(".stories.") ||
        /(?:^|\/)_story[^/]*\.(tsx?|jsx?)$/i.test(rel) ||
        /(?:^|\/)_[^/]*Story[^/]*\.(tsx?|jsx?)$/i.test(rel)
      ) {
        continue;
      }
      const hits = findViolations(readFileSync(abs, "utf8"), legalPx);
      if (hits.length > 0) byFile[rel] = hits;
    }
  }
  return byFile;
}

export { evaluate, stripComments };

/**
 * ENG-1589 — the `--radius-*` custom properties that back the Tailwind
 * `rounded-*` radius ladder. Deliberately scoped to this exact list (not
 * "every `--radius*` var in the file"): `--radius-xl-landing` (20px) is a
 * pre-existing, separate marketing-only token consumed by raw
 * `.card-landing` CSS, not the shared `rounded-*` ladder audited by this
 * ticket (docs/audits/2026-07-17-design-sweep/report.md, cluster 2) — out
 * of scope here, tracked as its own surface if it ever needs auditing.
 */
export const RADIUS_VAR_NAMES = [
  "radius",
  "radius-sm",
  "radius-md",
  "radius-lg",
  "radius-xl",
  "radius-card",
  "radius-card-lg",
];

const ROOT_BLOCK_RE = /:root\s*\{([\s\S]*?)\n[ \t]*\}/;

/**
 * Resolve each of `varNames` to its px value as literally declared in
 * `:root` (theme.css's canonical value block — the `@theme inline` block
 * further down only re-exposes these via `var(--name)` for Tailwind, so
 * `:root` is the one source of truth to read). Supports a plain `px`/`rem`
 * literal or a single-level `var(--other)` indirection (the token graph
 * currently in use, e.g. `--radius-card: var(--radius-card-lg)`); throws on
 * anything else (`calc()`, unresolvable var, missing declaration) so a
 * future re-introduction of `calc()`-derivation fails loudly instead of
 * silently passing through unresolved.
 */
export function resolveRadiusVarsPx(cssSrc, varNames = RADIUS_VAR_NAMES) {
  const rootMatch = stripComments(cssSrc).match(ROOT_BLOCK_RE);
  if (!rootMatch) {
    throw new Error("check-web-radius — could not find a `:root { ... }` block in theme.css");
  }
  const block = rootMatch[1];
  const raw = {};
  for (const name of varNames) {
    const m = block.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
    if (!m) {
      throw new Error(`check-web-radius — no \`--${name}\` declaration found in :root`);
    }
    raw[name] = m[1].trim();
  }

  const resolved = {};
  function resolve(name, seen) {
    if (resolved[name] !== undefined) return resolved[name];
    if (seen.has(name)) {
      throw new Error(`check-web-radius — circular var() reference resolving --${name}`);
    }
    seen.add(name);
    const value = raw[name];
    const varRef = value.match(/^var\(--([\w-]+)\)$/);
    if (varRef) {
      if (raw[varRef[1]] === undefined) {
        throw new Error(`check-web-radius — --${name} references undeclared --${varRef[1]}`);
      }
      resolved[name] = resolve(varRef[1], seen);
      return resolved[name];
    }
    const rem = value.match(/^(-?[\d.]+)rem$/);
    if (rem) {
      resolved[name] = parseFloat(rem[1]) * 16; // 1rem = 16px root font-size
      return resolved[name];
    }
    const px = value.match(/^(-?[\d.]+)px$/);
    if (px) {
      resolved[name] = parseFloat(px[1]);
      return resolved[name];
    }
    throw new Error(
      `check-web-radius — --${name}: ${value} is not a plain px/rem value or var() reference ` +
        `(no calc() — pin an independent value instead, ENG-1589)`,
    );
  }
  for (const name of varNames) resolve(name, new Set());
  return resolved;
}

/**
 * `[{ varName, px, nearest }]` for every resolved `--radius-*` var whose px
 * value is off the legal ladder. Pure — takes already-resolved values so
 * tests can drive it with synthetic data without touching the filesystem.
 */
export function findCssVarViolations(resolvedPx, legalRadius) {
  const hits = [];
  for (const [name, px] of Object.entries(resolvedPx)) {
    if (!legalRadius.has(px)) {
      hits.push({ varName: name, px, nearest: nearestLegal(px, legalRadius) });
    }
  }
  return hits.sort((a, b) => a.varName.localeCompare(b.varName));
}

/**
 * The ENG-1589 hard gate: read theme.css, resolve the radius-ladder vars,
 * and report any that are off the legal scale. Returns `true` when clean.
 * Never grandfathers a hit through a pin/allow file — see the module
 * doc-comment for why.
 */
function checkCssVarLadder() {
  const legalRadius = readLegalRadius();
  const sortedLegal = [...legalRadius].sort((a, b) => a - b).join(" / ");
  const cssSrc = readFileSync(THEME_CSS_FILE, "utf8");
  const resolvedPx = resolveRadiusVarsPx(cssSrc);
  const hits = findCssVarViolations(resolvedPx, legalRadius);

  if (hits.length === 0) {
    console.log(
      `[check:web-radius] OK — all ${RADIUS_VAR_NAMES.length} --radius-* ladder vars resolve on-scale. ` +
        `Legal radius: ${sortedLegal}.`,
    );
    return true;
  }

  console.error(
    `\n[check:web-radius] ${hits.length} --radius-* var(s) in ` +
      `${relative(REPO_ROOT, THEME_CSS_FILE)} resolve OFF the legal ladder (value-based check, ` +
      `ENG-1589 — class-name allowlisting can't catch this):\n`,
  );
  for (const h of hits) {
    console.error(`  x --${h.varName}: ${h.px}px → nearest legal is ${h.nearest}px`);
  }
  console.error(
    `\nEvery --radius-* var backing the Tailwind rounded-* ladder must resolve to exactly one of\n` +
      `${sortedLegal} — pin it as an independent px/rem value in :root (src/styles/theme.css), never\n` +
      `derive it via calc() from another step. This check has no pin/allow file: a design-token\n` +
      `definition is either on the ladder or it is a bug to fix now.\n`,
  );
  return false;
}

function describeHit(h) {
  if (h.kind === "arbitrary-px") return `${h.token} → ${h.nearest}px (or a token class)`;
  return `${h.token} → rounded-card-lg (cards) / rounded-[12px] (inner)`;
}

function main() {
  // ENG-1589: the value-based ladder gate runs first and is a hard fail —
  // it's checked in both `check` and `--write` mode, and is never satisfied
  // by regenerating scripts/web-radius-budget.json (see module doc-comment).
  const cssVarsOk = checkCssVarLadder();

  const sortedPx = [...LEGAL_ARBITRARY_PX].sort((a, b) => a - b).join(" / ");
  runKeyedCli({
    name: "check:web-radius",
    budgetFile: BUDGET_FILE,
    scan: () => scanTree(),
    describeHit,
    writeNoun: "off-grammar web radii",
    shedNoun: "off-grammar radii",
    droppedOutLabel: "fully on the card grammar",
    okNoun: "legacy off-grammar web radii",
    newHitNoun: (count) => `${count} off-grammar radius/radii`,
    grewHitNoun: (count) => `${count} off-grammar radius/radii`,
    legalLabel: `Legal arbitrary px: ${sortedPx}. Cards: rounded-card / rounded-card-lg (24).`,
    guidance:
      `Web corners follow the one card grammar (2026-07-10): cards/banners/sheets/tiles are 24\n` +
      `(\`rounded-card\` / \`rounded-card-lg\`), nested/inner elements are 12; \`rounded-2xl\` /\n` +
      `\`rounded-3xl\` and arbitrary \`rounded-[Npx]\` off {${sortedPx}} are retired. The gate is a\n` +
      `ratchet — it can only ever tighten. If you legitimately shrank a pinned file, re-pin with:\n` +
      `  node scripts/check-web-radius.mjs --write`,
  });

  // runKeyedCli() above calls process.exit(1) itself on a #1/#2 failure and
  // otherwise returns normally without exiting — so the #3 ladder gate's
  // exit code only needs handling on the "runKeyedCli found nothing wrong"
  // path.
  if (!cssVarsOk) process.exit(1);
}

if (isInvokedDirectly(import.meta.url)) main();
