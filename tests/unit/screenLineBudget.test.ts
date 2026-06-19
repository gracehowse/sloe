/**
 * ENG-717 — Screen line-count ratchet (`scripts/check-screen-line-budget.mjs`).
 *
 * Pins:
 *  1. evaluate() flags a NEW (non-allow-listed) file over 400 lines.
 *  2. evaluate() flags an allow-listed file that GREW past its pin.
 *  3. evaluate() passes an allow-listed file held AT its pin.
 *  4. evaluate() treats a SHRUNK allow-listed file as a (non-fatal) shrink
 *     notice, not a failure.
 *  5. countLines() matches `wc -l` semantics (newline count).
 *  6. Self-check: the committed allow-list passes against the live repo
 *     tree (the script exits 0 on the current tree).
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  HARD_LIMIT,
  countLines,
  evaluate,
  scanOffenders,
} from "../../scripts/check-screen-line-budget.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BUDGET_FILE = join(REPO_ROOT, "scripts", "screen-line-budget.json");

describe("countLines", () => {
  it("counts newline characters like wc -l", () => {
    expect(countLines("a\nb\nc\n")).toBe(3);
    expect(countLines("a\nb\nc")).toBe(2); // no trailing newline
    expect(countLines("")).toBe(0);
  });
});

describe("evaluate", () => {
  it("flags a new file that crosses the hard limit and is not allow-listed", () => {
    const current = { "app/NewBigScreen.tsx": 612 };
    const { failures } = evaluate(current, {});
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ path: "app/NewBigScreen.tsx", kind: "new" });
  });

  it("flags an allow-listed file that grew past its pin", () => {
    const current = { "app/Legacy.tsx": 905 };
    const pinned = { "app/Legacy.tsx": 900 };
    const { failures } = evaluate(current, pinned);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ path: "app/Legacy.tsx", kind: "grew", pin: 900 });
  });

  it("passes an allow-listed file held exactly at its pin", () => {
    const current = { "app/Legacy.tsx": 900 };
    const pinned = { "app/Legacy.tsx": 900 };
    const { failures, shrinks } = evaluate(current, pinned);
    expect(failures).toHaveLength(0);
    expect(shrinks).toHaveLength(0);
  });

  it("treats a shrunk allow-listed file as a non-fatal shrink notice", () => {
    const current = { "app/Legacy.tsx": 850 };
    const pinned = { "app/Legacy.tsx": 900 };
    const { failures, shrinks } = evaluate(current, pinned);
    expect(failures).toHaveLength(0);
    expect(shrinks).toEqual([{ path: "app/Legacy.tsx", lines: 850, pin: 900 }]);
  });

  it("does not flag files at or below the hard limit (they never reach the offender map)", () => {
    // scanOffenders only emits files > HARD_LIMIT, so evaluate never sees
    // a sub-limit file. A file pinned but now under-limit is reported as a
    // "droppedOut" candidate by the CLI, not a failure here.
    const { failures } = evaluate({}, { "app/Shrunk.tsx": 410 });
    expect(failures).toHaveLength(0);
  });
});

describe("self-check against the live repo tree", () => {
  it("HARD_LIMIT is the documented 400-line rule", () => {
    expect(HARD_LIMIT).toBe(400);
  });

  it("the committed allow-list passes the current tree (script would exit 0)", () => {
    const pinned = JSON.parse(readFileSync(BUDGET_FILE, "utf8"));
    const current = scanOffenders(REPO_ROOT);
    const { failures } = evaluate(current, pinned);
    // Every current offender must be allow-listed at >= its current size.
    expect(failures).toEqual([]);
  });

  it("every allow-listed path is actually over the hard limit (no dead pins for grown-shrunk churn)", () => {
    const pinned = JSON.parse(readFileSync(BUDGET_FILE, "utf8")) as Record<string, number>;
    for (const lines of Object.values(pinned)) {
      expect(lines).toBeGreaterThan(HARD_LIMIT);
    }
  });
});
