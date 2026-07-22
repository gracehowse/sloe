import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

describe("AppLaunchScreen", () => {
  it("uses the Sloe launch wordmark PNG and status copy (not a bare spinner)", () => {
    const src = readFileSync(join(ROOT, "components/AppLaunchScreen.tsx"), "utf8");
    expect(src).toContain("SloeLaunchWordmark");
    const launchMarkSrc = readFileSync(
      join(ROOT, "components/SloeLaunchWordmark.tsx"),
      "utf8",
    );
    expect(launchMarkSrc).toContain("splash-icon.png");
    expect(src).toContain("ActivityIndicator");
    expect(src).toMatch(/message/);
  });

  it("theme boot gate renders AppLaunchScreen after FontGate loads fonts", () => {
    const themeSrc = readFileSync(join(ROOT, "context/theme.tsx"), "utf8");
    const layoutSrc = readFileSync(join(ROOT, "app/_layout.tsx"), "utf8");
    const fontGateSrc = readFileSync(join(ROOT, "components/FontGate.tsx"), "utf8");
    expect(themeSrc).toContain("AppLaunchScreen");
    // ENG-1475 — `FontGate` (+ the rest of the app-root provider stack)
    // moved out of `_layout.tsx` into `context/AppProviders.tsx` so adding
    // `NutritionJournalProvider` didn't push the pinned `_layout.tsx` past
    // its screen-line-budget. Pin the delegation + the new home.
    const appProvidersSrc = readFileSync(join(ROOT, "context/AppProviders.tsx"), "utf8");
    expect(layoutSrc).toContain("AppProviders");
    expect(appProvidersSrc).toContain("FontGate");
    expect(fontGateSrc).toContain("SplashScreen.hideAsync");
    expect(fontGateSrc).toContain("useFonts");
  });

  it("native splash uses the cream brand field (light) and plum (dark)", () => {
    const appJson = JSON.parse(readFileSync(join(ROOT, "app.json"), "utf8")) as {
      expo: { plugins: unknown[] };
    };
    const splashPlugin = appJson.expo.plugins.find(
      (p) => Array.isArray(p) && p[0] === "expo-splash-screen",
    ) as [string, Record<string, unknown>] | undefined;
    // Light splash background = cream #FBF8F3 (matches the Sloe splash mock).
    expect(splashPlugin?.[1]?.backgroundColor).toBe("#FBF8F3");
    expect(splashPlugin?.[1]?.image).toContain("splash-icon");
    // Dark splash = white wordmark on plum.
    const dark = splashPlugin?.[1]?.dark as Record<string, unknown> | undefined;
    expect(dark?.backgroundColor).toBe("#3B2A4D");
    expect(dark?.image).toContain("splash-icon-dark");
  });

  it("in-app launch screen sits on the same cream/plum field as the native splash (continuity)", () => {
    const src = readFileSync(join(ROOT, "components/AppLaunchScreen.tsx"), "utf8");
    // The launch screen must use the splash field colours, not the theme page bg,
    // so the native-splash → JS handoff is seamless (no cream→white flash).
    expect(src).toContain("#FBF8F3");
    expect(src).toContain("#3B2A4D");
    expect(src).toContain("splashBackground");
  });
});
