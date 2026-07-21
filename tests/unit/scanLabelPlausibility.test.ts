/**
 * @vitest-environment node
 *
 * Pins the plausibility gate added to /api/nutrition/scan-label (2026-06-11).
 *
 * The route extracts a nutrition label via vision OCR, resolves the macros to
 * per-100g, then runs them through the shared Atwater plausibility check
 * (`checkMacroPlausibility`) BEFORE handing them to the client to pre-fill a
 * form. An OCR mis-read (kcal that doesn't match the macros, an impossible
 * range) must be FLAGGED — `implausible: true` + confidence forced to "low" —
 * never silently accepted. A clean label passes the model's own confidence
 * through unchanged.
 *
 * Boundary deps (auth, rate-limit, image normalisation, feature flags, the AI
 * provider) are mocked so the test is deterministic and never calls a live
 * API. Only the route's resolve + plausibility logic is exercised.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, retryAfterSec: 0 })),
}));
vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(async () => "user-1"),
  // ENG-1487 finding #2: this route now tier-gates. Default Pro so this
  // file's plausibility-gate assertions (unrelated to tier) stay
  // authoritative unmodified — tier-gating itself has dedicated coverage
  // in tests/integration/scanLabelRoute.test.ts.
  getUserTier: vi.fn(async () => "pro"),
}));
vi.mock("@/lib/server/featureFlags", () => ({
  isServerFeatureEnabled: vi.fn(async () => false),
}));
vi.mock("@/lib/server/normalizeImageForAi", () => ({
  normalizeImageForAi: vi.fn(async () => ({
    buffer: Buffer.from("fake-jpeg-bytes"),
    mediaType: "image/jpeg",
    sourceFormat: "image/jpeg",
  })),
}));
vi.mock("@/lib/observability/captureRouteError", () => ({
  captureRouteError: vi.fn(),
}));
vi.mock("@/lib/server/aiProvider", () => ({
  callAiVision: vi.fn(),
  AiBudgetExceededError: class AiBudgetExceededError extends Error {
    retryAfterSec = 3600;
  },
}));

import { callAiVision } from "@/lib/server/aiProvider";
import { POST } from "../../app/api/nutrition/scan-label/route";

const mockCallAiVision = callAiVision as ReturnType<typeof vi.fn>;

function labelRequest(): Request {
  const form = new FormData();
  // A tiny fake image — `normalizeImageForAi` is mocked so the bytes are
  // never actually decoded.
  form.append("image", new File([new Uint8Array([1, 2, 3])], "label.jpg", { type: "image/jpeg" }));
  return new Request("http://localhost/api/nutrition/scan-label", {
    method: "POST",
    body: form,
  });
}

describe("scan-label plausibility gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes a plausible label through with the model's confidence intact", async () => {
    // Per-100g greek yogurt: 59 kcal, 10P 3.6C 0.4F → Atwater ≈ 58.0, plausible.
    mockCallAiVision.mockResolvedValue({
      ok: true,
      vendor: "claude",
      modelVersion: "test",
      text: JSON.stringify({
        name: "Greek yogurt",
        perServing: null,
        per100g: { calories: 59, protein: 10, carbs: 3.6, fat: 0.4, fiberG: 0, sugarG: 3.6, sodiumMg: 36 },
        confidence: "high",
      }),
    });
    const res = await POST(labelRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.calories).toBe(59);
    expect(json.implausible).toBe(false);
    expect(json.plausibilityReason).toBeNull();
    // Model confidence preserved when plausible.
    expect(json.confidence).toBe("high");
  });

  it("flags an implausible label (kcal disagrees with macros) and forces low confidence", async () => {
    // OCR mis-read: claims 600 kcal/100g but 5P 5C 1F → Atwater ≈ 49 kcal.
    // The kcal grossly disagrees with the macros → atwater_mismatch.
    mockCallAiVision.mockResolvedValue({
      ok: true,
      vendor: "claude",
      modelVersion: "test",
      text: JSON.stringify({
        name: "Mystery bar",
        perServing: null,
        per100g: { calories: 600, protein: 5, carbs: 5, fat: 1, fiberG: 0, sugarG: 2, sodiumMg: 80 },
        confidence: "high", // model was (wrongly) confident
      }),
    });
    const res = await POST(labelRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    // Flagged — never silently accepted.
    expect(json.implausible).toBe(true);
    expect(json.plausibilityReason).toBe("atwater_mismatch");
    // Confidence downgraded regardless of the model's self-report.
    expect(json.confidence).toBe("low");
    // The numbers are still returned (the user is the source of truth and may
    // override) — but the form will warn before save.
    expect(json.calories).toBe(600);
  });

  it("flags an out-of-range label (kcal/100g above the ceiling)", async () => {
    mockCallAiVision.mockResolvedValue({
      ok: true,
      vendor: "claude",
      modelVersion: "test",
      text: JSON.stringify({
        name: "Bad scan",
        perServing: null,
        per100g: { calories: 1500, protein: 20, carbs: 20, fat: 30, fiberG: 0, sugarG: null, sodiumMg: null },
        confidence: "medium",
      }),
    });
    const res = await POST(labelRequest());
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.implausible).toBe(true);
    expect(json.plausibilityReason).toBe("out_of_range");
    expect(json.confidence).toBe("low");
  });
});
