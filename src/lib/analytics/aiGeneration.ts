/**
 * Server-side emitter for PostHog LLM Analytics `$ai_generation` events.
 *
 * Why this exists separately from `serverTrack`:
 *   - `$ai_generation` is a PostHog *canonical* event name (not a Suppr
 *     custom event), so it deliberately bypasses the `AnalyticsEventName`
 *     enum in `events.ts`. PostHog's LLM Analytics dashboard auto-derives
 *     cost, token totals, and vendor error rates only when the event
 *     carries the canonical `$ai_*` property keys.
 *   - The capture is fire-and-forget — the AI call itself is the
 *     load-bearing side-effect; telemetry MUST NOT block the response.
 *
 * Canonical PostHog LLM Analytics property keys (do not rename):
 *   `$ai_provider`        "anthropic" | "openai"
 *   `$ai_model`           dated model id (e.g. "claude-sonnet-4-5-20250929")
 *   `$ai_input_tokens`    integer
 *   `$ai_output_tokens`   integer
 *   `$ai_latency`         seconds, decimal
 *   `$ai_http_status`     integer (200 on success; upstream status on http_error)
 *   `$ai_is_error`        boolean — true on any non-ok result
 *   `$ai_error`           vendor-neutral error code (see `AiCallErr.error`)
 *   `$ai_trace_id`        UUID, one per logical user action (caller-supplied)
 *   `$ai_span_name`       human-readable label (the `callSite` from
 *                          `CallAiOptions`)
 *
 * Suppr-custom (non-canonical) properties — keep prefixed to avoid
 * collisions with PostHog reserved keys:
 *   `suppr_call_site`     duplicate of $ai_span_name for filtering when
 *                          PostHog dashboards default-hide $ai_* fields
 *
 * No prompts / completions are shipped. Recipe captions can contain
 * personal text and creator handles — sending those to PostHog would be
 * a privacy regression vs the cookie-consent posture on web. If
 * prompt-level debugging is needed later we'll gate it behind a
 * `SUPPR_AI_TRACE_VERBOSE=1` env var.
 */

import { DEFAULT_POSTHOG_HOST } from "./serverTrack";

/** Distinct-id fallback for AI calls that lack a logged-in user
 *  context. PostHog requires SOME distinct_id; using a stable string
 *  groups all anonymous server LLM calls into one synthetic profile,
 *  which keeps the dashboard tidy. */
export const SYSTEM_AI_DISTINCT_ID = "srv:ai-anonymous";

export type AiGenerationProvider = "anthropic" | "openai";

export type EmitAiGenerationInput = {
  /** Caller's userId (Supabase auth uid). Falls back to
   *  `SYSTEM_AI_DISTINCT_ID` when missing. */
  userId?: string | null;
  provider: AiGenerationProvider;
  model: string;
  callSite: string;
  /** Wall-clock latency from request start to response settle, ms. */
  latencyMs: number;
  /** HTTP status returned by the vendor. 200 on success; upstream
   *  status on error. */
  httpStatus: number;
  /** True when the result was not ok. */
  isError: boolean;
  /** Vendor-neutral error code (matches `AiCallErr.error`). Omit on
   *  success. */
  errorCode?: string | null;
  /** Token usage when the vendor returned it. Most error paths have
   *  none — leave undefined. */
  inputTokens?: number | null;
  outputTokens?: number | null;
  /** Optional trace id supplied by the caller to group spans (e.g. one
   *  recipe-import request can fire 2-3 generations across vision +
   *  text retries). */
  traceId?: string | null;
};

export type EmitAiGenerationOptions = {
  fetchImpl?: typeof fetch;
  host?: string;
  projectKey?: string;
};

/**
 * Fire-and-forget POST of a `$ai_generation` event to PostHog's
 * `/capture/` endpoint. Returns a `{ ok, reason? }` object only so
 * tests can assert; production callers throw the promise away with
 * `void emitAiGeneration(...)`.
 */
export async function emitAiGeneration(
  input: EmitAiGenerationInput,
  options: EmitAiGenerationOptions = {},
): Promise<{ ok: boolean; reason?: string }> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return { ok: false, reason: "fetch_unavailable" };
  }
  const projectKey = options.projectKey ?? process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
  if (!projectKey) {
    return { ok: false, reason: "no_project_key" };
  }
  const host = (options.host ?? process.env.POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST).replace(
    /\/+$/,
    "",
  );
  const distinctId =
    typeof input.userId === "string" && input.userId.length > 0
      ? input.userId
      : SYSTEM_AI_DISTINCT_ID;

  const properties: Record<string, unknown> = {
    $ai_provider: input.provider,
    $ai_model: input.model,
    $ai_latency: input.latencyMs / 1000,
    $ai_http_status: input.httpStatus,
    $ai_is_error: input.isError,
    $ai_span_name: input.callSite,
    suppr_call_site: input.callSite,
  };
  if (typeof input.inputTokens === "number") {
    properties.$ai_input_tokens = input.inputTokens;
  }
  if (typeof input.outputTokens === "number") {
    properties.$ai_output_tokens = input.outputTokens;
  }
  if (input.errorCode) {
    properties.$ai_error = input.errorCode;
  }
  if (input.traceId) {
    properties.$ai_trace_id = input.traceId;
  }

  try {
    const res = await fetchImpl(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: projectKey,
        event: "$ai_generation",
        distinct_id: distinctId,
        properties,
        timestamp: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      return { ok: false, reason: `status_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: `fetch_error:${(err as Error)?.message ?? "unknown"}`,
    };
  }
}
