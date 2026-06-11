/**
 * Modal overlay scrim token (ENG-1013) — shared tint across surfaces.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MODAL_OVERLAY_SCRIM } from "@suppr/shared/theme/modalOverlay";

const FILES = [
  "../../components/today/LogSheet.tsx",
  "../../components/JournalDatePickerModal.tsx",
  "../../components/today/TodayMealsSection.tsx",
  "../../components/VoiceLogSheet.tsx",
  "../../components/PhotoLogSheet.tsx",
  "../../components/today/PortionPickerSheet.tsx",
  "../../components/CopyMealSheet.tsx",
  "../../components/SaveMealSheet.tsx",
  "../../components/DuplicateDaySheet.tsx",
  "../../components/AddIngredientSheet.tsx",
  "../../components/OverrideIngredientSheet.tsx",
  "../../components/CreateCustomFoodSheet.tsx",
  "../../components/settings/CancelExportPromptSheet.tsx",
  "../../components/today/TodayActivityBonusCard.tsx",
  "../../app/create-recipe.tsx",
  "../../components/household/HouseholdInviteSheet.tsx",
  "../../app/(tabs)/discover.tsx",
] as const;

describe("MODAL_OVERLAY_SCRIM (ENG-1013)", () => {
  it("exports the canonical 40% black scrim", () => {
    expect(MODAL_OVERLAY_SCRIM).toBe("#00000066");
  });

  for (const rel of FILES) {
    it(`${rel} imports the shared modal overlay token`, () => {
      const src = readFileSync(resolve(__dirname, rel), "utf8");
      expect(src).toContain("MODAL_OVERLAY_SCRIM");
      expect(src).not.toMatch(/backgroundColor:\s*"rgba\(0,0,0,0\.4\)"/);
      expect(src).not.toMatch(/backgroundColor:\s*"#00000066"/);
      expect(src).not.toMatch(/backgroundColor:\s*"#0007"/);
    });
  }
});
