/**
 * Unit tests for the shared `normaliseInstructions` helper.
 *
 * Covers every code path that ships on both read (mobile +
 * `RecipeDetail.tsx` + public SSR page) and write (`create-recipe.tsx`,
 * `RecipeUpload.tsx`, `saveImportedRecipe.ts`) sides.
 *
 * Contract source: `src/lib/recipes/normaliseInstructions.ts`.
 *
 * TestFlight anchors:
 *   - `AO4NtyNB` (2026-04-18) — Create Recipe placeholder rendering `\n`
 *     literally, teaching users to type escape sequences.
 *   - `AO4NtyNBpP4FJRgq7mCV5cs` — historical seed row with `/n`.
 */
import { describe, it, expect } from "vitest";
import { normaliseInstructions } from "@/lib/recipes/normaliseInstructions";

describe("normaliseInstructions", () => {
  it("returns empty string for null", () => {
    expect(normaliseInstructions(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(normaliseInstructions(undefined)).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(normaliseInstructions("")).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normaliseInstructions("   \n\t  ")).toBe("");
  });

  it("rejects non-string input by returning empty string", () => {
    // Caller in `saveImportedRecipe.normalizeInstructions` coerces arrays
    // element-by-element, but the helper itself guards against accidental
    // number / boolean / object passes.
    expect(normaliseInstructions(42 as unknown as string)).toBe("");
    expect(normaliseInstructions({} as unknown as string)).toBe("");
    expect(normaliseInstructions([] as unknown as string)).toBe("");
  });

  it("converts literal `\\n` two-char sequences into real newlines", () => {
    // Users who saw the old Create Recipe placeholder (TestFlight
    // `AO4NtyNB`) typed `Step 1: foo\nStep 2: bar` verbatim. The helper
    // must recover a real newline between the steps.
    expect(normaliseInstructions("Step 1: foo\\nStep 2: bar")).toBe(
      "Step 1: foo\nStep 2: bar",
    );
  });

  it("converts an escaped `\\\\n` run into a real newline too", () => {
    // JSON-encoded strings that hit the DB after one extra round-trip
    // end up with `\\n` rather than `\n`. The replace pattern uses a
    // literal backslash so both cases collapse to the same real newline.
    expect(normaliseInstructions("A\\nB")).toBe("A\nB");
  });

  it("converts literal `/n` with surrounding spaces to a newline", () => {
    // Historical seed `AO4NtyNBpP4FJRgq7mCV5cs` stored breaks as ` /n `.
    expect(normaliseInstructions("Boil water /n Add pasta /n Drain")).toBe(
      "Boil water\nAdd pasta\nDrain",
    );
  });

  it("leaves ordinary slashes in words untouched", () => {
    // The `/n` pattern requires a leading whitespace so URL-shaped text
    // and ingredient shorthands like `apples/navel` survive intact.
    expect(normaliseInstructions("Mix apples/navel oranges")).toBe(
      "Mix apples/navel oranges",
    );
  });

  it("collapses three or more consecutive newlines to exactly two", () => {
    expect(normaliseInstructions("a\n\n\n\nb")).toBe("a\n\nb");
    expect(normaliseInstructions("a\n\n\nb\n\n\n\n\nc")).toBe("a\n\nb\n\nc");
  });

  it("preserves paragraph breaks (two newlines) unchanged", () => {
    expect(normaliseInstructions("first para\n\nsecond para")).toBe(
      "first para\n\nsecond para",
    );
  });

  it("trims leading and trailing whitespace on the whole string", () => {
    expect(normaliseInstructions("   hello\n")).toBe("hello");
    expect(normaliseInstructions("\n\nmix and serve\n\n")).toBe(
      "mix and serve",
    );
  });

  it("roundtrips unchanged prose with no typos", () => {
    const clean =
      "Heat a large pan over medium heat.\nAdd olive oil and garlic, cook 30 seconds.\nStir in tomatoes and simmer for 10 minutes.";
    expect(normaliseInstructions(clean)).toBe(clean);
  });

  it("handles the mixed case (both `\\n` and `/n` in the same input)", () => {
    // Mirrors what the inline pipeline handled before extraction — keeps
    // the detail screens' prior behaviour byte-identical on historical
    // rows that have both kinds of typo.
    expect(
      normaliseInstructions("Step 1\\nStep 2 /n Step 3"),
    ).toBe("Step 1\nStep 2\nStep 3");
  });
});
