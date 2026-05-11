/**
 * D2 LLM Analytics (2026-05-11): `emitAiGeneration` posts canonical
 * `$ai_generation` events to PostHog's `/capture/` endpoint with the
 * key set + property shape PostHog's LLM Analytics dashboard expects.
 *
 * Pins the canonical property keys (`$ai_provider`, `$ai_model`,
 * `$ai_input_tokens`, `$ai_output_tokens`, `$ai_latency`,
 * `$ai_http_status`, `$ai_is_error`, `$ai_error`, `$ai_span_name`,
 * `$ai_trace_id`). A future refactor that drops the `$ai_` prefix or
 * stops sending tokens would silently kill the cost/latency views.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  emitAiGeneration,
  SYSTEM_AI_DISTINCT_ID,
} from "@/lib/analytics/aiGeneration";

type CapturedFetch = ReturnType<typeof vi.fn>;

function mockFetch(): CapturedFetch {
  return vi.fn(async () => new Response(null, { status: 200 }));
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test_key";
  delete process.env.POSTHOG_HOST;
});

describe("emitAiGeneration", () => {
  it("no-ops when project key is missing", async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const f = mockFetch();
    const res = await emitAiGeneration(
      {
        provider: "anthropic",
        model: "claude-sonnet-4-5-20250929",
        callSite: "test",
        latencyMs: 100,
        httpStatus: 200,
        isError: false,
      },
      { fetchImpl: f },
    );
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("no_project_key");
    expect(f).not.toHaveBeenCalled();
  });

  it("POSTs to PostHog /capture/ with the canonical $ai_generation event name", async () => {
    const f = mockFetch();
    await emitAiGeneration(
      {
        userId: "user-123",
        provider: "anthropic",
        model: "claude-sonnet-4-5-20250929",
        callSite: "extractSocialRecipe",
        latencyMs: 1500,
        httpStatus: 200,
        isError: false,
        inputTokens: 1200,
        outputTokens: 450,
      },
      { fetchImpl: f },
    );
    expect(f).toHaveBeenCalledOnce();
    const [url, init] = f.mock.calls[0];
    expect(url).toMatch(/\/capture\/$/);
    expect(init?.method).toBe("POST");
    const body = JSON.parse(init?.body as string);
    expect(body.event).toBe("$ai_generation");
    expect(body.api_key).toBe("phc_test_key");
    expect(body.distinct_id).toBe("user-123");
  });

  it("falls back to the synthetic distinct id when userId is missing", async () => {
    const f = mockFetch();
    await emitAiGeneration(
      {
        provider: "openai",
        model: "gpt-4o",
        callSite: "voice-log",
        latencyMs: 800,
        httpStatus: 200,
        isError: false,
      },
      { fetchImpl: f },
    );
    const body = JSON.parse(f.mock.calls[0][1]?.body as string);
    expect(body.distinct_id).toBe(SYSTEM_AI_DISTINCT_ID);
  });

  it("ships the canonical $ai_* property keys, in seconds for latency", async () => {
    const f = mockFetch();
    await emitAiGeneration(
      {
        userId: "user-abc",
        provider: "anthropic",
        model: "claude-sonnet-4-5-20250929",
        callSite: "extractSocialRecipe",
        latencyMs: 2400,
        httpStatus: 200,
        isError: false,
        inputTokens: 1200,
        outputTokens: 450,
        traceId: "trace-uuid-1",
      },
      { fetchImpl: f },
    );
    const body = JSON.parse(f.mock.calls[0][1]?.body as string);
    expect(body.properties.$ai_provider).toBe("anthropic");
    expect(body.properties.$ai_model).toBe("claude-sonnet-4-5-20250929");
    expect(body.properties.$ai_input_tokens).toBe(1200);
    expect(body.properties.$ai_output_tokens).toBe(450);
    expect(body.properties.$ai_latency).toBeCloseTo(2.4, 3);
    expect(body.properties.$ai_http_status).toBe(200);
    expect(body.properties.$ai_is_error).toBe(false);
    expect(body.properties.$ai_span_name).toBe("extractSocialRecipe");
    expect(body.properties.$ai_trace_id).toBe("trace-uuid-1");
    expect(body.properties.suppr_call_site).toBe("extractSocialRecipe");
    // Should not ship error code on success.
    expect(body.properties.$ai_error).toBeUndefined();
  });

  it("ships $ai_error + $ai_is_error true on failure, omits tokens when absent", async () => {
    const f = mockFetch();
    await emitAiGeneration(
      {
        userId: "user-abc",
        provider: "openai",
        model: "gpt-4o-mini",
        callSite: "parseCaption",
        latencyMs: 500,
        httpStatus: 429,
        isError: true,
        errorCode: "ai_rate_limited",
      },
      { fetchImpl: f },
    );
    const body = JSON.parse(f.mock.calls[0][1]?.body as string);
    expect(body.properties.$ai_is_error).toBe(true);
    expect(body.properties.$ai_error).toBe("ai_rate_limited");
    expect(body.properties.$ai_http_status).toBe(429);
    expect(body.properties.$ai_input_tokens).toBeUndefined();
    expect(body.properties.$ai_output_tokens).toBeUndefined();
  });

  it("respects POSTHOG_HOST override and trims trailing slashes", async () => {
    process.env.POSTHOG_HOST = "https://eu.i.posthog.com/";
    const f = mockFetch();
    await emitAiGeneration(
      {
        provider: "anthropic",
        model: "claude-sonnet-4-5-20250929",
        callSite: "test",
        latencyMs: 100,
        httpStatus: 200,
        isError: false,
      },
      { fetchImpl: f },
    );
    const [url] = f.mock.calls[0];
    expect(url).toBe("https://eu.i.posthog.com/capture/");
  });
});
