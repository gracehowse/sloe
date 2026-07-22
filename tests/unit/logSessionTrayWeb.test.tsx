/**
 * logSessionTray (web) — render harness for the ENG-1643 session tray.
 * Spec: `docs/specs/2026-07-21-log-session-tray.md` §11.2.
 *
 * Mounts the real `<LogSheet>` and exercises the `sessionTray` prop:
 *  - no prop ⇒ nothing renders (the sheet behaves as pre-ENG-1643);
 *  - items ⇒ collapsed bar with count + running kcal total + `~` trust marker;
 *  - expand ⇒ rows + total footer + correct CTAs;
 *  - Undo fires with the right item + disables while in flight;
 *  - Done fires; Save-as-meal renders only at ≥ 2; multi-slot suffix.
 *
 * The pure math is covered in `tests/unit/logSessionTray.test.ts`; this file
 * covers the web UI wiring. Mirror of `apps/mobile/tests/unit/logSessionTray.test.tsx`.
 * Fetch is stubbed the same way as `logHubQuickActions.test.tsx`.
 */

import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import { LogSheet, type LogSheetProps } from "../../src/app/components/suppr/log-sheet";
import type { LogSessionTrayItem } from "../../src/lib/nutrition/logSessionTray";

// Trust marker (`~`) is gated behind `kcal_trust_qualifier_v1`. Force it ON so
// the tray's verified/unverified logic is exercised; other flags stay off.
vi.mock("../../src/lib/analytics/track", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/lib/analytics/track")>()),
  isFeatureEnabled: (flag: string) => flag === "kcal_trust_qualifier_v1",
}));

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

function item(partial: Partial<LogSessionTrayItem> = {}): LogSessionTrayItem {
  return {
    mealId: "m1", title: "Chicken breast", kcal: 165,
    protein: 31, carbs: 0, fat: 3.6, slot: "Dinner",
    kcalIsVerified: true, ...partial,
  };
}

function tray(overrides?: Partial<NonNullable<LogSheetProps["sessionTray"]>>) {
  return {
    items: [] as LogSessionTrayItem[],
    pendingUndoIds: [] as string[],
    onUndo: () => {},
    onDone: () => {},
    ...overrides,
  };
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
      voice={{ onStart: () => {} }}
      photo={{ onCapture: () => {} }}
      {...props}
    />,
  );
}

describe("LogSheet session tray (web) — render", () => {
  it("renders nothing when no sessionTray prop is threaded (pre-ENG-1643)", () => {
    open();
    expect(screen.queryByTestId("log-session-tray")).toBeNull();
  });

  it("renders nothing when sessionTray has zero items", () => {
    open({ sessionTray: tray() });
    expect(screen.queryByTestId("log-session-tray")).toBeNull();
  });

  it("renders the collapsed bar with count + running kcal total (all-verified ⇒ no ~)", () => {
    open({
      sessionTray: tray({
        items: [
          item({ mealId: "a", kcal: 165, kcalIsVerified: true }),
          item({ mealId: "b", kcal: 200, kcalIsVerified: true }),
        ],
      }),
    });
    expect(screen.getByTestId("log-session-tray")).toBeTruthy();
    expect(screen.getByTestId("log-session-tray-toggle")).toHaveTextContent("2 added · 365 kcal");
  });

  it("shows the honest ~ when any item is unverified", () => {
    open({
      sessionTray: tray({
        items: [
          item({ mealId: "a", kcal: 165, kcalIsVerified: true }),
          item({ mealId: "b", kcal: 200, kcalIsVerified: false }),
        ],
      }),
    });
    expect(screen.getByTestId("log-session-tray-toggle")).toHaveTextContent("2 added · ~365 kcal");
  });

  it("surfaces the count in the sheet title", () => {
    open({ sessionTray: tray({ items: [item({ mealId: "a" }), item({ mealId: "b" })] }) });
    expect(screen.getByText("Log a meal · 2 added")).toBeTruthy();
  });

  it("expands to per-item rows + a total footer when the bar is clicked", () => {
    open({
      sessionTray: tray({
        items: [item({ mealId: "a", title: "Oats" }), item({ mealId: "b", title: "Milk" })],
      }),
    });
    expect(screen.queryByTestId("log-session-tray-row-0")).toBeNull();
    fireEvent.click(screen.getByTestId("log-session-tray-toggle"));
    expect(screen.getByTestId("log-session-tray-row-0")).toBeTruthy();
    expect(screen.getByTestId("log-session-tray-row-1")).toBeTruthy();
    expect(screen.getByTestId("log-session-tray-list")).toHaveTextContent("Total");
  });

  it("Save-as-usual-meal is hidden at 1 item (the sheet portals to body, so scope by cleanup)", () => {
    open({ sessionTray: tray({ items: [item({ mealId: "a" })], onSaveMeal: () => {} }) });
    fireEvent.click(screen.getByTestId("log-session-tray-toggle"));
    expect(screen.queryByTestId("log-session-tray-save-meal")).toBeNull();
  });

  it("Save-as-usual-meal renders at ≥ 2 items", () => {
    cleanup();
    open({
      sessionTray: tray({
        items: [item({ mealId: "a" }), item({ mealId: "b" })],
        onSaveMeal: () => {},
      }),
    });
    fireEvent.click(screen.getByTestId("log-session-tray-toggle"));
    expect(screen.getByTestId("log-session-tray-save-meal")).toBeTruthy();
  });

  it("appends the slot suffix to rows only when the tray spans multiple slots", () => {
    open({
      sessionTray: tray({
        items: [
          item({ mealId: "a", title: "Toast", kcal: 100, kcalIsVerified: true, slot: "Breakfast" }),
          item({ mealId: "b", title: "Soup", kcal: 100, kcalIsVerified: true, slot: "Lunch" }),
        ],
      }),
    });
    fireEvent.click(screen.getByTestId("log-session-tray-toggle"));
    expect(screen.getByTestId("log-session-tray-row-0")).toHaveTextContent("100 kcal · Breakfast");
    expect(screen.getByTestId("log-session-tray-row-1")).toHaveTextContent("100 kcal · Lunch");
  });

  it("Done fires the host handler", () => {
    const onDone = vi.fn();
    open({ sessionTray: tray({ items: [item({ mealId: "a" })], onDone }) });
    fireEvent.click(screen.getByTestId("log-session-tray-done"));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("Undo fires with the right item", () => {
    const onUndo = vi.fn();
    open({ sessionTray: tray({ items: [item({ mealId: "meal-xyz", title: "Oats" })], onUndo }) });
    fireEvent.click(screen.getByTestId("log-session-tray-toggle"));
    fireEvent.click(screen.getByTestId("log-session-tray-undo-0"));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onUndo.mock.calls[0]![0].mealId).toBe("meal-xyz");
  });

  it("disables a row's ✕ while its removal is in flight (pendingUndoIds)", () => {
    const onUndo = vi.fn();
    open({
      sessionTray: tray({
        items: [item({ mealId: "meal-xyz", title: "Oats" })],
        pendingUndoIds: ["meal-xyz"],
        onUndo,
      }),
    });
    fireEvent.click(screen.getByTestId("log-session-tray-toggle"));
    const undoBtn = screen.getByTestId("log-session-tray-undo-0") as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(true);
    fireEvent.click(undoBtn);
    expect(onUndo).not.toHaveBeenCalled();
  });
});
