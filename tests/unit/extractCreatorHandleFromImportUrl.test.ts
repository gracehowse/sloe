import { describe, expect, it } from "vitest";
import { extractCreatorHandleFromImportUrl } from "@/lib/recipes/resolveImportUrl";

describe("extractCreatorHandleFromImportUrl", () => {
  it("extracts Instagram username from profile-style paths", () => {
    expect(
      extractCreatorHandleFromImportUrl("https://www.instagram.com/chefmaria/reel/abc123/"),
    ).toBe("@chefmaria");
  });

  it("returns null for Instagram /p/ and /reel/ paths without a handle", () => {
    expect(extractCreatorHandleFromImportUrl("https://instagram.com/p/abc123/")).toBeNull();
    expect(extractCreatorHandleFromImportUrl("https://instagram.com/reel/abc123/")).toBeNull();
  });

  it("extracts TikTok @handle from video URLs", () => {
    expect(
      extractCreatorHandleFromImportUrl("https://www.tiktok.com/@foodtok/video/1234567890"),
    ).toBe("@foodtok");
  });

  it("extracts YouTube @handle paths", () => {
    expect(
      extractCreatorHandleFromImportUrl("https://www.youtube.com/@coastalkitchen/shorts/abc"),
    ).toBe("@coastalkitchen");
  });

  it("returns null for generic blog URLs", () => {
    expect(extractCreatorHandleFromImportUrl("https://www.bonappetit.com/recipe/pasta")).toBeNull();
  });
});
