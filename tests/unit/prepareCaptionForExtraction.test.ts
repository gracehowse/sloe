import { describe, expect, it } from "vitest";
import {
  CAPTION_MAX,
  prepareCaptionForExtraction,
} from "../../src/lib/recipe-import/extractSocialRecipe";

describe("prepareCaptionForExtraction (ENG-1159b)", () => {
  it("exports CAPTION_MAX at 4000", () => {
    expect(CAPTION_MAX).toBe(4000);
  });

  it("does not truncate short captions", () => {
    const caption = "Chicken stir fry · serves 4";
    const out = prepareCaptionForExtraction(caption);
    expect(out.text).toBe(caption);
    expect(out.captionTruncated).toBe(false);
  });

  it("truncates long captions and flags captionTruncated", () => {
    const caption = "x".repeat(CAPTION_MAX + 500);
    const out = prepareCaptionForExtraction(caption);
    expect(out.text).toHaveLength(CAPTION_MAX);
    expect(out.captionTruncated).toBe(true);
  });
});
