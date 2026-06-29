/**
 * aiMethodTooltip (shared) — pure gate logic for the ENG-1252 LogSheet
 * first-session AI-method discoverability tooltip.
 *
 * Pins the decision matrix the LogSheet relies on: flag on/off ×
 * session 1-3 vs 4+ × free / base / pro tier, plus the session-counter
 * parse/increment/serialise helpers the host uses to persist state.
 *
 * This file is shared logic (`@suppr/shared/today/aiMethodTooltip`), so the
 * same source is exercised by web here and re-imported by the mobile suite.
 */

import { describe, it, expect } from "vitest";
import {
  AI_METHOD_TOOLTIP_FLAG,
  AI_METHOD_TOOLTIP_SESSION_KEY,
  AI_METHOD_TOOLTIP_TEXT,
  MAX_TOOLTIP_SESSION,
  nextSessionNumber,
  parseSessionCount,
  serializeSessionCount,
  shouldShowAiMethodTooltip,
} from "../../src/lib/today/aiMethodTooltip";

describe("aiMethodTooltip — constants", () => {
  it("registers the default-OFF flag key", () => {
    expect(AI_METHOD_TOOLTIP_FLAG).toBe("logsheet_ai_method_tooltip");
  });

  it("pins the user-facing copy (web ↔ mobile single source)", () => {
    expect(AI_METHOD_TOOLTIP_TEXT).toBe("AI logging — available with Pro.");
  });

  it("uses a versioned session-counter storage key", () => {
    expect(AI_METHOD_TOOLTIP_SESSION_KEY).toBe(
      "suppr-logsheet-ai-tooltip-session-v1",
    );
  });

  it("shows the tooltip for the first 3 sessions only", () => {
    expect(MAX_TOOLTIP_SESSION).toBe(3);
  });
});

describe("shouldShowAiMethodTooltip — gating matrix", () => {
  it("shows for a free-tier user on sessions 1-3 with the flag on", () => {
    for (const sessionNumber of [1, 2, 3]) {
      expect(
        shouldShowAiMethodTooltip({ flagOn: true, userTier: "free", sessionNumber }),
      ).toBe(true);
    }
  });

  it("shows for a base-tier (non-Pro) user on sessions 1-3", () => {
    expect(
      shouldShowAiMethodTooltip({ flagOn: true, userTier: "base", sessionNumber: 2 }),
    ).toBe(true);
  });

  it("does NOT show when the flag is off, even on session 1 for free", () => {
    expect(
      shouldShowAiMethodTooltip({ flagOn: false, userTier: "free", sessionNumber: 1 }),
    ).toBe(false);
  });

  it("does NOT show for a Pro user (any session, flag on)", () => {
    for (const sessionNumber of [1, 2, 3]) {
      expect(
        shouldShowAiMethodTooltip({ flagOn: true, userTier: "pro", sessionNumber }),
      ).toBe(false);
    }
  });

  it("does NOT show from session 4 onward for a free user", () => {
    for (const sessionNumber of [4, 5, 99]) {
      expect(
        shouldShowAiMethodTooltip({ flagOn: true, userTier: "free", sessionNumber }),
      ).toBe(false);
    }
  });

  it("does NOT show for a non-positive or non-finite session number", () => {
    for (const sessionNumber of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        shouldShowAiMethodTooltip({ flagOn: true, userTier: "free", sessionNumber }),
      ).toBe(false);
    }
  });
});

describe("session-counter helpers", () => {
  it("parses missing / malformed / negative reads to 0", () => {
    expect(parseSessionCount(null)).toBe(0);
    expect(parseSessionCount(undefined)).toBe(0);
    expect(parseSessionCount("")).toBe(0);
    expect(parseSessionCount("not-a-number")).toBe(0);
    expect(parseSessionCount("-3")).toBe(0);
  });

  it("parses a valid integer string", () => {
    expect(parseSessionCount("0")).toBe(0);
    expect(parseSessionCount("2")).toBe(2);
    expect(parseSessionCount("3")).toBe(3);
  });

  it("increments a fresh device to session 1", () => {
    expect(nextSessionNumber(parseSessionCount(null))).toBe(1);
  });

  it("walks 1 → 2 → 3 → 4 across opens", () => {
    let stored = 0;
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      const n = nextSessionNumber(stored);
      seen.push(n);
      stored = parseSessionCount(serializeSessionCount(n));
    }
    expect(seen).toEqual([1, 2, 3, 4]);
  });

  it("caps the persisted count at MAX + 1 so it never overflows", () => {
    // Heavy user opens the app many times; storage never grows past the cap.
    let stored = MAX_TOOLTIP_SESSION + 1;
    for (let i = 0; i < 50; i++) {
      stored = parseSessionCount(serializeSessionCount(nextSessionNumber(stored)));
    }
    expect(stored).toBe(MAX_TOOLTIP_SESSION + 1);
    // And a capped count still gates the tooltip OFF.
    expect(
      shouldShowAiMethodTooltip({ flagOn: true, userTier: "free", sessionNumber: stored }),
    ).toBe(false);
  });

  it("serialises defensively (truncates / floors negatives to 0)", () => {
    expect(serializeSessionCount(2.9)).toBe("2");
    expect(serializeSessionCount(-5)).toBe("0");
  });
});
