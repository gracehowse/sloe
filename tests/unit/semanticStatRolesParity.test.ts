import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const read = (relative: string) => fs.readFileSync(path.join(ROOT, relative), "utf8");

describe("semantic stat roles parity (ENG-1578)", () => {
  it("registers and consumes one mirrored rollout flag", () => {
    for (const file of [
      "src/lib/analytics/track.ts",
      "apps/mobile/lib/analytics.ts",
      "src/app/components/suppr/progress-energy-triad.tsx",
      "apps/mobile/components/progress/ProgressEnergyTriad.tsx",
      "apps/mobile/components/settings/SettingsBundleContent.tsx",
    ]) {
      expect(read(file)).toContain("semantic_stat_roles_v1");
    }
  });

  it("keeps Progress and Settings sibling values on the ink role", () => {
    const mobileProgress = read("apps/mobile/components/progress/ProgressEnergyTriad.tsx");
    const webProgress = read("src/app/components/suppr/progress-energy-triad.tsx");
    const mobileSettings = read("apps/mobile/components/settings/SettingsBundleContent.tsx");

    expect(mobileProgress).toContain("semanticStats ? text : sage");
    expect(mobileProgress).toMatch(/color: semanticStats[\s\S]{0,90}\? text/);
    expect(webProgress).toContain('semanticStats ? "var(--foreground)"');
    expect(mobileSettings).toContain("semanticStatRoles ? colors.text : t.accent");
    expect(mobileSettings).toContain("semanticStatRoles ? colors.text : t.green");
  });
});
