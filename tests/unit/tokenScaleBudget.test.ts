/**
 * ENG-1007 — Colour / radius token census + ratchet (`scripts/check-token-scale.mjs`).
 *
 * Pins:
 *  1. readLegalRadius() reads the canonical Radius scale from theme.ts
 *     (4/6/8/12/full) and always allows `0`.
 *  2. findViolations() flags raw 6-digit hexes, raw Tailwind palette colour
 *     classes, and off-scale borderRadius literals; ignores 3-digit hexes
 *     (the Apple-brand carve-out), comments, and on-scale radii.
 *  3. evaluate() flags a new (un-pinned) file, a grown pin, passes a held pin,
 *     treats a shrink as a non-fatal notice, and rejects a silent allow entry.
 *  4. Self-check: the committed budget passes the live repo tree (exit 0).
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  SCAN_DIRS,
  readLegalRadius,
  findViolations,
  scanTree,
  evaluate,
} from "../../scripts/check-token-scale.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BUDGET_FILE = join(REPO_ROOT, "scripts", "token-budget.json");

describe("readLegalRadius", () => {
  it("reads the canonical Radius scale from theme.ts and allows 0", () => {
    const legal = readLegalRadius();
    for (const v of [0, 4, 6, 8, 12, 9999]) expect(legal.has(v)).toBe(true);
    expect(legal.has(7)).toBe(false);
    expect(legal.has(16)).toBe(false);
  });

  it("throws on a theme source with no Radius export", () => {
    expect(() => readLegalRadius("export const NotRadius = { x: 1 };")).toThrow();
  });
});

describe("findViolations", () => {
  const legal = readLegalRadius();

  it("flags a raw 6-digit hex literal", () => {
    const hits = findViolations('const c = "#abc123";', legal);
    expect(hits).toEqual([{ line: 1, kind: "hex", token: "#abc123" }]);
  });

  it("does NOT flag a 3-digit hex (Apple Sign-In brand carve-out)", () => {
    expect(findViolations('backgroundColor: "#000"', legal)).toEqual([]);
    expect(findViolations('color: "#fff"', legal)).toEqual([]);
  });

  it("flags a raw Tailwind palette colour class", () => {
    const hits = findViolations('className="bg-red-500 text-slate-600"', legal);
    expect(hits.map((h) => h.token).sort()).toEqual(["bg-red-500", "text-slate-600"]);
    expect(hits.every((h) => h.kind === "tailwind")).toBe(true);
  });

  it("does NOT flag non-colour Tailwind utilities or token-utility classes", () => {
    // text-2xl (size), grid-cols-4 (no colour prefix), bg-primary (semantic token)
    expect(findViolations('className="text-2xl grid-cols-4 bg-primary text-foreground"', legal)).toEqual([]);
  });

  it("flags an off-scale borderRadius and points at the nearest legal value", () => {
    const hits = findViolations("const s = { borderRadius: 7 };", legal);
    expect(hits).toEqual([{ line: 1, kind: "radius", token: "borderRadius: 7", nearest: 6 }]);
  });

  it("ignores an on-scale borderRadius and the full (9999) radius", () => {
    expect(findViolations("const s = { borderRadius: 12 };", legal)).toEqual([]);
    expect(findViolations("const s = { borderRadius: 9999 };", legal)).toEqual([]);
  });

  it("ignores a hex that lives in a comment", () => {
    expect(findViolations("// light #3B2A4D / dark #815E91\nconst x = 1;", legal)).toEqual([]);
  });

  it("reports the correct line for a hex below a multi-line block comment", () => {
    const src = "/* doc\n#aabbcc in here is fine\nspans */\nconst c = \"#112233\";";
    const hits = findViolations(src, legal);
    expect(hits).toEqual([{ line: 4, kind: "hex", token: "#112233" }]);
  });
});

describe("evaluate", () => {
  const hits = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ line: i + 1, kind: "hex", token: "#abc123" }));

  it("flags an un-pinned file that introduces a violation", () => {
    const { failures } = evaluate({ "app/New.tsx": hits(1) }, {}, {});
    expect(failures[0]).toMatchObject({ path: "app/New.tsx", kind: "new", count: 1 });
  });

  it("flags a pinned file that grew past its pin", () => {
    const { failures } = evaluate({ "app/L.tsx": hits(9) }, { "app/L.tsx": 8 }, {});
    expect(failures[0]).toMatchObject({ kind: "grew", count: 9, pin: 8 });
  });

  it("passes a pinned file held exactly at its pin", () => {
    const { failures, shrinks } = evaluate({ "app/L.tsx": hits(8) }, { "app/L.tsx": 8 }, {});
    expect(failures).toHaveLength(0);
    expect(shrinks).toHaveLength(0);
  });

  it("treats a shrunk pinned file as a non-fatal shrink notice", () => {
    const { failures, shrinks } = evaluate({ "app/L.tsx": hits(3) }, { "app/L.tsx": 8 }, {});
    expect(failures).toHaveLength(0);
    expect(shrinks).toEqual([{ path: "app/L.tsx", count: 3, pin: 8 }]);
  });

  it("rejects a silent (rationale-less) allow-list entry", () => {
    expect(evaluate({}, {}, { "app/X.tsx": "" }).badAllow).toEqual(["app/X.tsx"]);
  });

  it("honours a well-justified allow-list entry", () => {
    const { failures, badAllow } = evaluate(
      { "app/X.tsx": hits(2) },
      {},
      { "app/X.tsx": "ENG-1234 — Apple HIG brand literal" },
    );
    expect(failures).toHaveLength(0);
    expect(badAllow).toHaveLength(0);
  });
});

describe("self-check against the live repo tree", () => {
  it("scans the documented web + mobile dirs", () => {
    expect(SCAN_DIRS).toEqual([
      "src/app/components",
      "app",
      "apps/mobile/app",
      "apps/mobile/components",
    ]);
  });

  it("the committed budget passes the current tree (script would exit 0)", () => {
    const { pins, allow } = JSON.parse(readFileSync(BUDGET_FILE, "utf8"));
    const byFile = scanTree(REPO_ROOT, SCAN_DIRS, readLegalRadius());
    const { failures, badAllow } = evaluate(byFile, pins, allow);
    expect(failures).toEqual([]);
    expect(badAllow).toEqual([]);
  });

  it("every pinned file still carries at least its pinned count (no dead pins)", () => {
    const { pins, allow } = JSON.parse(readFileSync(BUDGET_FILE, "utf8"));
    const byFile = scanTree(REPO_ROOT, SCAN_DIRS, readLegalRadius());
    for (const path of Object.keys(pins)) {
      if (allow[path] !== undefined) continue;
      expect(byFile[path], `${path} is pinned but has no token violations`).toBeDefined();
    }
  });
});
