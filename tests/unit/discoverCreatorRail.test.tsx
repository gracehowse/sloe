// @vitest-environment jsdom
/**
 * DiscoverCreatorRail + loadTopCreators (ENG-1225 #14). The rail renders chips
 * for real creators and HIDES when empty (the creators table is empty pre-launch
 * — no fabricated chips). The loader maps the `top_creators_by_saves` RPC and is
 * resilient (returns [] on error).
 */
import * as React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiscoverCreatorRail } from "../../src/app/components/suppr/discover-creator-rail";
import { loadTopCreators } from "../../src/lib/discover/topCreators";

void React;

const creators = [
  { id: "a1", handle: "mob", displayName: "Mob Kitchen", avatarUrl: null },
  { id: "b2", handle: "anna", displayName: "Anna Jones", avatarUrl: "https://x/y.jpg" },
];

describe("DiscoverCreatorRail", () => {
  it("renders a chip per creator", () => {
    const { getByTestId, getAllByRole } = render(<DiscoverCreatorRail creators={creators} />);
    expect(getByTestId("discover-creator-rail")).not.toBeNull();
    expect(getByTestId("creator-chip-mob")).not.toBeNull();
    expect(getByTestId("creator-chip-anna")).not.toBeNull();
    expect(getAllByRole("button").length).toBe(2);
  });

  it("hides entirely when there are no creators (no fabricated chips)", () => {
    const { queryByTestId } = render(<DiscoverCreatorRail creators={[]} />);
    expect(queryByTestId("discover-creator-rail")).toBeNull();
  });
});

describe("loadTopCreators", () => {
  it("maps the RPC rows to creator chips", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          { id: "a1", handle: "mob", display_name: "Mob Kitchen", avatar_url: null, saves: 12 },
          { id: "b2", handle: null, display_name: "Anna", avatar_url: "x", saves: 9 },
        ],
        error: null,
      }),
    };
    const out = await loadTopCreators(supabase, 12);
    expect(supabase.rpc).toHaveBeenCalledWith("top_creators_by_saves", { p_limit: 12 });
    expect(out).toEqual([
      { id: "a1", handle: "mob", displayName: "Mob Kitchen", avatarUrl: null, bio: null },
      { id: "b2", handle: "b2", displayName: "Anna", avatarUrl: "x", bio: null }, // handle falls back to id
    ]);
  });

  it("maps bio from the RPC rows", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            id: "a1",
            handle: "mob",
            display_name: "Mob Kitchen",
            avatar_url: null,
            bio: "Batch-cooking",
            saves: 3,
          },
        ],
        error: null,
      }),
    };
    expect(await loadTopCreators(supabase)).toEqual([
      {
        id: "a1",
        handle: "mob",
        displayName: "Mob Kitchen",
        avatarUrl: null,
        bio: "Batch-cooking",
      },
    ]);
  });

  it("returns [] on RPC error (never throws into Discover)", async () => {
    const supabase = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }) };
    expect(await loadTopCreators(supabase)).toEqual([]);
  });

  it("drops rows with no display name", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [{ id: "a1", handle: "x", display_name: "  ", avatar_url: null, saves: 1 }],
        error: null,
      }),
    };
    expect(await loadTopCreators(supabase)).toEqual([]);
  });

  it("drops the retired synthetic personas but keeps genuine creator rows", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            id: "a1000001-0001-4000-8000-000000000002",
            handle: "marcuscooks",
            display_name: "Marcus Chen",
            avatar_url: null,
            saves: 0,
          },
          {
            id: "d2461bc3-3118-46a5-90df-462cf9a87e33",
            handle: "realcook",
            display_name: "Real Cook",
            avatar_url: "https://example.com/avatar.jpg",
            saves: 4,
          },
        ],
        error: null,
      }),
    };

    expect(await loadTopCreators(supabase)).toEqual([
      {
        id: "d2461bc3-3118-46a5-90df-462cf9a87e33",
        handle: "realcook",
        displayName: "Real Cook",
        avatarUrl: "https://example.com/avatar.jpg",
        bio: null,
      },
    ]);
  });
});
