import { describe, expect, it } from "vitest";

import { webRecipeDeepLink } from "@/lib/share/recipeDeepLink";

describe("webRecipeDeepLink", () => {
  it("builds a discover deep link with encoded recipe id", () => {
    expect(webRecipeDeepLink("abc 123", "https://app.suppr.com/")).toBe(
      "https://app.suppr.com/home?view=discover&recipe=abc%20123",
    );
  });

  it("strips trailing slash from origin", () => {
    expect(webRecipeDeepLink("r1", "http://localhost:3000")).toBe(
      "http://localhost:3000/home?view=discover&recipe=r1",
    );
  });
});
