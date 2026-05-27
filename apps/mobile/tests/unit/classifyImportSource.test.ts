/**
 * ENG-748 #13 (2026-05-27) — image-import attribution must not be silently
 * dropped when the pasted source text doesn't parse as a URL.
 *
 * Pre-fix: `import-shared.tsx`'s image-import path sent `manualUrl.trim()`
 * raw as the `sourceUrl` form field with no `sourceName`. The server's
 * `normaliseSource` then NULLed any value that didn't parse as a URL, so a
 * typo'd / partial link / plain-text credit ("from @creator on IG") lost the
 * creator's attribution entirely with no feedback — an ODbL + viral-hook
 * correctness gap.
 *
 * Post-fix: `classifyImportSource` decides which field the value occupies —
 * a real link → `sourceUrl` (linked); non-empty unparseable text →
 * `sourceName` (non-linked note, preserved); empty → no attribution.
 *
 * `classifyImportSource` lives in `lib/resolveImportUrl`, which transitively
 * imports `expo-linking`; stub it so the test runs in node/vitest.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("expo-linking", () => ({
  parse: (href: string) => {
    try {
      const u = new URL(href);
      const queryParams: Record<string, string> = {};
      u.searchParams.forEach((v, k) => {
        queryParams[k] = v;
      });
      return { queryParams };
    } catch {
      return { queryParams: {} };
    }
  },
}));

import { classifyImportSource } from "../../lib/resolveImportUrl";

describe("classifyImportSource (ENG-748 #13 — attribution never silently dropped)", () => {
  it("routes a full https URL to sourceUrl (linked attribution)", () => {
    expect(classifyImportSource("https://www.bbcgoodfood.com/recipes/x")).toEqual({
      sourceUrl: "https://www.bbcgoodfood.com/recipes/x",
    });
  });

  it("routes a scheme-less known host to sourceUrl with https prepended", () => {
    expect(classifyImportSource("instagram.com/p/abc123")).toEqual({
      sourceUrl: "https://instagram.com/p/abc123",
    });
  });

  it("keeps a non-empty unparseable paste as a non-linked sourceName", () => {
    // The core regression: this used to vanish entirely.
    expect(classifyImportSource("from @nonna_kitchen on IG")).toEqual({
      sourceName: "from @nonna_kitchen on IG",
    });
  });

  it("keeps a partial / mistyped link as a sourceName rather than dropping it", () => {
    expect(classifyImportSource("htp://broken link")).toEqual({
      sourceName: "htp://broken link",
    });
  });

  it("trims surrounding whitespace before classifying as a name", () => {
    expect(classifyImportSource("  Grandma's recipe card  ")).toEqual({
      sourceName: "Grandma's recipe card",
    });
  });

  it("returns no attribution field for an empty / whitespace string", () => {
    expect(classifyImportSource("")).toEqual({});
    expect(classifyImportSource("   ")).toEqual({});
  });
});
