import { describe, it, expect } from "vitest";
import { socialImportSourceName } from "@/lib/recipe-import/extractSocialRecipe";

describe("socialImportSourceName", () => {
  it("uses oEmbed author when present", () => {
    expect(
      socialImportSourceName(
        "instagram",
        "https://www.instagram.com/p/ABC123/",
        "Chef Maria",
        "caption",
      ),
    ).toBe("Chef Maria");
  });

  it("uses recipe by @handle from caption when author missing", () => {
    expect(
      socialImportSourceName(
        "instagram",
        "https://www.instagram.com/p/ABC123/",
        null,
        "Recipe by @healthykitchen — try this!",
      ),
    ).toBe("@healthykitchen");
  });

  it("uses first @handle when no credit phrase", () => {
    expect(
      socialImportSourceName("tiktok", "https://www.tiktok.com/@x/video/1", null, "Love this @cooktok !!"),
    ).toBe("@cooktok");
  });

  it("uses Instagram path username for /user/reel/… URLs", () => {
    expect(
      socialImportSourceName(
        "instagram",
        "https://www.instagram.com/foodblogger/reel/123456/",
        null,
        "no handles here",
      ),
    ).toBe("@foodblogger");
  });
});
