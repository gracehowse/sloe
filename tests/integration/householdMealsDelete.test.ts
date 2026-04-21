/**
 * Integration tests for DELETE /api/household/meals.
 *
 * Covers the IDOR fix: service role bypasses RLS, so authorization must
 * be enforced in application code. Allowed deleters are:
 *   - the meal's creator (added_by === userId), OR
 *   - an 'owner' role member of the meal's household.
 * Any other caller must get 403 (or 404 if the meal doesn't exist).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/server/serverEnv", () => ({
  misconfiguredServiceRoleResponse: vi.fn(() => null),
}));

import { DELETE } from "../../app/api/household/meals/route";
import {
  getUserIdFromRequest,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/serverAnonClient";

const mockGetUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockCreateServiceClient = createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>;

function mockRequest(mealId?: string | null): Request {
  const url = mealId == null
    ? "http://localhost/api/household/meals"
    : `http://localhost/api/household/meals?id=${encodeURIComponent(mealId)}`;
  return new Request(url, { method: "DELETE" });
}

type MealRow = { id: string; household_id: string; added_by: string } | null;
type MemberRow = { role: string } | null;

/**
 * Builds a Supabase client mock that:
 *  - returns `meal` for the household_meals lookup
 *  - returns `member` for the household_members lookup (scoped by user+household)
 *  - records delete invocations on `deleteCalls`
 */
function buildClient(opts: {
  meal: MealRow;
  mealError?: { message: string } | null;
  member: MemberRow;
  deleteError?: { message: string } | null;
}) {
  const deleteCalls: Array<Record<string, string>> = [];

  function makeQuery(table: string, op: "select" | "delete") {
    const filters: Record<string, string> = {};
    const chain: any = {
      eq: (col: string, val: string) => {
        filters[col] = val;
        return chain;
      },
      maybeSingle: async () => {
        if (table === "household_meals") {
          return { data: opts.meal, error: opts.mealError ?? null };
        }
        if (table === "household_members") {
          // honour the user_id + household_id scoping
          if (
            opts.meal &&
            filters.household_id &&
            filters.household_id !== opts.meal.household_id
          ) {
            return { data: null, error: null };
          }
          return { data: opts.member, error: null };
        }
        return { data: null, error: null };
      },
      then: undefined as any,
    };

    if (op === "delete") {
      // awaiting the chain should resolve to { error }
      chain.then = (resolve: (v: any) => void) => {
        deleteCalls.push({ table, ...filters });
        resolve({ error: opts.deleteError ?? null });
      };
    }
    return chain;
  }

  const client = {
    from(table: string) {
      return {
        select: (_cols: string) => makeQuery(table, "select"),
        delete: () => makeQuery(table, "delete"),
      };
    },
    __deleteCalls: deleteCalls,
  };
  return client;
}

describe("DELETE /api/household/meals — IDOR guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await DELETE(mockRequest("m1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when id is missing", async () => {
    mockGetUserId.mockResolvedValue("user-1");
    mockCreateServiceClient.mockReturnValue(
      buildClient({ meal: null, member: null }),
    );
    const res = await DELETE(mockRequest(null));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("missing_id");
  });

  it("returns 404 when meal does not exist", async () => {
    mockGetUserId.mockResolvedValue("user-1");
    mockCreateServiceClient.mockReturnValue(
      buildClient({ meal: null, member: null }),
    );
    const res = await DELETE(mockRequest("missing"));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("not_found");
  });

  it("returns 403 when caller is not a member of the meal's household (IDOR attempt)", async () => {
    mockGetUserId.mockResolvedValue("attacker");
    mockCreateServiceClient.mockReturnValue(
      buildClient({
        meal: { id: "m1", household_id: "hh-victim", added_by: "victim" },
        member: null, // attacker has no membership row for hh-victim
      }),
    );
    const res = await DELETE(mockRequest("m1"));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("forbidden");
  });

  it("returns 403 when caller is a non-owner member and not the creator", async () => {
    mockGetUserId.mockResolvedValue("member-bystander");
    mockCreateServiceClient.mockReturnValue(
      buildClient({
        meal: { id: "m1", household_id: "hh1", added_by: "someone-else" },
        member: { role: "member" },
      }),
    );
    const res = await DELETE(mockRequest("m1"));
    expect(res.status).toBe(403);
  });

  it("allows deletion when caller is the meal creator", async () => {
    mockGetUserId.mockResolvedValue("creator");
    const client = buildClient({
      meal: { id: "m1", household_id: "hh1", added_by: "creator" },
      member: { role: "member" },
    });
    mockCreateServiceClient.mockReturnValue(client);
    const res = await DELETE(mockRequest("m1"));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    // delete must be scoped by household_id as well as id
    const call = (client as any).__deleteCalls.find((c: any) => c.table === "household_meals");
    expect(call).toBeTruthy();
    expect(call.id).toBe("m1");
    expect(call.household_id).toBe("hh1");
  });

  it("allows deletion when caller is a household owner (even if not creator)", async () => {
    mockGetUserId.mockResolvedValue("owner-user");
    mockCreateServiceClient.mockReturnValue(
      buildClient({
        meal: { id: "m1", household_id: "hh1", added_by: "someone-else" },
        member: { role: "owner" },
      }),
    );
    const res = await DELETE(mockRequest("m1"));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it("surfaces delete_failed when the underlying delete errors", async () => {
    mockGetUserId.mockResolvedValue("creator");
    mockCreateServiceClient.mockReturnValue(
      buildClient({
        meal: { id: "m1", household_id: "hh1", added_by: "creator" },
        member: { role: "member" },
        deleteError: { message: "db down" },
      }),
    );
    const res = await DELETE(mockRequest("m1"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("delete_failed");
  });
});
