/**
 * logSheetBuildMealCart — web flag-gate + cart-summary pins (ENG-757).
 *
 * Protects the two load-bearing guarantees of the build-meal cart:
 *   1. Flag OFF (or `onLogCombined` not wired) → the sheet shows the
 *      plain "Log a meal" title, no cart UI. Zero regression.
 *   2. Flag ON + cart populated → the title flips to "Build meal · N
 *      items", the cart summary + totals render, and "Log meal · X
 *      kcal" commits ONE combined entry.
 *
 * The cart only fills via the food-search preview's "Add" buttons,
 * which require a live search round-trip — out of scope for a unit
 * render. We drive the cart by mounting with the flag on and asserting
 * the gate wiring, and cover the totals/naming math exhaustively in
 * `buildMealCart.test.ts`. Mobile mirror:
 * `apps/mobile/tests/unit/logSheetBuildMealCart.test.tsx`.
 */

import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock the flag reader so each test pins a deterministic flag state.
vi.mock("@/lib/analytics/track", () => ({
  isFeatureEnabled: vi.fn(() => false),
  track: vi.fn(),
}));

import { isFeatureEnabled } from "@/lib/analytics/track";
import { LogSheet } from "../../src/app/components/suppr/log-sheet";

const flagMock = isFeatureEnabled as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  flagMock.mockReset();
  flagMock.mockReturnValue(false);
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

describe("LogSheet build-meal cart (web) — flag gate", () => {
  it("flag OFF: shows the plain 'Log a meal' title and no cart summary", () => {
    flagMock.mockReturnValue(false);
    render(
      <LogSheet
        open
        onOpenChange={() => {}}
        search={{ onSelect: () => {}, onLogCombined: () => {} }}
        recent={{ entries: [], onPick: () => {} }}
      />,
    );
    expect(screen.getByTestId("log-sheet-title").textContent).toBe("Log a meal");
    expect(screen.queryByTestId("log-sheet-cart-summary")).toBeNull();
    expect(screen.queryByTestId("log-sheet-cart-log-meal")).toBeNull();
  });

  it("flag ON but onLogCombined NOT wired: still no cart (host opted out)", () => {
    flagMock.mockReturnValue(true);
    render(
      <LogSheet
        open
        onOpenChange={() => {}}
        search={{ onSelect: () => {} }}
        recent={{ entries: [], onPick: () => {} }}
      />,
    );
    expect(screen.getByTestId("log-sheet-title").textContent).toBe("Log a meal");
    expect(screen.queryByTestId("log-sheet-cart-summary")).toBeNull();
  });

  it("flag ON + onLogCombined wired: empty cart still reads 'Log a meal' (cart only shows once it has items)", () => {
    flagMock.mockReturnValue(true);
    render(
      <LogSheet
        open
        onOpenChange={() => {}}
        search={{ onSelect: () => {}, onLogCombined: () => {} }}
        recent={{ entries: [], onPick: () => {} }}
      />,
    );
    // Title only flips once the cart has items; an empty cart keeps the
    // default title and shows no summary panel.
    expect(screen.getByTestId("log-sheet-title").textContent).toBe("Log a meal");
    expect(screen.queryByTestId("log-sheet-cart-summary")).toBeNull();
  });
});
