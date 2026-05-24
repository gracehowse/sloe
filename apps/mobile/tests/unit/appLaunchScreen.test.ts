import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

describe("AppLaunchScreen", () => {
  it("uses plate wordmark and status copy (not a bare spinner)", () => {
    const src = readFileSync(
      join(ROOT, "components/AppLaunchScreen.tsx"),
      "utf8",
    );
    expect(src).toContain("SupprPlateWordmark");
    expect(src).toContain("ActivityIndicator");
    expect(src).toMatch(/message/);
  });

  it("theme boot gate renders AppLaunchScreen and hides native splash when loaded", () => {
    const src = readFileSync(join(ROOT, "context/theme.tsx"), "utf8");
    expect(src).toContain("AppLaunchScreen");
    expect(src).toContain("SplashScreen.hideAsync");
    expect(src).toContain("preventAutoHideAsync");
  });

  it("native splash uses warm cream background (not pure white)", () => {
    const appJson = JSON.parse(
      readFileSync(join(ROOT, "app.json"), "utf8"),
    ) as {
      expo: { plugins: unknown[] };
    };
    const splashPlugin = appJson.expo.plugins.find(
      (p) => Array.isArray(p) && p[0] === "expo-splash-screen",
    ) as [string, Record<string, unknown>] | undefined;
    expect(splashPlugin?.[1]?.backgroundColor).toBe("#fafaf8");
  });
});
