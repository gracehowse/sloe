/**
 * logSheetAiMethodTooltip (web) — render harness for the ENG-1252
 * first-session AI-method discoverability tooltip ("AI logging — available
 * with Pro.") under the locked Voice / Snap chip in `InputModeRow`.
 *
 * The pure gate matrix (flag × session × tier) is pinned in
 * `aiMethodTooltipGate.test.ts`. This file mounts the real `<LogSheet>` and
 * asserts the rendered behaviour the host controls via `aiMethodTooltipVisible`:
 *   - tooltip renders under a LOCKED Voice chip when visible
 *   - tooltip is absent when not visible (default)
 *   - tooltip never renders under an UNLOCKED chip (host gate already false,
 *     but the sheet also self-guards on `locked`)
 *   - exactly ONE tooltip renders even when both AI chips are locked
 *
 * Mirror of `apps/mobile/tests/unit/logSheetAiMethodTooltip.test.tsx`.
 */

import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  LogSheet,
  type LogSheetProps,
} from "../../src/app/components/suppr/log-sheet";
import { AI_METHOD_TOOLTIP_TEXT } from "../../src/lib/today/aiMethodTooltip";

// LogSheet mounts <FoodSearchPanel>, which debounces + fans out over fetch.
// These tests never touch the network — stub fetch to a permanent no-op.
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, hits: [], products: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
});

function open(props?: Partial<LogSheetProps>) {
  return render(
    <LogSheet
      open
      onOpenChange={() => {}}
      search={{ onOpen: () => {} }}
      barcode={{ onOpen: () => {} }}
      recent={{ entries: [], onPick: () => {} }}
      saved={{ meals: [], onPick: () => {} }}
      voice={{ onStart: () => {}, locked: true }}
      photo={{ onCapture: () => {}, locked: false }}
      {...props}
    />,
  );
}

describe("LogSheet AI-method tooltip (web)", () => {
  it("renders the tooltip under the locked Voice chip when visible", () => {
    open({ aiMethodTooltipVisible: true });
    const tip = screen.getByTestId("log-sheet-ai-method-tooltip");
    expect(tip).toBeTruthy();
    expect(tip.textContent).toBe(AI_METHOD_TOOLTIP_TEXT);
  });

  it("does NOT render the tooltip by default (prop omitted)", () => {
    open();
    expect(screen.queryByTestId("log-sheet-ai-method-tooltip")).toBeNull();
  });

  it("does NOT render the tooltip when explicitly false", () => {
    open({ aiMethodTooltipVisible: false });
    expect(screen.queryByTestId("log-sheet-ai-method-tooltip")).toBeNull();
  });

  it("does NOT render the tooltip when no AI chip is locked (e.g. Pro user)", () => {
    open({
      aiMethodTooltipVisible: true,
      voice: { onStart: () => {}, locked: false },
      photo: { onCapture: () => {}, locked: false },
    });
    expect(screen.queryByTestId("log-sheet-ai-method-tooltip")).toBeNull();
  });

  it("renders EXACTLY ONE tooltip even when both Voice and Photo are locked", () => {
    open({
      aiMethodTooltipVisible: true,
      voice: { onStart: () => {}, locked: true },
      photo: { onCapture: () => {}, locked: true },
    });
    expect(screen.getAllByTestId("log-sheet-ai-method-tooltip")).toHaveLength(1);
  });
});
