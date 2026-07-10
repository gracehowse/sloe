/**
 * ENG-1499 — Web `rounded-*` radius census + ratchet (`scripts/check-web-radius.mjs`).
 *
 * Pins the card-grammar enforcement leg (2026-07-10 ruling,
 * `docs/decisions/2026-07-10-card-grammar-rounder-flat.md`):
 *  1. The legal arbitrary px set is exactly {12, 24} (12 = inner standard,
 *     24 = THE card corner).
 *  2. findViolations() flags retired `rounded-2xl` / `rounded-3xl` classes
 *     (incl. directional/responsive variants) and off-set `rounded-[Npx]`;
 *     allowlisted named classes and token-routed `rounded-[var(--…)]` pass.
 *  3. Self-check: the committed budget passes the live repo tree (exit 0).
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  SCAN_DIRS,
  LEGAL_ARBITRARY_PX,
  findViolations,
  scanTree,
  evaluate,
} from "../../scripts/check-web-radius.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BUDGET_FILE = join(REPO_ROOT, "scripts", "web-radius-budget.json");

describe("legal arbitrary px set", () => {
  it("is exactly {12, 24} — the inner standard + the card corner", () => {
    expect([...LEGAL_ARBITRARY_PX].sort((a, b) => a - b)).toEqual([12, 24]);
  });
});

describe("findViolations", () => {
  it("flags the retired rounded-2xl / rounded-3xl named classes", () => {
    const hits = findViolations('className="rounded-2xl p-4 rounded-3xl"');
    expect(hits.map((h) => h.token).sort()).toEqual(["rounded-2xl", "rounded-3xl"]);
    expect(hits.every((h) => h.kind === "retired-class")).toBe(true);
  });

  it("flags directional and responsive variants of the retired classes", () => {
    expect(findViolations('className="rounded-t-2xl sm:rounded-3xl"').map((h) => h.token)).toEqual([
      "rounded-t-2xl",
      "rounded-3xl",
    ]);
  });

  it("flags an off-set arbitrary px and points at the nearest legal value", () => {
    const hits = findViolations('className="rounded-[14px]"');
    expect(hits).toEqual([
      { line: 1, kind: "arbitrary-px", token: "rounded-[14px]", nearest: 12 },
    ]);
  });

  it("flags a directional off-set arbitrary px (rounded-t-[16px])", () => {
    const hits = findViolations('className="rounded-t-[16px]"');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ kind: "arbitrary-px", token: "rounded-t-[16px]" });
  });

  it("passes the legal arbitrary px values 12 and 24", () => {
    expect(findViolations('className="rounded-[12px] rounded-[24px] rounded-t-[24px]"')).toEqual([]);
  });

  it("passes the allowlisted named classes and token-routed arbitrary values", () => {
    expect(
      findViolations(
        'className="rounded-card rounded-card-lg rounded-sm rounded-md rounded-lg rounded-xl rounded-full rounded-none rounded-[var(--radius-card-lg)] rounded-[inherit]"',
      ),
    ).toEqual([]);
  });

  it("ignores a retired class that lives in a comment", () => {
    expect(findViolations("// migrated from rounded-2xl (ENG-1498)\nconst x = 1;")).toEqual([]);
  });
});

describe("self-check against the live repo tree", () => {
  it("scans the documented web-only dirs", () => {
    expect(SCAN_DIRS).toEqual(["src/app", "app"]);
  });

  it("the committed budget passes the current tree (script would exit 0)", () => {
    const { pins, allow } = JSON.parse(readFileSync(BUDGET_FILE, "utf8"));
    const byFile = scanTree(REPO_ROOT, SCAN_DIRS, LEGAL_ARBITRARY_PX);
    const { failures, badAllow } = evaluate(byFile, pins, allow);
    expect(failures).toEqual([]);
    expect(badAllow).toEqual([]);
  });

  it("every pinned file still carries at least its pinned count (no dead pins)", () => {
    const { pins, allow } = JSON.parse(readFileSync(BUDGET_FILE, "utf8"));
    const byFile = scanTree(REPO_ROOT, SCAN_DIRS, LEGAL_ARBITRARY_PX);
    for (const path of Object.keys(pins)) {
      if (allow[path] !== undefined) continue;
      expect(byFile[path], `${path} is pinned but has no web-radius violations`).toBeDefined();
    }
  });
});
