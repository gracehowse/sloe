/**
 * @vitest-environment node
 *
 * Integration tests for POST /api/nutrition/coach-day-narrative — the
 * grounded "Today's read" for the full Coach screen (ENG-1240 /
 * ENG-1292 / ENG-1288).
 *
 * Covers: auth, body validation, the Pro-only AI gate (free/base get
 * the grounded template narrative with NO provider call), the kill
 * switch, every AI failure path falling back to the template, the
 * response shape, and the server-side completion event. Sibling of
 * `coachRoute.test.ts` / `digestNarrativeRoute.test.ts`. No live AI calls.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(),
  getUserTier: vi.fn(),
}));
vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, remaining: 89, resetAtMs: 0 })),
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

import { POST } from "../../app/api/nutrition/coach-day-narrative/route";
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

function narrativeRequest(body: unknown): Request {
  return new Request("http://localhost/api/nutrition/coach-day-narrative", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// caloriesRemaining = 600, proteinRemaining = 40 — the grounded number
// set the validator allows the model to use.
const baseBody = {
  dateLabel: "Wednesday, 2 July",
  caloriesLogged: 1400,
  calorieTarget: 2000,
  proteinLogged: 80,
  proteinTarget: 120,
  mealsLoggedCount: 2,
  nextMealSlot: "Dinner",
};

const GROUNDED_AI_NARRATIVE =
  "You have 600 kcal left today with 40g of protein still open. Dinner is a good moment to close that gap without crowding the evening.";

describe("POST /api/nutrition/coach-day-narrative", () => {
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
    const res = await POST(narrativeRequest(baseBody));
    expect(res.status).toBe(401);
    expect(mockServerTrack).not.toHaveBeenCalled();
  });

  it("returns 400 when the date label is missing", async () => {
    const res = await POST(narrativeRequest({ ...baseBody, dateLabel: "  " }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("missing_date_label");
  });

  it("free tier gets the grounded template narrative — provider never invoked (ENG-1292)", async () => {
    mockGetUserTier.mockResolvedValue("free");
    const res = await POST(narrativeRequest(baseBody));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.source).toBe("template");
    expect(typeof json.narrative).toBe("string");
    expect(json.narrative.length).toBeGreaterThan(0);
    expect(mockAi).not.toHaveBeenCalled();
    expect(mockServerTrack).toHaveBeenCalledWith(
      AnalyticsEvents.coach_day_narrative_api_completed,
      "user-1",
      expect.objectContaining({
        source: "template",
        tier: "free",
        latency_ms: expect.any(Number),
      }),
    );
  });

  it("base tier is gated like free — the AI narrative is Pro-only (ENG-1292)", async () => {
    mockGetUserTier.mockResolvedValue("base");
    const res = await POST(narrativeRequest(baseBody));
    const json = await res.json();
    expect(json.source).toBe("template");
    expect(mockAi).not.toHaveBeenCalled();
  });

  it("pro tier gets the AI narrative when it passes validation (source=ai)", async () => {
    mockAi.mockResolvedValue({
      ok: true,
      text: JSON.stringify({ narrative: GROUNDED_AI_NARRATIVE }),
    });
    const res = await POST(narrativeRequest(baseBody));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.source).toBe("ai");
    expect(json.narrative).toContain("600");
    expect(mockAi).toHaveBeenCalledTimes(1);
    expect(mockServerTrack).toHaveBeenCalledWith(
      AnalyticsEvents.coach_day_narrative_api_completed,
      "user-1",
      expect.objectContaining({ source: "ai", tier: "pro" }),
    );
  });

  it("falls back to the template when the AI invents a number (source=template, tracked as error)", async () => {
    mockAi.mockResolvedValue({
      ok: true,
      text: JSON.stringify({
        narrative: "You have 750 kcal left today and plenty of room for dinner.",
      }),
    });
    const res = await POST(narrativeRequest(baseBody));
    const json = await res.json();
    expect(json.source).toBe("template");
    expect(json.narrative).not.toContain("750");
    expect(mockServerTrack).toHaveBeenCalledWith(
      AnalyticsEvents.coach_day_narrative_api_completed,
      "user-1",
      expect.objectContaining({ source: "error", tier: "pro" }),
    );
  });

  it("falls back to the template when the provider errors", async () => {
    mockAi.mockResolvedValue({
      ok: false,
      error: "ai_network_error",
      status: 502,
      message: "down",
    });
    const res = await POST(narrativeRequest(baseBody));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.source).toBe("template");
    expect(json.narrative.length).toBeGreaterThan(0);
  });

  it("falls back to the template when the AI budget is exceeded", async () => {
    mockAi.mockRejectedValue(new AiBudgetExceededError("cap"));
    const res = await POST(narrativeRequest(baseBody));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.source).toBe("template");
    expect(mockServerTrack).toHaveBeenCalledWith(
      AnalyticsEvents.coach_day_narrative_api_completed,
      "user-1",
      expect.objectContaining({ source: "error" }),
    );
  });

  it("honours the kill switch — no AI call, template narrative", async () => {
    mockFlags.mockResolvedValue(true);
    const res = await POST(narrativeRequest(baseBody));
    const json = await res.json();
    expect(json.source).toBe("template");
    expect(mockAi).not.toHaveBeenCalled();
    expect(mockServerTrack).toHaveBeenCalledWith(
      AnalyticsEvents.coach_day_narrative_api_completed,
      "user-1",
      expect.objectContaining({ source: "template", tier: "pro" }),
    );
  });
});
