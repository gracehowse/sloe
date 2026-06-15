import { describe, expect, it } from "vitest";
import { isPrepStateOrServingLine } from "../../src/lib/recipe-import/isPrepStateLine";

describe("isPrepStateOrServingLine", () => {
  it("flags prep-state and serving-note lines from §V7 captures", () => {
    expect(isPrepStateOrServingLine("1/2 tsp cornflour mixed with warm water")).toBe(true);
    expect(isPrepStateOrServingLine("cooked rice to serve (optional)")).toBe(true);
    expect(isPrepStateOrServingLine("marinade combined with the oil")).toBe(true);
    expect(isPrepStateOrServingLine("eggs whisked into the batter")).toBe(true);
  });

  it("keeps real buyable ingredients", () => {
    expect(isPrepStateOrServingLine("cornflour")).toBe(false);
    expect(isPrepStateOrServingLine("200g chicken breast, diced")).toBe(false);
    expect(isPrepStateOrServingLine("2 tbsp soy sauce")).toBe(false);
    expect(isPrepStateOrServingLine("rice, to serve")).toBe(false);
  });
});
