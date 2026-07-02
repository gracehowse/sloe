/**
 * ENG-1002 — Mobile type-scale census + ratchet
 * (`scripts/check-type-scale-mobile.mjs`).
 *
 * Brings the mobile side to parity with the web `check:type-scale` gate
 * (ENG-119): enforces the canonical `Type` ramp on raw `fontSize:` literals in
 * mobile `.tsx`, as an only-shrink ratchet.
 *
 * Pins:
 *  1. readLegalSizes() reads the ramp from theme.ts (`Type`) and unions in the
 *     micro (8/9/10) + display (36/40/44/52/60/64) bands.
 *  2. findOffScale() flags off-ramp fontSize literals, ignores on-ramp ones,
 *     ignores `Type.*` token spreads, ignores sizes in comments, and reports
 *     the right nearest-legal.
 *  3. stripComments() preserves line numbers (so reported file:line is exact).
 *  4. evaluate() flags a new (un-pinned) file, flags a grown pin, passes a held
 *     pin, treats a shrink as a non-fatal notice, and rejects a silent
 *     (rationale-less) allow-list entry.
 *  5. Self-check: the committed budget passes the live repo tree (exit 0).
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  SCAN_DIRS,
  MICRO_SIZES,
  DISPLAY_SIZES,
  readLegalSizes,
  stripComments,
  findOffScale,
  scanTree,
  evaluate,
} from "../../scripts/check-type-scale-mobile.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BUDGET_FILE = join(REPO_ROOT, "scripts", "type-scale-mobile-budget.json");

describe("readLegalSizes", () => {
  it("reads the Type ramp from theme.ts (11 … 56) and the micro + display bands", () => {
    const legal = readLegalSizes();
    // The Type ramp fontSizes as of ENG-1281 (captionSmall 12, bodyLarge 15 added).
    for (const v of [11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 28, 32, 48, 56]) {
      expect(legal.has(v)).toBe(true);
    }
    // Micro + display bands.
    for (const v of [...MICRO_SIZES, ...DISPLAY_SIZES]) {
      expect(legal.has(v)).toBe(true);
    }
    // Remaining off-ramp values the census still pins (not on ramp, micro, or display).
    expect(legal.has(19)).toBe(false);
    expect(legal.has(30)).toBe(false);
    expect(legal.has(10.5)).toBe(false);
  });

  it("throws on a theme source with no Type export", () => {
    expect(() => readLegalSizes("export const NotType = { body: 1 };\n")).toThrow();
  });
});

describe("stripComments", () => {
  it("preserves line numbers when blanking block comments", () => {
    const src = "a\n/* block\ncomment\nspans */\nfontSize: 12";
    const stripped = stripComments(src);
    expect(stripped.split("\n")).toHaveLength(5);
    expect(stripped.split("\n")[4]).toContain("fontSize: 12");
  });

  it("blanks a trailing line comment", () => {
    expect(stripComments("fontSize: 16 // bumped from 15")).toBe("fontSize: 16 ");
  });
});

describe("findOffScale", () => {
  const legal = readLegalSizes();

  it("flags an off-ramp fontSize and points at the nearest legal value", () => {
    const hits = findOffScale("const s = { fontSize: 19 };", legal);
    expect(hits).toHaveLength(1);
    expect(hits[0].line).toBe(1);
    expect(hits[0].value).toBe(19);
    expect(Math.abs(hits[0].nearest - 19)).toBe(1);
  });

  it("ignores ENG-1281 on-ramp values 12 and 15 (captionSmall / bodyLarge)", () => {
    expect(findOffScale("const s = { fontSize: 12 };", legal)).toEqual([]);
    expect(findOffScale("const s = { fontSize: 15 };", legal)).toEqual([]);
  });

  it("ignores on-ramp values (Type ramp + micro + display)", () => {
    const src = "const s = { fontSize: 16 }; const t = { fontSize: 10 }; const u = { fontSize: 48 };";
    expect(findOffScale(src, legal)).toEqual([]);
  });

  it("ignores a Type.* token spread (no numeric literal to match)", () => {
    expect(findOffScale("const s = { ...Type.body };", legal)).toEqual([]);
  });

  it("ignores off-ramp numbers that live in a comment", () => {
    expect(findOffScale("// fontSize: 15 is off-ramp\nconst s = { fontSize: 16 };", legal)).toEqual([]);
  });

  it("flags a fractional off-ramp size", () => {
    const hits = findOffScale("const s = { fontSize: 10.5 };", legal);
    expect(hits).toEqual([{ line: 1, value: 10.5, nearest: 10 }]);
  });
});

describe("evaluate", () => {
  const hit = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ line: i + 1, value: 12, nearest: 11 }));

  it("flags an un-pinned file that introduces an off-ramp literal", () => {
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
      { "app/X.tsx": "ENG-1002 — intentional display carve-out" },
    );
    expect(failures).toHaveLength(0);
    expect(badAllow).toHaveLength(0);
  });

  it("reports a pin whose file is now fully on-ramp as droppedOut, not a failure", () => {
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
    const byFile = scanTree(REPO_ROOT, SCAN_DIRS, readLegalSizes());
    const { failures, badAllow } = evaluate(byFile, pins, allow);
    expect(failures).toEqual([]);
    expect(badAllow).toEqual([]);
  });

  it("every pinned file still has at least its pinned count of off-ramp literals (no dead pins)", () => {
    const { pins, allow } = JSON.parse(readFileSync(BUDGET_FILE, "utf8"));
    const byFile = scanTree(REPO_ROOT, SCAN_DIRS, readLegalSizes());
    for (const path of Object.keys(pins)) {
      if (allow[path] !== undefined) continue;
      expect(byFile[path], `${path} is pinned but has no off-ramp literals`).toBeDefined();
    }
  });
});
