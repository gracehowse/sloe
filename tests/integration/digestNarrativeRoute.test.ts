/**
 * @vitest-environment node
 *
 * Integration tests for POST /api/nutrition/digest-narrative — the
 * grounded weekly narrative route.
 *
 * Covers: auth, body validation, the AI narrate path (mocked), and every
 * failure path falling back to the deterministic grounded template — so
 * the surface never goes empty and never shows an ungrounded number. No
 * live AI calls.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(),
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

import { POST } from "../../app/api/nutrition/digest-narrative/route";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { callAiText, AiBudgetExceededError } from "@/lib/server/aiProvider";

const mockGetUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockAi = callAiText as ReturnType<typeof vi.fn>;

function narrativeRequest(body: unknown): Request {
  return new Request("http://localhost/api/nutrition/digest-narrative", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const baseBody = {
  weekLabel: "May 5 – May 11",
  daysLogged: 5,
  avgCalories: 1940,
  targetCalories: 2100,
  proteinOnTargetDays: 3,
  closestDayLabel: "Tuesday",
};

describe("POST /api/nutrition/digest-narrative", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserId.mockResolvedValue("user-1");
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await POST(narrativeRequest(baseBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 when the week label is missing", async () => {
    const res = await POST(narrativeRequest({ ...baseBody, weekLabel: "" }));
    expect(res.status).toBe(400);
  });

  it("returns the AI narrative when it passes validation (source=ai)", async () => {
    mockAi.mockResolvedValue({
      ok: true,
      text: JSON.stringify({
        narrative:
          "Last week you logged 5 of 7 days and averaged 1,940 kcal against your 2,100 target. Tuesday was your steadiest day — a calm, consistent week.",
      }),
    });
    const res = await POST(narrativeRequest(baseBody));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.source).toBe("ai");
    expect(json.narrative).toContain("Tuesday");
  });

  it("falls back to the template when the AI invents a number", async () => {
    mockAi.mockResolvedValue({
      ok: true,
      text: JSON.stringify({
        narrative:
          "Last week you logged 5 of 7 days and torched 3,300 kcal in the gym.",
      }),
    });
    const res = await POST(narrativeRequest(baseBody));
    const json = await res.json();
    expect(json.source).toBe("template");
    // The grounded template references the real numbers, never the invented one.
    expect(json.narrative).toContain("1,940");
    expect(json.narrative).not.toContain("3,300");
  });

  it("falls back to the template when the AI makes a weight-loss claim", async () => {
    mockAi.mockResolvedValue({
      ok: true,
      text: JSON.stringify({
        narrative:
          "Last week you logged 5 of 7 days. Stay under target and you'll lose weight fast.",
      }),
    });
    const res = await POST(narrativeRequest(baseBody));
    const json = await res.json();
    expect(json.source).toBe("template");
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
    expect(json.source).toBe("template");
    expect(json.narrative.length).toBeGreaterThan(0);
  });

  it("falls back to the template when the AI budget is exceeded", async () => {
    mockAi.mockRejectedValue(new AiBudgetExceededError("cap", 3600));
    const res = await POST(narrativeRequest(baseBody));
    const json = await res.json();
    expect(json.source).toBe("template");
  });

  it("weaves the maintenance move into the AI narrative when supplied", async () => {
    mockAi.mockResolvedValue({
      ok: true,
      text: JSON.stringify({
        narrative:
          "Last week you logged 5 of 7 days. Your maintenance estimate rose to about 2,350 kcal because you held your weight while eating a little more than expected.",
      }),
    });
    const res = await POST(
      narrativeRequest({
        ...baseBody,
        maintenanceMove: {
          direction: "rose",
          previousKcal: 2200,
          newKcal: 2350,
          reason: "ate_more_held_weight",
        },
      }),
    );
    const json = await res.json();
    expect(json.source).toBe("ai");
    expect(json.narrative).toContain("2,350");
  });

  it("honours the kill switch — no AI call, template narrative", async () => {
    const { isServerFeatureEnabled } = await import("@/lib/server/featureFlags");
    (isServerFeatureEnabled as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const res = await POST(narrativeRequest(baseBody));
    const json = await res.json();
    expect(json.source).toBe("template");
    expect(mockAi).not.toHaveBeenCalled();
  });

  it("ignores a malformed maintenance move (invalid enum) rather than failing", async () => {
    mockAi.mockResolvedValue({
      ok: true,
      text: JSON.stringify({
        narrative:
          "Last week you logged 5 of 7 days and averaged 1,940 kcal against your 2,100 target. A steady week.",
      }),
    });
    const res = await POST(
      narrativeRequest({
        ...baseBody,
        maintenanceMove: { direction: "sideways", previousKcal: 1, newKcal: 2, reason: "bogus" },
      }),
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    // Malformed move dropped; narrative still produced.
    expect(json.narrative.length).toBeGreaterThan(0);
  });
});
