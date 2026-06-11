/**
 * digestNarrative — grounded narrative layer over the weekly digest.
 *
 * Pins the strict grounding contract:
 *   - buildNarrativeFacts nulls out fields that would be a lie
 *   - the system prompt forbids invented numbers + claims
 *   - parseNarrative rejects invented numbers, banned claims, junk
 *   - the template fallback is grounded, warm, never empty
 *   - the maintenance-move story renders when supplied
 */

import { describe, expect, it } from "vitest";
import {
  buildNarrativeFacts,
  buildNarrativeUserMessage,
  buildTemplateNarrative,
  DIGEST_NARRATIVE_SYSTEM_PROMPT,
  maintenanceReasonPhrase,
  parseNarrative,
  type DigestNarrativeFacts,
} from "@/lib/nutrition/digestNarrative";

const baseInput = {
  weekLabel: "May 5 – May 11",
  daysLogged: 5,
  avgCalories: 1940,
  targetCalories: 2100,
  proteinOnTargetDays: 3,
  closestDayLabel: "Tuesday",
};

describe("buildNarrativeFacts", () => {
  it("computes the signed calorie delta from avg − target", () => {
    const facts = buildNarrativeFacts(baseInput);
    expect(facts.avgCalories).toBe(1940);
    expect(facts.targetCalories).toBe(2100);
    expect(facts.calorieDelta).toBe(-160);
  });

  it("nulls out calorie facts when no target is set (never a lie)", () => {
    const facts = buildNarrativeFacts({ ...baseInput, targetCalories: 0 });
    expect(facts.targetCalories).toBeNull();
    expect(facts.calorieDelta).toBeNull();
  });

  it("nulls out calorie + protein facts on a zero-logged week", () => {
    const facts = buildNarrativeFacts({ ...baseInput, daysLogged: 0 });
    expect(facts.daysLogged).toBe(0);
    expect(facts.avgCalories).toBeNull();
    expect(facts.proteinOnTargetDays).toBeNull();
  });

  it("clamps proteinOnTargetDays to the days logged", () => {
    const facts = buildNarrativeFacts({
      ...baseInput,
      daysLogged: 3,
      proteinOnTargetDays: 9,
    });
    expect(facts.proteinOnTargetDays).toBe(3);
  });

  it("passes through a maintenance move", () => {
    const facts = buildNarrativeFacts({
      ...baseInput,
      maintenanceMove: {
        direction: "rose",
        previousKcal: 2200,
        newKcal: 2350,
        reason: "ate_more_held_weight",
      },
    });
    expect(facts.maintenanceMove?.direction).toBe("rose");
    expect(facts.maintenanceMove?.newKcal).toBe(2350);
  });
});

describe("system prompt contract", () => {
  it("forbids invented numbers and health claims", () => {
    expect(DIGEST_NARRATIVE_SYSTEM_PROMPT).toContain("NEVER state a number");
    expect(DIGEST_NARRATIVE_SYSTEM_PROMPT).toContain("NEVER make a health");
    expect(DIGEST_NARRATIVE_SYSTEM_PROMPT).toContain("past tense");
  });
});

describe("buildNarrativeUserMessage", () => {
  it("serialises the facts + a pre-resolved maintenance phrase", () => {
    const facts = buildNarrativeFacts({
      ...baseInput,
      maintenanceMove: {
        direction: "rose",
        previousKcal: 2200,
        newKcal: 2350,
        reason: "ate_more_held_weight",
      },
    });
    const msg = buildNarrativeUserMessage(facts);
    const json = JSON.parse(msg.slice(msg.indexOf("{")));
    expect(json.calorieDelta).toBe(-160);
    expect(json.maintenance.reasonPhrase).toBe(
      maintenanceReasonPhrase("ate_more_held_weight"),
    );
  });
});

describe("parseNarrative — number grounding + voice gate", () => {
  const facts: DigestNarrativeFacts = buildNarrativeFacts(baseInput);

  it("accepts a clean narrative that only uses grounded numbers", () => {
    const out = parseNarrative(
      JSON.stringify({
        narrative:
          "Last week you logged 5 of 7 days and averaged 1,940 kcal against your 2,100 target. Tuesday was your steadiest day — a calm week overall.",
      }),
      facts,
    );
    expect(out).toContain("Tuesday");
  });

  it("rejects a narrative that invents a calorie number not in the facts", () => {
    const out = parseNarrative(
      JSON.stringify({
        narrative:
          "Last week you logged 5 of 7 days and burned about 3,300 kcal across your workouts.",
      }),
      facts,
    );
    expect(out).toBeNull();
  });

  it("rejects a narrative making a weight-loss claim", () => {
    const out = parseNarrative(
      JSON.stringify({
        narrative:
          "Last week you logged 5 of 7 days. Keep this up and you will lose weight quickly.",
      }),
      facts,
    );
    expect(out).toBeNull();
  });

  it("rejects a 'you should' prescription", () => {
    const out = parseNarrative(
      JSON.stringify({
        narrative: "Last week you logged 5 of 7 days. You should eat more protein.",
      }),
      facts,
    );
    expect(out).toBeNull();
  });

  it("rejects unparseable or empty output", () => {
    expect(parseNarrative("not json", facts)).toBeNull();
    expect(parseNarrative(JSON.stringify({ narrative: "" }), facts)).toBeNull();
    expect(parseNarrative(JSON.stringify({ narrative: "x" }), facts)).toBeNull();
  });

  it("allows the maintenance kcal figures when a move is in the facts", () => {
    const withMove = buildNarrativeFacts({
      ...baseInput,
      maintenanceMove: {
        direction: "rose",
        previousKcal: 2200,
        newKcal: 2350,
        reason: "ate_more_held_weight",
      },
    });
    const out = parseNarrative(
      JSON.stringify({
        narrative:
          "Last week your maintenance estimate rose to about 2,350 kcal, because you held your weight while eating a little more than expected. A steady week.",
      }),
      withMove,
    );
    expect(out).toContain("2,350");
  });
});

describe("buildTemplateNarrative — deterministic fallback", () => {
  it("renders a quiet-week line on zero logged days", () => {
    const facts = buildNarrativeFacts({ ...baseInput, daysLogged: 0 });
    const out = buildTemplateNarrative(facts);
    expect(out.toLowerCase()).toContain("quiet week");
    expect(out.length).toBeGreaterThan(0);
  });

  it("tells the under-target story grounded in the real numbers", () => {
    const facts = buildNarrativeFacts(baseInput);
    const out = buildTemplateNarrative(facts);
    expect(out).toContain("5 of 7 days");
    expect(out).toContain("1,940");
    expect(out).toContain("2,100");
    expect(out).toContain("under");
  });

  it("tells the over-target story", () => {
    const facts = buildNarrativeFacts({
      ...baseInput,
      avgCalories: 2400,
      targetCalories: 2100,
    });
    const out = buildTemplateNarrative(facts);
    expect(out).toContain("over");
    expect(out).toContain("300");
  });

  it("weaves in the maintenance move when supplied", () => {
    const facts = buildNarrativeFacts({
      ...baseInput,
      maintenanceMove: {
        direction: "rose",
        previousKcal: 2200,
        newKcal: 2350,
        reason: "ate_more_held_weight",
      },
    });
    const out = buildTemplateNarrative(facts);
    expect(out).toContain("maintenance estimate rose");
    expect(out).toContain("2,350");
  });

  it("stays at most 3 sentences (matches the AI contract)", () => {
    const facts = buildNarrativeFacts({
      ...baseInput,
      maintenanceMove: {
        direction: "fell",
        previousKcal: 2400,
        newKcal: 2250,
        reason: "more_data",
      },
    });
    const out = buildTemplateNarrative(facts);
    const sentences = out.split(". ").filter(Boolean);
    expect(sentences.length).toBeLessThanOrEqual(3);
  });

  it("contains no banned diet-culture / medical language", () => {
    const facts = buildNarrativeFacts(baseInput);
    const out = buildTemplateNarrative(facts).toLowerCase();
    expect(out).not.toContain("lose weight");
    expect(out).not.toContain("healthy");
    expect(out).not.toMatch(/you should/);
    expect(out).not.toContain("!");
  });
});
