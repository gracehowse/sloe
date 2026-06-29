/**
 * ENG-1256 — web Profile read showcase behind `profile_showcase_v1`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PROFILE = readFileSync(
  resolve(__dirname, "../../src/app/components/Profile.tsx"),
  "utf8",
);
const SHOWCASE = readFileSync(
  resolve(__dirname, "../../src/app/components/profile/ProfileShowcaseReadView.tsx"),
  "utf8",
);

describe("ENG-1256 ProfileShowcaseReadView web", () => {
  it("gates read showcase behind profile_showcase_v1 in Profile.tsx", () => {
    expect(PROFILE).toMatch(/profileShowcaseV1\s*=\s*isFeatureEnabled\("profile_showcase_v1"\)/);
    expect(PROFILE).toMatch(/if\s*\(\s*profileShowcaseV1\s*\)/);
    expect(PROFILE).toMatch(/ProfileShowcaseReadView/);
    expect(PROFILE).toMatch(/screen-profile-showcase/);
  });

  it("routes Edit in Settings to /settings", () => {
    expect(SHOWCASE).toMatch(/href="\/settings"/);
    expect(SHOWCASE).toMatch(/Edit in Settings/);
  });

  it("mirrors mobile stat trio (days logged, recipes, streak)", () => {
    expect(SHOWCASE).toMatch(/Days logged/);
    expect(SHOWCASE).toMatch(/Recipes/);
    expect(SHOWCASE).toMatch(/Day streak/);
    expect(SHOWCASE).toMatch(/Daily targets/);
  });
});
