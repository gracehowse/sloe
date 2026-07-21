/**
 * ENG-1007 — Spacing-scale census + ratchet (`scripts/check-spacing-scale.mjs`).
 *
 * Pins:
 *  1. readLegalSpacing() reads the canonical scale from theme.ts (incl. the
 *     ENG-1012 `dense: 12` step) and always allows `0`.
 *  2. findOffScale() flags off-scale spacing-prop literals, ignores on-scale
 *     ones, ignores values in comments, and reports the right nearest-legal.
 *  3. stripComments() preserves line numbers (so reported file:line is exact).
 *  4. evaluate() flags a new (un-pinned) file, flags a grown pin, passes a
 *     held pin, treats a shrink as a non-fatal notice, and rejects a silent
 *     (rationale-less) allow-list entry.
 *  5. Self-check: the committed budget passes the live repo tree (exit 0).
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  SCAN_DIRS,
  readLegalSpacing,
  stripComments,
  findOffScale,
  scanTree,
  evaluate,
} from "../../scripts/check-spacing-scale.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BUDGET_FILE = join(REPO_ROOT, "scripts", "spacing-budget.json");

describe("readLegalSpacing", () => {
  it("reads the canonical scale from theme.ts and allows 0", () => {
    const legal = readLegalSpacing();
    // The ENG-1012 scale: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40, plus the 0 reset.
    for (const v of [0, 4, 8, 12, 16, 20, 24, 32, 40]) {
      expect(legal.has(v)).toBe(true);
    }
    // Off-scale values the contract explicitly calls bugs.
    expect(legal.has(18)).toBe(false);
    expect(legal.has(10)).toBe(false);
    expect(legal.has(6)).toBe(false);
  });

  it("includes the ENG-1012 dense step (12)", () => {
    expect(readLegalSpacing().has(12)).toBe(true);
  });

  it("throws on a theme source with no Spacing export", () => {
    expect(() => readLegalSpacing("export const NotSpacing = { x: 1 };")).toThrow();
  });
});

describe("stripComments", () => {
  it("preserves line numbers when blanking block comments", () => {
    const src = "a\n/* block\ncomment\nspans */\npadding: 18";
    const stripped = stripComments(src);
    // The off-scale literal must still be on line 5 (1-indexed).
    expect(stripped.split("\n")).toHaveLength(5);
    expect(stripped.split("\n")[4]).toContain("padding: 18");
  });

  it("blanks a trailing line comment", () => {
    expect(stripComments("gap: 8 // note 10")).toBe("gap: 8 ");
  });
});

describe("findOffScale", () => {
  const legal = readLegalSpacing();

  it("flags an off-scale padding and points at the nearest legal value", () => {
    const hits = findOffScale("const s = { padding: 18 };", legal);
    expect(hits).toEqual([{ line: 1, prop: "padding", value: 18, nearest: 16 }]);
  });

  it("ignores on-scale values and the 0 reset", () => {
    expect(findOffScale("const s = { padding: 16, margin: 0, gap: 12 };", legal)).toEqual([]);
  });

  it("ignores a Spacing.* token reference (no numeric literal to match)", () => {
    expect(findOffScale("const s = { padding: Spacing.dense };", legal)).toEqual([]);
  });

  it("ignores off-scale numbers that live in a comment", () => {
    expect(findOffScale("// padding: 18 is a bug\nconst s = { gap: 8 };", legal)).toEqual([]);
  });

  it("flags the full set of spacing props (gap, rowGap, inset, marginTop, ...)", () => {
    const src = "const s = { rowGap: 10, inset: 7, marginTop: 6 };";
    const hits = findOffScale(src, legal);
    expect(hits.map((h) => h.prop).sort()).toEqual(["inset", "marginTop", "rowGap"]);
  });
});

describe("evaluate", () => {
  const hit = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ line: i + 1, prop: "padding", value: 18, nearest: 16 }));

  it("flags an un-pinned file that introduces an off-scale literal", () => {
    const { failures } = evaluate({ "app/New.tsx": hit(2) }, {}, {});
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ path: "app/New.tsx", count: 2, kind: "new" });
  });

  it("flags a pinned file that grew past its pin", () => {
    const { failures } = evaluate({ "app/Legacy.tsx": hit(5) }, { "app/Legacy.tsx": 4 }, {});
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ kind: "grew", count: 5, pin: 4 });
  });

  it("passes a pinned file held exactly at its pin", () => {
    const { failures, shrinks } = evaluate({ "app/Legacy.tsx": hit(4) }, { "app/Legacy.tsx": 4 }, {});
    expect(failures).toHaveLength(0);
    expect(shrinks).toHaveLength(0);
  });

  it("treats a shrunk pinned file as a non-fatal shrink notice", () => {
    const { failures, shrinks } = evaluate({ "app/Legacy.tsx": hit(2) }, { "app/Legacy.tsx": 4 }, {});
    expect(failures).toHaveLength(0);
    expect(shrinks).toEqual([{ path: "app/Legacy.tsx", count: 2, pin: 4 }]);
  });

  it("rejects a silent (rationale-less) allow-list entry", () => {
    expect(evaluate({}, {}, { "app/X.tsx": "" }).badAllow).toEqual(["app/X.tsx"]);
    expect(evaluate({}, {}, { "app/X.tsx": "x" }).badAllow).toEqual(["app/X.tsx"]);
  });

  it("honours a well-justified allow-list entry (excludes the file from failures)", () => {
    const { failures, badAllow } = evaluate(
      { "app/X.tsx": hit(3) },
      {},
      { "app/X.tsx": "ENG-1234 — intentional brand carve-out" },
    );
    expect(failures).toHaveLength(0);
    expect(badAllow).toHaveLength(0);
  });

  it("reports a pin whose file is now fully on-scale as droppedOut, not a failure", () => {
    const { failures, droppedOut } = evaluate({}, { "app/Clean.tsx": 4 }, {});
    expect(failures).toHaveLength(0);
    expect(droppedOut).toEqual(["app/Clean.tsx"]);
  });
});

describe("self-check against the live repo tree", () => {
  it("scans the documented mobile dirs", () => {
    expect(SCAN_DIRS).toEqual(["apps/mobile/app", "apps/mobile/components"]);
  });

  it("the committed budget passes the current tree (script would exit 0)", () => {
    const { pins, allow } = JSON.parse(readFileSync(BUDGET_FILE, "utf8"));
    const byFile = scanTree(REPO_ROOT, SCAN_DIRS, readLegalSpacing());
    const { failures, badAllow } = evaluate(byFile, pins, allow);
    expect(failures).toEqual([]);
    expect(badAllow).toEqual([]);
  });

  it("reports dead pins as a warning-only signal", () => {
    const { pins, allow } = JSON.parse(readFileSync(BUDGET_FILE, "utf8"));
    const byFile = scanTree(REPO_ROOT, SCAN_DIRS, readLegalSpacing());
    const deadPins = Object.keys(pins).filter((path) => allow[path] === undefined && byFile[path] === undefined);
    if (deadPins.length > 0) {
      console.warn(`[check:spacing-scale] dead pin(s), run npm run check:spacing-scale:write: ${deadPins.join(", ")}`);
    }
    expect(Array.isArray(deadPins)).toBe(true);
  });
});
