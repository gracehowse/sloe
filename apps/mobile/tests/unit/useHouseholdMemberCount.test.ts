import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react-native";

const { getMyHousehold } = vi.hoisted(() => ({
  getMyHousehold: vi.fn(),
}));

vi.mock("@suppr/shared/household/householdClient", () => ({
  getMyHousehold,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {},
}));

import { useHouseholdMemberCount } from "@/hooks/useHouseholdMemberCount";

describe("useHouseholdMemberCount (ENG-849)", () => {
  beforeEach(() => {
    getMyHousehold.mockReset();
  });

  it("defaults to 1 when userId is missing", () => {
    const { result } = renderHook(() => useHouseholdMemberCount(null));
    expect(result.current).toBe(1);
  });

  it("uses live member count when the user belongs to a household", async () => {
    getMyHousehold.mockResolvedValue({
      data: { household: { id: "hh-1" }, members: [{}, {}, {}], meals: [] },
      error: null,
    });

    const { result } = renderHook(() => useHouseholdMemberCount("user-1"));

    await waitFor(() => expect(result.current).toBe(3));
  });

  it("falls back to 1 for solo users with no household row", async () => {
    getMyHousehold.mockResolvedValue({
      data: { household: null, members: [], meals: [] },
      error: null,
    });

    const { result } = renderHook(() => useHouseholdMemberCount("user-1"));

    await waitFor(() => expect(result.current).toBe(1));
  });
});
