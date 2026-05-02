/**
 * @vitest-environment node
 *
 * Integration tests for POST /api/nutrition/photo-log — the
 * range-first re-architecture (2026-05-01).
 *
 * Covers auth, tier gate, multipart expectation, OpenAI config, and
 * the new behaviour pins:
 *  - Returns the `PhotoLogRangedResponse` shape (items[].calories is a
 *    range, totalKcal is a range, optional addons + notes).
 *  - NEVER blanket-fails on partial / low-confidence items — if the
 *    model returns ANY items, the route returns ok:true. This is the
 *    single biggest reason the old "Couldn't analyse" alert fired.
 *  - 422 `no_food_detected` ONLY when the model returns zero items.
 *  - 502 `model_unparseable` when the JSON body is broken.
 *
 * No live OpenAI calls — the upstream `fetch` is stubbed with
 * `vi.stubGlobal`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(),
  getUserTier: vi.fn(),
}));

vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, retryAfterSec: 0 })),
}));

import { POST } from "../../app/api/nutrition/photo-log/route";
import { getUserIdFromRequest, getUserTier } from "@/lib/supabase/serverAnonClient";

const mockUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockTier = getUserTier as ReturnType<typeof vi.fn>;

type FetchInit = RequestInit & { body?: string };
type StubSpec = { status: number; body: unknown };

/** Helper: stub `globalThis.fetch` to return a single OpenAI-shaped response. */
function stubOpenAi(spec: StubSpec) {
  const fakeResp = new Response(JSON.stringify(spec.body), {
    status: spec.status,
    headers: { "content-type": "application/json" },
  });
  vi.stubGlobal("fetch", vi.fn(async (_url: string, _init?: FetchInit) => fakeResp));
}

/** Helper: model JSON wrapped in OpenAI's chat completion envelope. */
function modelEnvelope(content: string) {
  return {
    choices: [{ message: { content } }],
  };
}

function pngFormBody() {
  const fd = new FormData();
  fd.append(
    "image",
    new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }),
    "meal.png",
  );
  return fd;
}

describe("POST /api/nutrition/photo-log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("OPENAI_API_KEY", "sk-test-openai");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUserId.mockResolvedValue(null);
    const fd = pngFormBody();
    const res = await POST(
      new Request("http://localhost/api/nutrition/photo-log", {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=----x" },
        body: fd,
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 upgrade_required when tier is not Pro", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("free");
    const fd = pngFormBody();
    const res = await POST(
      new Request("http://localhost/api/nutrition/photo-log", {
        method: "POST",
        body: fd,
      }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("upgrade_required");
  });

  it("returns 503 when OPENAI_API_KEY is unset", async () => {
    vi.unstubAllEnvs();
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    const fd = pngFormBody();
    const res = await POST(
      new Request("http://localhost/api/nutrition/photo-log", {
        method: "POST",
        body: fd,
      }),
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("openai_not_configured");
  });

  it("returns 400 expected_multipart when Content-Type is not multipart", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    const res = await POST(
      new Request("http://localhost/api/nutrition/photo-log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("expected_multipart");
  });

  it("returns the range-first shape on a successful charcuterie-style breakdown", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    // Simulates the model output that maps to Grace's screenshot
    // (charcuterie / mezze plate). The route is responsible for
    // surfacing it as `PhotoLogRangedResponse`.
    stubOpenAi({
      status: 200,
      body: modelEnvelope(
        JSON.stringify({
          items: [
            {
              name: "Pita",
              category: "Bread + dips",
              quantityHint: "1 piece",
              calories: { low: 120, high: 150 },
              protein: { low: 4, high: 5 },
              carbs: { low: 24, high: 30 },
              fat: { low: 0, high: 1 },
              confidence: "high",
            },
            {
              name: "Hummus",
              category: "Bread + dips",
              quantityHint: "~2 tbsp",
              calories: { low: 70, high: 100 },
              protein: { low: 2, high: 3 },
              carbs: { low: 6, high: 8 },
              fat: { low: 5, high: 7 },
              confidence: "high",
            },
            {
              name: "Cheese",
              category: "Protein + fats",
              quantityHint: "~40-50g",
              calories: { low: 160, high: 200 },
              protein: { low: 10, high: 13 },
              carbs: 0,
              fat: { low: 13, high: 17 },
              confidence: "medium",
            },
          ],
          addons: [
            {
              name: "Glass of red wine",
              hint: "if you're also having wine",
              calories: { low: 120, high: 150 },
            },
          ],
          notes: "Olive oil glaze on bread likely +30 kcal",
        }),
      ),
    });
    const fd = pngFormBody();
    const res = await POST(
      new Request("http://localhost/api/nutrition/photo-log", {
        method: "POST",
        body: fd,
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.modelVersion).toMatch(/gpt-4o/);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(3);
    // Per-item kcal RANGE.
    expect(body.items[0]).toMatchObject({
      name: "Pita",
      category: "Bread + dips",
      quantityHint: "1 piece",
      calories: { low: 120, high: 150 },
      confidence: "high",
      source: "ai",
    });
    // Computed plate total spans the sum of all items.
    expect(body.totalKcal).toEqual({ low: 350, high: 450 });
    // Addons preserved + total-with-addons computed.
    expect(body.addons).toHaveLength(1);
    expect(body.addons[0]).toMatchObject({
      name: "Glass of red wine",
      hint: "if you're also having wine",
      calories: { low: 120, high: 150 },
    });
    expect(body.totalKcalWithAddons).toEqual({ low: 470, high: 600 });
    // Notes preserved.
    expect(body.notes).toMatch(/olive oil/i);
  });

  it("returns ok:true with whatever items the model gave — never blanket-fails on low confidence", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    // The whole point of the re-architecture: if the model returns
    // even a single low-confidence item, the route MUST surface it
    // with the `low` flag so the user sees the breakdown and can
    // edit. Pre-2026-05-01 this returned 502 verify_failed.
    stubOpenAi({
      status: 200,
      body: modelEnvelope(
        JSON.stringify({
          items: [
            {
              name: "Mystery sauce",
              category: "Extras",
              calories: { low: 50, high: 250 },
              confidence: "low",
            },
          ],
        }),
      ),
    });
    const fd = pngFormBody();
    const res = await POST(
      new Request("http://localhost/api/nutrition/photo-log", {
        method: "POST",
        body: fd,
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.items[0].confidence).toBe("low");
    expect(body.totalKcal).toEqual({ low: 50, high: 250 });
  });

  it("returns 422 no_food_detected ONLY when the model returns zero items", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    stubOpenAi({
      status: 200,
      body: modelEnvelope(JSON.stringify({ items: [] })),
    });
    const fd = pngFormBody();
    const res = await POST(
      new Request("http://localhost/api/nutrition/photo-log", {
        method: "POST",
        body: fd,
      }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("no_food_detected");
  });

  it("returns 502 model_unparseable when the model's JSON is broken", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    stubOpenAi({
      status: 200,
      body: modelEnvelope("not json at all"),
    });
    const fd = pngFormBody();
    const res = await POST(
      new Request("http://localhost/api/nutrition/photo-log", {
        method: "POST",
        body: fd,
      }),
    );
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("model_unparseable");
  });

  it("returns 502 model_unparseable when the JSON has no `items` array", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    stubOpenAi({
      status: 200,
      body: modelEnvelope(JSON.stringify({ totalKcal: 500 })),
    });
    const fd = pngFormBody();
    const res = await POST(
      new Request("http://localhost/api/nutrition/photo-log", {
        method: "POST",
        body: fd,
      }),
    );
    // No `items` array at all triggers the unparseable path; an empty
    // array would trigger no_food_detected. Distinction matters
    // because one indicates a model schema regression and the other
    // is a "no food in photo" user error.
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("model_unparseable");
  });
});
