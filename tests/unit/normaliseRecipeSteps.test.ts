import { describe, it, expect } from "vitest";
import {
  normaliseStepToImperative,
  splitIntoImperativeSteps,
  paraphraseInstructionsField,
} from "../../src/lib/recipes/normaliseRecipeSteps";

/**
 * ENG-1128 — imported step legal guardrail.
 *
 * The persist chokepoint must never store a creator's narrative step prose
 * verbatim, on ANY import path (caption / structured-LLM / JSON-LD HTML).
 */
describe("ENG-1128 — imported step legal guardrail", () => {
  describe("normaliseStepToImperative", () => {
    it("strips leading first-person voice", () => {
      expect(normaliseStepToImperative("I heat the oil in a pan")).toBe(
        "Heat the oil in a pan.",
      );
    });
    it("strips conversational filler + capitalises + terminates", () => {
      expect(normaliseStepToImperative("then, add the garlic")).toBe(
        "Add the garlic.",
      );
    });
    it("strips contraction voice-over (you'll / I'll / you're going to)", () => {
      expect(
        normaliseStepToImperative("First, you'll want to gently cream the butter"),
      ).toBe("Gently cream the butter.");
      expect(normaliseStepToImperative("I'll then fold in the flour")).toBe(
        "Fold in the flour.",
      );
      expect(
        normaliseStepToImperative("You're going to whisk until stiff peaks form"),
      ).toBe("Whisk until stiff peaks form.");
    });
  });

  describe("splitIntoImperativeSteps", () => {
    it("splits a multi-sentence step into atomic steps", () => {
      expect(
        splitIntoImperativeSteps("Heat the oil. Add the garlic. Simmer for 10 minutes."),
      ).toEqual(["Heat the oil.", "Add the garlic.", "Simmer for 10 minutes."]);
    });
    it("does NOT split on decimals", () => {
      expect(splitIntoImperativeSteps("Add 1.5 cups of flour and mix well.")).toEqual([
        "Add 1.5 cups of flour and mix well.",
      ]);
    });
    it("de-narrativises a paragraph into multiple imperative steps", () => {
      const para =
        "First, heat the oil until it shimmers. Then add the garlic and cook for two minutes.";
      expect(splitIntoImperativeSteps(para)).toEqual([
        "Heat the oil until it shimmers.",
        "Add the garlic and cook for two minutes.",
      ]);
    });
  });

  describe("paraphraseInstructionsField (persist chokepoint)", () => {
    it("normalises an array of steps, stripping voice + filler", () => {
      const out = paraphraseInstructionsField([
        "I heat the oil in a pan",
        "Then add the garlic",
      ]);
      expect(out).toBe("Heat the oil in a pan.\nAdd the garlic.");
      expect(out).not.toContain("I heat");
      expect(out).not.toContain("Then add");
    });
    it("splits a narrative paragraph item into atomic steps (verbatim prose not stored)", () => {
      const out = paraphraseInstructionsField([
        "First, heat the oil until it shimmers. Then add the garlic and cook for two minutes.",
      ]);
      expect(out).toBe(
        "Heat the oil until it shimmers.\nAdd the garlic and cook for two minutes.",
      );
      expect(out).not.toContain("First,");
    });
    it("handles a newline-separated string", () => {
      expect(paraphraseInstructionsField("Step one is ready.\nStep two is ready.")).toBe(
        "Step one is ready.\nStep two is ready.",
      );
    });
    it("returns null for empty / non-string input", () => {
      expect(paraphraseInstructionsField([])).toBeNull();
      expect(paraphraseInstructionsField("")).toBeNull();
      expect(paraphraseInstructionsField(null)).toBeNull();
      expect(paraphraseInstructionsField(undefined)).toBeNull();
    });
  });
});
