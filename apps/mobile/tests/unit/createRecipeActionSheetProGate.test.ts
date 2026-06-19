import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  resolve(__dirname, "../../components/recipe/CreateRecipeActionSheet.tsx"),
  "utf8",
);

describe("CreateRecipeActionSheet — photo Pro gate (ENG-898 action sheet)", () => {
  it("routes Free users to paywall before opening the photo picker", () => {
    expect(SRC).toMatch(/onPhotoPress/);
    expect(SRC).toMatch(/if \(isFreeTier\)\s*\{\s*\n?\s*go\("\/paywall\?from=import_photo"\)/);
  });

  it("hydrates tier from cache and reconciles against profiles.user_tier", () => {
    expect(SRC).toMatch(/loadCachedUserTier/);
    expect(SRC).toMatch(/select\("user_tier"\)/);
    expect(SRC).toMatch(/const isFreeTier = userTier === "free"/);
  });

  it("shows Lock + Pro badge on the photo row for Free users", () => {
    expect(SRC).toMatch(/<Lock size=\{12\}/);
    expect(SRC).toMatch(/\(Pro\)/);
    expect(SRC).toMatch(/Pro feature — upgrade required/);
  });
});
