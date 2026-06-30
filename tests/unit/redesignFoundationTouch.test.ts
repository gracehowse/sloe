/**
 * ENG-1221 §2 — Redesign foundation-touch classifier
 * (`scripts/check-redesign-foundation-touch.mjs`).
 *
 * Drives the PURE `classifyFoundationTouch()` over synthetic diff fixtures —
 * no git, no fs — so the classification contract is pinned independently of the
 * git plumbing in `collectChangedPaths()`.
 *
 * Pins:
 *  1. A diff touching the mobile design token (apps/mobile/constants/theme.ts)
 *     is flagged as foundation.
 *  2. A diff touching the web design token (src/styles/theme.css) is flagged.
 *  3. A diff touching a shared theme helper / package / UI primitive is flagged
 *     with the right category.
 *  4. A diff touching ONLY a single page component is NOT flagged.
 *  5. An empty diff is NOT flagged.
 *  6. Mixed diffs report only the foundation files, deduped categories, sorted.
 *  7. Input hygiene: null / undefined / empty strings / backslash paths.
 */
import { describe, expect, it } from "vitest";

import {
  FOUNDATION_RULES,
  classifyFoundationTouch,
} from "../../scripts/check-redesign-foundation-touch.mjs";

describe("classifyFoundationTouch — foundation files", () => {
  it("flags the mobile design token (apps/mobile/constants/theme.ts)", () => {
    const result = classifyFoundationTouch(["apps/mobile/constants/theme.ts"]);
    expect(result.touched).toBe(true);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toMatchObject({
      path: "apps/mobile/constants/theme.ts",
      category: "design-token (mobile theme)",
    });
    expect(result.categories).toEqual(["design-token (mobile theme)"]);
  });

  it("flags the web design token (src/styles/theme.css)", () => {
    const result = classifyFoundationTouch(["src/styles/theme.css"]);
    expect(result.touched).toBe(true);
    expect(result.files[0].category).toBe(
      "design-token (web theme.css / Tailwind @theme)",
    );
  });

  it("flags a shared theme helper under src/lib/theme/*", () => {
    const result = classifyFoundationTouch(["src/lib/theme/macroColors.ts"]);
    expect(result.touched).toBe(true);
    expect(result.files[0].category).toBe("shared theme helper (src/lib/theme/*)");
  });

  it("flags a shared package under packages/*", () => {
    const result = classifyFoundationTouch(["packages/shared/src/index.ts"]);
    expect(result.touched).toBe(true);
    expect(result.files[0].category).toBe("shared package (packages/*)");
  });

  it("flags a mobile UI primitive under apps/mobile/components/ui/*", () => {
    const result = classifyFoundationTouch([
      "apps/mobile/components/ui/PressableScale.tsx",
    ]);
    expect(result.touched).toBe(true);
    expect(result.files[0].category).toBe(
      "primitive UI component (mobile components/ui/*)",
    );
  });

  it("flags a web UI primitive under src/app/components/ui/*", () => {
    const result = classifyFoundationTouch(["src/app/components/ui/Button.tsx"]);
    expect(result.touched).toBe(true);
    expect(result.files[0].category).toBe(
      "primitive UI component (web app/components/ui/*)",
    );
  });
});

describe("classifyFoundationTouch — non-foundation", () => {
  it("does NOT flag a single page component", () => {
    const result = classifyFoundationTouch([
      "src/app/components/today/TodayHero.tsx",
    ]);
    expect(result.touched).toBe(false);
    expect(result.files).toEqual([]);
    expect(result.categories).toEqual([]);
  });

  it("does NOT flag a mobile screen", () => {
    const result = classifyFoundationTouch(["apps/mobile/app/(tabs)/index.tsx"]);
    expect(result.touched).toBe(false);
  });

  it("does NOT flag a non-ui mobile component (a sibling of components/ui)", () => {
    // Guards against an over-broad prefix that would catch components/* — only
    // the ui/ primitive dir is foundation.
    const result = classifyFoundationTouch([
      "apps/mobile/components/today/TodayCard.tsx",
    ]);
    expect(result.touched).toBe(false);
  });

  it("does NOT flag a sibling theme file that is not the token entry", () => {
    // src/styles/tailwind.css imports the token layer but is not the @theme
    // source itself; only theme.css is the token entry.
    const result = classifyFoundationTouch(["src/styles/tailwind.css"]);
    expect(result.touched).toBe(false);
  });

  it("does NOT flag an empty diff", () => {
    const result = classifyFoundationTouch([]);
    expect(result.touched).toBe(false);
    expect(result.files).toEqual([]);
    expect(result.categories).toEqual([]);
  });
});

describe("classifyFoundationTouch — mixed and malformed input", () => {
  it("reports only foundation files from a mixed diff, deduped + sorted", () => {
    const result = classifyFoundationTouch([
      "src/app/components/today/TodayHero.tsx", // page — ignored
      "src/lib/theme/brandGradient.ts", // foundation
      "apps/mobile/constants/theme.ts", // foundation
      "src/lib/theme/macroColors.ts", // foundation (same category)
      "README.md", // unrelated — ignored
    ]);
    expect(result.touched).toBe(true);
    // Sorted by path: apps/... before src/...
    expect(result.files.map((f) => f.path)).toEqual([
      "apps/mobile/constants/theme.ts",
      "src/lib/theme/brandGradient.ts",
      "src/lib/theme/macroColors.ts",
    ]);
    // Categories deduped: two src/lib/theme files collapse to one category.
    expect(result.categories).toEqual([
      "design-token (mobile theme)",
      "shared theme helper (src/lib/theme/*)",
    ]);
  });

  it("normalises backslash paths and ignores empty / non-string entries", () => {
    const result = classifyFoundationTouch([
      "apps\\mobile\\constants\\theme.ts", // Windows-style separators
      "",
      "   ",
      // @ts-expect-error — guard runtime junk the test deliberately feeds in
      null,
      // @ts-expect-error — guard runtime junk the test deliberately feeds in
      undefined,
      // @ts-expect-error — guard runtime junk the test deliberately feeds in
      42,
    ]);
    expect(result.touched).toBe(true);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe("apps/mobile/constants/theme.ts");
  });

  it("tolerates null / undefined as the whole argument", () => {
    // @ts-expect-error — defensive: classifier must not throw on bad input
    expect(classifyFoundationTouch(null).touched).toBe(false);
    // @ts-expect-error — defensive: classifier must not throw on bad input
    expect(classifyFoundationTouch(undefined).touched).toBe(false);
  });
});

describe("FOUNDATION_RULES contract", () => {
  it("every rule has a category, reason, and a callable matcher", () => {
    expect(FOUNDATION_RULES.length).toBeGreaterThan(0);
    for (const rule of FOUNDATION_RULES) {
      expect(typeof rule.category).toBe("string");
      expect(rule.category.length).toBeGreaterThan(0);
      expect(typeof rule.reason).toBe("string");
      expect(rule.reason.length).toBeGreaterThan(0);
      expect(typeof rule.match).toBe("function");
    }
  });
});
