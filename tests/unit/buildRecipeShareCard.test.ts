import { describe, expect, it } from "vitest";
import {
  buildRecipeShareCardMessage,
  creatorProfileUrl,
  formatRecipeCreatorCredit,
  formatRecipeShareMacroLine,
} from "../../src/lib/share/buildRecipeShareCard";

describe("formatRecipeShareMacroLine", () => {
  it("formats calories and protein with estimated suffix by default", () => {
    expect(formatRecipeShareMacroLine({ calories: 420, protein: 32 })).toBe(
      "~420 kcal · 32g protein, estimated",
    );
  });

  it("omits protein when zero or missing", () => {
    expect(formatRecipeShareMacroLine({ calories: 200 })).toBe("~200 kcal, estimated");
  });

  it("returns null when calories are missing", () => {
    expect(formatRecipeShareMacroLine({ protein: 10 })).toBeNull();
  });
});

describe("formatRecipeCreatorCredit", () => {
  it("prefers author display name over source", () => {
    expect(
      formatRecipeCreatorCredit({ authorDisplayName: "Chef Ana", sourceName: "@foodtok" }),
    ).toBe("Recipe by Chef Ana");
  });

  it("prefixes @handles from source attribution", () => {
    expect(formatRecipeCreatorCredit({ sourceName: "@mealprep" })).toBe("Recipe by @mealprep");
  });

  it("filters internal seed sources", () => {
    expect(formatRecipeCreatorCredit({ sourceName: "system" })).toBe("");
  });
});

describe("creatorProfileUrl", () => {
  it("builds a creator profile deep link", () => {
    expect(
      creatorProfileUrl({ creatorId: "abc-123", appOrigin: "https://suppr-club.com/" }),
    ).toBe("https://suppr-club.com/creator/abc-123");
  });
});

describe("buildRecipeShareCardMessage", () => {
  it("assembles title, macros, credit, brand line, recipe link, and creator profile", () => {
    const message = buildRecipeShareCardMessage({
      recipeId: "r1",
      title: "Sheet-pan salmon",
      calories: 510,
      protein: 42,
      sourceName: "@coastalkitchen",
      creatorId: "creator-9",
      appOrigin: "https://suppr-club.com",
    });
    expect(message).toContain("Sheet-pan salmon");
    expect(message).toContain("~510 kcal · 42g protein, estimated");
    expect(message).toContain("Recipe by @coastalkitchen");
    expect(message).toContain("made with Sloe");
    expect(message).toContain(
      "https://suppr-club.com/home?view=discover&recipe=r1",
    );
    expect(message).toContain("https://suppr-club.com/creator/creator-9");
  });
});
