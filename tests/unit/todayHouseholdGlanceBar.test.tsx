/**
 * TodayHouseholdGlanceBar — slim household chrome above the tracker on
 * desktop Today (ENG-1495). Tests pin:
 *  - hide-don't-skeleton: renders NOTHING when solo / signed out /
 *    still resolving (empty members from the context);
 *  - the "Cooking for N" summary + first-name list;
 *  - initials avatar chips with index-stable accents, capped at 4;
 *  - the single press target (onOpen override + a11y label).
 *
 * Household data comes from `useHousehold()` (the app-level provider's
 * one `getMyHousehold` fetch) — the bar itself must never query, so
 * the tests mock the context hook, not the network.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { TodayHouseholdGlanceBar } from "../../src/app/components/suppr/today-household-glance-bar";
import { useHousehold } from "../../src/context/HouseholdContext";
import { householdMemberAccent } from "../../src/lib/household/memberAccents";

vi.mock("../../src/context/HouseholdContext", () => ({
  useHousehold: vi.fn(),
}));

const mockUseHousehold = vi.mocked(useHousehold);

function contextValue(
  members: Array<{ userId: string; displayName: string }>,
  activeHouseholdId: string | null = members.length > 0 ? "hh-1" : null,
) {
  return {
    activeHouseholdId,
    householdMemberCount: Math.max(members.length, 1),
    members,
  };
}

describe("TodayHouseholdGlanceBar", () => {
  beforeEach(() => {
    mockUseHousehold.mockReset();
  });

  it("renders nothing when the user has no household (solo / signed out / resolving)", () => {
    mockUseHousehold.mockReturnValue(contextValue([]));
    const { container } = render(<TodayHouseholdGlanceBar />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when a household id exists but members are still resolving", () => {
    mockUseHousehold.mockReturnValue(contextValue([], "hh-1"));
    const { container } = render(<TodayHouseholdGlanceBar />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the member count and first names for a household", () => {
    mockUseHousehold.mockReturnValue(
      contextValue([
        { userId: "u1", displayName: "Grace Howse" },
        { userId: "u2", displayName: "Sam Taylor" },
      ]),
    );
    render(<TodayHouseholdGlanceBar />);
    expect(screen.getByText("Cooking for 2")).toBeDefined();
    expect(screen.getByText(/Grace, Sam/)).toBeDefined();
  });

  it("renders initials chips with the index-stable member accents", () => {
    mockUseHousehold.mockReturnValue(
      contextValue([
        { userId: "u1", displayName: "Grace Howse" },
        { userId: "u2", displayName: "Sam Taylor" },
      ]),
    );
    render(<TodayHouseholdGlanceBar />);
    const grace = screen.getByText("GH");
    const sam = screen.getByText("ST");
    expect(grace).toBeDefined();
    expect(sam).toBeDefined();
    // Index-based accents (joined_at ASC order) — same palette as the
    // Plan/Progress HouseholdBar, so a member's colour never shifts
    // between surfaces.
    expect((grace as HTMLElement).style.backgroundColor).not.toBe("");
    expect(householdMemberAccent(0)).not.toBe(householdMemberAccent(1));
  });

  it("caps the avatar stack at 4 chips while the count stays honest", () => {
    mockUseHousehold.mockReturnValue(
      contextValue(
        ["Ada A", "Ben B", "Cy C", "Dee D", "Eve E", "Fay F"].map((n, i) => ({
          userId: `u${i}`,
          displayName: n,
        })),
      ),
    );
    const { container } = render(<TodayHouseholdGlanceBar />);
    expect(screen.getByText("Cooking for 6")).toBeDefined();
    const chips = container.querySelectorAll("span.rounded-full");
    expect(chips.length).toBe(4);
  });

  it("is one press target with an a11y label and calls onOpen when provided", () => {
    mockUseHousehold.mockReturnValue(
      contextValue([{ userId: "u1", displayName: "Grace Howse" }]),
    );
    const onOpen = vi.fn();
    render(<TodayHouseholdGlanceBar onOpen={onOpen} />);
    const bar = screen.getByRole("button", {
      name: /Cooking for 1 — open household settings/,
    });
    fireEvent.click(bar);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
