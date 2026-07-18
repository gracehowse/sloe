import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

describe("ENG-1376 bottom chrome contract", () => {
  const clearance = read("hooks/useTabBarClearance.ts");
  const tabLayout = read("app/(tabs)/_layout.tsx");
  const rootLayout = read("app/_layout.tsx");
  const settings = read("app/settings.tsx");
  const legacySettings = read("app/(tabs)/settings-legacy.tsx");
  const route = read("lib/settingsRoute.ts");

  it("includes host breathing in the flag-on overlay clearance", () => {
    expect(clearance).toContain('isFeatureEnabled("bottom_chrome_contract_v1")');
    expect(clearance).toContain("return tabBarOuterHeight(insets.bottom)");
    expect(clearance).toMatch(/pillHeight \+ bottomGap \+ hostBreathing \+ bottomInset/);
  });

  it("moves Settings to the root stack while retaining a flag-off tab route", () => {
    expect(rootLayout).toMatch(/STACK_HEADER_HIDDEN[\s\S]*?"settings"/);
    expect(tabLayout).toContain('<Tabs.Screen name="settings-legacy" options={{ href: null }} />');
    expect(tabLayout).not.toContain('<Tabs.Screen name="settings"');
    expect(legacySettings).toContain('export { default } from "../settings"');
    // The hidden legacy wrapper still needs floating-tab clearance when the
    // flag is off; the root-stack path switches to ordinary safe-area space.
    expect(settings).toContain("const legacyTabClearance = useTabBarClearance()");
    expect(settings).toMatch(/bottomChromeContract \? Spacing\.xxxl \+ insets\.bottom : legacyTabClearance/);
  });

  it("keeps both navigation paths behind the mirrored rollout flag", () => {
    expect(route).toContain('isFeatureEnabled("bottom_chrome_contract_v1")');
    expect(route).toContain('? "/settings"');
    expect(route).toContain(': "/(tabs)/settings-legacy"');
  });
});
