import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

describe("primary screen chrome contract (ENG-1577)", () => {
  it("registers the rollout flag on both platforms", () => {
    expect(read("src/lib/analytics/track.ts")).toContain('"primary_screen_chrome_v1"');
    expect(read("apps/mobile/lib/analytics.ts")).toContain('"primary_screen_chrome_v1"');
  });

  it("keeps the 33px page title in the shared token systems", () => {
    expect(read("src/styles/theme.css")).toContain("--text-page-title: 2.0625rem");
    expect(read("src/styles/theme.css")).toContain(".page-title");
    expect(read("apps/mobile/constants/theme.ts")).toMatch(/pageTitle:\s*\{[^}]*fontSize:\s*33/);
  });

  it("migrates standard chrome and leaves a flag-off kill switch", () => {
    const web = read("src/app/components/suppr/screen-chrome.tsx");
    const mobile = read("apps/mobile/components/suppr/screen-section-chrome.tsx");
    expect(web).toContain('isFeatureEnabled("primary_screen_chrome_v1")');
    expect(web).toContain('"page-title"');
    expect(web).toContain('text-[24px]');
    expect(mobile).toContain('isFeatureEnabled("primary_screen_chrome_v1")');
    expect(mobile).toContain("Type.pageTitle");
    expect(mobile).toContain("Type.title");
  });

  it("keeps Today out of the standard page-title migration", () => {
    expect(read("src/app/components/suppr/screen-chrome.tsx")).not.toContain("TodayBrandBar");
    expect(read("apps/mobile/components/suppr/screen-section-chrome.tsx")).not.toContain(
      'title="Today"',
    );
  });
});
