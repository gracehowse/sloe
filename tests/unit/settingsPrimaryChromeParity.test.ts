import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const WEB_SETTINGS = readFileSync(resolve(ROOT, "src/app/components/Settings.tsx"), "utf8");
const WEB_TWO_PANE = readFileSync(
  resolve(ROOT, "src/app/components/settings/SettingsTwoPaneShell.tsx"),
  "utf8",
);
const WEB_CHROME = readFileSync(
  resolve(ROOT, "src/app/components/settings/SettingsPageChrome.tsx"),
  "utf8",
);
const MOBILE_SETTINGS = readFileSync(resolve(ROOT, "apps/mobile/app/settings.tsx"), "utf8");

describe("Settings primary-screen chrome parity (ENG-1577)", () => {
  it("uses the same flag-gated overline and 33px page-title path on web", () => {
    expect(WEB_CHROME).toContain("Your account");
    expect(WEB_CHROME).toContain('className="page-title text-foreground-brand"');
    expect(WEB_CHROME).toContain('isFeatureEnabled("primary_screen_chrome_v1")');
    expect(WEB_SETTINGS).toContain("<SettingsPageChrome");
    expect(WEB_TWO_PANE).toContain("<SettingsPageChrome");
  });

  it("uses the shared mobile chrome primitive for pushed Settings", () => {
    expect(MOBILE_SETTINGS).toContain(
      'from "@/components/suppr/screen-section-chrome"',
    );
    expect(MOBILE_SETTINGS).toContain('overline={consistencyChrome ? "Your account" : null}');
    expect(MOBILE_SETTINGS).toContain('title="Settings"');
    expect(MOBILE_SETTINGS).toContain("leading={");
  });
});
