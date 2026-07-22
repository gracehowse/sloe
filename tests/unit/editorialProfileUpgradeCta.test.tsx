/**
 * ENG-1641 — "Profile screen lost its upgrade-to-Pro CTA when
 * sloe_v3_profile went default-on (ENG-1246) — dead onUpgrade callback."
 *
 * `App.tsx` always supplied a real `onUpgrade` to `<Profile>`, but the
 * editorial block that replaced the legacy Profile hub never accepted or
 * rendered it — free/base-tier users on `/profile` had no upgrade path for
 * ~3 weeks. This pins the restored contract directly on the web
 * `EditorialProfileBlock` component (render test, not just source-string
 * pinning, since the whole point is that the callback actually fires):
 *   - free/base (`isPro=false`) + `onUpgrade` supplied → a real, visible,
 *     accessible "Upgrade to Pro" button renders and calls it on click.
 *   - `isPro=true` → no upgrade CTA renders, even if `onUpgrade` is passed
 *     (nothing to upgrade to).
 *   - `onUpgrade` omitted (defensive/optional prop) → no upgrade CTA
 *     renders, rather than a crash on click.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

void React;

vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: () => {},
  isFeatureEnabled: () => false,
}));

// Import AFTER the mock so the component picks up the mocked flags.
import { EditorialProfileBlock } from "../../src/app/components/profile/EditorialProfileBlock";
import { buildEditorialProfileBlock } from "../../src/lib/profile/editorialProfileBlock";

const EMPTY_MODEL = buildEditorialProfileBlock({
  byDay: {},
  freezeLedger: { earnedAt: [], usedHistory: [] },
  freezeBudgetMax: 3,
  now: new Date("2026-07-22T12:00:00Z"),
});

const BASE_PROPS = {
  displayName: "Alex",
  joinedLabel: "Joined this week",
  monogramInitial: "A",
  tierLabel: "Free",
  model: EMPTY_MODEL,
  recipes: [],
  recipeCount: 0,
  onOpenRecipe: () => {},
  onSeeAllRecipes: () => {},
};

describe("EditorialProfileBlock upgrade CTA (ENG-1641)", () => {
  let onUpgrade: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onUpgrade = vi.fn();
  });

  it("renders a real, clickable Upgrade to Pro CTA for a free-tier user and fires the supplied onUpgrade", async () => {
    const user = userEvent.setup();
    render(<EditorialProfileBlock {...BASE_PROPS} isPro={false} onUpgrade={onUpgrade} />);

    const button = screen.getByRole("button", { name: /upgrade to pro/i });
    expect(button).toBeVisible();

    await user.click(button);
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it("does not render an upgrade CTA for a Pro user, even when onUpgrade is supplied", () => {
    render(<EditorialProfileBlock {...BASE_PROPS} isPro tierLabel="Pro" onUpgrade={onUpgrade} />);

    expect(screen.queryByRole("button", { name: /upgrade to pro/i })).not.toBeInTheDocument();
  });

  it("does not render an upgrade CTA when onUpgrade is omitted (defensive — no dead click target)", () => {
    render(<EditorialProfileBlock {...BASE_PROPS} isPro={false} />);

    expect(screen.queryByRole("button", { name: /upgrade to pro/i })).not.toBeInTheDocument();
  });
});
