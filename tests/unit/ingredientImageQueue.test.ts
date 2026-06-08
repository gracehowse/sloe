/**
 * Lazy generate-on-miss candidate selection (`/api/ingredient-image`) — the
 * idempotency / dedupe contract, unit-tested away from the HTTP stack:
 *   - `ready` keys are NEVER regenerated (the whole point: reuse forever)
 *   - `pending` keys are skipped (another request owns the claim)
 *   - `failed` keys + keys with no row are eligible to (re)generate
 *   - requested keys are deduped + capped per request
 */
import { describe, expect, it } from "vitest";
import {
  selectIngredientImageCandidates,
  type IngredientImageStatus,
} from "../../src/lib/recipe/ingredientImageQueue";

function statuses(entries: Array<[string, IngredientImageStatus]>) {
  return new Map<string, IngredientImageStatus>(entries);
}

describe("selectIngredientImageCandidates", () => {
  it("generates keys that have no row yet", () => {
    const { candidates, alreadyReady } = selectIngredientImageCandidates(
      ["spinach", "salt"],
      statuses([]),
      10,
    );
    expect(candidates).toEqual(["spinach", "salt"]);
    expect(alreadyReady).toEqual([]);
  });

  it("NEVER regenerates a ready key (reuse forever)", () => {
    const { candidates, alreadyReady } = selectIngredientImageCandidates(
      ["spinach", "salt"],
      statuses([
        ["spinach", "ready"],
        ["salt", "ready"],
      ]),
      10,
    );
    expect(candidates).toEqual([]);
    expect(alreadyReady).toEqual(["spinach", "salt"]);
  });

  it("skips a pending key (another request owns the claim → no double-gen)", () => {
    const { candidates } = selectIngredientImageCandidates(
      ["onion"],
      statuses([["onion", "pending"]]),
      10,
    );
    expect(candidates).toEqual([]);
  });

  it("retries a failed key", () => {
    const { candidates } = selectIngredientImageCandidates(
      ["onion"],
      statuses([["onion", "failed"]]),
      10,
    );
    expect(candidates).toEqual(["onion"]);
  });

  it("mixes statuses correctly", () => {
    const { candidates, alreadyReady } = selectIngredientImageCandidates(
      ["a", "b", "c", "d"],
      statuses([
        ["a", "ready"],
        ["b", "pending"],
        ["c", "failed"],
        // d: no row
      ]),
      10,
    );
    expect(candidates).toEqual(["c", "d"]);
    expect(alreadyReady).toEqual(["a"]);
  });

  it("dedupes requested keys", () => {
    const { candidates } = selectIngredientImageCandidates(
      ["spinach", "spinach", "salt", "spinach"],
      statuses([]),
      10,
    );
    expect(candidates).toEqual(["spinach", "salt"]);
  });

  it("caps candidates at maxPerRequest", () => {
    const { candidates } = selectIngredientImageCandidates(
      ["a", "b", "c", "d", "e"],
      statuses([]),
      3,
    );
    expect(candidates).toEqual(["a", "b", "c"]);
  });

  it("ignores empty keys", () => {
    const { candidates } = selectIngredientImageCandidates(["", "salt", ""], statuses([]), 10);
    expect(candidates).toEqual(["salt"]);
  });
});
