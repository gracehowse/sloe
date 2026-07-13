/**
 * ENG-1540 — UTC day-key recurrence guard (`scripts/check-date-key.mjs`).
 *
 * Pins the Build-41-class regression guard:
 *  1. findViolations() flags the argless `new Date().toISOString().slice(...)`
 *     ("today in UTC"), ignores `d.toISOString()` on an explicit instant, and
 *     ignores comments.
 *  2. evaluate() enforces the only-shrink pin + rationale'd allow model.
 *  3. Self-check: the committed budget passes the live repo tree (exit 0), and
 *     the local `dateKeyFromDate` helper is NOT itself flagged.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  SCAN_DIRS,
  findViolations,
  scanTree,
  evaluate,
} from "../../scripts/check-date-key.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BUDGET_FILE = join(REPO_ROOT, "scripts", "date-key-budget.json");

describe("findViolations", () => {
  it("flags the argless new Date().toISOString().slice(...) (today in UTC)", () => {
    const hits = findViolations('const k = new Date().toISOString().slice(0, 10);');
    expect(hits).toEqual([
      { line: 1, kind: "utc-today", token: "new Date().toISOString().slice(…)" },
    ]);
  });

  it("flags it inside a template literal (export-filename shape)", () => {
    const hits = findViolations("const f = `sloe-${new Date().toISOString().slice(0,10)}.json`;");
    expect(hits).toHaveLength(1);
    expect(hits[0].kind).toBe("utc-today");
  });

  it("does NOT flag toISOString().slice on an explicit given instant", () => {
    // `d`/`nowMs`/`t` are specific Dates being formatted, not "today".
    expect(findViolations("const k = d.toISOString().slice(0, 10);")).toEqual([]);
    expect(findViolations("return new Date(nowMs).toISOString().slice(0, 10);")).toEqual([]);
    expect(findViolations("return new Date(t).toISOString().slice(0, 10);")).toEqual([]);
  });

  it("does NOT flag the local helper (dateKeyFromDate uses local getters)", () => {
    expect(findViolations("const k = dateKeyFromDate(new Date());")).toEqual([]);
  });

  it("ignores the pattern in a comment", () => {
    expect(
      findViolations("// previously used new Date().toISOString().slice(0, 10) which shifted\nconst x = 1;"),
    ).toEqual([]);
  });
});

describe("evaluate", () => {
  const hit = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ line: i + 1, kind: "utc-today", token: "…" }));

  it("flags an un-pinned file that introduces a UTC today-key", () => {
    const { failures } = evaluate({ "app/New.tsx": hit(1) }, {}, {});
    expect(failures[0]).toMatchObject({ path: "app/New.tsx", kind: "new", count: 1 });
  });

  it("passes a pinned file held at its pin, flags one that grew", () => {
    expect(evaluate({ "a.ts": hit(2) }, { "a.ts": 2 }, {}).failures).toHaveLength(0);
    expect(evaluate({ "a.ts": hit(3) }, { "a.ts": 2 }, {}).failures[0]).toMatchObject({ kind: "grew" });
  });

  it("honours a rationale'd allow entry and rejects a silent one", () => {
    expect(evaluate({ "x.ts": hit(1) }, {}, { "x.ts": "ENG-1540 — export filename" }).failures).toHaveLength(0);
    expect(evaluate({}, {}, { "x.ts": "" }).badAllow).toEqual(["x.ts"]);
  });
});

describe("self-check against the live repo tree", () => {
  it("scans web + mobile app source", () => {
    expect(SCAN_DIRS).toEqual(["src", "app", "apps/mobile"]);
  });

  it("the committed budget passes the current tree (script would exit 0)", () => {
    const { pins, allow } = JSON.parse(readFileSync(BUDGET_FILE, "utf8"));
    const byFile = scanTree(REPO_ROOT, SCAN_DIRS);
    const { failures, badAllow } = evaluate(byFile, pins, allow);
    expect(failures).toEqual([]);
    expect(badAllow).toEqual([]);
  });

  it("the canonical local helper is NOT flagged (it uses local getters)", () => {
    const byFile = scanTree(REPO_ROOT, SCAN_DIRS);
    expect(byFile["src/lib/datetime/dateKey.ts"]).toBeUndefined();
  });
});
