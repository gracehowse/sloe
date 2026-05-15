/**
 * Shared AI provider helper. Single point of vendor selection across
 * every server route that needs an LLM call.
 *
 * 2026-05-08 (`docs/decisions/2026-05-08-food-correction-verification-pipeline.md`)
 * — Suppr is migrating away from OpenAI to Anthropic Claude as the
 * single AI provider. This helper:
 *   - Prefers Claude when `ANTHROPIC_API_KEY` is set
 *   - Falls back to OpenAI when only `OPENAI_API_KEY` is set
 *   - Returns vendor-neutral `ai_*` error codes so client error maps
 *     don't have to know which vendor answered
 *
 * Once the migration is fully baked (one TestFlight cycle confirms
 * parity for all routes), the OpenAI fallback can be deleted in a
 * single follow-up PR — every call site is one function call away.
 *
 * Two entry points:
 *   - `callAiVision()` — image + text prompt → JSON or text reply
 *   - `callAiText()`   — text prompt only   → JSON or text reply
 *
 * Both accept an `AbortSignal` for sub-platform timeout control.
 */

import { emitAiGeneration } from "../analytics/aiGeneration";
import {
  AiBudgetExceededError,
  commitBudget,
  releaseBudget,
  reserveBudget,
} from "./aiBudget";

// 2026-05-08 hotfix: switched from `claude-sonnet-4-6` (alias) to the
// fully-qualified dated model id. Aliases sometimes 400 via direct
// REST when the account hasn't been provisioned for the latest tier.
// Override per call via `claudeModel` option if a specific dated model
// is needed.
const CLAUDE_MODEL_DEFAULT = "claude-sonnet-4-5-20250929";
const OPENAI_MODEL_DEFAULT = "gpt-4o-mini";
const OPENAI_VISION_MODEL_DEFAULT = "gpt-4o";

export type AiVendor = "claude" | "openai";

export type AiCallOk = {
  ok: true;
  /** Raw model text (caller parses JSON, etc.). For Claude, the
   *  prefilled `{` is already prepended when JSON is requested. */
  text: string;
  vendor: AiVendor;
  modelVersion: string;
};

export type AiCallErr = {
  ok: false;
  /** Vendor-neutral error code. Clients map these to user copy. */
  error:
    | "ai_not_configured"
    | "ai_timeout"
    | "ai_network_error"
    | "ai_http_error"
    | "ai_rate_limited"
    | "ai_internal_error";
  /** HTTP status the route should return to the client. */
  status: number;
  /** User-facing message. */
  message: string;
  /** Vendor that failed (for logging). */
  vendor: AiVendor;
  modelVersion: string;
  /** Upstream HTTP status for ai_http_error / ai_rate_limited (else null). */
  upstreamStatus?: number | null;
};

export type AiCallResult = AiCallOk | AiCallErr;

export type CallAiOptions = {
  /** When true, prefill the assistant message with `{` for Claude so
   *  the response is guaranteed to start with a JSON object. The route
   *  is responsible for `JSON.parse` of the result. Default: false. */
  expectJson?: boolean;
  /** Sampling temperature (default 0.3). */
  temperature?: number;
  /** Max tokens in response (default 1500). */
  maxTokens?: number;
  /** Optional AbortSignal for sub-platform timeout. */
  signal?: AbortSignal;
  /** Override default models. Use sparingly — defaults reflect the
   *  best cost/quality balance for general extraction tasks. */
  claudeModel?: string;
  openaiModel?: string;
  /** Tag for log lines so callers can grep their own traffic. */
  callSite: string;
  /** Supabase user id, for `$ai_generation` PostHog attribution.
   *  When null/undefined the event falls back to the synthetic
   *  `srv:ai-anonymous` distinct id. */
  userId?: string | null;
  /** Optional trace id to group multiple AI calls from one logical
   *  user action (e.g. recipe-import vision retry + text fallback). */
  traceId?: string | null;
};

export type CallAiVisionInput = {
  systemPrompt: string;
  userText: string;
  /** `data:image/jpeg;base64,...` shape. The Claude branch parses
   *  out media_type + data; the OpenAI branch passes the data URL
   *  directly. */
  imageDataUrl: string;
} & CallAiOptions;

export type CallAiTextInput = {
  /** Optional system message — Claude reads this as `system`; OpenAI
   *  prepends it as a `system` role message. */
  systemPrompt?: string;
  userText: string;
} & CallAiOptions;

type ProviderKeys = {
  claudeKey: string | null;
  openaiKey: string | null;
};

function readKeys(): ProviderKeys {
  return {
    claudeKey: process.env.ANTHROPIC_API_KEY?.trim() || null,
    openaiKey: process.env.OPENAI_API_KEY?.trim() || null,
  };
}

function notConfigured(_callSite: string): AiCallErr {
  return {
    ok: false,
    error: "ai_not_configured",
    status: 503,
    message:
      "AI service not configured. Set ANTHROPIC_API_KEY (preferred) or OPENAI_API_KEY.",
    vendor: "claude",
    modelVersion: "n/a",
    upstreamStatus: null,
  };
}

function abortError(
  callSite: string,
  vendor: AiVendor,
  modelVersion: string,
  elapsedMs: number,
): AiCallErr {
  console.warn(
    `[${callSite}] ${vendor} timeout after ${elapsedMs}ms`,
  );
  return {
    ok: false,
    error: "ai_timeout",
    status: 504,
    message: "The AI took too long to respond. Try again in a moment.",
    vendor,
    modelVersion,
    upstreamStatus: null,
  };
}

function networkError(
  callSite: string,
  vendor: AiVendor,
  modelVersion: string,
  err: unknown,
): AiCallErr {
  console.error(`[${callSite}] ${vendor} fetch threw`, err);
  return {
    ok: false,
    error: "ai_network_error",
    status: 502,
    message: "Could not reach the AI service. Please try again.",
    vendor,
    modelVersion,
    upstreamStatus: null,
  };
}

function httpError(
  callSite: string,
  vendor: AiVendor,
  modelVersion: string,
  res: Response,
  bodyPreview: string,
): AiCallErr {
  console.warn(
    `[${callSite}] ${vendor} non-200 status=${res.status} bodyPreview=${bodyPreview.slice(0, 500)}`,
  );
  if (res.status === 429) {
    return {
      ok: false,
      error: "ai_rate_limited",
      status: 429,
      message: "The AI service is busy right now. Try again in a moment.",
      vendor,
      modelVersion,
      upstreamStatus: 429,
    };
  }
  return {
    ok: false,
    error: "ai_http_error",
    status: 502,
    message:
      "The AI service had a problem with that request. Try again in a moment.",
    vendor,
    modelVersion,
    upstreamStatus: res.status,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// PostHog LLM Analytics — fire `$ai_generation` from every branch so the
// dashboard captures token usage, latency, vendor error rate, and model
// distribution. Fire-and-forget; never blocks the response.
// ─────────────────────────────────────────────────────────────────────────

type EmitCtx = {
  vendor: AiVendor;
  model: string;
  callSite: string;
  userId?: string | null;
  traceId?: string | null;
  startedAt: number;
};

function fireAiTelemetry(
  ctx: EmitCtx,
  result: AiCallResult,
  usage?: { inputTokens?: number | null; outputTokens?: number | null },
): void {
  void emitAiGeneration({
    userId: ctx.userId,
    provider: ctx.vendor === "claude" ? "anthropic" : "openai",
    model: ctx.model,
    callSite: ctx.callSite,
    latencyMs: Date.now() - ctx.startedAt,
    httpStatus: result.ok ? 200 : result.upstreamStatus ?? 0,
    isError: !result.ok,
    errorCode: result.ok ? null : result.error,
    inputTokens: usage?.inputTokens ?? null,
    outputTokens: usage?.outputTokens ?? null,
    traceId: ctx.traceId,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Vision
// ─────────────────────────────────────────────────────────────────────────

async function callClaudeVision(
  key: string,
  input: CallAiVisionInput,
): Promise<AiCallResult> {
  const model = input.claudeModel ?? CLAUDE_MODEL_DEFAULT;
  const startedAt = Date.now();
  const ctx: EmitCtx = {
    vendor: "claude",
    model,
    callSite: input.callSite,
    userId: input.userId,
    traceId: input.traceId,
    startedAt,
  };
  // Validate inputs BEFORE reserving budget so a malformed call doesn't
  // pollute the daily counter.
  const dataUrlMatch = /^data:([^;]+);base64,(.*)$/.exec(input.imageDataUrl);
  if (!dataUrlMatch) {
    const err: AiCallErr = {
      ok: false,
      error: "ai_internal_error",
      status: 500,
      message: "Could not prepare the image for the AI service.",
      vendor: "claude",
      modelVersion: model,
      upstreamStatus: null,
    };
    fireAiTelemetry(ctx, err);
    return err;
  }
  const [, mediaType, b64] = dataUrlMatch;
  // Blocker 3 (2026-05-14) — reserve worst-case cost against the daily
  // budget BEFORE the model call. Throws `AiBudgetExceededError` when
  // enforcement is on and a cap has been hit; route handlers catch
  // and return 503.
  const grant = await reserveBudget(
    input.userId ?? null,
    model,
    input.maxTokens ?? 2500,
  );
  if (!grant.ok) {
    throw new AiBudgetExceededError(grant.reason, grant.retryAfterSec);
  }
  const messages: Array<Record<string, unknown>> = [
    {
      role: "user",
      content: [
        { type: "text", text: input.userText },
        {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: b64 },
        },
      ],
    },
  ];
  if (input.expectJson) {
    // Prefill `{` so Claude's response is guaranteed to start with a
    // JSON object — no preamble like "Here's the analysis:".
    messages.push({ role: "assistant", content: "{" });
  }

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      signal: input.signal,
      body: JSON.stringify({
        model,
        max_tokens: input.maxTokens ?? 2500,
        temperature: input.temperature ?? 0.3,
        system: input.systemPrompt,
        messages,
      }),
    });
  } catch (err) {
    void releaseBudget(grant.grantId);
    const elapsedMs = Date.now() - startedAt;
    const ret =
      (err as { name?: string } | null)?.name === "AbortError"
        ? abortError(input.callSite, "claude", model, elapsedMs)
        : networkError(input.callSite, "claude", model, err);
    fireAiTelemetry(ctx, ret);
    return ret;
  }

  if (!res.ok) {
    void releaseBudget(grant.grantId);
    const bodyPreview = await res.text().catch(() => "");
    const ret = httpError(input.callSite, "claude", model, res, bodyPreview);
    fireAiTelemetry(ctx, ret);
    return ret;
  }

  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const inputTokens = data.usage?.input_tokens ?? 0;
  const outputTokens = data.usage?.output_tokens ?? 0;
  void commitBudget(grant.grantId, { inputTokens, outputTokens });
  const text = data.content?.find((b) => b.type === "text")?.text?.trim() ?? "";
  // Re-attach the prefilled `{` so the parser sees a complete object.
  const reply = input.expectJson && !text.startsWith("{") ? `{${text}` : text;
  const ok: AiCallOk = { ok: true, text: reply, vendor: "claude", modelVersion: model };
  fireAiTelemetry(ctx, ok, {
    inputTokens: data.usage?.input_tokens ?? null,
    outputTokens: data.usage?.output_tokens ?? null,
  });
  return ok;
}

async function callOpenAIVision(
  key: string,
  input: CallAiVisionInput,
): Promise<AiCallResult> {
  const model = input.openaiModel ?? OPENAI_VISION_MODEL_DEFAULT;
  const startedAt = Date.now();
  const ctx: EmitCtx = {
    vendor: "openai",
    model,
    callSite: input.callSite,
    userId: input.userId,
    traceId: input.traceId,
    startedAt,
  };
  // Blocker 3 (2026-05-14) — see aiBudget.ts.
  const grant = await reserveBudget(
    input.userId ?? null,
    model,
    input.maxTokens ?? 2500,
  );
  if (!grant.ok) {
    throw new AiBudgetExceededError(grant.reason, grant.retryAfterSec);
  }

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: input.signal,
      body: JSON.stringify({
        model,
        temperature: input.temperature ?? 0.3,
        max_tokens: input.maxTokens ?? 2500,
        ...(input.expectJson ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: input.systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: input.userText },
              { type: "image_url", image_url: { url: input.imageDataUrl } },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    void releaseBudget(grant.grantId);
    const elapsedMs = Date.now() - startedAt;
    const ret =
      (err as { name?: string } | null)?.name === "AbortError"
        ? abortError(input.callSite, "openai", model, elapsedMs)
        : networkError(input.callSite, "openai", model, err);
    fireAiTelemetry(ctx, ret);
    return ret;
  }

  if (!res.ok) {
    void releaseBudget(grant.grantId);
    const bodyPreview = await res.text().catch(() => "");
    const ret = httpError(input.callSite, "openai", model, res, bodyPreview);
    fireAiTelemetry(ctx, ret);
    return ret;
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  void commitBudget(grant.grantId, {
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  });
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  const ok: AiCallOk = { ok: true, text, vendor: "openai", modelVersion: model };
  fireAiTelemetry(ctx, ok, {
    inputTokens: data.usage?.prompt_tokens ?? null,
    outputTokens: data.usage?.completion_tokens ?? null,
  });
  return ok;
}

export async function callAiVision(
  input: CallAiVisionInput,
): Promise<AiCallResult> {
  const { claudeKey, openaiKey } = readKeys();
  if (!claudeKey && !openaiKey) return notConfigured(input.callSite);
  if (claudeKey) return callClaudeVision(claudeKey, input);
  return callOpenAIVision(openaiKey!, input);
}

// ─────────────────────────────────────────────────────────────────────────
// Text
// ─────────────────────────────────────────────────────────────────────────

async function callClaudeText(
  key: string,
  input: CallAiTextInput,
): Promise<AiCallResult> {
  const model = input.claudeModel ?? CLAUDE_MODEL_DEFAULT;
  const startedAt = Date.now();
  const ctx: EmitCtx = {
    vendor: "claude",
    model,
    callSite: input.callSite,
    userId: input.userId,
    traceId: input.traceId,
    startedAt,
  };
  // Blocker 3 (2026-05-14) — see aiBudget.ts.
  const grant = await reserveBudget(
    input.userId ?? null,
    model,
    input.maxTokens ?? 1500,
  );
  if (!grant.ok) {
    throw new AiBudgetExceededError(grant.reason, grant.retryAfterSec);
  }
  const messages: Array<Record<string, unknown>> = [
    { role: "user", content: input.userText },
  ];
  if (input.expectJson) {
    messages.push({ role: "assistant", content: "{" });
  }

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      signal: input.signal,
      body: JSON.stringify({
        model,
        max_tokens: input.maxTokens ?? 1500,
        temperature: input.temperature ?? 0.3,
        ...(input.systemPrompt ? { system: input.systemPrompt } : {}),
        messages,
      }),
    });
  } catch (err) {
    void releaseBudget(grant.grantId);
    const elapsedMs = Date.now() - startedAt;
    const ret =
      (err as { name?: string } | null)?.name === "AbortError"
        ? abortError(input.callSite, "claude", model, elapsedMs)
        : networkError(input.callSite, "claude", model, err);
    fireAiTelemetry(ctx, ret);
    return ret;
  }

  if (!res.ok) {
    void releaseBudget(grant.grantId);
    const bodyPreview = await res.text().catch(() => "");
    const ret = httpError(input.callSite, "claude", model, res, bodyPreview);
    fireAiTelemetry(ctx, ret);
    return ret;
  }

  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  void commitBudget(grant.grantId, {
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  });
  const text = data.content?.find((b) => b.type === "text")?.text?.trim() ?? "";
  const reply = input.expectJson && !text.startsWith("{") ? `{${text}` : text;
  const ok: AiCallOk = { ok: true, text: reply, vendor: "claude", modelVersion: model };
  fireAiTelemetry(ctx, ok, {
    inputTokens: data.usage?.input_tokens ?? null,
    outputTokens: data.usage?.output_tokens ?? null,
  });
  return ok;
}

async function callOpenAIText(
  key: string,
  input: CallAiTextInput,
): Promise<AiCallResult> {
  const model = input.openaiModel ?? OPENAI_MODEL_DEFAULT;
  const startedAt = Date.now();
  const ctx: EmitCtx = {
    vendor: "openai",
    model,
    callSite: input.callSite,
    userId: input.userId,
    traceId: input.traceId,
    startedAt,
  };
  // Blocker 3 (2026-05-14) — see aiBudget.ts.
  const grant = await reserveBudget(
    input.userId ?? null,
    model,
    input.maxTokens ?? 1500,
  );
  if (!grant.ok) {
    throw new AiBudgetExceededError(grant.reason, grant.retryAfterSec);
  }
  const messages: Array<{ role: string; content: string }> = [];
  if (input.systemPrompt) messages.push({ role: "system", content: input.systemPrompt });
  messages.push({ role: "user", content: input.userText });

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: input.signal,
      body: JSON.stringify({
        model,
        temperature: input.temperature ?? 0.3,
        max_tokens: input.maxTokens ?? 1500,
        ...(input.expectJson ? { response_format: { type: "json_object" } } : {}),
        messages,
      }),
    });
  } catch (err) {
    void releaseBudget(grant.grantId);
    const elapsedMs = Date.now() - startedAt;
    const ret =
      (err as { name?: string } | null)?.name === "AbortError"
        ? abortError(input.callSite, "openai", model, elapsedMs)
        : networkError(input.callSite, "openai", model, err);
    fireAiTelemetry(ctx, ret);
    return ret;
  }

  if (!res.ok) {
    void releaseBudget(grant.grantId);
    const bodyPreview = await res.text().catch(() => "");
    const ret = httpError(input.callSite, "openai", model, res, bodyPreview);
    fireAiTelemetry(ctx, ret);
    return ret;
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  void commitBudget(grant.grantId, {
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  });
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  const ok: AiCallOk = { ok: true, text, vendor: "openai", modelVersion: model };
  fireAiTelemetry(ctx, ok, {
    inputTokens: data.usage?.prompt_tokens ?? null,
    outputTokens: data.usage?.completion_tokens ?? null,
  });
  return ok;
}

export async function callAiText(input: CallAiTextInput): Promise<AiCallResult> {
  const { claudeKey, openaiKey } = readKeys();
  if (!claudeKey && !openaiKey) return notConfigured(input.callSite);
  if (claudeKey) return callClaudeText(claudeKey, input);
  return callOpenAIText(openaiKey!, input);
}

// ─────────────────────────────────────────────────────────────────────────
// Utility for routes that need to know which vendor would be used
// (e.g. for log lines or model_version stamping).
// ─────────────────────────────────────────────────────────────────────────

export function activeVendor(): AiVendor | null {
  const { claudeKey, openaiKey } = readKeys();
  if (claudeKey) return "claude";
  if (openaiKey) return "openai";
  return null;
}

// Re-export so route handlers can `import { AiBudgetExceededError }
// from "@/lib/server/aiProvider"` rather than knowing the budget
// module's path. Blocker 3 (2026-05-14).
export { AiBudgetExceededError } from "./aiBudget";
