/**
 * ENG-1363 — Shared scaffolding for the pin-based only-shrink ratchets:
 *   check-screen-line-budget.mjs, check-spacing-scale.mjs,
 *   check-token-scale.mjs, check-type-scale-mobile.mjs, check-web-radius.mjs.
 *
 * Those scripts were >85% line-for-line duplicates of one skeleton:
 * `stripComments()`, `walk()`, `loadBudget()`/`writeBudget()`, the
 * `{failures, shrinks, droppedOut, badAllow}` evaluator, and the `--write`
 * CLI. This module is that skeleton, extracted once. Each checker keeps
 * ONLY its distinct rule logic (the regex / theme-parsing bits) and wires
 * it into the harness here.
 *
 * Two pin-file shapes are supported (byte-compatible with the pre-refactor
 * files — do not change either):
 *   - "keyed"     — `{ pins: { "<path>": <count> }, allow: { "<path>":
 *                    "<rationale>" } }`. Used by the spacing/token/
 *                    type-scale-mobile/web-radius budgets. `evaluate()`
 *                    takes an `allow` map and returns `badAllow`
 *                    (rationale-less carve-outs) in addition to the other
 *                    fields.
 *   - "flat"      — `{ "<path>": <count> }` with no `allow` concept. Used
 *                    by screen-line-budget.json. `evaluate()` is called
 *                    with no `allow` argument and never returns `badAllow`.
 *
 * `readLegalRadius()` (ENG-1589) is the one non-ratchet-harness export here:
 * both `check-token-scale.mjs` (mobile `borderRadius` literals) and
 * `check-web-radius.mjs` (web `--radius-*` custom properties) read the same
 * canonical scale from `apps/mobile/constants/theme.ts`'s `Radius` so web
 * and mobile can never grade different values as "legal".
 *
 * Nothing else here changes ratchet semantics — it is a pure extraction.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Blank out block + line comments so doc-comment numbers/hexes never
 * false-positive — WHILE preserving line numbers (newlines are kept, comment
 * bodies become spaces) so the reported `file:line` is accurate. Conservative
 * on line comments: blanks everything after `//`; this loses the rare case of
 * `//` inside a string, but none of the scanned prop/value shapes are written
 * that way in practice.
 */
export function stripComments(src) {
  // Replace each block comment with the same number of newlines it spanned
  // (plus spaces for the rest), so subsequent line indexing is unchanged.
  let s = src.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "));
  s = s
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("//");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");
  return s;
}

/** Recursively collect files under `dir` whose name ends with one of
 *  `extensions`, skipping `node_modules` and `.expo`. Returns `acc`
 *  (an array) for compatibility with the original per-script signature. */
export function walk(dir, acc, extensions) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".expo") continue;
      walk(full, acc, extensions);
    } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
      acc.push(full);
    }
  }
  return acc;
}

export function nearestLegal(value, legal) {
  return [...legal].sort((a, b) => Math.abs(a - value) - Math.abs(b - value))[0];
}

/** Mobile's canonical `Radius` scale (`apps/mobile/constants/theme.ts`) —
 *  the single legal radius ladder both `check-token-scale.mjs` (mobile
 *  `borderRadius` literals) and `check-web-radius.mjs` (web `--radius-*`
 *  custom properties, ENG-1589) read, so the two platforms can never drift
 *  apart on what counts as a legal radius. */
const THEME_FILE = join(REPO_ROOT, "apps", "mobile", "constants", "theme.ts");

/** Read the canonical legal radius values from `theme.ts` (`Radius`). */
export function readLegalRadius(themeSrc = readFileSync(THEME_FILE, "utf8")) {
  const block = themeSrc.match(/export const Radius\s*=\s*\{([\s\S]*?)\}/);
  if (!block) {
    throw new Error("readLegalRadius — could not find `export const Radius` in theme.ts");
  }
  const values = new Set([0]); // 0 = square, always legal
  const valRe = /:\s*(\d+(?:\.\d+)?)\s*,/g;
  let m;
  while ((m = valRe.exec(block[1])) !== null) {
    values.add(parseFloat(m[1]));
  }
  if (values.size <= 1) {
    throw new Error("readLegalRadius — parsed an empty Radius scale from theme.ts");
  }
  return values;
}

/** Load a "keyed" budget file (`{ pins, allow }`). Missing file → empty. */
export function loadKeyedBudget(budgetFile) {
  if (!existsSync(budgetFile)) return { pins: {}, allow: {} };
  const parsed = JSON.parse(readFileSync(budgetFile, "utf8"));
  return { pins: parsed.pins ?? {}, allow: parsed.allow ?? {} };
}

/** Write a "keyed" budget file (`{ allow, pins }`, pins sorted by path). */
export function writeKeyedBudget(budgetFile, pins, allow) {
  const sortedPins = Object.fromEntries(Object.entries(pins).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(budgetFile, JSON.stringify({ allow, pins: sortedPins }, null, 2) + "\n", "utf8");
}

/** Load a "flat" budget file (`{ "<path>": <count> }`, no allow concept). */
export function loadFlatBudget(budgetFile) {
  if (!existsSync(budgetFile)) return {};
  return JSON.parse(readFileSync(budgetFile, "utf8"));
}

/** Write a "flat" budget file, sorted by path for a diff-friendly commit. */
export function writeFlatBudget(budgetFile, map) {
  const sorted = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(budgetFile, JSON.stringify(sorted, null, 2) + "\n", "utf8");
}

/**
 * Pure evaluator (side-effect-free) shared by the spacing / token /
 * type-scale-mobile gates. Given the per-file findings, the pinned counts,
 * and the allow-list, returns violations + shrink notices + dropped-out
 * pins + any silent (rationale-less) carve-outs.
 *
 * `byFile` is `{ "<path>": [hit, ...] }` — only the `.length` of each hit
 * array is used, so callers can shape hits however their rule needs.
 */
export function evaluateKeyed(byFile, pins, allow = {}) {
  const failures = [];
  const shrinks = [];

  // Silent carve-outs are themselves a failure: an allow entry must explain
  // itself (ENG ref or explicit "intentional" reason).
  const badAllow = [];
  for (const [path, reason] of Object.entries(allow)) {
    if (typeof reason !== "string" || reason.trim().length < 6) {
      badAllow.push(path);
    }
  }

  for (const [path, hits] of Object.entries(byFile)) {
    if (allow[path] !== undefined) continue; // allow-listed (rationale checked above)
    const count = hits.length;
    const pin = pins[path];
    if (pin === undefined) {
      failures.push({ path, count, hits, kind: "new" });
    } else if (count > pin) {
      failures.push({ path, count, pin, hits, kind: "grew" });
    } else if (count < pin) {
      shrinks.push({ path, count, pin });
    }
  }

  // Pins for files that no longer have any violation can be removed.
  const droppedOut = Object.keys(pins).filter((p) => byFile[p] === undefined && allow[p] === undefined);

  return { failures, shrinks, droppedOut, badAllow };
}

/**
 * Pure evaluator for the "flat" pin shape (screen-line-budget: no `allow`,
 * a single numeric `lines` value per file rather than a hit array).
 * `limitLabel` names the limit in the "new file" message (default "line"
 * so it reads "crosses the 400-line limit"; the screen-budget caller
 * passes "screen limit" to read "crosses the 400-line screen limit").
 */
export function evaluateFlat(current, pinned, { hardLimit, limitLabel = "line limit" } = {}) {
  const failures = [];
  const shrinks = [];
  for (const [path, lines] of Object.entries(current)) {
    const pin = pinned[path];
    if (pin === undefined) {
      failures.push({
        path,
        lines,
        kind: "new",
        message: `crosses the ${hardLimit}-${limitLabel} (${lines} lines) and is not allow-listed`,
      });
    } else if (lines > pin) {
      failures.push({
        path,
        lines,
        pin,
        kind: "grew",
        message: `grew past its pinned budget (${lines} lines > ${pin} pinned)`,
      });
    } else if (lines < pin) {
      shrinks.push({ path, lines, pin });
    }
  }
  return { failures, shrinks };
}

/**
 * Print up to 5 hits per file via `describeHit(hit)`, then an "and N more"
 * summary line. Shared by the three "keyed" (hit-array) checkers.
 */
export function printHits(hits, describeHit, indent = "      ") {
  for (const h of hits.slice(0, 5)) {
    console.error(`${indent}${h.line}: ${describeHit(h)}`);
  }
  if (hits.length > 5) console.error(`${indent}... and ${hits.length - 5} more`);
}

/**
 * Run the standard "keyed" ratchet CLI (check + `--write`) for a checker
 * whose pin file is `{ pins, allow }` and whose per-file findings are hit
 * arrays. The four callers' log copy differs in small but real ways (e.g.
 * "fully on-scale" vs "fully tokenised" vs "fully on-ramp"), so every phrase
 * is passed in verbatim rather than derived, to keep output byte-identical
 * to the pre-extraction scripts. `opts`:
 *   - name             e.g. "check:spacing-scale" (used in log prefixes)
 *   - budgetFile       absolute path to the pin JSON
 *   - scan()           () => byFile (`{ path: [hits] }`)
 *   - describeHit(hit) -> string, for the violation report
 *   - writeNoun        e.g. "off-scale literals" — the `--write` summary noun
 *   - shedNoun         e.g. "off-scale literals" — the shrink-notice noun
 *   - droppedOutLabel  e.g. "fully on-scale" — the dropped-pin adjective
 *   - okNoun           e.g. "legacy off-scale literals" — the clean-run noun
 *   - newHitNoun(count)  -> e.g. "3 off-scale spacing literal(s)"
 *   - grewHitNoun(count) -> e.g. "3 off-scale literal(s)"
 *   - legalLabel       string describing the legal scale, appended to summaries
 *   - guidance         multi-line string printed above the re-pin instructions
 */
export function runKeyedCli(opts) {
  const {
    name,
    budgetFile,
    scan,
    describeHit,
    writeNoun,
    shedNoun,
    droppedOutLabel,
    okNoun,
    newHitNoun,
    grewHitNoun,
    legalLabel,
    guidance,
  } = opts;

  const write = process.argv.includes("--write");
  const byFile = scan();
  const { allow } = loadKeyedBudget(budgetFile);

  if (write) {
    const pins = Object.fromEntries(
      Object.entries(byFile)
        .filter(([p]) => allow[p] === undefined)
        .map(([p, hits]) => [p, hits.length]),
    );
    writeKeyedBudget(budgetFile, pins, allow);
    const total = Object.values(pins).reduce((a, b) => a + b, 0);
    console.log(
      `[${name}] wrote ${Object.keys(pins).length} pinned files ` +
        `(${total} ${writeNoun}) to ${relative(REPO_ROOT, budgetFile)}. ${legalLabel}`,
    );
    return;
  }

  const { pins } = loadKeyedBudget(budgetFile);
  const { failures, shrinks, droppedOut, badAllow } = evaluateKeyed(byFile, pins, allow);

  if (shrinks.length > 0) {
    console.log(`[${name}] These files shed ${shedNoun} — tighten with \`--write\`:`);
    for (const s of shrinks) console.log(`  ${s.path}: ${s.count} (pinned ${s.pin})`);
  }
  if (droppedOut.length > 0) {
    console.log(`[${name}] ${droppedOut.length} file(s) are now ${droppedOutLabel} — remove from the pin with \`--write\`:`);
    for (const p of droppedOut) console.log(`  ${p}`);
  }

  if (badAllow.length > 0) {
    console.error(
      `\n[${name}] ${badAllow.length} allow-list entr(y/ies) lack a rationale ` +
        `(needs an ENG ref or explicit "intentional ..." reason — no silent carve-outs):`,
    );
    for (const p of badAllow) console.error(`  x ${p}`);
  }

  if (failures.length === 0 && badAllow.length === 0) {
    const total = Object.values(pins).reduce((a, b) => a + b, 0);
    console.log(
      `[${name}] OK — ${Object.keys(pins).length} pinned files ` +
        `(${total} ${okNoun}), none grew; no new file introduced one. ${legalLabel}`,
    );
    return;
  }

  if (failures.length > 0) {
    console.error(`\n[${name}] ${failures.length} file(s) over budget:\n`);
    for (const f of failures) {
      if (f.kind === "new") {
        console.error(`  x ${f.path} — introduces ${newHitNoun(f.count)}; not pinned:`);
      } else {
        console.error(`  x ${f.path} — grew to ${grewHitNoun(f.count)} (pinned ${f.pin}):`);
      }
      printHits(f.hits, describeHit);
    }
    console.error(`\n${guidance}\n`);
  }
  process.exit(1);
}

/**
 * Run the standard "flat" ratchet CLI (check + `--write`) for
 * check-screen-line-budget.mjs — no `allow` concept, one numeric value per
 * file. `opts`:
 *   - name        "check:screen-budget"
 *   - budgetFile  absolute path to the pin JSON
 *   - scan()      () => current offender map `{ path: lines }`
 *   - hardLimit   the ceiling every non-pinned file must stay under
 *   - limitLabel  passed through to `evaluateFlat` (see there)
 *   - guidance    multi-line string printed above the re-pin instructions
 */
export function runFlatCli(opts) {
  const { name, budgetFile, scan, hardLimit, limitLabel, guidance } = opts;

  const write = process.argv.includes("--write");
  const current = scan();

  if (write) {
    writeFlatBudget(budgetFile, current);
    console.log(`[${name}] wrote ${Object.keys(current).length} pinned offenders to ${relative(REPO_ROOT, budgetFile)}.`);
    return;
  }

  const pinned = loadFlatBudget(budgetFile);
  const { failures, shrinks } = evaluateFlat(current, pinned, { hardLimit, limitLabel });

  const droppedOut = Object.keys(pinned).filter((p) => current[p] === undefined);

  if (shrinks.length > 0) {
    console.log(`[${name}] These files shrank below their pin — tighten with \`--write\`:`);
    for (const s of shrinks) console.log(`  ${s.path}: ${s.lines} (pinned ${s.pin})`);
  }
  if (droppedOut.length > 0) {
    console.log(`[${name}] ${droppedOut.length} file(s) dropped to <=${hardLimit} lines — remove from the allow-list with \`--write\`:`);
    for (const p of droppedOut) console.log(`  ${p}`);
  }

  if (failures.length === 0) {
    console.log(`[${name}] OK — ${Object.keys(current).length} allow-listed legacy offenders, none grew; no new file crossed ${hardLimit} lines.`);
    return;
  }

  console.error(`\n[${name}] ${failures.length} violation(s):\n`);
  for (const f of failures) {
    console.error(`  x ${f.path} — ${f.message}`);
  }
  console.error(`\n${guidance}\n`);
  process.exit(1);
}

/** True when this module was invoked directly as a script (not imported by
 *  a test). Shared by all four checkers' `main()` guard. */
export function isInvokedDirectly(importMetaUrl) {
  return Boolean(
    process.argv[1] && statSync(process.argv[1]).isFile() && fileURLToPath(importMetaUrl) === process.argv[1],
  );
}
