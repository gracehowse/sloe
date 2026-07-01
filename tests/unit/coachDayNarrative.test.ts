import { describe, expect, it } from "vitest";
import {
  buildCoachDayFacts,
  buildTemplateCoachDayNarrative,
  parseCoachDayNarrative,
} from "@/lib/nutrition/coachDayNarrative";

describe("coachDayNarrative", () => {
  const facts = buildCoachDayFacts({
    dateLabel: "Wednesday, 2 July",
    caloriesLogged: 900,
    calorieTarget: 2000,
    proteinLogged: 45,
    proteinTarget: 140,
    mealsLoggedCount: 2,
    nextMealSlot: "Dinner",
  });

  it("buildCoachDayFacts computes remaining macros", () => {
    expect(facts.caloriesRemaining).toBe(1100);
    expect(facts.proteinRemaining).toBe(95);
    expect(facts.nextMealSlot).toBe("Dinner");
  });

  it("buildTemplateCoachDayNarrative never returns empty on logged day", () => {
    const text = buildTemplateCoachDayNarrative(facts);
    expect(text.length).toBeGreaterThan(20);
    expect(text).toMatch(/1,100/);
    expect(text).toMatch(/dinner/i);
  });

  it("parseCoachDayNarrative rejects invented numbers", () => {
    const raw = JSON.stringify({
      narrative:
        "You have 1,100 kcal left and about 95g protein open — dinner is still ahead.",
    });
    expect(parseCoachDayNarrative(raw, facts)).toBeTruthy();
    const bad = JSON.stringify({
      narrative: "You have 1,500 kcal left today which is plenty of room.",
    });
    expect(parseCoachDayNarrative(bad, facts)).toBeNull();
  });
});
