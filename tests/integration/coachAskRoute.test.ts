/**
 * @vitest-environment node
 *
 * Integration tests for POST /api/nutrition/coach-ask — the bounded
 * "Ask the coach" chip answers (ENG-1240 / ENG-1292 / ENG-1288).
 *
 * Covers: auth, body validation, the Pro-only AI gate (free/base get
 * the grounded template answer with NO provider call), the kill switch,
 * every AI failure path falling back to the template, the response
 * shape, and the server-side completion event. Sibling of
 * `coachRoute.test.ts` / `digestNarrativeRoute.test.ts`. No live AI calls.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(),
  getUserTier: vi.fn(),
}));
vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, remaining: 59, resetAtMs: 0 })),
}));
vi.mock("@/lib/server/featureFlags", () => ({
  isServerFeatureEnabled: vi.fn(async () => false),
}));
vi.mock("@/lib/observability/captureRouteError", () => ({
  captureRouteError: vi.fn(),
}));
vi.mock("@/lib/server/aiProvider", () => ({
  callAiText: vi.fn(),
  AiBudgetExceededError: class AiBudgetExceededError extends Error {
    retryAfterSec = 3600;
  },
}));
vi.mock("@/lib/analytics/serverTrack", () => ({
  serverTrack: vi.fn(async () => ({ ok: true })),
}));

import { POST } from "../../app/api/nutrition/coach-ask/route";
import { getUserIdFromRequest, getUserTier } from "@/lib/supabase/serverAnonClient";
import { isServerFeatureEnabled } from "@/lib/server/featureFlags";
import { callAiText, AiBudgetExceededError } from "@/lib/server/aiProvider";
import { serverTrack } from "@/lib/analytics/serverTrack";
import { AnalyticsEvents } from "@/lib/analytics/events";

const mockGetUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockGetUserTier = getUserTier as ReturnType<typeof vi.fn>;
const mockFlags = isServerFeatureEnabled as ReturnType<typeof vi.fn>;
const mockAi = callAiText as ReturnType<typeof vi.fn>;
const mockServerTrack = serverTrack as ReturnType<typeof vi.fn>;

function askRequest(body: unknown): Request {
  return new Request("http://localhost/api/nutrition/coach-ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// caloriesRemaining = 600, proteinRemaining = 40 — the grounded number
// set the validator allows the model to use.
const baseBody = {
  chipId: "high_protein_snack",
  dateLabel: "Wednesday, 2 July",
  caloriesLogged: 1400,
  calorieTarget: 2000,
  proteinLogged: 80,
  proteinTarget: 120,
  mealsLoggedCount: 2,
  nextMealSlot: "Dinner",
};

const GROUNDED_AI_ANSWER =
  "You still have 600 kcal and 40g of protein open today. A yogurt-based snack from your saved recipes would close a good chunk of that.";

describe("POST /api/nutrition/coach-ask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserId.mockResolvedValue("user-1");
    // Pro by default — the AI branch is Pro-only (ENG-1292); the tier
    // gate itself is exercised in the dedicated tests below.
    mockGetUserTier.mockResolvedValue("pro");
    // Explicit reset — mockResolvedValue survives clearAllMocks, so a
    // kill-switch test must not leak into its neighbours.
    mockFlags.mockResolvedValue(false);
  });

  it("returns 401 when unauthenticated (no completion event on 4xx)", async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await POST(askRequest(baseBody));
    expect(res.status).toBe(401);
    expect(mockServerTrack).not.toHaveBeenCalled();
  });

  it("returns 400 for an unknown chip id", async () => {
    const res = await POST(askRequest({ ...baseBody, chipId: "write_my_plan" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_chip");
  });

  it("returns 400 when the date label is missing", async () => {
    const res = await POST(askRequest({ ...baseBody, dateLabel: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("missing_date_label");
  });

  it("free tier gets the grounded template answer — provider never invoked (ENG-1292)", async () => {
    mockGetUserTier.mockResolvedValue("free");
    const res = await POST(askRequest(baseBody));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.source).toBe("template");
    expect(typeof json.answer).toBe("string");
    expect(json.answer.length).toBeGreaterThan(0);
    expect(mockAi).not.toHaveBeenCalled();
    expect(mockServerTrack).toHaveBeenCalledWith(
      AnalyticsEvents.coach_ask_api_completed,
      "user-1",
      expect.objectContaining({
        source: "template",
        tier: "free",
        latency_ms: expect.any(Number),
      }),
    );
  });

  it("base tier is gated like free — AI answers are Pro-only (ENG-1292)", async () => {
    mockGetUserTier.mockResolvedValue("base");
    const res = await POST(askRequest(baseBody));
    const json = await res.json();
    expect(json.source).toBe("template");
    expect(mockAi).not.toHaveBeenCalled();
  });

  it("pro tier gets the AI answer when it passes validation (source=ai)", async () => {
    mockAi.mockResolvedValue({
      ok: true,
      text: JSON.stringify({ answer: GROUNDED_AI_ANSWER }),
    });
    const res = await POST(askRequest(baseBody));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.source).toBe("ai");
    expect(json.answer).toContain("600");
    expect(mockAi).toHaveBeenCalledTimes(1);
    expect(mockServerTrack).toHaveBeenCalledWith(
      AnalyticsEvents.coach_ask_api_completed,
      "user-1",
      expect.objectContaining({ source: "ai", tier: "pro" }),
    );
  });

  it("falls back to the template when the AI invents a number (source=template, tracked as error)", async () => {
    mockAi.mockResolvedValue({
      ok: true,
      text: JSON.stringify({
        answer: "Try a 350 kcal snack with 42g of protein to top up your day.",
      }),
    });
    const res = await POST(askRequest(baseBody));
    const json = await res.json();
    expect(json.source).toBe("template");
    expect(json.answer).not.toContain("350");
    // Attempted-but-failed AI is "error" server-side so the fall-back
    // rate stays visible, even though the user sees a template answer.
    expect(mockServerTrack).toHaveBeenCalledWith(
      AnalyticsEvents.coach_ask_api_completed,
      "user-1",
      expect.objectContaining({ source: "error", tier: "pro" }),
    );
  });

  it("falls back to the template when the provider errors", async () => {
    mockAi.mockResolvedValue({
      ok: false,
      error: "ai_timeout",
      status: 504,
      message: "slow",
    });
    const res = await POST(askRequest(baseBody));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.source).toBe("template");
    expect(json.answer.length).toBeGreaterThan(0);
  });

  it("falls back to the template when the AI budget is exceeded", async () => {
    mockAi.mockRejectedValue(new AiBudgetExceededError("cap"));
    const res = await POST(askRequest(baseBody));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.source).toBe("template");
    expect(mockServerTrack).toHaveBeenCalledWith(
      AnalyticsEvents.coach_ask_api_completed,
      "user-1",
      expect.objectContaining({ source: "error" }),
    );
  });

  it("honours the kill switch — no AI call, template answer", async () => {
    mockFlags.mockResolvedValue(true);
    const res = await POST(askRequest(baseBody));
    const json = await res.json();
    expect(json.source).toBe("template");
    expect(mockAi).not.toHaveBeenCalled();
    expect(mockServerTrack).toHaveBeenCalledWith(
      AnalyticsEvents.coach_ask_api_completed,
      "user-1",
      expect.objectContaining({ source: "template", tier: "pro" }),
    );
  });
});
