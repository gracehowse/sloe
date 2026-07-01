/**
 * @vitest-environment node
 *
 * Integration tests for POST /api/nutrition/refine-log (ENG-974 — "refine by
 * describing"). Covers:
 *  - auth + source validation
 *  - gating parity with the source route (voice = Pro-only; photo = free-taster)
 *  - the PHOTO refine path: refinement text → corrected ranged result, and the
 *    critical trust case — a VAGUE refinement keeps the qualitative framing and
 *    does NOT fabricate a tight number (the prompt tells the model to widen +
 *    drop to low, and the SAME strict validator runs on the reply)
 *  - the VOICE refine path: the model only RE-PARSES foods; nutrition comes from
 *    the verified pipeline (`verifyIngredients`), never the LLM's macros
 *  - the prompt actually carries the original result + the refinement text
 *
 * No live AI calls — the upstream Anthropic `fetch` is stubbed. `verifyIngredients`
 * is mocked so the voice path is deterministic and never hits the network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  clearIntegrationAiKeys,
  isolateAiBudgetForIntegrationTest,
  stubClaudeMessagesFetch,
} from "../helpers/aiRouteTestEnv";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(),
  getUserTier: vi.fn(),
}));

vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, remaining: 99, resetAtMs: 0 })),
}));

// Voice path runs parsed foods through the verified pipeline. Mock it so the
// test is deterministic and asserts that nutrition comes from HERE, not the LLM.
vi.mock("@/lib/nutrition/verifyIngredients", () => ({
  verifyIngredients: vi.fn(async () => ({
    verified: [
      {
        matchedName: "Scrambled eggs",
        resolved: { name: "Scrambled eggs", amount: 2, unit: "large" },
        macros: { calories: 180, protein: 12, carbs: 2, fat: 13 },
        confidence: 0.9,
        source: "USDA",
      },
      {
        matchedName: "Fried egg",
        resolved: { name: "Fried egg", amount: 1, unit: "large" },
        macros: { calories: 90, protein: 6, carbs: 0, fat: 7 },
        confidence: 0.85,
        source: "USDA",
      },
    ],
    avgIngredientConfidence: 0.875,
  })),
}));

import { POST } from "../../app/api/nutrition/refine-log/route";
import { getUserIdFromRequest, getUserTier } from "@/lib/supabase/serverAnonClient";
import { rateLimit } from "@/lib/server/rateLimit";
import { verifyIngredients } from "@/lib/nutrition/verifyIngredients";

const mockUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockTier = getUserTier as ReturnType<typeof vi.fn>;
const mockRateLimit = rateLimit as ReturnType<typeof vi.fn>;
const mockVerify = verifyIngredients as ReturnType<typeof vi.fn>;

/** Wrap a model JSON string in Claude's Messages envelope. The route prefills
 *  `{`, so `text` here is the JSON minus its leading brace. */
function modelEnvelope(content: string) {
  return { content: [{ type: "text", text: content.replace(/^\{/, "") }] };
}

/** Capture the request body sent to Anthropic so we can assert the prompt
 *  carried the original result + the refinement text. */
let lastAnthropicBody: any = null;
function stubClaudeCapturing(modelJson: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: RequestInfo, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("api.anthropic.com")) {
        lastAnthropicBody = init?.body ? JSON.parse(String(init.body)) : null;
        return new Response(JSON.stringify(modelEnvelope(modelJson)), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (u.includes("/capture/")) return new Response(null, { status: 200 });
      throw new Error(`unexpected fetch: ${u}`);
    }) as typeof fetch,
  );
}

const PHOTO_ITEMS = [
  {
    id: "ai-0-rice",
    name: "White rice",
    category: "Carbs",
    quantityHint: "~150g",
    calories: { low: 190, high: 210 },
    protein: { low: 3, high: 4 },
    carbs: { low: 42, high: 46 },
    fat: { low: 0, high: 1 },
    confidence: "high",
    source: "ai",
  },
  {
    id: "ai-1-chicken",
    name: "Grilled chicken",
    category: "Protein",
    quantityHint: "~120g",
    calories: { low: 190, high: 210 },
    protein: { low: 35, high: 38 },
    carbs: { low: 0, high: 0 },
    fat: { low: 4, high: 6 },
    confidence: "high",
    source: "ai",
  },
];

function photoReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/nutrition/refine-log", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/nutrition/refine-log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isolateAiBudgetForIntegrationTest();
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    mockRateLimit.mockImplementation(async () => ({ ok: true, remaining: 99, resetAtMs: 0 }));
    lastAnthropicBody = null;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns 400 for an invalid source", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    const res = await POST(photoReq({ source: "typing", refinementText: "x", items: [] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_source");
  });

  it("returns 401 when unauthenticated", async () => {
    mockUserId.mockResolvedValue(null);
    const res = await POST(
      photoReq({ source: "photo", refinementText: "no rice", round: 1, items: PHOTO_ITEMS }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when the refinement text is empty", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    const res = await POST(
      photoReq({ source: "photo", refinementText: "   ", round: 1, items: PHOTO_ITEMS }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("missing_refinement");
  });

  it("voice refine is Pro-only (403 for non-Pro)", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("free");
    const res = await POST(
      photoReq({ source: "voice", refinementText: "add a fried egg", round: 1, items: [] }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("upgrade_required");
  });

  it("photo refine: applies the correction (remove rice) and returns the corrected ranged result", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    // Model drops the rice item per "no rice".
    stubClaudeCapturing(
      JSON.stringify({
        items: [
          {
            name: "Grilled chicken",
            category: "Protein",
            calories: { low: 190, high: 210 },
            protein: { low: 35, high: 38 },
            carbs: { low: 0, high: 0 },
            fat: { low: 4, high: 6 },
            confidence: "high",
          },
        ],
        notes: "Removed the rice.",
      }),
    );
    const res = await POST(
      photoReq({ source: "photo", refinementText: "no rice", round: 2, items: PHOTO_ITEMS }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.round).toBe(2);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe("Grilled chicken");

    // The prompt MUST carry the original items + the refinement text so the
    // model has the current result to correct.
    const promptText = JSON.stringify(lastAnthropicBody);
    expect(promptText).toContain("White rice");
    expect(promptText).toContain("Grilled chicken");
    expect(promptText).toContain("no rice");
  });

  it("photo refine (AMBIGUOUS): a vague 'make it bigger' keeps qualitative framing — widened range, low confidence, no fabricated tight number", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    // A well-behaved model responds to a vague correction by WIDENING the range
    // and dropping to low confidence — never a confident tight number. The route
    // preserves this honestly (the same validator derives `low` from spread when
    // the model omits/contradicts it).
    stubClaudeCapturing(
      JSON.stringify({
        items: [
          {
            name: "White rice",
            category: "Carbs",
            calories: { low: 190, high: 320 },
            confidence: "low",
          },
          {
            name: "Grilled chicken",
            category: "Protein",
            calories: { low: 190, high: 210 },
            confidence: "high",
          },
        ],
        notes: "You said bigger but not how much — widened the rice estimate.",
      }),
    );
    const res = await POST(
      photoReq({
        source: "photo",
        refinementText: "make the rice bigger",
        round: 1,
        items: PHOTO_ITEMS,
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const rice = body.items.find((i: { name: string }) => i.name === "White rice");
    expect(rice.confidence).toBe("low");
    // The range stays a RANGE (low < high) — not collapsed to a fabricated point.
    expect(rice.calories.high).toBeGreaterThan(rice.calories.low);
    // Caveat text is preserved so the UI can show the uncertainty.
    expect(typeof body.notes).toBe("string");
  });

  it("photo refine: a correction that empties the plate returns 422 (kept-result signal)", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    stubClaudeMessagesFetch(modelEnvelope(JSON.stringify({ items: [] })));
    const res = await POST(
      photoReq({ source: "photo", refinementText: "remove everything", round: 1, items: PHOTO_ITEMS }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("no_items_after_refine");
  });

  it("photo refine: malformed model reply → 502 model_unparseable (no bad numbers leak)", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    stubClaudeMessagesFetch(modelEnvelope("this is not json"));
    const res = await POST(
      photoReq({ source: "photo", refinementText: "no rice", round: 1, items: PHOTO_ITEMS }),
    );
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("model_unparseable");
  });

  it("voice refine: nutrition comes from the VERIFIED pipeline, not the model's numbers", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    // Model returns ONLY foods (name/amount/unit) — deliberately no macros. Even
    // if it tried to include kcal, the route ignores them and calls verify.
    stubClaudeCapturing(
      JSON.stringify({
        items: [
          { name: "scrambled eggs", amount: "2", unit: "large" },
          { name: "fried egg", amount: "1", unit: "large" },
        ],
      }),
    );
    const res = await POST(
      photoReq({
        source: "voice",
        refinementText: "add a fried egg",
        round: 2,
        transcript: "two scrambled eggs",
        items: [
          { name: "Scrambled eggs", quantity: "2 large", calories: 180, protein: 12, carbs: 2, fat: 13 },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.source).toBe("voice");
    // Verify pipeline was invoked with the re-parsed foods.
    expect(mockVerify).toHaveBeenCalledTimes(1);
    const call = mockVerify.mock.calls[0][0];
    expect(call.ingredients).toEqual([
      { name: "scrambled eggs", amount: "2", unit: "large" },
      { name: "fried egg", amount: "1", unit: "large" },
    ]);
    // Totals come from the mocked verified macros (180+90 kcal), NOT the model.
    expect(body.totalCalories).toBe(270);
    expect(body.items).toHaveLength(2);
    // Prompt carried the current foods + the correction.
    const promptText = JSON.stringify(lastAnthropicBody);
    expect(promptText).toContain("Scrambled eggs");
    expect(promptText).toContain("add a fried egg");
  });

  it("voice refine: a correction that leaves no foods → 422", async () => {
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    stubClaudeMessagesFetch(modelEnvelope(JSON.stringify({ items: [] })));
    const res = await POST(
      photoReq({
        source: "voice",
        refinementText: "remove everything",
        round: 1,
        items: [{ name: "Eggs", calories: 180, protein: 12, carbs: 2, fat: 13 }],
      }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("no_items_after_refine");
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("returns 503 ai_not_configured when no AI key is set (after the gate passes)", async () => {
    vi.unstubAllEnvs();
    isolateAiBudgetForIntegrationTest();
    clearIntegrationAiKeys();
    mockUserId.mockResolvedValue("u1");
    mockTier.mockResolvedValue("pro");
    const res = await POST(
      photoReq({ source: "photo", refinementText: "no rice", round: 1, items: PHOTO_ITEMS }),
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("ai_not_configured");
  });
});
