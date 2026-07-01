import { describe, expect, it } from "vitest";
import {
  buildCoachAskFacts,
  buildTemplateCoachAskAnswer,
  COACH_ASK_CHIPS,
  parseCoachAskAnswer,
} from "@/lib/nutrition/coachAsk";
import { buildCoachDayFacts } from "@/lib/nutrition/coachDayNarrative";

describe("coachAsk", () => {
  const day = buildCoachDayFacts({
    dateLabel: "Wednesday, 2 July",
    caloriesLogged: 1200,
    calorieTarget: 2000,
    proteinLogged: 60,
    proteinTarget: 140,
    mealsLoggedCount: 2,
    nextMealSlot: "Dinner",
  });

  it("exposes three bounded chips", () => {
    expect(COACH_ASK_CHIPS).toHaveLength(3);
  });

  it("buildTemplateCoachAskAnswer covers each chip", () => {
    for (const chip of COACH_ASK_CHIPS) {
      const facts = buildCoachAskFacts({ ...day, chipId: chip.id });
      const answer = buildTemplateCoachAskAnswer(facts);
      expect(answer.length).toBeGreaterThan(24);
    }
  });

  it("parseCoachAskAnswer rejects banned phrasing", () => {
    const facts = buildCoachAskFacts({
      ...day,
      chipId: "high_protein_snack",
      topCandidateTitle: "Greek salad",
      topCandidateCalories: 400,
      topCandidateProtein: 35,
    });
    const ok = JSON.stringify({
      answer:
        "You still have about 80g of protein open today — a yogurt or egg snack from your saved recipes would close part of that gap.",
    });
    expect(parseCoachAskAnswer(ok, facts)).toBeTruthy();
    const bad = JSON.stringify({ answer: "You should lose weight faster with this snack." });
    expect(parseCoachAskAnswer(bad, facts)).toBeNull();
  });
});
