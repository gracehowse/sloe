import { describe, expect, it } from "vitest";

import {
  formatSettingsProfileSubline,
  resolveSettingsProfileStatsPresentation,
} from "@/lib/settings/settingsProfileStats";

describe("resolveSettingsProfileStatsPresentation (ENG-1614)", () => {
  it("hides the strip when both stats are zero", () => {
    expect(resolveSettingsProfileStatsPresentation({ savedCount: 0, streak: 0 })).toEqual({
      mode: "hidden",
    });
  });

  it("folds a lone recipe count into inline text instead of a tile", () => {
    expect(resolveSettingsProfileStatsPresentation({ savedCount: 1, streak: 0 })).toEqual({
      mode: "inline",
      inlineSuffix: "1 recipe saved",
    });
  });

  it("folds a lone streak into inline text instead of a tile", () => {
    expect(resolveSettingsProfileStatsPresentation({ savedCount: 0, streak: 3 })).toEqual({
      mode: "inline",
      inlineSuffix: "3-day streak",
    });
  });

  it("renders the two-tile row only when both stats are non-zero", () => {
    expect(resolveSettingsProfileStatsPresentation({ savedCount: 2, streak: 5 })).toEqual({
      mode: "tiles",
      tiles: [
        { value: "2", label: "Recipes", kind: "recipes" },
        { value: "5", label: "Streak", kind: "streak" },
      ],
    });
  });
});

describe("formatSettingsProfileSubline", () => {
  it("appends inline stats after email and plan label", () => {
    const presentation = resolveSettingsProfileStatsPresentation({
      savedCount: 1,
      streak: 0,
    });
    expect(
      formatSettingsProfileSubline(
        { email: "grace@example.com", planLabel: "Free plan" },
        presentation,
      ),
    ).toBe("grace@example.com · Free plan · 1 recipe saved");
  });

  it("omits inline stats when the presentation is tile mode", () => {
    const presentation = resolveSettingsProfileStatsPresentation({
      savedCount: 2,
      streak: 4,
    });
    expect(
      formatSettingsProfileSubline(
        { email: "grace@example.com", planLabel: "Pro plan" },
        presentation,
      ),
    ).toBe("grace@example.com · Pro plan");
  });
});
