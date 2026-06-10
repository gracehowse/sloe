import { vi } from "vitest";
import {
  _resetCountersForTest,
  _resetUpstashStateForTest,
} from "@/lib/server/aiBudget";

/** Keep AI budget counters in-memory — never hit Upstash during fetch stubs. */
export function isolateAiBudgetForIntegrationTest(): void {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  delete (globalThis as { __pm_aiBudgetRedis?: unknown }).__pm_aiBudgetRedis;
  _resetCountersForTest();
  _resetUpstashStateForTest();
}

/** Root `.env.local` is loaded in tests/setup.ts — override to empty. */
export function clearIntegrationAiKeys(): void {
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("OPENAI_API_KEY", "");
}

export function clearIntegrationFatSecretKeys(): void {
  vi.stubEnv("FATSECRET_CLIENT_ID", "");
  vi.stubEnv("FATSECRET_CLIENT_SECRET", "");
  vi.stubEnv("FATSECRET_CONSUMER_KEY", "");
  vi.stubEnv("FATSECRET_CONSUMER_SECRET", "");
}

function vendorFetchStub(
  match: (url: string) => boolean,
  body: unknown,
  status = 200,
): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: RequestInfo) => {
      const u = String(url);
      if (match(u)) {
        return new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        });
      }
      if (u.includes("/capture/")) {
        return new Response(null, { status: 200 });
      }
      throw new Error(`unexpected fetch in integration test: ${u}`);
    }) as typeof fetch,
  );
}

export function stubClaudeMessagesFetch(body: unknown, status = 200): void {
  vendorFetchStub((u) => u.includes("api.anthropic.com"), body, status);
}

export function stubOpenAiChatFetch(body: unknown, status = 200): void {
  vendorFetchStub((u) => u.includes("api.openai.com"), body, status);
}
