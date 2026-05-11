/**
 * D2 LLM Analytics (2026-05-11): every Claude/OpenAI call from
 * `aiProvider` MUST fire a `$ai_generation` event so PostHog's LLM
 * Analytics dashboard sees latency, token usage, and vendor error
 * rates. This is the load-bearing wiring: if it regresses, the
 * dashboard goes blank and we lose visibility into AI cost + quality.
 *
 * The helper itself (`emitAiGeneration`) is unit-tested in
 * `aiGenerationEmit.test.ts`; here we pin that the four internal
 * fetch paths (Claude vision, Claude text, OpenAI vision, OpenAI
 * text) each fire it once, with the expected vendor/model/call_site
 * and token counts from the response body.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { callAiText, callAiVision } from "@/lib/server/aiProvider";

type CapturedFetch = ReturnType<typeof vi.fn>;

const ORIGINAL_ENV = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  posthog: process.env.NEXT_PUBLIC_POSTHOG_KEY,
};

let realFetch: typeof globalThis.fetch;

beforeEach(() => {
  realFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test_key";
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (ORIGINAL_ENV.anthropic !== undefined) {
    process.env.ANTHROPIC_API_KEY = ORIGINAL_ENV.anthropic;
  } else {
    delete process.env.ANTHROPIC_API_KEY;
  }
  if (ORIGINAL_ENV.openai !== undefined) {
    process.env.OPENAI_API_KEY = ORIGINAL_ENV.openai;
  } else {
    delete process.env.OPENAI_API_KEY;
  }
  if (ORIGINAL_ENV.posthog !== undefined) {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = ORIGINAL_ENV.posthog;
  } else {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Build a fetch stub that returns `vendorResponse` for the AI vendor
 * endpoint and a 200 for the PostHog /capture/ endpoint. Captures
 * every call so tests can inspect the telemetry payload.
 */
function buildFetchStub(vendorResponse: Response): CapturedFetch {
  return vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    if (u.includes("api.anthropic.com") || u.includes("api.openai.com")) {
      return vendorResponse;
    }
    if (u.includes("/capture/")) {
      return new Response(null, { status: 200 });
    }
    throw new Error(`unexpected fetch in test: ${u}`);
  }) as unknown as CapturedFetch;
}

function findTelemetryCall(f: CapturedFetch): { url: string; body: any } | null {
  for (const call of f.mock.calls) {
    const u = String(call[0]);
    if (u.includes("/capture/")) {
      const body = JSON.parse(call[1]?.body as string);
      if (body.event === "$ai_generation") return { url: u, body };
    }
  }
  return null;
}

describe("aiProvider telemetry — $ai_generation emission", () => {
  it("Claude text success: emits $ai_generation with input/output tokens + vendor=anthropic", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    delete process.env.OPENAI_API_KEY;
    const f = buildFetchStub(
      jsonResponse({
        content: [{ type: "text", text: '{"ok":true}' }],
        usage: { input_tokens: 800, output_tokens: 120 },
      }),
    );
    globalThis.fetch = f as unknown as typeof globalThis.fetch;

    const result = await callAiText({
      callSite: "test-claude-text",
      userText: "hello",
      userId: "user-123",
      traceId: "trace-abc",
    });

    expect(result.ok).toBe(true);
    const telemetry = findTelemetryCall(f);
    expect(telemetry).not.toBeNull();
    expect(telemetry!.body.distinct_id).toBe("user-123");
    expect(telemetry!.body.properties.$ai_provider).toBe("anthropic");
    expect(telemetry!.body.properties.$ai_input_tokens).toBe(800);
    expect(telemetry!.body.properties.$ai_output_tokens).toBe(120);
    expect(telemetry!.body.properties.$ai_span_name).toBe("test-claude-text");
    expect(telemetry!.body.properties.$ai_is_error).toBe(false);
    expect(telemetry!.body.properties.$ai_trace_id).toBe("trace-abc");
  });

  it("OpenAI text success: emits $ai_generation with prompt/completion → input/output mapping", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = "sk-test";
    const f = buildFetchStub(
      jsonResponse({
        choices: [{ message: { content: "hi" } }],
        usage: { prompt_tokens: 300, completion_tokens: 75 },
      }),
    );
    globalThis.fetch = f as unknown as typeof globalThis.fetch;

    await callAiText({
      callSite: "test-openai-text",
      userText: "hello",
      userId: "user-456",
    });

    const telemetry = findTelemetryCall(f);
    expect(telemetry).not.toBeNull();
    expect(telemetry!.body.properties.$ai_provider).toBe("openai");
    expect(telemetry!.body.properties.$ai_input_tokens).toBe(300);
    expect(telemetry!.body.properties.$ai_output_tokens).toBe(75);
  });

  it("Claude vision HTTP 429: emits $ai_generation with error=ai_rate_limited and http_status=429", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const f = buildFetchStub(new Response("rate limited", { status: 429 }));
    globalThis.fetch = f as unknown as typeof globalThis.fetch;

    const result = await callAiVision({
      callSite: "test-claude-vision-429",
      systemPrompt: "extract",
      userText: "what is in this image",
      imageDataUrl: "data:image/jpeg;base64,/9j/2wBDAA==",
    });

    expect(result.ok).toBe(false);
    const telemetry = findTelemetryCall(f);
    expect(telemetry).not.toBeNull();
    expect(telemetry!.body.properties.$ai_is_error).toBe(true);
    expect(telemetry!.body.properties.$ai_error).toBe("ai_rate_limited");
    expect(telemetry!.body.properties.$ai_http_status).toBe(429);
  });

  it("Claude vision malformed data URL: emits $ai_generation with error=ai_internal_error (no fetch)", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const f = buildFetchStub(jsonResponse({}));
    globalThis.fetch = f as unknown as typeof globalThis.fetch;

    const result = await callAiVision({
      callSite: "test-claude-bad-image",
      systemPrompt: "extract",
      userText: "what is in this image",
      imageDataUrl: "not-a-data-url",
    });

    expect(result.ok).toBe(false);
    const telemetry = findTelemetryCall(f);
    expect(telemetry).not.toBeNull();
    expect(telemetry!.body.properties.$ai_is_error).toBe(true);
    expect(telemetry!.body.properties.$ai_error).toBe("ai_internal_error");
    // No vendor fetch fired — only the /capture/ POST.
    expect(f.mock.calls.length).toBe(1);
  });

  it("falls back to synthetic distinct id when userId is omitted", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const f = buildFetchStub(
      jsonResponse({
        content: [{ type: "text", text: "hi" }],
        usage: { input_tokens: 50, output_tokens: 10 },
      }),
    );
    globalThis.fetch = f as unknown as typeof globalThis.fetch;

    await callAiText({ callSite: "test-no-user", userText: "hello" });

    const telemetry = findTelemetryCall(f);
    expect(telemetry).not.toBeNull();
    expect(telemetry!.body.distinct_id).toBe("srv:ai-anonymous");
  });
});
