/**
 * ENG-1597 — contextual help registry + gate helpers.
 */

import { describe, expect, it } from "vitest";
import {
  CONTEXTUAL_HELP_REGISTRY,
  MAX_COACH_RAIL_SESSION,
  nextCoachRailSession,
  parseCoachRailSessions,
  parseDismissedTopics,
  serializeCoachRailSessions,
  serializeDismissedTopics,
  shouldShowContextualHelp,
  type HelpTopicId,
} from "../../src/lib/help/contextualHelp";

const TOPICS = Object.keys(CONTEXTUAL_HELP_REGISTRY) as HelpTopicId[];

describe("CONTEXTUAL_HELP_REGISTRY (ENG-1597 Phase 1)", () => {
  it("defines all five Phase 1 topics with non-empty copy", () => {
    expect(TOPICS).toHaveLength(5);
    for (const id of TOPICS) {
      const content = CONTEXTUAL_HELP_REGISTRY[id];
      expect(content.title.length, id).toBeGreaterThan(0);
      expect(content.paragraphs.length, id).toBeGreaterThanOrEqual(1);
      for (const p of content.paragraphs) {
        expect(p.trim().length, `${id} paragraph`).toBeGreaterThan(0);
      }
    }
  });

  it("uses /help deep links only for methodology topics", () => {
    expect(CONTEXTUAL_HELP_REGISTRY["import.how_it_works"].learnMorePath).toBe(
      "/help#importing-recipes",
    );
    expect(CONTEXTUAL_HELP_REGISTRY["capture.post_save_next"].learnMorePath).toBeUndefined();
  });
});

describe("shouldShowContextualHelp", () => {
  it("returns false when flag is off", () => {
    expect(
      shouldShowContextualHelp({
        flagOn: false,
        topicId: "import.how_it_works",
        dismissedTopics: new Set(),
      }),
    ).toBe(false);
  });

  it("returns true for trigger topics when flag on and not dismissed", () => {
    expect(
      shouldShowContextualHelp({
        flagOn: true,
        topicId: "verify.why_verify",
        dismissedTopics: new Set(),
      }),
    ).toBe(true);
  });

  it("returns false when topic was dismissed", () => {
    expect(
      shouldShowContextualHelp({
        flagOn: true,
        topicId: "verify.why_verify",
        dismissedTopics: new Set(["verify.why_verify"]),
      }),
    ).toBe(false);
  });

  it("coach rail requires session within 1..MAX", () => {
    const base = {
      flagOn: true,
      topicId: "capture.post_save_next" as const,
      dismissedTopics: new Set<string>(),
    };
    expect(shouldShowContextualHelp({ ...base, coachRailSession: 1 })).toBe(true);
    expect(shouldShowContextualHelp({ ...base, coachRailSession: MAX_COACH_RAIL_SESSION })).toBe(
      true,
    );
    expect(shouldShowContextualHelp({ ...base, coachRailSession: MAX_COACH_RAIL_SESSION + 1 })).toBe(
      false,
    );
    expect(shouldShowContextualHelp({ ...base, coachRailSession: undefined })).toBe(false);
  });
});

describe("dismissed-topic persistence", () => {
  it("round-trips valid topic IDs only", () => {
    const set = new Set(["import.how_it_works", "bogus", "recipe.save_vs_log"]);
    const serialized = serializeDismissedTopics(set);
    expect(serialized).toBe("import.how_it_works,recipe.save_vs_log");
    expect(parseDismissedTopics(serialized)).toEqual(
      new Set(["import.how_it_works", "recipe.save_vs_log"]),
    );
  });
});

describe("coach-rail session persistence", () => {
  it("increments and caps session count", () => {
    expect(nextCoachRailSession(0)).toBe(1);
    expect(nextCoachRailSession(MAX_COACH_RAIL_SESSION)).toBe(MAX_COACH_RAIL_SESSION + 1);
    expect(nextCoachRailSession(MAX_COACH_RAIL_SESSION + 5)).toBe(MAX_COACH_RAIL_SESSION + 1);
  });

  it("parses malformed JSON as empty", () => {
    expect(parseCoachRailSessions("not-json")).toEqual({});
    expect(parseCoachRailSessions('{"capture.post_save_next":2}')).toEqual({
      "capture.post_save_next": 2,
    });
  });

  it("round-trips session map", () => {
    const map = { "capture.post_save_next": 2 };
    expect(parseCoachRailSessions(serializeCoachRailSessions(map))).toEqual(map);
  });
});
