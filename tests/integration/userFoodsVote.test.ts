/**
 * Integration tests for POST /api/user-foods/vote.
 *
 * Covers H2 (2026-04-21): promotion from `pending` to `verified` must
 * use COUNT(DISTINCT voter_id), never raw row count. The route loads
 * the current verification_status first and only flips `pending` →
 * `verified` when ≥3 distinct upvoters exist.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/server/serverEnv", () => ({
  misconfiguredServiceRoleResponse: vi.fn(() => null),
}));
vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, retryAfterSec: 0 })),
}));

import { POST } from "../../app/api/user-foods/vote/route";
import {
  getUserIdFromRequest,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/serverAnonClient";

const mockGetUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockClient = createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>;

const ORIG_APP_URL = process.env.NEXT_PUBLIC_APP_URL;
beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost";
});
afterEach(() => {
  if (ORIG_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = ORIG_APP_URL;
});

function req(body: unknown): Request {
  // No Origin header → assertOrigin no-ops (native/test path).
  return new Request("http://localhost/api/user-foods/vote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

type VoteRow = { voter_id: string; vote: number };

function buildClient(opts: {
  voteRows: VoteRow[];
  currentStatus: "pending" | "verified" | "rejected";
  upsertError?: { message: string } | null;
  capturedUpdate?: Record<string, unknown>;
}) {
  const update = vi.fn((patch: Record<string, unknown>) => {
    opts.capturedUpdate && Object.assign(opts.capturedUpdate, patch);
    return { eq: vi.fn(() => Promise.resolve({ data: null, error: null })) };
  });

  return {
    from: vi.fn((table: string) => {
      if (table === "user_food_votes") {
        return {
          upsert: vi.fn(() =>
            Promise.resolve({ error: opts.upsertError ?? null }),
          ),
          select: vi.fn(() => ({
            eq: vi.fn(() =>
              Promise.resolve({ data: opts.voteRows, error: null }),
            ),
          })),
        };
      }
      if (table === "user_foods") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({
                  data: { verification_status: opts.currentStatus },
                  error: null,
                }),
              ),
            })),
          })),
          update,
        };
      }
      return {};
    }),
  };
}

describe("POST /api/user-foods/vote — Sybil-resistant promotion (H2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserId.mockResolvedValue("user-a");
  });

  it("does NOT promote when there are only 2 distinct upvoters", async () => {
    const captured: Record<string, unknown> = {};
    mockClient.mockReturnValue(
      buildClient({
        voteRows: [
          { voter_id: "a", vote: 1 },
          { voter_id: "b", vote: 1 },
        ],
        currentStatus: "pending",
        capturedUpdate: captured,
      }) as never,
    );

    const res = await POST(req({ userFoodId: "food-1", vote: 1 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.promoted).toBe(false);
    expect(body.distinctUpvoters).toBe(2);
    expect(captured.verification_status).toBeUndefined();
  });

  it("promotes when there are ≥3 DISTINCT upvoters", async () => {
    const captured: Record<string, unknown> = {};
    mockClient.mockReturnValue(
      buildClient({
        voteRows: [
          { voter_id: "a", vote: 1 },
          { voter_id: "b", vote: 1 },
          { voter_id: "c", vote: 1 },
        ],
        currentStatus: "pending",
        capturedUpdate: captured,
      }) as never,
    );

    const res = await POST(req({ userFoodId: "food-1", vote: 1 }));
    const body = await res.json();
    expect(body.promoted).toBe(true);
    expect(body.distinctUpvoters).toBe(3);
    expect(captured.verification_status).toBe("verified");
    expect(typeof captured.verified_at).toBe("string");
  });

  it("does NOT promote if current status is not `pending` (verified stays verified; rejected stays rejected)", async () => {
    const captured: Record<string, unknown> = {};
    mockClient.mockReturnValue(
      buildClient({
        voteRows: [
          { voter_id: "a", vote: 1 },
          { voter_id: "b", vote: 1 },
          { voter_id: "c", vote: 1 },
        ],
        currentStatus: "rejected",
        capturedUpdate: captured,
      }) as never,
    );

    const res = await POST(req({ userFoodId: "food-1", vote: 1 }));
    const body = await res.json();
    expect(body.promoted).toBe(false);
    expect(captured.verification_status).toBeUndefined();
  });

  it("excludes downvote rows from the distinct-upvoter count", async () => {
    const captured: Record<string, unknown> = {};
    mockClient.mockReturnValue(
      buildClient({
        voteRows: [
          { voter_id: "a", vote: 1 },
          { voter_id: "b", vote: 1 },
          { voter_id: "c", vote: -1 }, // downvote — not a distinct upvoter
          { voter_id: "d", vote: -1 },
        ],
        currentStatus: "pending",
        capturedUpdate: captured,
      }) as never,
    );
    const res = await POST(req({ userFoodId: "food-1", vote: 1 }));
    const body = await res.json();
    expect(body.distinctUpvoters).toBe(2);
    expect(body.downvotes).toBe(2);
    expect(body.promoted).toBe(false);
  });

  it("rejects unauthenticated callers with 401", async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await POST(req({ userFoodId: "food-1", vote: 1 }));
    expect(res.status).toBe(401);
  });

  it("rejects invalid vote values with 400", async () => {
    mockClient.mockReturnValue(
      buildClient({ voteRows: [], currentStatus: "pending" }) as never,
    );
    const res = await POST(req({ userFoodId: "food-1", vote: 5 }));
    expect(res.status).toBe(400);
  });
});
