#!/usr/bin/env node

/**
 * ENG-1378 — Copy-voice census + only-shrink ratchet (web + mobile).
 *
 * Extends the no-"!" / no-praise / no-vendor discipline that already
 * lives as hand-written tests on three copy modules
 * (`src/lib/nutrition/weeklyRecapPushBody.ts`,
 * `src/lib/nutrition/weeklyDigestSuggestion.ts`,
 * `src/lib/recipes/importErrorCopy.ts`) into a write-time / CI gate that
 * covers every user-facing string literal in the app shell, the same way
 * `check-token-scale.mjs` gave teeth to the tokens-only rule. Root cause
 * (2026-07-05 Mobbin-benchmarked UI critique, ENG-1378): internal
 * pipeline state and defensive ad-copy voice leaked into user-facing
 * strings because the "no exclamation marks / no unearned praise / no
 * vendor names" rule only lived in review agents and three hand-audited
 * files — nobody writing a toast or an Alert elsewhere had it.
 *
 * What it flags (a "copy-voice violation"), one hit per offending string:
 *
 *   1. `bang`   — a string literal that contains "!" outside of a
 *      handful of code-shaped exceptions (see BANG_RE below: `!==`,
 *      `!important`, `!!`, a leading `!` used as a boolean negation
 *      inside a template expression). Matches ANY "!" in a plain string
 *      or template literal, not just a trailing one — "Marked as made!"
 *      and "Great! Let's go" both trip it. This is deliberately broad:
 *      exclamation-marked UI copy is exactly rule #1 of the voice
 *      contract ("no self-defence / no unearned enthusiasm"), and a
 *      mid-sentence "!" is just as much a voice violation as a trailing
 *      one.
 *
 *   2. `vendor` — a vendor/env name (Supabase, Expo, EXPO_PUBLIC_,
 *      Postgres, Upstash, RevenueCat, Stripe) appearing inside a string
 *      literal that also contains a space (i.e. reads as prose, not an
 *      import path / identifier / URL slug). The space requirement is
 *      the key precision lever — `"@/lib/supabase"`, `import ... from
 *      "expo-router"`, and `getSupprApiBase()` calls never match because
 *      they're spaceless paths/identifiers, while `"Supabase is not
 *      configured"` does. This still isn't perfect (a prose string with
 *      no space is vanishingly rare in practice) but it's the
 *      conservative side of the tradeoff: false negatives (a vendor name
 *      slipping through in an unusual shape) are acceptable; false
 *      positives on `import` lines are not, because the scan directories
 *      are 100% application code, not just copy — every file has import
 *      statements.
 *
 *   3. `ellipsisAscii` — three literal dots `...` inside a string
 *      literal. Canonical is the single ellipsis glyph `…`. This one has
 *      the weakest precision of the three: it cannot distinguish
 *      "Loading..." (a copy offender) from a URL placeholder
 *      ("https://getsloe.com/recipe/...") or a code-ish ellipsis inside
 *      an error string ("cannot add postgres_changes callbacks ... after
 *      subscribe()"). We accept the miss-rate cost here too and instead
 *      narrow with an allowlist of URL/code-shaped substrings (`http`,
 *      `://`) skipped inline — anything that still false-positives after
 *      that gets pinned via the ratchet (a pin is not a pass, it's a
 *      tracked debt) or moved to the `allow` map with a rationale.
 *
 * Precision summary: this script is a census + ratchet, not a proof.
 * It is tuned to never block a legitimate code pattern (comparison
 * operators, CSS `!important`, import paths, identifiers) at the cost of
 * occasionally under-counting real offenders (an exclamation mark
 * hidden inside a computed template expression it can't statically
 * evaluate, a vendor name spelled with unusual casing). Per the
 * project's "better to miss than false-positive on code" instruction,
 * every regex below is written to fail closed (skip) on ambiguity.
 *
 * Exclusions:
 *   - Legal / billing / licences pages carry factual vendor disclosure
 *     by design (Terms, Privacy, Licences, the Stripe billing portal
 *     redirect, the pricing page's VAT-disclosure copy) — allow-listed
 *     below with the ENG/legal rationale inline. A silent carve-out is
 *     itself a ratchet failure (enforced by `evaluateKeyed`'s `badAllow`
 *     check), so every entry must explain itself.
 *   - `apps/mobile/components/ops/SupabaseNotConfiguredScreen.tsx`
 *     already has a tracked gap for its `__DEV__`-only "Supabase is not
 *     configured" title — see ENG-1456. Allow-listed with that
 *     reference rather than silently pinned, since the ticket already
 *     owns the fix.
 *   - Non-JSX/story/dev-only surfaces are NOT specially excluded beyond
 *     what the scan dirs already omit (this mirrors `check-token-scale`,
 *     which also scans everything under the same four directories
 *     uniformly).
 *
 * Ratchet model (identical to the token/spacing/type-scale-mobile
 * gates, via the shared `scripts/lib/ratchet.mjs` harness — ENG-1363):
 *   - The current violation population is pinned PER FILE in
 *     `scripts/copy-voice-budget.json` (`{ pins: { "<path>": <count> },
 *     allow: { "<path>": "<rationale / ENG-ref>" } }`). A pinned file
 *     may only SHRINK; a new violation in an un-pinned file, or growth
 *     past a pin, fails CI.
 *
 * Usage:
 *   node scripts/check-copy-voice.mjs            # check (CI)
 *   node scripts/check-copy-voice.mjs --write     # regenerate pins
 *
 * Exit 0 clean, exit 1 with a `file:line kind: snippet` report otherwise.
 * Wired into `npm run check:copy-voice` / `check:copy-voice:write` and
 * into the `ci` script chain alongside the sibling ratchets.
 */

import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import {
  REPO_ROOT,
  stripComments,
  walk as sharedWalk,
  evaluateKeyed as evaluate,
  runKeyedCli,
  isInvokedDirectly,
} from "./lib/ratchet.mjs";

const BUDGET_FILE = join(REPO_ROOT, "scripts", "copy-voice-budget.json");

/** Same four app-shell surfaces the token/spacing gates scan — web +
 *  mobile UI, not API routes / lib / tests. */
export const SCAN_DIRS = ["src/app/components", "app", "apps/mobile/app", "apps/mobile/components"];

const SCAN_EXTS = [".tsx", ".ts"];

/**
 * String-literal matcher: single- or double-quoted, or a template
 * literal with no `${` inside it (a template literal WITH an
 * interpolation is skipped for the vendor/ellipsis checks below because
 * we can't safely tell prose text from an embedded expression without a
 * real parser — conservative miss, not a false-positive risk). Runs
 * against comment-stripped source so doc-comment prose never matches.
 */
const STRING_LITERAL_RE = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\$]|\\.)*`/g;

/**
 * Bang check — "!" anywhere in a string literal, excluding the
 * code-shaped exceptions:
 *   - `!==` / `!=`   (inequality operators never appear bare in a
 *     string literal the way we scan, but guarded anyway in case a
 *     literal contains a rendered code snippet)
 *   - `!important`   (CSS)
 *   - `!!`           (double-negation idiom, never real UI copy)
 * A literal ending in or containing a real "!" — "Marked as made!",
 * "Great! Let's go" — both trip this.
 */
function findBangHits(literal) {
  if (looksLikeClassList(literal)) return false;
  // A "!" wedged directly between two identifier characters with no
  // surrounding space (`word!word`) is a code shape, not prose — e.g.
  // PostgREST's foreign-key embed hint `profiles!author_id` in a
  // Supabase `.select("...")` column list. Real exclamation-marked
  // sentences always have the "!" followed by a space, closing quote,
  // or another punctuation mark — never immediately by another word
  // character. Strip these before testing so a real "!" elsewhere in
  // the same literal still trips.
  const withoutCodeShapedBangs = literal.replace(/(?<=\w)!(?=\w)/g, "");
  if (/!important|!==|!!|!=/.test(withoutCodeShapedBangs)) {
    // Still might have an independent real "!" elsewhere in the same
    // literal alongside one of these code-shaped tokens; strip the
    // known-safe tokens out first, then re-test on what's left.
    const scrubbed = withoutCodeShapedBangs.replace(/!important|!==|!!|!=/g, "");
    return scrubbed.includes("!");
  }
  return withoutCodeShapedBangs.includes("!");
}

/**
 * Tailwind `className` strings are the dominant source of "!"
 * false-positives: Tailwind v4's important-modifier shorthand puts "!"
 * directly against a utility token, either leading (`!bg-slot-.../12`,
 * `!text-destructive`) or trailing (`size-8!`, `p-0!`). Real UI prose
 * never has a hyphenated/colon-adjacent "!" like that — a sentence's
 * "!" always follows a plain word with nothing but a space or end-of-
 * string next to it.
 *
 * Heuristic (conservative — errs toward treating ambiguous strings as
 * class-lists so we skip rather than false-positive on code): a literal
 * reads as a Tailwind class-list if it contains 2+ variant-prefix
 * colons (`hover:`, `focus:`, `dark:`, `data-[foo=bar]:`, `group-...:`)
 * OR any of the structural Tailwind markers `data-[`, `aria-[`, `peer/`,
 * `group/`, `group-data-` OR is itself a single bare utility token (no
 * spaces, no uppercase, only lowercase/digits/hyphen/slash/dot/colon/
 * bang) such as a helper function's return value
 * (`"!bg-slot-breakfast/12"`). A real sentence essentially never
 * contains two `word:` colon-tokens, a `data-[...]` attribute selector,
 * or is a single space-free lowercase/punctuation token.
 */
function looksLikeClassList(literal) {
  if (/data-\[|aria-\[|peer\/|group\/|group-data-/.test(literal)) return true;
  const colonTokens = literal.match(/[a-zA-Z][\w-]*:/g) ?? [];
  if (colonTokens.length >= 2) return true;
  const inner = literal.slice(1, -1); // strip the quote chars
  return /^!?[a-z0-9][a-z0-9./:-]*!?$/.test(inner);
}

/** Vendor/env names that must not leak into user-facing prose. */
const VENDOR_RE = /\b(Supabase|Expo|EXPO_PUBLIC_[A-Z_]+|Postgres(?:ql)?|Upstash|RevenueCat|Stripe)\b/;

/**
 * Vendor hit: the literal contains a vendor keyword AND a space
 * (reads as prose, not an import path / bare identifier / URL slug).
 * `EXPO_PUBLIC_*` names are already all-caps-with-underscore idenfiers
 * so the space requirement still applies (an env var rendered directly
 * into an error string, e.g. "Missing EXPO_PUBLIC_API_URL", has a space
 * around it from the surrounding sentence).
 */
function findVendorHit(literal) {
  return VENDOR_RE.test(literal) && /\s/.test(literal.replace(/^['"`]|['"`]$/g, ""));
}

/**
 * Ellipsis-ASCII hit: three literal dots, with a light denylist for the
 * two most common code-shaped false positives (a URL placeholder, a
 * protocol-bearing string). Anything else containing "..." is flagged;
 * true remaining false positives are pinned/allow-listed rather than
 * chased with more regex, per the header's precision tradeoff.
 */
function findEllipsisAsciiHit(literal) {
  if (!literal.includes("...")) return false;
  if (/https?:\/\//.test(literal)) return false; // URL placeholder, not prose
  return true;
}

/**
 * Scan one file's source and return its findings as
 * `[{ line, kind, snippet }]`. Pure (no filesystem) so tests can drive
 * it with synthetic source. `kind`: "bang" | "vendor" | "ellipsisAscii".
 */
export function findViolations(src) {
  const code = stripComments(src);
  const lines = code.split("\n");
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    STRING_LITERAL_RE.lastIndex = 0;
    let m;
    while ((m = STRING_LITERAL_RE.exec(line)) !== null) {
      const literal = m[0];
      // Skip template literals with an interpolation — see doc comment.
      if (literal.startsWith("`") && literal.includes("${")) continue;
      // Skip literals with no letters at all (pure punctuation/numeric —
      // never user-facing prose, avoids false hits on things like ":!:"
      // separators that don't exist here but keeps the intent explicit).
      if (!/[a-zA-Z]/.test(literal)) continue;

      if (findBangHits(literal)) {
        hits.push({ line: i + 1, kind: "bang", snippet: truncate(literal) });
      }
      if (findVendorHit(literal)) {
        hits.push({ line: i + 1, kind: "vendor", snippet: truncate(literal) });
      }
      if (findEllipsisAsciiHit(literal)) {
        hits.push({ line: i + 1, kind: "ellipsisAscii", snippet: truncate(literal) });
      }
    }
  }
  return hits;
}

function truncate(s, max = 72) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export { stripComments };

/** Walk the tree and return `{ "<repo-relative path>": [hits] }`. */
export function scanTree(repoRoot = REPO_ROOT, scanDirs = SCAN_DIRS) {
  const byFile = {};
  for (const d of scanDirs) {
    for (const abs of sharedWalk(join(repoRoot, d), [], SCAN_EXTS)) {
      const rel = relative(repoRoot, abs);
      const hits = findViolations(readFileSync(abs, "utf8"));
      if (hits.length > 0) byFile[rel] = hits;
    }
  }
  return byFile;
}

export { evaluate };

function describeHit(h) {
  if (h.kind === "bang") return `"!" in string: ${h.snippet}`;
  if (h.kind === "vendor") return `vendor name in user-facing string: ${h.snippet}`;
  return `"..." (use the … glyph): ${h.snippet}`;
}

function main() {
  runKeyedCli({
    name: "check:copy-voice",
    budgetFile: BUDGET_FILE,
    scan: scanTree,
    describeHit,
    writeNoun: "copy-voice violations",
    shedNoun: "copy-voice violations",
    droppedOutLabel: "fully clean",
    okNoun: "legacy copy-voice violations",
    newHitNoun: (count) => `${count} copy-voice violation(s)`,
    grewHitNoun: (count) => `${count} copy-voice violation(s)`,
    legalLabel: "Rules: no \"!\" in UI strings, no bare vendor/env names in prose, ellipsis glyph (…) not \"...\".",
    guidance:
      `No "!" in user-facing copy (no self-defence / no unearned enthusiasm — ENG-1378 voice contract);\n` +
      `no vendor/env names in prose (Supabase/Expo/EXPO_PUBLIC_*/Postgres/Upstash/RevenueCat/Stripe — factual\n` +
      `legal/billing disclosure is allow-listed, not exempted app-wide); "..." becomes the ellipsis glyph "…".\n` +
      `Fix the copy, or if genuinely a legal/billing factual disclosure, add it to the allow map in\n` +
      `scripts/copy-voice-budget.json with a rationale. The gate is a ratchet — it can only ever tighten.\n` +
      `If you are legitimately shrinking a pinned file, re-pin it lower with:\n` +
      `  node scripts/check-copy-voice.mjs --write`,
  });
}

if (isInvokedDirectly(import.meta.url)) main();
