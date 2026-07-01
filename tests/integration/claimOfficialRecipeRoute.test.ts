/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(async () => "user-1"),
  createService: vi.fn(),
  rateLimit: vi.fn(async () => ({ ok: true, retryAfterSec: 0 })),
}));

vi.mock("@/lib/api/assertOrigin", () => ({ assertOrigin: () => null }));
vi.mock("@/lib/server/serverEnv", () => ({ misconfiguredServiceRoleResponse: () => null }));
vi.mock("@/lib/server/rateLimit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: mocks.getUserId,
  createSupabaseServiceRoleClient: mocks.createService,
}));

import { POST } from "../../app/api/recipes/claim-official/route";

const recipeId = "11111111-1111-4111-8111-111111111111";

type RecipeRow = {
  id: string;
  author_id: string | null;
  source_url: string | null;
  published: boolean | null;
  content_origin: string | null;
  is_verified: boolean | null;
  claimed_by: string | null;
};

function makeReq(body: unknown) {
  return new Request("http://localhost/api/recipes/claim-official", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function createSupabaseMock(opts: {
  recipe?: RecipeRow | null;
  ingredients?: Array<{ id: string; is_verified: boolean | null }>;
  existingClaim?: { id: string } | null;
  insertError?: { code?: string; message: string } | null;
}) {
  const updates: Array<{ table: string; payload: unknown; filters: Record<string, unknown> }> = [];
  const inserts: Array<{ table: string; payload: unknown }> = [];

  class Query {
    filters: Record<string, unknown> = {};
    payload: unknown = null;
    mode: "select" | "update" | "insert" = "select";

    constructor(private table: string) {}

    select() { this.mode = "select"; return this; }
    eq(key: string, value: unknown) { this.filters[key] = value; return this; }
    maybeSingle() {
      if (this.table === "recipes") return Promise.resolve({ data: opts.recipe ?? null, error: null });
      if (this.table === "recipe_claims") return Promise.resolve({ data: opts.existingClaim ?? null, error: null });
      return Promise.resolve({ data: null, error: null });
    }
    update(payload: unknown) { this.mode = "update"; this.payload = payload; return this; }
    insert(payload: unknown) {
      this.mode = "insert";
      this.payload = payload;
      inserts.push({ table: this.table, payload });
      return Promise.resolve({ data: null, error: opts.insertError ?? null });
    }
    then(resolve: (value: unknown) => void) {
      if (this.table === "recipe_ingredients") {
        return Promise.resolve({ data: opts.ingredients ?? [], error: null }).then(resolve);
      }
      if (this.mode === "update") {
        updates.push({ table: this.table, payload: this.payload, filters: this.filters });
        return Promise.resolve({ data: null, error: null }).then(resolve);
      }
      return Promise.resolve({ data: null, error: null }).then(resolve);
    }
  }

  return {
    updates,
    inserts,
    client: { from: (table: string) => new Query(table) },
  };
}

describe("POST /api/recipes/claim-official", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserId.mockResolvedValue("user-1");
    mocks.rateLimit.mockResolvedValue({ ok: true, retryAfterSec: 0 });
  });

  it("requires authentication before service-role work", async () => {
    mocks.getUserId.mockResolvedValueOnce(null);
    const res = await POST(makeReq({ recipeId }));
    expect(res.status).toBe(401);
    expect(mocks.createService).not.toHaveBeenCalled();
  });

  it("404s a recipe that is not owned by the caller", async () => {
    const sb = createSupabaseMock({
      recipe: {
        id: recipeId,
        author_id: "someone-else",
        source_url: "https://example.com/r",
        published: true,
        content_origin: "first_party",
        is_verified: false,
        claimed_by: null,
      },
    });
    mocks.createService.mockReturnValueOnce(sb.client);

    const res = await POST(makeReq({ recipeId }));
    expect(res.status).toBe(404);
    expect(sb.updates).toHaveLength(0);
  });

  it("rejects unverified ingredient sets without writing trust columns", async () => {
    const sb = createSupabaseMock({
      recipe: {
        id: recipeId,
        author_id: "user-1",
        source_url: "https://example.com/r",
        published: true,
        content_origin: "first_party",
        is_verified: false,
        claimed_by: null,
      },
      ingredients: [{ id: "i1", is_verified: true }, { id: "i2", is_verified: false }],
    });
    mocks.createService.mockReturnValueOnce(sb.client);

    const res = await POST(makeReq({ recipeId }));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: "unverified_ingredients" });
    expect(sb.updates).toHaveLength(0);
  });

  it("writes trust columns through service role and inserts one verified audit row", async () => {
    const sb = createSupabaseMock({
      recipe: {
        id: recipeId,
        author_id: "user-1",
        source_url: "https://example.com/r",
        published: true,
        content_origin: "first_party",
        is_verified: false,
        claimed_by: null,
      },
      ingredients: [{ id: "i1", is_verified: true }, { id: "i2", is_verified: true }],
    });
    mocks.createService.mockReturnValueOnce(sb.client);

    const res = await POST(makeReq({ recipeId }));
    expect(res.status).toBe(200);
    expect(sb.updates.find((u) => u.table === "recipes")?.payload).toMatchObject({
      is_verified: true,
      content_origin: "claimed",
      claimed_by: "user-1",
      verified_source: "owner_confirmed",
    });
    expect(sb.inserts.find((i) => i.table === "recipe_claims")?.payload).toMatchObject({
      recipe_id: recipeId,
      claimant_id: "user-1",
      status: "verified",
      source_url: "https://example.com/r",
    });
  });

  it("updates an existing verified claim row instead of duplicating it", async () => {
    const sb = createSupabaseMock({
      recipe: {
        id: recipeId,
        author_id: "user-1",
        source_url: "https://example.com/r",
        published: true,
        content_origin: "first_party",
        is_verified: false,
        claimed_by: null,
      },
      ingredients: [{ id: "i1", is_verified: true }],
      existingClaim: { id: "claim-1" },
    });
    mocks.createService.mockReturnValueOnce(sb.client);

    const res = await POST(makeReq({ recipeId }));
    expect(res.status).toBe(200);
    expect(sb.inserts).toHaveLength(0);
    expect(sb.updates.find((u) => u.table === "recipe_claims")?.filters).toMatchObject({ id: "claim-1" });
  });
});
