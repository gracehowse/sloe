/**
 * Web `PhotoLogDialog` free-taster render tests (2026-05-02).
 *
 * Pins the public contract of the free-taster "X free logs remaining
 * today" line + the `onUpgradeRequired` upgrade-handoff. Decision doc:
 * `docs/decisions/2026-05-02-photo-log-free-taster.md`.
 *
 * Mirrors the mobile coverage at
 * `apps/mobile/tests/unit/photoLogSheetFreeTaster.test.tsx` so a
 * platform drift (different copy, different default tier, missing
 * upgrade callback) fails CI on whichever side it lands.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

void React;

import { PhotoLogDialog } from "../../src/app/components/suppr/photo-log-dialog";

describe("PhotoLogDialog (web) — free-taster quota line", () => {
  it("renders '3 free logs remaining today' for a free user with no prior call", () => {
    render(
      <PhotoLogDialog
        open
        onOpenChange={() => undefined}
        activeSlot="Lunch"
        onCommit={() => undefined}
        userTier="free"
      />,
    );
    // The role="status" + aria-label pins the count without being
    // brittle to whitespace / wrapping.
    expect(
      screen.getByLabelText("3 free photo logs remaining today"),
    ).toBeInTheDocument();
  });

  it("renders the same quota line for a 'base' tier user", () => {
    render(
      <PhotoLogDialog
        open
        onOpenChange={() => undefined}
        activeSlot="Lunch"
        onCommit={() => undefined}
        userTier="base"
      />,
    );
    expect(
      screen.getByLabelText("3 free photo logs remaining today"),
    ).toBeInTheDocument();
  });

  it("does NOT render the quota line for a Pro user", () => {
    render(
      <PhotoLogDialog
        open
        onOpenChange={() => undefined}
        activeSlot="Lunch"
        onCommit={() => undefined}
        userTier="pro"
      />,
    );
    // No "remaining today" affordance on Pro — they're uncapped at the
    // user-visible level.
    expect(
      screen.queryByLabelText(/free photo logs remaining today/),
    ).not.toBeInTheDocument();
  });

  it("defaults to Pro behaviour when userTier prop is omitted (back-compat)", () => {
    render(
      <PhotoLogDialog
        open
        onOpenChange={() => undefined}
        activeSlot="Lunch"
        onCommit={() => undefined}
      />,
    );
    expect(
      screen.queryByLabelText(/free photo logs remaining today/),
    ).not.toBeInTheDocument();
  });

  it("does NOT render anything when open=false (Dialog contract)", () => {
    render(
      <PhotoLogDialog
        open={false}
        onOpenChange={() => undefined}
        activeSlot="Lunch"
        onCommit={() => undefined}
        userTier="free"
      />,
    );
    expect(
      screen.queryByLabelText(/free photo logs remaining today/),
    ).not.toBeInTheDocument();
  });
});
