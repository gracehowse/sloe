/**
 * ENG-927 — user-facing copy must say Sloe, not Suppr.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { todayHealthConnectEnergyEmptyHint } from "../../src/lib/copy/today";
import { PLAN_SOURCE_ROW_META } from "../../src/lib/planning/planSource";

const ROOT = join(__dirname, "../..");

describe("ENG-927 — Sloe brand copy (user-facing)", () => {
  it("today health-connect empty hint says Sloe", () => {
    expect(todayHealthConnectEnergyEmptyHint()).toContain("in Sloe yet");
    expect(todayHealthConnectEnergyEmptyHint()).not.toContain("in Suppr yet");
  });

  it("plan source subtitles say Sloe's recipes", () => {
    expect(PLAN_SOURCE_ROW_META.library_and_discovery.subtitle).toContain("Sloe's recipe picks");
    expect(PLAN_SOURCE_ROW_META.discovery.subtitle).toContain("Sloe's recipes");
  });

  it("web whats-new page title says Sloe", () => {
    const page = readFileSync(join(ROOT, "app/whats-new/page.tsx"), "utf8");
    const titleBlock = page.match(/data-testid="whats-new-title"[\s\S]{0,120}/)?.[0] ?? "";
    expect(titleBlock).toMatch(/What(?:&rsquo;|'|')s new in Sloe/);
    expect(titleBlock).not.toMatch(/Suppr/);
  });

  it("recipe share strings say Sloe", () => {
    const detail = readFileSync(join(ROOT, "src/app/components/RecipeDetail.tsx"), "utf8");
    expect(detail).toContain('title: "Recipe on Sloe"');
    expect(detail).toContain('text: "Open this recipe in Sloe"');
  });
});
