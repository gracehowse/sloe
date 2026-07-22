/**
 * Web `PhotoLogDialog` free-taster render tests (2026-05-02).
 *
 * Pins the public contract of the free-taster "X free logs remaining
 * this week" line. Decision doc:
 * `docs/decisions/2026-05-02-photo-log-free-taster.md`.
 *
 * Mirrors the mobile coverage at
 * `apps/mobile/tests/unit/photoLogSheetFreeTaster.test.tsx` so a
 * platform drift (different copy, different default tier, missing
 * upgrade callback) fails CI on whichever side it lands.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

void React;

vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: vi.fn(),
  // The dialog's "Plate total" glyph (lucide ArrowRight) is unconditional
  // (ENG-816 #24, mobile parity); `isFeatureEnabled` here only gates
  // `log_refine_describe_v1`. Default OFF keeps the free-taster assertions
  // unchanged.
  isFeatureEnabled: vi.fn(() => false),
}));

vi.mock("../../src/lib/supabase/browserClient", () => ({
  supabase: {
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    from: () => ({
      select: () => ({ eq: () => ({ ilike: () => Promise.resolve({ data: [], error: null }) }) }),
    }),
  },
}));

vi.mock("../../src/lib/nutrition/photoCorrectionPersist", () => ({
  persistPhotoCorrections: vi.fn(async () => ({ anyPersisted: false })),
}));

import { PhotoLogDialog } from "../../src/app/components/suppr/photo-log-dialog";

describe("PhotoLogDialog (web) — free-taster quota line", () => {
  it("renders '5 free photo logs remaining this week' for a free user with no prior call", () => {
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
      screen.getByLabelText("5 free photo logs remaining this week"),
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
      screen.getByLabelText("5 free photo logs remaining this week"),
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
    // No "remaining this week" affordance on Pro — they're uncapped
    // at the user-visible level.
    expect(
      screen.queryByLabelText(/free photo logs? remaining this week/),
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
      screen.queryByLabelText(/free photo logs? remaining this week/),
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
      screen.queryByLabelText(/free photo logs? remaining this week/),
    ).not.toBeInTheDocument();
  });
});
