/**
 * ENG-1565 — PressableScale migration pins for slice 3 screens.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE_ROOT = resolve(import.meta.dirname, "../..");

function readMobile(rel: string): string {
  return readFileSync(resolve(MOBILE_ROOT, rel), "utf8");
}

describe("ENG-1565 slice 3 — PressableScale migration", () => {
  it("creator profile routes all taps through PressableScale", () => {
    const screen = readMobile("app/creator/[id].tsx");
    const parts = readMobile("components/creator/CreatorProfileParts.tsx");
    expect(screen).not.toMatch(/<Pressable[\s/>]/);
    expect(parts).toMatch(/import \{ PressableScale \}/);
    expect(parts).toMatch(/CreatorBackButton[\s\S]*haptic="selection"/);
    expect(parts).toMatch(/CreatorFollowButton[\s\S]*haptic="confirm"/);
    expect(parts).toMatch(/CreatorRecipeRow[\s\S]*haptic="confirm"/);
  });

  it("cookbook import routes all taps through PressableScale", () => {
    const screen = readMobile("app/cookbook-import.tsx");
    const parts = readMobile("components/cookbook/CookbookImportPressables.tsx");
    expect(screen).not.toMatch(/<Pressable[\s/>]/);
    expect(parts).toMatch(/import \{ PressableScale \}/);
    expect(parts).toMatch(/haptic="confirm"[\s\S]{0,200}Parse cookbook/);
  });

  it("login screen routes all taps through PressableScale", () => {
    const screen = readMobile("app/login.tsx");
    const parts = readMobile("components/login/LoginScreenPressables.tsx");
    expect(screen).not.toMatch(/<Pressable[\s/>]/);
    expect(parts).toMatch(/import \{ PressableScale \}/);
    expect(parts).toMatch(/haptic="confirm"[\s\S]{0,120}login-submit|login-submit[\s\S]{0,200}haptic="confirm"/);
  });
});
