/**
 * Honeydew parity (2026-04-30) — web ShoppingList household surfacing.
 *
 * When the user is in a household, the web Shopping list must:
 *   - Render the "Shared with Sarah & Tom" banner (Lucide Users icon
 *     + tap navigates to household-settings).
 *   - Surface a per-row attribution chip on every checked group whose
 *     items were toggled by a single household member.
 *
 * When the user is solo:
 *   - Banner is NOT rendered.
 *   - Attribution chips are NOT rendered (always implicit).
 *
 * Mirror mobile coverage: the equivalent React Native chip + banner
 * are pinned at the integration level via the explicit `testID`s
 * `shopping-household-banner` and `shopping-attribution-<key>`.
 * Keep both platform contracts in lockstep.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

void React;

type ShoppingItem = {
  id: string;
  name: string;
  amount: string;
  unit: string;
  category: string;
  checked: boolean;
  from: string;
  checkedBy?: string | null;
};

type MockAppData = {
  shoppingItems: ShoppingItem[];
  toggleShoppingChecked: (id: string) => void;
  removeShoppingItem: (id: string) => void;
  setShoppingItems: (next: unknown) => void;
  userId: string | null;
  activeHouseholdId: string | null;
};

const appDataState: { current: MockAppData } = {
  current: {
    shoppingItems: [],
    toggleShoppingChecked: vi.fn(),
    removeShoppingItem: vi.fn(),
    setShoppingItems: vi.fn(),
    userId: "u-self",
    activeHouseholdId: null,
  },
};

vi.mock("../../src/context/AppDataContext.tsx", () => ({
  useAppData: () => appDataState.current,
}));

// Mock the supabase client so the effect-time `getMyHousehold`
// resolves with a deterministic 2-member household when active.
const mockHouseholdFetch = vi.fn();
vi.mock("../../src/lib/supabase/browserClient.ts", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => mockHouseholdFetch(),
          order: () => ({
            limit: () => ({ maybeSingle: async () => mockHouseholdFetch() }),
          }),
        }),
      }),
    }),
    rpc: async () => ({ data: null, error: null }),
    channel: () => ({
      on: () => ({ on: () => ({ subscribe: () => null }) }),
      subscribe: () => null,
    }),
    removeChannel: vi.fn(),
  },
}));

// Mock the household client — easier than threading a fake supabase
// chain through `getMyHousehold`'s 4-table fan-out for a UI test.
const householdResolver = vi.fn();
vi.mock("../../src/lib/household/householdClient.ts", () => ({
  getMyHousehold: (...args: unknown[]) => householdResolver(...args),
}));

import { ShoppingList } from "../../src/app/components/ShoppingList";

const baseItems: ShoppingItem[] = [
  { id: "p1", name: "Broccoli", amount: "2", unit: "heads", category: "Produce", checked: false, from: "Plan", checkedBy: null },
  // Single fully-checked group, attributed to a member named "Sarah".
  { id: "p2", name: "Red pepper", amount: "3", unit: "", category: "Produce", checked: true, from: "Plan", checkedBy: "u-sarah" },
];

beforeEach(() => {
  appDataState.current = {
    shoppingItems: baseItems,
    toggleShoppingChecked: vi.fn(),
    removeShoppingItem: vi.fn(),
    setShoppingItems: vi.fn(),
    userId: "u-self",
    activeHouseholdId: null,
  };
  householdResolver.mockReset();
  mockHouseholdFetch.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ShoppingList — Honeydew household surfacing (2026-04-30)", () => {
  it("does NOT render the household banner for solo users", async () => {
    render(<ShoppingList userTier="free" />);
    expect(screen.queryByTestId("shopping-household-banner")).toBeNull();
  });

  it("does NOT render attribution chips for solo users", async () => {
    render(<ShoppingList userTier="free" />);
    // Group key is the deduped lowercase ingredient name.
    expect(
      screen.queryByTestId(/shopping-attribution-/),
    ).toBeNull();
  });

  it("renders 'Shared with Sarah' banner when in a 2-member household", async () => {
    appDataState.current = {
      ...appDataState.current,
      activeHouseholdId: "h-1",
    };
    householdResolver.mockResolvedValue({
      data: {
        household: {
          id: "h-1",
          name: "Team",
          invite_code: "abc",
          isOwner: true,
          myRole: "owner",
          shareLunch: false,
        },
        members: [
          { userId: "u-self", role: "owner", displayName: "Me" },
          { userId: "u-sarah", role: "member", displayName: "Sarah" },
        ],
        meals: [],
      },
      error: null,
    });

    render(<ShoppingList userTier="free" />);
    // Effect-time resolution — flush microtasks.
    await screen.findByTestId("shopping-household-banner");
    const banner = screen.getByTestId("shopping-household-banner");
    expect(banner).toHaveTextContent(/Shared with Sarah/);
    // Real-time hint copy is part of the contract.
    expect(banner).toHaveTextContent(/Synced live/);
  });

  it("attributes a checked row to Sarah with her initials chip", async () => {
    appDataState.current = {
      ...appDataState.current,
      activeHouseholdId: "h-1",
    };
    householdResolver.mockResolvedValue({
      data: {
        household: {
          id: "h-1",
          name: "Team",
          invite_code: "abc",
          isOwner: true,
          myRole: "owner",
          shareLunch: false,
        },
        members: [
          { userId: "u-self", role: "owner", displayName: "Me" },
          { userId: "u-sarah", role: "member", displayName: "Sarah" },
        ],
        meals: [],
      },
      error: null,
    });

    render(<ShoppingList userTier="free" />);
    // After the household resolves, the chip should appear on the
    // "red pepper" group.
    const chip = await screen.findByTestId(/^shopping-attribution-/);
    expect(chip).toBeInTheDocument();
    // ENG-1669 density (default ON): initials-only chip; first name lives in title.
    expect(chip).toHaveTextContent(/SA/i);
    expect(chip).toHaveAttribute("title", expect.stringMatching(/Sarah/));
  });

  it("renders the 'Shared with Sarah & Tom' banner for a 3-member household", async () => {
    appDataState.current = {
      ...appDataState.current,
      activeHouseholdId: "h-1",
    };
    householdResolver.mockResolvedValue({
      data: {
        household: {
          id: "h-1",
          name: "Team",
          invite_code: "abc",
          isOwner: true,
          myRole: "owner",
          shareLunch: false,
        },
        members: [
          { userId: "u-self", role: "owner", displayName: "Me" },
          { userId: "u-sarah", role: "member", displayName: "Sarah" },
          { userId: "u-tom", role: "member", displayName: "Tom" },
        ],
        meals: [],
      },
      error: null,
    });

    render(<ShoppingList userTier="free" />);
    const banner = await screen.findByTestId("shopping-household-banner");
    expect(banner).toHaveTextContent(/Shared with Sarah & Tom/);
  });
});
