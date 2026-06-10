/**
 * Auth boot must clear `loading` from onAuthStateChange, not only getSession.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const AUTH_FILE = join(__dirname, "..", "..", "context", "auth.tsx");
const TABS_LAYOUT = join(__dirname, "..", "..", "app", "(tabs)", "_layout.tsx");
const FONT_GATE = join(__dirname, "..", "..", "components", "FontGate.tsx");

describe("mobile auth boot gates", () => {
  it("clears loading inside onAuthStateChange (INITIAL_SESSION path)", () => {
    const src = readFileSync(AUTH_FILE, "utf8");
    const listenerBlock = src.slice(
      src.indexOf("onAuthStateChange"),
      src.indexOf("supabase.auth.getSession"),
    );
    expect(listenerBlock).toMatch(/setLoading\(false\)/);
  });

  it("tabs layout does not block on onboardingChecked launch screen", () => {
    const src = readFileSync(TABS_LAYOUT, "utf8");
    expect(src).not.toContain("onboardingChecked");
    expect(src).not.toContain("Getting Today ready");
  });

  it("FontGate does not block children while fonts load", () => {
    const src = readFileSync(FONT_GATE, "utf8");
    expect(src).toContain("return children");
    expect(src).not.toMatch(/import\s*\{[^}]*AppLaunchScreen/);
    expect(src).toContain("hideAsync");
  });

  it("AppLaunchScreen does not import theme context (breaks require cycle)", () => {
    const src = readFileSync(
      join(__dirname, "..", "..", "components", "AppLaunchScreen.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/from\s+["']@\/hooks\/use-theme-colors["']/);
    expect(src).not.toMatch(/from\s+["']@\/context\/theme["']/);
  });
});
