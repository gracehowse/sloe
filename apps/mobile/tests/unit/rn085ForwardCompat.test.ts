import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 2026-05-15 — pins the RN 0.85 forward-compat sweep.
 *
 * RN 0.85 dropped `StyleSheet.absoluteFillObject` from the public types
 * (the runtime alias `absoluteFill` still works). The dependabot bump in
 * #243 fell over on 7 production files plus a brittle `useColorScheme`
 * indexing pattern in `hooks/use-theme-color.ts`. We swept the codebase
 * to use the forward-compatible `StyleSheet.absoluteFill`
 * (or an inline literal where spread is required).
 *
 * This test asserts the regression-prone pattern can't sneak back in.
 * It scans the seven previously-broken files plus the theme hook and
 * fails if any of them contains `StyleSheet.absoluteFillObject` again.
 *
 * Test shims (`tests/shims/react-native.{tsx,cjs}`) are deliberately
 * exempt — those define the legacy property on a mock so a broader
 * ecosystem test path keeps working.
 */
const FILES = [
  "components/progress/LogWeightSheet.tsx",
  "components/today/FullNutrientPanelSheet.tsx",
  "components/today/LogSheet.tsx",
  "components/today/TodayEditMealModal.tsx",
  "components/today/TodayNutrientsModal.tsx",
  "components/today/WhereThisComesFromSheet.tsx",
  "components/today/WhyThisNumberSheet.tsx",
];

describe("RN 0.85 forward-compat — no StyleSheet.absoluteFillObject leak", () => {
  for (const file of FILES) {
    it(`${file} uses absoluteFill (not absoluteFillObject)`, () => {
      const src = readFileSync(
        resolve(__dirname, "..", "..", file),
        "utf8",
      );
      // Match `StyleSheet.absoluteFillObject` as a real token, not the
      // string "absoluteFillObject" anywhere (e.g. a comment).
      const regex = /StyleSheet\.absoluteFillObject\b(?!.*\/\/)/;
      const lines = src.split("\n").filter((l) => {
        // Allow it inside a single-line comment that documents the
        // historical name.
        const trimmed = l.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) return false;
        return regex.test(l);
      });
      expect(lines, `Found in:\n${lines.join("\n")}`).toHaveLength(0);
    });
  }

  it("use-theme-color narrows the colorScheme to 'light' | 'dark' before indexing", () => {
    const src = readFileSync(
      resolve(__dirname, "..", "..", "hooks/use-theme-color.ts"),
      "utf8",
    );
    // The previous pattern (`useColorScheme() ?? 'light'`) is OK at
    // runtime but no longer narrows under RN 0.85 types. Our fix uses
    // an explicit ternary that produces a `'light' | 'dark'`.
    expect(src).toMatch(/useColorScheme\(\)\s*===\s*['"]dark['"]/);
  });
});
