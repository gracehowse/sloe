#!/usr/bin/env node

/**
 * ENG-1007 — Colour / radius token census + only-shrink ratchet (web + mobile).
 *
 * Gives teeth to the "Tokens only — no literal hexes, no off-scale radii"
 * rule (root `.claude/CLAUDE.md` UI write discipline + `_project-context.md`
 * Design craft contract: "A literal hex in a component is a finding").
 * Like the spacing gate, the rule lived only in review agents; this script
 * is the write-time / CI gate.
 *
 * What it flags (a "token-scale violation"):
 *   1. A raw 6-digit hex literal `#RRGGBB` in a component (web or mobile).
 *   2. A raw Tailwind palette colour class `bg-/text-/border-<hue>-<NNN>`
 *      (web), e.g. `bg-red-500`, `text-slate-600` — should be a semantic
 *      token utility, not a raw palette step.
 *   3. A `borderRadius` numeric literal that is not on the canonical `Radius`
 *      scale (mobile), read at runtime from `apps/mobile/constants/theme.ts`
 *      via the shared `readLegalRadius()` in `scripts/lib/ratchet.mjs`
 *      (`Radius` = 4/6/8/12/24/9999) — never hardcoded. `check-web-radius.mjs`
 *      (ENG-1589) reads the same scale for web's `--radius-*` custom
 *      properties, so the two platforms can't grade different values legal.
 *   4. A raw `rgb()` / `rgba()` colour literal with numeric channels
 *      (ENG-1520 blind spot), e.g. `rgba(139, 92, 246, 0.5)` — a hue that
 *      dodges HEX_RE. Pure black / white (`rgb(0,0,0)` / `rgb(255,255,255)`,
 *      any alpha) are carved out as the scrim/shadow idiom, mirroring the
 *      3-digit `#000` / `#fff` carve-out. (The web `rounded-[Npx]` bracket
 *      blind spot from the same ticket is gated separately by
 *      `check:web-radius` / ENG-1499.)
 *   5. Call-site alpha-concat (ENG-1521): a colour expression glued to a
 *      quoted 2-hex-digit alpha suffix (`Accent.warning + "1F"`,
 *      `slotColor(slot) + "14"`), plus any `withAlpha(` call outside a
 *      token-definition file. The sanctioned soft-tint scale is the named
 *      `*Soft` / `*SoftStrong` tokens (12/20% light, 18/28% dark) — an
 *      ad-hoc alpha is off-scale by construction, and `withAlpha` is the
 *      token-file-internal derivation helper only.
 *   6. Web Tailwind slash-opacity on an accent semantic token (ENG-1591 —
 *      the web sibling of #5 / ENG-1521): `bg-`/`text-`/`border-` +
 *      `primary`/`success`/`warning`/`destructive` + `/<NN>`
 *      (`bg-primary/10`, `text-warning/15`, `border-destructive/30`).
 *      Tailwind's slash-opacity modifier manufactures the exact same
 *      ad-hoc tint ENG-1521 retired on mobile — just spelled `/NN` instead
 *      of `+ "1F"`. `muted` / `muted-foreground` are DELIBERATELY left out
 *      of this regex (not merely allow-listed — see the constant below):
 *      `--muted` is a neutral/structural fill, not an accent colour, and
 *      mobile's Soft/SoftStrong family never covered it either for the
 *      same reason — there is no Soft token for `muted` slash-opacity to
 *      migrate to, so it isn't a finding. (Other neutral slash-opacity
 *      idioms — `border-border/NN`, `bg-card/NN`, `bg-black/NN` scrims,
 *      etc. — are the same already-settled hairline/scrim category
 *      ENG-1572 explicitly left untouched, and stay out of scope here too.)
 *
 * Exclusions: token-definition files (`apps/mobile/constants/theme.ts`,
 * `src/styles/theme.css`, the Tailwind theme config), `node_modules`, and
 * `.claude/worktrees` (agent worktrees mirror the tree and would
 * double-count). 3-digit hexes (`#000` / `#fff`) are NOT matched — the Apple
 * Sign-In brand carve-out (`signup.tsx`, `login.tsx`) writes those, and they
 * are a documented intentional divergence (`_project-context.md`).
 *
 * Comments are stripped before scanning, so a hex referenced in a doc
 * comment ("light #3B2A4D / dark #815E91") never reads as a violation.
 *
 * Ratchet model (same as `check-screen-line-budget.mjs`):
 *   - The current violation population is pinned PER FILE in
 *     `scripts/token-budget.json` (`{ pins: { "<path>": <count> }, allow:
 *     { "<path>": "<rationale / ENG-ref>" } }`). A pinned file may only
 *     SHRINK; introducing a violation in an un-pinned file fails CI.
 *   - `allow` entries are full-file carve-outs and MUST carry a non-empty
 *     rationale (ENG ref / explicit "intentional" reason) — a silent
 *     carve-out is itself a failure.
 *
 * Usage:
 *   node scripts/check-token-scale.mjs            # check (CI)
 *   node scripts/check-token-scale.mjs --write    # regenerate pins
 *
 * Exit 0 on clean, exit 1 with a `file:line current → nearest-legal`
 * report otherwise. Wired into `npm run check:token-scale` and CI.
 *
 * The `stripComments`/`walk`/`loadBudget`/`writeBudget`/`evaluate`/CLI
 * scaffolding, plus `readLegalRadius()`, is shared with the spacing,
 * type-scale-mobile, screen-line-budget, and web-radius gates — see
 * `scripts/lib/ratchet.mjs` (ENG-1363, ENG-1589). Only the token-specific
 * regex lives here.
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

const BUDGET_FILE = join(REPO_ROOT, "scripts", "token-budget.json");

/** Dirs the token rule targets (relative to repo root). Web + mobile, same
 *  surfaces as the screen-line ratchet. */
export const SCAN_DIRS = [
  "src/app/components",
  "app",
  "apps/mobile/app",
  "apps/mobile/components",
];

const SCAN_EXTS = [".tsx", ".ts"];

/** Token-definition files — the legal homes for raw values. Repo-relative. */
const TOKEN_DEF_FILES = new Set([
  "apps/mobile/constants/theme.ts",
  "src/styles/theme.css",
  "tailwind.config.ts",
  "tailwind.config.js",
]);

const HEX_RE = /#[0-9a-fA-F]{6}\b/g;
// Tailwind palette colour class: bg-/text-/border- + hue + 3-digit step.
// Constrained to the canonical Tailwind hue names so e.g. `text-2xl` or a
// `bg-[#fff]` arbitrary value (caught by HEX_RE) never matches here.
const TW_HUES =
  "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|grey|zinc|neutral|stone";
const TW_RE = new RegExp(`\\b(?:bg|text|border)-(?:${TW_HUES})-[0-9]{3}\\b`, "g");
const RADIUS_RE = /\bborderRadius\s*:\s*(\d+(?:\.\d+)?)\b/g;
// Raw rgb()/rgba() colour literal with a numeric channel triple (ENG-1520 —
// the `check:web-radius`/`check:token-scale` blind-spot cluster). A hue
// written as `rgba(139, 92, 246, 0.5)` slips past HEX_RE entirely, so it
// dodges the "colour comes from tokens" rule. Pure black / pure white
// (`rgb(0,0,0)` / `rgb(255,255,255)`, any alpha) are the scrim + shadow
// idiom and are carved out — the same reason the 3-digit `#000` / `#fff`
// are (there is no semantic token for a raw scrim/shadow alpha). A
// token-routed `rgba(var(--x), 0.5)` has no numeric triple and never matches.
const RGBA_RE = /\brgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\b[^)]*\)/g;

// Call-site alpha-concat (ENG-1521): an identifier / property chain / call
// or index tail (`)` / `]`) followed by `+` and a quoted 2-hex-digit string —
// the `Accent.warning + "1F"` idiom that manufactures an off-scale tint from
// a token. Plain string-literal concat (`"a" + "1f"`) deliberately does NOT
// match: the left side must end in an expression character, not a quote.
const ALPHA_CONCAT_RE =
  /(?:[A-Za-z_$][\w$.]*|\)|\])\s*\+\s*(['"`])[0-9a-fA-F]{2}\1/g;
// `withAlpha(` outside a token-definition file (ENG-1521): the derivation
// helper lives in `apps/mobile/constants/theme.ts` ONLY (TOKEN_DEF_FILES,
// which scanTree skips) — call sites consume the named `*Soft` tokens.
const WITH_ALPHA_RE = /\bwithAlpha\s*\(/g;

// Web Tailwind slash-opacity on an ACCENT semantic token (ENG-1591 — web
// sibling of the ENG-1521 alpha-concat detector above): `bg-primary/10`,
// `text-warning/15`, `border-destructive/30`. Constrained to the accent
// family that ENG-1521 gave a Soft/SoftStrong scale to on mobile —
// `primary`/`success`/`warning`/`destructive` — the same duplication-of-a-
// sanctioned-scale problem, just spelled with Tailwind's `/NN` opacity
// modifier instead of a `+ "1F"` string concat.
//
// Detect + pin only (this ticket): migrating the 308 currently-pinned sites
// to a web Soft/SoftStrong token family is real follow-up work, deliberately
// NOT bundled here — see ENG-1624 (not a silent deferral: tracked, scoped,
// numbered against the exact population this scan pinned on 2026-07-20).
//
// `muted` / `muted-foreground` are deliberately NOT in this list (ENG-1591
// carve-out decision): `--muted` is a neutral/structural fill (the plain
// grey wash for chips/pressed states), not an accent colour, and mobile's
// Soft/SoftStrong family never covered `muted` for the exact same reason —
// there's no Soft token for `muted` slash-opacity to migrate to, so it
// isn't a finding here. This is an intentional scope boundary, not an
// oversight: it is enforced by never appearing in TW_SLASH_ACCENT_NAMES,
// not by a separate allow-list entry (nothing to allow-list — no violation
// is ever generated for it). Other neutral/structural slash-opacity idioms
// (`border-border/NN`, `bg-card/NN`, `bg-black/NN` scrims, `bg-white/NN`
// overlays, `bg-input/NN`, `bg-accent/NN`, `bg-secondary/NN`) are the same
// already-settled "hairline/scrim" category ENG-1572 explicitly left
// untouched ("a different, already-settled category") and are out of
// scope for this accent-only detector too — a much larger, structurally
// different problem that would need its own audit, not a silent sweep-in
// here.
const TW_SLASH_ACCENT_NAMES = "primary|success|warning|destructive";
const TW_SLASH_RE = new RegExp(
  `\\b(?:bg|text|border)-(?:${TW_SLASH_ACCENT_NAMES})/\\d{1,3}\\b`,
  "g",
);

/** Pure black / pure white channels — the carved-out scrim/shadow idiom. */
function isScrimBlackWhite(r, g, b) {
  return (r === 0 && g === 0 && b === 0) || (r === 255 && g === 255 && b === 255);
}

export { stripComments, readLegalRadius };

/**
 * Scan a single source file's text and return its token findings as
 * `[{ line, kind, token, nearest? }]`. Pure (no filesystem) so tests can
 * drive it with synthetic source.
 *   kind: "hex" | "tailwind" | "radius" | "rgba"
 */
export function findViolations(src, legalRadius) {
  const code = stripComments(src);
  const lines = code.split("\n");
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    HEX_RE.lastIndex = 0;
    while ((m = HEX_RE.exec(line)) !== null) {
      hits.push({ line: i + 1, kind: "hex", token: m[0] });
    }
    TW_RE.lastIndex = 0;
    while ((m = TW_RE.exec(line)) !== null) {
      hits.push({ line: i + 1, kind: "tailwind", token: m[0] });
    }
    RADIUS_RE.lastIndex = 0;
    while ((m = RADIUS_RE.exec(line)) !== null) {
      const value = parseFloat(m[1]);
      if (!legalRadius.has(value)) {
        hits.push({
          line: i + 1,
          kind: "radius",
          token: `borderRadius: ${value}`,
          nearest: nearestLegal(value, legalRadius),
        });
      }
    }
    RGBA_RE.lastIndex = 0;
    while ((m = RGBA_RE.exec(line)) !== null) {
      const [r, g, b] = [m[1], m[2], m[3]].map((n) => parseInt(n, 10));
      if (isScrimBlackWhite(r, g, b)) continue;
      hits.push({ line: i + 1, kind: "rgba", token: m[0].replace(/\s+/g, " ") });
    }
    ALPHA_CONCAT_RE.lastIndex = 0;
    while ((m = ALPHA_CONCAT_RE.exec(line)) !== null) {
      hits.push({ line: i + 1, kind: "alpha-concat", token: m[0].replace(/\s+/g, " ") });
    }
    WITH_ALPHA_RE.lastIndex = 0;
    while ((m = WITH_ALPHA_RE.exec(line)) !== null) {
      hits.push({ line: i + 1, kind: "with-alpha", token: "withAlpha(…)" });
    }
    TW_SLASH_RE.lastIndex = 0;
    while ((m = TW_SLASH_RE.exec(line)) !== null) {
      hits.push({ line: i + 1, kind: "slash-opacity", token: m[0] });
    }
  }
  return hits;
}

/** Walk the tree and return `{ "<repo-relative path>": [hits] }`. */
export function scanTree(repoRoot = REPO_ROOT, scanDirs = SCAN_DIRS, legalRadius = readLegalRadius()) {
  const byFile = {};
  for (const d of scanDirs) {
    for (const abs of sharedWalk(join(repoRoot, d), [], SCAN_EXTS)) {
      const rel = relative(repoRoot, abs);
      if (TOKEN_DEF_FILES.has(rel)) continue;
      const hits = findViolations(readFileSync(abs, "utf8"), legalRadius);
      if (hits.length > 0) byFile[rel] = hits;
    }
  }
  return byFile;
}

export { evaluate };

function describeHit(h) {
  if (h.kind === "radius") return `borderRadius ${h.token.split(": ")[1]} → ${h.nearest}`;
  if (h.kind === "tailwind") return `${h.token} → semantic token utility`;
  if (h.kind === "rgba") return `${h.token} → semantic colour token (token + opacity)`;
  if (h.kind === "alpha-concat")
    return `${h.token} → named *Soft / *SoftStrong token (ENG-1521 soft-tint scale)`;
  if (h.kind === "with-alpha")
    return `withAlpha() at a call site → named *Soft token (ENG-1521 — helper is theme.ts-internal)`;
  if (h.kind === "slash-opacity")
    return `${h.token} → named *Soft / *SoftStrong token (ENG-1591 — web mirror of ENG-1521)`;
  return `${h.token} → semantic token`;
}

function main() {
  const legalRadius = readLegalRadius();
  const sortedRadius = [...legalRadius].sort((a, b) => a - b).join(" / ");
  runKeyedCli({
    name: "check:token-scale",
    budgetFile: BUDGET_FILE,
    scan: () => scanTree(REPO_ROOT, SCAN_DIRS, legalRadius),
    describeHit,
    writeNoun: "raw colour/radius literals",
    shedNoun: "raw literals",
    droppedOutLabel: "fully tokenised",
    okNoun: "legacy raw colour/radius literals",
    newHitNoun: (count) => `${count} raw colour/radius literal(s)`,
    grewHitNoun: (count) => `${count} raw literal(s)`,
    legalLabel: `Legal radius: ${sortedRadius}.`,
    guidance:
      `Colour + radius come from tokens: a literal hex / Tailwind palette class is a finding;\n` +
      `borderRadius snaps to ${sortedRadius} (\`Radius.*\`).\n` +
      `Soft tints come from the named *Soft / *SoftStrong tokens (ENG-1521: 12/20% light,\n` +
      `18/28% dark) — alpha-concat (\`hue + "18"\`) and call-site withAlpha() are findings, and so\n` +
      `is web Tailwind slash-opacity on an accent token (ENG-1591: \`bg-primary/10\` etc. — \n` +
      `\`bg-muted/NN\` is exempt, a neutral fill, not an accent tint).\n` +
      `Route the value to a semantic token (theme.ts / theme.css / the Tailwind theme). The gate\n` +
      `is a ratchet — it can only ever tighten. If you are legitimately shrinking a pinned file,\n` +
      `re-pin it lower with:\n` +
      `  node scripts/check-token-scale.mjs --write`,
  });
}

if (isInvokedDirectly(import.meta.url)) main();
