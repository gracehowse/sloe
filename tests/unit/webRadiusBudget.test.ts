/**
 * ENG-1499 — Web `rounded-*` radius census + ratchet (`scripts/check-web-radius.mjs`).
 * ENG-1589 (2026-07-20) — added the value-based `--radius-*` ladder gate.
 *
 * Pins the card-grammar enforcement leg (2026-07-10 ruling,
 * `docs/decisions/2026-07-10-card-grammar-rounder-flat.md`):
 *  1. The legal arbitrary px set is exactly {12, 24} (12 = inner standard,
 *     24 = THE card corner).
 *  2. findViolations() flags retired `rounded-2xl` / `rounded-3xl` classes
 *     (incl. directional/responsive variants) and off-set `rounded-[Npx]`;
 *     allowlisted named classes and token-routed `rounded-[var(--…)]` pass.
 *  3. Self-check: the committed budget passes the live repo tree (exit 0).
 *
 * Plus the ENG-1589 value-based ladder gate:
 *  4. RADIUS_VAR_NAMES is scoped to exactly the 7 vars backing the Tailwind
 *     `rounded-*` ladder — NOT `--radius-xl-landing` (a separate,
 *     out-of-scope marketing-only token).
 *  5. resolveRadiusVarsPx() resolves plain px/rem literals and one level of
 *     var() indirection, and throws on calc() / an undeclared var / a
 *     circular reference — so a future calc()-derivation regression fails
 *     loudly rather than silently passing through unresolved.
 *  6. findCssVarViolations() flags any resolved value off the legal ladder,
 *     by VALUE — this is what would have caught the original bug (2px/10px
 *     sm/xl) that the name-based allowlist in #1/#2 could never see.
 *  7. Self-check: the live theme.css resolves every ladder var on-scale.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  SCAN_DIRS,
  LEGAL_ARBITRARY_PX,
  RADIUS_VAR_NAMES,
  findViolations,
  resolveRadiusVarsPx,
  findCssVarViolations,
  scanTree,
  evaluate,
} from "../../scripts/check-web-radius.mjs";
import { readLegalRadius } from "../../scripts/lib/ratchet.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BUDGET_FILE = join(REPO_ROOT, "scripts", "web-radius-budget.json");
const THEME_CSS_FILE = join(REPO_ROOT, "src", "styles", "theme.css");

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

  it("reports dead pins as a warning-only signal", () => {
    const { pins, allow } = JSON.parse(readFileSync(BUDGET_FILE, "utf8"));
    const byFile = scanTree(REPO_ROOT, SCAN_DIRS, LEGAL_ARBITRARY_PX);
    const deadPins = Object.keys(pins).filter((path) => allow[path] === undefined && byFile[path] === undefined);
    if (deadPins.length > 0) {
      console.warn(`[check:web-radius] dead pin(s), run npm run check:web-radius:write: ${deadPins.join(", ")}`);
    }
    expect(Array.isArray(deadPins)).toBe(true);
  });
});

describe("RADIUS_VAR_NAMES (ENG-1589)", () => {
  it("is scoped to exactly the 7 vars backing the Tailwind rounded-* ladder", () => {
    expect([...RADIUS_VAR_NAMES].sort()).toEqual(
      ["radius", "radius-card", "radius-card-lg", "radius-lg", "radius-md", "radius-sm", "radius-xl"].sort(),
    );
  });

  it("deliberately excludes --radius-xl-landing (separate, out-of-scope marketing token)", () => {
    expect(RADIUS_VAR_NAMES).not.toContain("radius-xl-landing");
  });
});

describe("resolveRadiusVarsPx", () => {
  const css = (decls: string) => `:root {\n${decls}\n}\n`;

  it("resolves a plain rem literal to px (1rem = 16px)", () => {
    const resolved = resolveRadiusVarsPx(
      css(
        [
          "--radius-sm: 0.25rem;",
          "--radius-md: 0.375rem;",
          "--radius-lg: 0.5rem;",
          "--radius-xl: 0.75rem;",
          "--radius: 0.375rem;",
          "--radius-card: var(--radius-card-lg);",
          "--radius-card-lg: 1.5rem;",
        ].join("\n"),
      ),
    );
    expect(resolved).toEqual({
      "radius-sm": 4,
      "radius-md": 6,
      "radius-lg": 8,
      "radius-xl": 12,
      radius: 6,
      "radius-card": 24,
      "radius-card-lg": 24,
    });
  });

  it("resolves a plain px literal directly", () => {
    const resolved = resolveRadiusVarsPx(
      css(
        [
          "--radius-sm: 4px;",
          "--radius-md: 6px;",
          "--radius-lg: 8px;",
          "--radius-xl: 12px;",
          "--radius: 6px;",
          "--radius-card: var(--radius-card-lg);",
          "--radius-card-lg: 24px;",
        ].join("\n"),
      ),
    );
    expect(resolved["radius-sm"]).toBe(4);
    expect(resolved["radius-card"]).toBe(24);
  });

  it("throws on a calc()-derived value (the original ENG-1589 bug pattern)", () => {
    expect(() =>
      resolveRadiusVarsPx(
        css(
          [
            "--radius-sm: calc(var(--radius) - 4px);",
            "--radius-md: 0.375rem;",
            "--radius-lg: 0.5rem;",
            "--radius-xl: calc(var(--radius) + 4px);",
            "--radius: 0.375rem;",
            "--radius-card: var(--radius-card-lg);",
            "--radius-card-lg: 1.5rem;",
          ].join("\n"),
        ),
      ),
    ).toThrow(/calc/);
  });

  it("throws when a var() reference points at an undeclared variable", () => {
    expect(() =>
      resolveRadiusVarsPx(
        css(
          [
            "--radius-sm: 0.25rem;",
            "--radius-md: 0.375rem;",
            "--radius-lg: 0.5rem;",
            "--radius-xl: 0.75rem;",
            "--radius: 0.375rem;",
            "--radius-card: var(--radius-nope);",
            "--radius-card-lg: 1.5rem;",
          ].join("\n"),
        ),
      ),
    ).toThrow(/undeclared/);
  });

  it("throws when a var() declaration is missing entirely", () => {
    expect(() =>
      resolveRadiusVarsPx(
        css(
          [
            "--radius: 0.375rem;",
            "--radius-sm: 0.25rem;",
            "--radius-md: 0.375rem;",
            "--radius-lg: 0.5rem;",
          ].join("\n"),
        ),
      ),
    ).toThrow(/no `--radius-xl` declaration/);
  });

  it("throws on a circular var() reference", () => {
    expect(() =>
      resolveRadiusVarsPx(
        css(
          [
            "--radius-sm: 0.25rem;",
            "--radius-md: 0.375rem;",
            "--radius-lg: 0.5rem;",
            "--radius-xl: 0.75rem;",
            "--radius: 0.375rem;",
            "--radius-card: var(--radius-card-lg);",
            "--radius-card-lg: var(--radius-card);",
          ].join("\n"),
        ),
      ),
    ).toThrow(/circular/);
  });
});

describe("findCssVarViolations", () => {
  const legal = readLegalRadius();

  it("flags resolved values off the legal ladder, by value — not by var name", () => {
    const hits = findCssVarViolations(
      { "radius-sm": 2, "radius-md": 6, "radius-lg": 8, "radius-xl": 10, radius: 6, "radius-card": 24 },
      legal,
    );
    expect(hits).toEqual([
      { varName: "radius-sm", px: 2, nearest: 0 },
      { varName: "radius-xl", px: 10, nearest: 8 },
    ]);
  });

  it("passes when every resolved value is on the legal ladder", () => {
    const hits = findCssVarViolations(
      { "radius-sm": 4, "radius-md": 6, "radius-lg": 8, "radius-xl": 12, radius: 6, "radius-card": 24 },
      legal,
    );
    expect(hits).toEqual([]);
  });
});

describe("self-check: the live theme.css resolves the ladder on-scale (ENG-1589)", () => {
  it("every --radius-* ladder var resolves to a value on the legal 4/6/8/12/24/full scale", () => {
    const cssSrc = readFileSync(THEME_CSS_FILE, "utf8");
    const resolved = resolveRadiusVarsPx(cssSrc);
    const legal = readLegalRadius();
    expect(findCssVarViolations(resolved, legal)).toEqual([]);
  });

  it("--radius-sm/--radius-xl specifically resolve to 4px/12px, not the old illegal 2px/10px", () => {
    const cssSrc = readFileSync(THEME_CSS_FILE, "utf8");
    const resolved = resolveRadiusVarsPx(cssSrc);
    expect(resolved["radius-sm"]).toBe(4);
    expect(resolved["radius-xl"]).toBe(12);
  });

  it("matches mobile Radius.sm/md/lg/xl (apps/mobile/constants/theme.ts) exactly", () => {
    const cssSrc = readFileSync(THEME_CSS_FILE, "utf8");
    const resolved = resolveRadiusVarsPx(cssSrc);
    expect(resolved).toMatchObject({
      "radius-sm": 4,
      "radius-md": 6,
      "radius-lg": 8,
      "radius-xl": 12,
      "radius-card": 24,
      "radius-card-lg": 24,
    });
  });
});
