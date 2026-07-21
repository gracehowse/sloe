/**
 * ENG-1592 — Web spacing-scale census + ratchet
 * (`scripts/check-web-spacing-scale.mjs`), the web leg ENG-1007's own code
 * comment promised and never built (mobile's `check-spacing-scale.mjs`
 * scans `apps/mobile/app` + `apps/mobile/components` only).
 *
 * Pins:
 *  1. findOffScale() flags an off-scale arbitrary bracket value
 *     (`p-[14px]`) and an off-scale numeric Tailwind step (`p-7` → 28px),
 *     ignores on-scale ones (`p-6` → 24px), ignores values in comments, a
 *     `*-pm-N` semantic token class, and reports the right nearest-legal.
 *  2. A negative Tailwind utility (`-mt-8`, `mt-[-8px]`) reads as an
 *     off-scale negative px value — the legal scale is all-positive,
 *     mirroring mobile's `check-spacing-scale.mjs`.
 *  3. Tailwind's bare `-px` keyword (`p-px`, `-mt-px`) flags as 1px,
 *     off-scale by definition; an arbitrary `rem` value converts to px
 *     (`p-[1.125rem]` = 18px, off-scale) at the repo's un-overridden 16px
 *     root; a `calc()`/`var()`/`%`/`vh`/`vw` arbitrary value is correctly
 *     left unscored (not a fixed value comparable to the px scale).
 *  4. evaluate() (shared with the mobile spacing ratchet) flags a new
 *     (un-pinned) file, flags a grown pin, passes a held pin, treats a
 *     shrink as a non-fatal notice, and rejects a silent allow-list entry.
 *  5. Self-check: the committed budget passes the live repo tree (exit 0).
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  SCAN_DIRS,
  stripComments,
  findOffScale,
  scanTree,
  evaluate,
  readLegalSpacing,
} from "../../scripts/check-web-spacing-scale.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BUDGET_FILE = join(REPO_ROOT, "scripts", "web-spacing-budget.json");

describe("readLegalSpacing (shared with mobile's check-spacing-scale.mjs)", () => {
  it("reads the canonical scale from theme.ts and allows 0", () => {
    const legal = readLegalSpacing();
    for (const v of [0, 4, 8, 12, 16, 20, 24, 32, 40]) {
      expect(legal.has(v)).toBe(true);
    }
    expect(legal.has(28)).toBe(false);
    expect(legal.has(10)).toBe(false);
    expect(legal.has(6)).toBe(false);
  });
});

describe("stripComments", () => {
  it("preserves line numbers when blanking block comments", () => {
    const src = "a\n/* block\ncomment\nspans */\nclassName=\"p-7\"";
    const stripped = stripComments(src);
    expect(stripped.split("\n")).toHaveLength(5);
    expect(stripped.split("\n")[4]).toContain('className="p-7"');
  });

  it("blanks a trailing line comment", () => {
    expect(stripComments('className="p-6" // was p-7')).toBe('className="p-6" ');
  });
});

describe("findOffScale", () => {
  const legal = readLegalSpacing();

  it("flags an off-scale numeric Tailwind step and points at the nearest legal px", () => {
    const hits = findOffScale('<div className="p-7" />', legal);
    expect(hits).toEqual([{ line: 1, prop: "p", value: 28, nearest: 24 }]);
  });

  it("passes an on-scale numeric step (p-6 = 24px, the ENG-1592 worked example)", () => {
    expect(findOffScale('<div className="p-6" />', legal)).toEqual([]);
  });

  it("flags an off-scale arbitrary bracket value and points at the nearest legal px", () => {
    const hits = findOffScale('<div className="p-[14px]" />', legal);
    expect(hits).toEqual([{ line: 1, prop: "p", value: 14, nearest: 12 }]);
  });

  it("passes an on-scale arbitrary bracket value", () => {
    expect(findOffScale('<div className="gap-x-[16px]" />', legal)).toEqual([]);
  });

  it("flags the full spacing-prop family (px/py/pt/pb/pl/pr/ps/pe, mx/my/mt/mb/ml/mr/ms/me, gap/gap-x/gap-y)", () => {
    const src = '<div className="pt-7 mb-9 gap-x-11 gap-y-7" />';
    const hits = findOffScale(src, legal);
    expect(hits.map((h) => h.prop).sort()).toEqual(["gap-x", "gap-y", "mb", "pt"]);
  });

  it("never matches a `*-pm-N` semantic token class (px-pm-6, py-pm-5)", () => {
    expect(findOffScale('<div className="px-pm-6 py-pm-5" />', legal)).toEqual([]);
  });

  it("ignores off-scale classes that live in a comment", () => {
    expect(findOffScale('// className="p-7" is a bug\n<div className="p-6" />', legal)).toEqual([]);
  });

  it("treats a negative utility as an off-scale negative px value (legal scale is all-positive)", () => {
    const hits = findOffScale('<div className="-mt-8" />', legal);
    expect(hits).toEqual([{ line: 1, prop: "mt", value: -32, nearest: 0 }]);
  });

  it("treats a signed arbitrary bracket value the same way (mt-[-8px])", () => {
    const hits = findOffScale('<div className="mt-[-8px]" />', legal);
    expect(hits).toEqual([{ line: 1, prop: "mt", value: -8, nearest: 0 }]);
  });

  it("passes an on-scale negative utility (-mt-10 = -40px is still off-scale — legal has no negatives)", () => {
    // Documents the mirrored-from-mobile behaviour explicitly: even a
    // "clean" magnitude reads as off-scale once negative, same as mobile's
    // check-spacing-scale.mjs (no negative literal is ever in the legal set).
    const hits = findOffScale('<div className="-mt-10" />', legal);
    expect(hits).toEqual([{ line: 1, prop: "mt", value: -40, nearest: 0 }]);
  });

  it("does not cross-match a Tailwind class that merely contains a spacing prefix mid-word (e.g. `step-8`, `wrap-4`)", () => {
    expect(findOffScale('<div className="step-8 wrap-4" />', legal)).toEqual([]);
  });

  it("flags Tailwind's bare -px keyword (a literal 1px, off-scale by definition)", () => {
    expect(findOffScale('<div className="p-px" />', legal)).toEqual([
      { line: 1, prop: "p", value: 1, nearest: 0 },
    ]);
  });

  it("flags a negative -px keyword the same way (-mt-px)", () => {
    expect(findOffScale('<div className="-mt-px" />', legal)).toEqual([
      { line: 1, prop: "mt", value: -1, nearest: 0 },
    ]);
  });

  it("does not mistake gap-x-px for the -px keyword on gap alone (longest-prefix-first still applies)", () => {
    const hits = findOffScale('<div className="gap-x-px" />', legal);
    expect(hits).toEqual([{ line: 1, prop: "gap-x", value: 1, nearest: 0 }]);
  });

  it("converts an arbitrary rem value to px and flags it if off-scale (p-[1.125rem] = 18px)", () => {
    const hits = findOffScale('<div className="p-[1.125rem]" />', legal);
    expect(hits).toEqual([{ line: 1, prop: "p", value: 18, nearest: 16 }]);
  });

  it("passes an on-scale arbitrary rem value (p-[1rem] = 16px)", () => {
    expect(findOffScale('<div className="p-[1rem]" />', legal)).toEqual([]);
  });

  it("does not score a calc()/var()/percentage/viewport arbitrary value (not a fixed value comparable to the px scale)", () => {
    const src =
      '<div className="pb-[calc(5rem+env(safe-area-inset-bottom))] w-[50%] h-[100vh] gap-[var(--foo)]" />';
    expect(findOffScale(src, legal)).toEqual([]);
  });
});

describe("evaluate (shared evaluateKeyed from lib/ratchet.mjs)", () => {
  const hit = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ line: i + 1, prop: "p", value: 28, nearest: 24 }));

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
  it("scans the documented web-only dirs (same as check-web-radius.mjs)", () => {
    expect(SCAN_DIRS).toEqual(["src/app", "app"]);
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
      console.warn(`[check:web-spacing-scale] dead pin(s), run npm run check:web-spacing-scale:write: ${deadPins.join(", ")}`);
    }
    expect(Array.isArray(deadPins)).toBe(true);
  });
});
