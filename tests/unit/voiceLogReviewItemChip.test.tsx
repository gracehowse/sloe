/**
 * VoiceLogReviewItem — the web voice-log review row (ENG-1429). Pins the ported
 * Verified/Estimated confidence chip behaviour:
 *   - the shared chip always renders, addressable as `voice-confidence-chip`
 *     (`redesign_search_results` collapsed permanently-on, ENG-1651 — the
 *     old flag-OFF no-chip path no longer exists in source, so there's
 *     nothing left to assert there).
 *   - the chip is ALWAYS "Estimated" — even for a high-confidence item — because
 *     an AI-parsed item is an estimate by definition (CLAUDE.md trust posture),
 *     mirroring the mobile AiLogReviewItem's hardcoded `tier="estimated"`.
 *   - the granular High/Med/Low signal + "AI estimate" badge still render
 *     (regression guard for the extraction out of voice-log-dialog).
 *
 * The `isFeatureEnabled` mock below stays generic-OFF: it's not gating this
 * chip anymore, but the shared `SearchResultConfidenceChip` still reads the
 * real, still-live `trust_source_name_v1` flag internally, and this suite
 * needs that flag OFF so the pinned "Estimated" default label (not the
 * trust-copy source label) is what renders.
 */
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("../../src/lib/analytics/track", () => ({
  track: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));

import { isFeatureEnabled } from "../../src/lib/analytics/track";
import { VoiceLogReviewItem } from "../../src/app/components/suppr/voice-log-review-item";
import type { AiLoggedItem } from "../../src/lib/nutrition/aiLogging";

void React;

const flagFn = isFeatureEnabled as unknown as ReturnType<typeof vi.fn>;

function makeItem(overrides: Partial<AiLoggedItem> = {}): AiLoggedItem {
  return {
    name: "Scrambled eggs",
    calories: 180,
    protein: 12,
    carbs: 2,
    fat: 13,
    confidence: 0.9,
    source: "voice",
    ...overrides,
  };
}

function renderItem(item: AiLoggedItem) {
  return render(
    <VoiceLogReviewItem item={item} index={0} onChange={vi.fn()} onRemove={vi.fn()} />,
  );
}

afterEach(() => {
  cleanup();
  flagFn.mockReset();
  flagFn.mockReturnValue(false);
});

describe("VoiceLogReviewItem — confidence chip port (ENG-1429)", () => {
  it("renders the shared chip addressable as voice-confidence-chip, reading 'Estimated'", () => {
    renderItem(makeItem());
    const chip = screen.getByTestId("voice-confidence-chip");
    expect(chip).toBeInTheDocument();
    expect(chip.textContent).toContain("Estimated");
    // Warm-amber estimated token, never the over-budget warning orange.
    expect(chip.style.color).toContain("var(--chip-estimated)");
  });

  it("the chip stays 'Estimated' even for a high-confidence item (never 'Structured')", () => {
    renderItem(makeItem({ confidence: 0.99 }));
    const chip = screen.getByTestId("voice-confidence-chip");
    expect(chip.textContent).toContain("Estimated");
    expect(chip.textContent).not.toContain("Structured");
    expect(screen.queryByText("Structured")).toBeNull();
  });

  it("still renders the low-confidence verify gate + AI badge (extraction regression guard)", () => {
    renderItem(makeItem({ confidence: 0.3 }));
    expect(
      screen.getByText(/Low confidence — please verify the portion and macros/i),
    ).toBeInTheDocument();
    expect(screen.getByText("AI estimate")).toBeInTheDocument();
  });
});
