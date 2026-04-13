import { describe, it, expect, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => (name.toLowerCase() === "x-forwarded-for" ? "127.0.0.1" : null),
  }),
}));

// Mock auth to return a valid user for non-auth tests
vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: async () => "test-user-id",
  getUserIdFromAuthHeader: async () => "test-user-id",
  createSupabaseAnonClient: () => ({}),
  supabasePublicUrl: () => "https://example.supabase.co",
}));

import { POST } from "../../app/api/nutrition/verify-recipe/route";

describe("POST /api/nutrition/verify-recipe", () => {
  it("returns 400 for invalid JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/nutrition/verify-recipe", {
        method: "POST",
        body: "not-json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when ingredients empty", async () => {
    const res = await POST(
      new Request("http://localhost/api/nutrition/verify-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: [], servings: 1 }),
      }),
    );
    expect(res.status).toBe(400);
    const j = (await res.json()) as { error?: string };
    expect(j.error).toBe("no_ingredients");
  });
});
