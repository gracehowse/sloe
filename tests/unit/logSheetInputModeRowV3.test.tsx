/**
 * logSheetInputModeRowV3 (web) — ENG-1303 v3 method-grid tile grammar for the
 * LogSheet input-method row, gated on `sloe_v3_log` (default-ON).
 *
 * Mounts the real `<LogSheet>` and asserts:
 *   - FLAG ON (default) → the tile grammar: `data-variant="v3-grid"`, a Describe
 *     tile, a frost lock badge on the locked AI method, and NO "PRO" text pill.
 *   - FLAG OFF → the legacy circular chips: `rounded-full` chip buttons, a "PRO"
 *     text pill on the locked AI method, no Describe tile, no lock-badge testid.
 *   - the header copy swaps "Log a meal" → "Add to today" with the flag.
 *   - the Describe tile is present only when the host wires `describe`.
 *
 * Mirror of `apps/mobile/tests/unit/logSheetInputModeRowV3.test.tsx`.
 */

import * as React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import {
  LogSheet,
  type LogSheetProps,
} from "../../src/app/components/suppr/log-sheet";

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

afterEach(() => {
  // Clear the client-side flag force between tests (isFeatureEnabled reads
  // window.__SUPPR_FORCE_FLAGS__ first — see track.ts#flagForceOverride).
  delete (window as { __SUPPR_FORCE_FLAGS__?: Record<string, unknown> })
    .__SUPPR_FORCE_FLAGS__;
});

function forceLogFlag(value: boolean | undefined) {
  const w = window as { __SUPPR_FORCE_FLAGS__?: Record<string, unknown> };
  if (value === undefined) {
    delete w.__SUPPR_FORCE_FLAGS__;
  } else {
    w.__SUPPR_FORCE_FLAGS__ = { ...(w.__SUPPR_FORCE_FLAGS__ ?? {}), sloe_v3_log: value };
  }
}

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
      onAddManually={() => {}}
      describe={{ onParse: async () => ({ ok: true, items: [] }), onCommit: () => {} }}
      {...props}
    />,
  );
}

describe("LogSheet input-method row — v3 tile grammar (web)", () => {
  it("renders the method-grid tile grammar when the flag is ON (default)", () => {
    forceLogFlag(true);
    open();
    const row = screen.getByTestId("log-sheet-input-mode-row");
    expect(row.getAttribute("data-variant")).toBe("v3-grid");
    // The five tiles render (Scan / Photo / Voice / Describe / Quick add).
    for (const key of ["scan", "photo", "voice", "describe", "quick"]) {
      expect(screen.getByTestId(`log-sheet-method-${key}`)).toBeTruthy();
    }
  });

  it("shows the frost lock badge (not a PRO text pill) on the locked AI method when flag ON", () => {
    forceLogFlag(true);
    open({ voice: { onStart: () => {}, locked: true } });
    // Lock badge present on the locked Voice tile…
    expect(screen.getByTestId("log-sheet-method-lock-voice")).toBeTruthy();
    // …and NO legacy "PRO" text pill anywhere.
    expect(screen.queryByText("PRO")).toBeNull();
  });

  it("renders the Describe tile only when the host wires `describe` (flag ON)", () => {
    forceLogFlag(true);
    const { unmount } = open({ describe: undefined });
    expect(screen.queryByTestId("log-sheet-method-describe")).toBeNull();
    unmount();
    open();
    expect(screen.getByTestId("log-sheet-method-describe")).toBeTruthy();
  });

  it("renders the legacy circular chips + PRO pill when the flag is OFF", () => {
    forceLogFlag(false);
    open({ voice: { onStart: () => {}, locked: true } });
    const row = screen.getByTestId("log-sheet-input-mode-row");
    // No v3 grid marker, and the circular chip class is present.
    expect(row.getAttribute("data-variant")).toBeNull();
    expect(row.innerHTML).toContain("rounded-full");
    // Legacy PRO text pill present; no v3 tile / lock-badge test handles.
    expect(screen.getByText("PRO")).toBeTruthy();
    expect(screen.queryByTestId("log-sheet-method-voice")).toBeNull();
    expect(screen.queryByTestId("log-sheet-method-lock-voice")).toBeNull();
    // Describe is NOT a chip in the legacy row.
    expect(screen.queryByTestId("log-sheet-method-describe")).toBeNull();
  });

  it("swaps the header copy to 'Add to today' when flag ON and 'Log a meal' when OFF", () => {
    forceLogFlag(true);
    const { unmount } = open();
    expect(screen.getByText("Add to today")).toBeTruthy();
    expect(screen.queryByText("Log a meal")).toBeNull();
    unmount();

    forceLogFlag(false);
    open();
    expect(screen.getByText("Log a meal")).toBeTruthy();
    expect(screen.queryByText("Add to today")).toBeNull();
  });

  it("expands the inline describe flow when the Describe tile is tapped (flag ON, unlocked)", () => {
    forceLogFlag(true);
    open({ describe: { locked: false, onParse: async () => ({ ok: true, items: [] }), onCommit: () => {} } });
    // Collapsed entry shows first; tapping the tile expands to the input.
    expect(screen.queryByTestId("log-sheet-describe-input")).toBeNull();
    fireEvent.click(screen.getByTestId("log-sheet-method-describe"));
    expect(screen.getByTestId("log-sheet-describe-input")).toBeTruthy();
  });

  it("paywalls (does not expand) when the Describe tile is tapped while locked (flag ON)", () => {
    forceLogFlag(true);
    const onPaywall = vi.fn();
    open({
      describe: { locked: true, onParse: async () => ({ ok: true, items: [] }), onCommit: () => {}, onPaywall },
    });
    fireEvent.click(screen.getByTestId("log-sheet-method-describe"));
    expect(onPaywall).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("log-sheet-describe-input")).toBeNull();
  });
});
