import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const read = (relative: string) => fs.readFileSync(path.join(ROOT, relative), "utf8");

describe("settings profile stats parity (ENG-1614)", () => {
  it("mobile Settings uses the shared orphan-tile guard", () => {
    const bundle = read("apps/mobile/components/settings/SettingsBundleContent.tsx");
    const tiles = read("apps/mobile/components/settings/SettingsProfileStatsTiles.tsx");
    expect(bundle).toContain("resolveSettingsProfileStatsPresentation");
    expect(bundle).toContain('profileStatsPresentation.mode === "tiles"');
    expect(bundle).toContain("formatSettingsProfileSubline");
    expect(bundle).toContain("SettingsProfileStatsTiles");
    expect(tiles).toContain('testID="settings-profile-stats-tiles"');
  });

  it("web Settings has no Recipes/Streak tile strip to orphan", () => {
    const settings = read("src/app/components/Settings.tsx");
    expect(settings).not.toMatch(/Recipes[\s\S]{0,120}Streak/);
    expect(settings).not.toContain("settings-profile-stats-tiles");
  });
});
