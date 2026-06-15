import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("Settings meal slot preset (ENG-1177)", () => {
  it("web Settings loads + saves meal_slot_config", () => {
    const src = readFileSync(join(ROOT, "src/app/components/Settings.tsx"), "utf8");
    expect(src).toContain("meal_slot_config");
    expect(src).toContain("meal-slot-preset-picker");
    expect(src).toContain("MEAL_SLOT_PRESET_OPTIONS");
  });

  it("mobile SettingsBundleContent loads + saves meal_slot_config", () => {
    const src = readFileSync(
      join(ROOT, "apps/mobile/components/settings/SettingsBundleContent.tsx"),
      "utf8",
    );
    expect(src).toContain("settings-bundle-meal-slots-row");
    expect(src).toContain("meal_slot_config");
    expect(src).toContain("meal-slot-preset-");
  });

  it("Today hosts thread enabled slots from profile", () => {
    const web = readFileSync(join(ROOT, "src/app/components/NutritionTracker.tsx"), "utf8");
    const mobile = readFileSync(join(ROOT, "apps/mobile/app/(tabs)/index.tsx"), "utf8");
    expect(web).toContain("enabledMealSlotLabels");
    expect(web).toContain("slotLabels={enabledMealSlots}");
    expect(mobile).toContain("enabledMealSlotLabels");
    expect(mobile).toContain("slots={MEAL_SLOTS}");
  });
});
