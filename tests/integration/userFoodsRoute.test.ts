/**
 * Integration tests for /api/user-foods community contribution management.
 *
 * ENG-1250 — users who share barcode corrections need a real withdrawal path.
 * Because this route uses the service-role client, ownership must be enforced
 * in application code as well as in the table's RLS policy.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/server/serverEnv", () => ({
  misconfiguredServiceRoleResponse: vi.fn(() => null),
}));
vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true })),
}));

import { DELETE, GET } from "../../app/api/user-foods/route";
import {
  createSupabaseServiceRoleClient,
  getUserIdFromRequest,
} from "@/lib/supabase/serverAnonClient";

const mockGetUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockCreateServiceClient = createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>;

type FoodRow = {
  id: string;
  submitted_by?: string;
  barcode?: string;
  name?: string;
  brand?: string | null;
  verification_status?: string;
};

function request(url: string, method = "GET"): Request {
  return new Request(url, { method });
}

function buildClient(opts: {
  ownRows?: FoodRow[];
  lookupRow?: FoodRow | null;
  lookupError?: { message: string } | null;
  deleteError?: { message: string } | null;
}) {
  const filters: Array<Record<string, string>> = [];
  const deletes: Array<Record<string, string>> = [];

  function query(op: "select" | "delete") {
    const activeFilters: Record<string, string> = {};
    const chain: any = {
      eq: (col: string, val: string) => {
        activeFilters[col] = val;
        return chain;
      },
      order: () => chain,
      limit: () => {
        filters.push({ ...activeFilters });
        return Promise.resolve({ data: opts.ownRows ?? [], error: null });
      },
      maybeSingle: async () => {
        filters.push({ ...activeFilters });
        return { data: opts.lookupRow ?? null, error: opts.lookupError ?? null };
      },
      then: undefined as any,
    };
    if (op === "delete") {
      chain.then = (resolve: (value: { error: unknown }) => void) => {
        deletes.push({ ...activeFilters });
        resolve({ error: opts.deleteError ?? null });
      };
    }
    return chain;
  }

  return {
    from: vi.fn(() => ({
      select: vi.fn(() => query("select")),
      delete: vi.fn(() => query("delete")),
    })),
    __filters: filters,
    __deletes: deletes,
  };
}

describe("/api/user-foods — contribution withdrawal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserId.mockResolvedValue("user-1");
  });

  it("lists only the caller's own contributions when mine=1", async () => {
    const client = buildClient({
      ownRows: [
        {
          id: "food-1",
          submitted_by: "user-1",
          barcode: "12345678",
          name: "Local yoghurt",
          verification_status: "pending",
        },
      ],
    });
    mockCreateServiceClient.mockReturnValue(client);

    const res = await GET(request("http://localhost/api/user-foods?mine=1"));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      foods: [{ id: "food-1", barcode: "12345678" }],
    });
    expect((client as any).__filters).toContainEqual({ submitted_by: "user-1" });
  });

  it("returns 404 and does not delete when the contribution is not owned by the caller", async () => {
    const client = buildClient({ lookupRow: null });
    mockCreateServiceClient.mockReturnValue(client);

    const res = await DELETE(request("http://localhost/api/user-foods?id=victim-row", "DELETE"));

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ ok: false, error: "not_found" });
    expect((client as any).__filters).toContainEqual({
      id: "victim-row",
      submitted_by: "user-1",
    });
    expect((client as any).__deletes).toHaveLength(0);
  });

  it("deletes with both id and submitted_by filters after ownership lookup succeeds", async () => {
    const client = buildClient({
      lookupRow: { id: "food-1", submitted_by: "user-1" },
    });
    mockCreateServiceClient.mockReturnValue(client);

    const res = await DELETE(request("http://localhost/api/user-foods?id=food-1", "DELETE"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect((client as any).__deletes).toContainEqual({
      id: "food-1",
      submitted_by: "user-1",
    });
  });
});
