/**
 * Integration tests for POST /api/custom-foods (ENG-1420).
 *
 * Manual custom-food creation previously wrote directly from the client to
 * Supabase with ZERO plausibility gate. This route moves the write behind a
 * server-enforced Atwater check: an implausible macro set is rejected 422
 * unless the request explicitly acknowledges it, in which case the row is
 * stamped `plausibility_overridden: true`. Because the route uses the
 * service-role client, the gate + ownership must be enforced in application
 * code, so we assert it here rather than trusting RLS alone.
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

import { POST } from "../../app/api/custom-foods/route";
import {
  createSupabaseServiceRoleClient,
  getUserIdFromRequest,
} from "@/lib/supabase/serverAnonClient";
import { rateLimit } from "@/lib/server/rateLimit";

const mockGetUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockCreateServiceClient = createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>;
const mockRateLimit = rateLimit as ReturnType<typeof vi.fn>;

/** Service-role client just rich enough for `insertCustomFoodWithDedupe`:
 *  `.from(t).insert(payload).select("*").single()`. Captures the insert
 *  payload and can be told to return a unique-violation error. */
function buildClient(opts: { insertError?: unknown } = {}) {
  const inserts: Array<Record<string, unknown>> = [];
  return {
    inserts,
    from: vi.fn(() => ({
      insert: (payload: Record<string, unknown>) => {
        inserts.push(payload);
        return {
          select: () => ({
            single: async () =>
              opts.insertError
                ? { data: null, error: opts.insertError }
                : {
                    data: {
                      id: "cf-new",
                      created_at: "2026-07-16T00:00:00Z",
                      updated_at: "2026-07-16T00:00:00Z",
                      ...payload,
                    },
                    error: null,
                  },
          }),
        };
      },
    })),
  };
}

function postReq(body: unknown): Request {
  return new Request("http://localhost/api/custom-foods", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// Plausible: 100 kcal vs implied 4*5 + 4*10 + 9*3 = 87 → ratio 1.15 (in range).
const PLAUSIBLE = { name: "Sane food", calories: 100, protein: 5, carbs: 10, fat: 3 };
// Implausible: 50 kcal vs implied 4*40 + 4*40 + 9*40 = 680 → ratio 0.07 (fails).
const IMPLAUSIBLE = { name: "Weird food", calories: 50, protein: 40, carbs: 40, fat: 40 };

describe("POST /api/custom-foods — plausibility gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserId.mockResolvedValue("user-1");
    mockRateLimit.mockResolvedValue({ ok: true });
  });

  it("401s when unauthenticated", async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await POST(postReq(PLAUSIBLE));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ ok: false, error: "unauthorized" });
  });

  it("429s when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ ok: false, retryAfterSec: 42 });
    const res = await POST(postReq(PLAUSIBLE));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
  });

  it("400s on invalid JSON", async () => {
    const res = await POST(postReq("{not json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, error: "invalid_json" });
  });

  it("400s when the name is missing", async () => {
    const res = await POST(postReq({ calories: 100, protein: 5, carbs: 10, fat: 3 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, error: "missing_fields" });
  });

  it("400s when a macro is not a number", async () => {
    const res = await POST(postReq({ ...PLAUSIBLE, protein: "abc" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, error: "invalid_macros" });
  });

  // (a) implausible macros → 422 without override, and NO insert happens.
  it("422s implausible macros without an override, and never inserts", async () => {
    const client = buildClient();
    mockCreateServiceClient.mockReturnValue(client);
    const res = await POST(postReq(IMPLAUSIBLE));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ ok: false, error: "implausible_macros" });
    expect(client.inserts).toHaveLength(0);
  });

  // (b) implausible macros + acknowledge → succeeds, persists overridden: true.
  it("inserts implausible macros with plausibility_overridden=true when acknowledged", async () => {
    const client = buildClient();
    mockCreateServiceClient.mockReturnValue(client);
    const res = await POST(postReq({ ...IMPLAUSIBLE, acknowledgeImplausible: true }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.food.name).toBe("Weird food");
    expect(client.inserts).toHaveLength(1);
    expect(client.inserts[0]!.plausibility_overridden).toBe(true);
    expect(client.inserts[0]!.user_id).toBe("user-1");
  });

  // (c) plausible macros → succeeds with plausibility_overridden: false.
  it("inserts plausible macros with plausibility_overridden=false (no acknowledge needed)", async () => {
    const client = buildClient();
    mockCreateServiceClient.mockReturnValue(client);
    const res = await POST(postReq(PLAUSIBLE));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(client.inserts).toHaveLength(1);
    expect(client.inserts[0]!.plausibility_overridden).toBe(false);
  });

  it("does not set the override flag when acknowledge is sent for already-plausible macros", async () => {
    const client = buildClient();
    mockCreateServiceClient.mockReturnValue(client);
    const res = await POST(postReq({ ...PLAUSIBLE, acknowledgeImplausible: true }));
    expect(res.status).toBe(200);
    // Acknowledge is a no-op when the gate passes — never a false-positive override.
    expect(client.inserts[0]!.plausibility_overridden).toBe(false);
  });

  it("500s (not 200) when the insert keeps colliding on the unique name", async () => {
    const client = buildClient({ insertError: { code: "23505", message: "duplicate key" } });
    mockCreateServiceClient.mockReturnValue(client);
    const res = await POST(postReq(PLAUSIBLE));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ ok: false, error: "create_failed" });
  });
});
