/**
 * Supadata client — SERVER-ONLY (ENG-994).
 *
 * Supadata is a recipe-import *acquisition* vendor: given a URL it can either
 *   - scrape the web page (`GET /web/scrape`), or
 *   - fetch a video transcript (`GET /youtube/transcript` for YouTube,
 *     `GET /transcript` for the generic / TikTok / Instagram case).
 *
 * This module ONLY acquires raw source content. It never extracts a recipe —
 * the normalised content is handed to the EXISTING extraction/LLM step
 * unchanged (the two-stage architecture from
 * `docs/research/2026-06-08-julienne-strengths.md`: acquisition → normalise →
 * existing extraction).
 *
 * ## SERVER-ONLY — the key must never reach a client bundle
 *
 * The API key is read from `process.env.SUPADATA_KEY` and sent in the
 * `x-api-key` header. There is **no** `NEXT_PUBLIC_` / `EXPO_PUBLIC_` prefix,
 * so Next.js will not inline it into client JS, and the mobile app never sees
 * it — mobile imports go through the web `/api/recipe-import` route, which runs
 * server-side. Do not import this module from any `"use client"` component or
 * from `apps/mobile/`.
 *
 * ## Robustness contract (integration-manager lens)
 *
 * Supadata's free tier is 100 requests/month — it WILL hit limits in
 * production. Every method here:
 *   - bounds the call with a hard timeout (`SUPADATA_TIMEOUT_MS`) via
 *     AbortController so it can never hang the import request;
 *   - retries transient failures (network error / 5xx) with exponential
 *     backoff + jitter, but NEVER retries a 429 / quota / 4xx (retrying a
 *     credit-exhausted request just burns the next month's credits faster);
 *   - returns a typed, vendor-neutral result (`{ ok: false, error, ... }`)
 *     instead of throwing, so the caller can fall back to the existing path
 *     or surface a clear user error — never a hang.
 *
 * The caller (the acquisition adapter) decides the fallback policy; this client
 * only reports what happened.
 */

const SUPADATA_BASE_URL = "https://api.supadata.ai/v1";

/** Hard per-request timeout. A scrape / transcript normally lands in a few
 *  seconds; this is generous headroom while guaranteeing the call never hangs
 *  the import request (which itself runs under the route's 45–50s budget). */
const SUPADATA_TIMEOUT_MS = 15_000;

/** Max attempts for a single Supadata call (1 initial + retries). Acquisition
 *  is on the critical path of the lead viral hook, so we keep retries low to
 *  stay inside the route timeout — 2 attempts total. */
const SUPADATA_MAX_ATTEMPTS = 2;

/** Base backoff between attempts; actual delay adds jitter. */
const SUPADATA_BACKOFF_BASE_MS = 600;

/**
 * Default transcript language. Supadata's API defaulted to `de` (German) in
 * live testing, so we pin `en` explicitly — see ENG-994. Callers can override.
 */
export const SUPADATA_DEFAULT_LANG = "en";

/** Stable, vendor-neutral error codes for callers + logs. Never user-facing. */
export type SupadataErrorCode =
  | "supadata_not_configured"
  | "supadata_rate_limited" // 429 / quota exhausted — do NOT retry
  | "supadata_http_error" // non-2xx (non-429) from Supadata
  | "supadata_network_error" // fetch threw (DNS, connection) or our timeout fired
  | "supadata_empty"; // 2xx but no usable content in the body

export interface SupadataScrapeResult {
  /** The scraped page content, normalised to plain text / markdown. */
  content: string;
  title: string | null;
  description: string | null;
  /** Hero / og image URL if Supadata surfaced one. */
  image: string | null;
  /** URLs found on the page (used by callers that want to follow a link-out). */
  urls: string[];
}

export interface SupadataTranscriptResult {
  /** Concatenated transcript text. */
  content: string;
  /** The language Supadata actually returned (may differ from requested). */
  lang: string | null;
  /** Languages Supadata reports are available for this video. */
  availableLangs: string[];
}

export type SupadataResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: SupadataErrorCode;
      /** Upstream HTTP status when available (for telemetry, never shown to users). */
      status: number | null;
      /** Suggested Retry-After seconds when Supadata returned one (429). */
      retryAfterSec: number | null;
      /** Human-readable detail for logs. Never surfaced to end users. */
      detail: string;
    };

/** True when `SUPADATA_KEY` is present and non-empty. */
export function hasSupadataConfig(): boolean {
  const v = process.env.SUPADATA_KEY;
  return typeof v === "string" && v.trim().length > 0;
}

function backoffDelayMs(attempt: number): number {
  // attempt is 1-based; exponential base with full jitter.
  const exp = SUPADATA_BACKOFF_BASE_MS * 2 ** (attempt - 1);
  return exp + Math.floor(Math.random() * SUPADATA_BACKOFF_BASE_MS);
}

function parseRetryAfter(res: Response): number | null {
  const h = res.headers.get("retry-after");
  if (!h) return null;
  const n = Number.parseInt(h, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  // Clamp to a sane ceiling so a bad header can't make a client wait forever.
  return Math.min(n, 3600);
}

interface RawFetchOk {
  ok: true;
  json: unknown;
  status: number;
}
interface RawFetchErr {
  ok: false;
  error: SupadataErrorCode;
  status: number | null;
  retryAfterSec: number | null;
  detail: string;
}

/** For tests only — inject a stub fetch to avoid live API calls. */
export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<Response>;

/**
 * One Supadata GET with timeout, retries (network / 5xx only), and typed
 * results. `path` is appended to the base URL; `query` is encoded.
 */
async function supadataGet(
  path: string,
  query: Record<string, string>,
  fetchImpl: FetchLike,
): Promise<RawFetchOk | RawFetchErr> {
  const key = process.env.SUPADATA_KEY?.trim();
  if (!key) {
    return {
      ok: false,
      error: "supadata_not_configured",
      status: null,
      retryAfterSec: null,
      detail: "SUPADATA_KEY is not set",
    };
  }

  const qs = new URLSearchParams(query).toString();
  const url = `${SUPADATA_BASE_URL}${path}${qs ? `?${qs}` : ""}`;

  let lastErr: RawFetchErr = {
    ok: false,
    error: "supadata_network_error",
    status: null,
    retryAfterSec: null,
    detail: "no attempt made",
  };

  for (let attempt = 1; attempt <= SUPADATA_MAX_ATTEMPTS; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), SUPADATA_TIMEOUT_MS);
    try {
      const res = await fetchImpl(url, {
        method: "GET",
        headers: { "x-api-key": key, Accept: "application/json" },
        signal: ac.signal,
      });

      // 429 / quota — do NOT retry. Retrying a credit-exhausted request just
      // burns the next reset's budget. Surface immediately so the caller can
      // fall back to the existing path.
      if (res.status === 429) {
        return {
          ok: false,
          error: "supadata_rate_limited",
          status: 429,
          retryAfterSec: parseRetryAfter(res),
          detail: "Supadata returned 429 (rate limited / quota exhausted)",
        };
      }

      // Other 4xx — caller/request problem; retrying won't help.
      if (res.status >= 400 && res.status < 500) {
        return {
          ok: false,
          error: "supadata_http_error",
          status: res.status,
          retryAfterSec: null,
          detail: `Supadata returned ${res.status}`,
        };
      }

      // 5xx — transient; retry with backoff if attempts remain.
      if (res.status >= 500) {
        lastErr = {
          ok: false,
          error: "supadata_http_error",
          status: res.status,
          retryAfterSec: null,
          detail: `Supadata returned ${res.status}`,
        };
        if (attempt < SUPADATA_MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, backoffDelayMs(attempt)));
          continue;
        }
        return lastErr;
      }

      // 2xx — parse JSON.
      let json: unknown;
      try {
        json = await res.json();
      } catch {
        return {
          ok: false,
          error: "supadata_empty",
          status: res.status,
          retryAfterSec: null,
          detail: "Supadata 2xx body was not valid JSON",
        };
      }
      return { ok: true, json, status: res.status };
    } catch (err) {
      // fetch threw (DNS / connection) or our AbortController fired (timeout).
      const isAbort = err instanceof Error && err.name === "AbortError";
      lastErr = {
        ok: false,
        error: "supadata_network_error",
        status: null,
        retryAfterSec: null,
        detail: isAbort ? `Supadata timed out after ${SUPADATA_TIMEOUT_MS}ms` : `Supadata fetch failed: ${String(err)}`,
      };
      if (attempt < SUPADATA_MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, backoffDelayMs(attempt)));
        continue;
      }
      return lastErr;
    } finally {
      clearTimeout(timer);
    }
  }
  return lastErr;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
}

/**
 * Scrape a web page via Supadata `GET /web/scrape`.
 *
 * Returns normalised `{ content, title, description, image, urls }`. The
 * content is whatever Supadata extracted (markdown / text). Recipe extraction
 * happens downstream — this only acquires the raw page content.
 */
export async function scrapeUrl(
  url: string,
  opts: { fetchImpl?: FetchLike } = {},
): Promise<SupadataResult<SupadataScrapeResult>> {
  const fetchImpl = opts.fetchImpl ?? (globalThis.fetch as FetchLike);
  const raw = await supadataGet("/web/scrape", { url }, fetchImpl);
  if (!raw.ok) {
    return {
      ok: false,
      error: raw.error,
      status: raw.status,
      retryAfterSec: raw.retryAfterSec,
      detail: raw.detail,
    };
  }

  const body = (raw.json ?? {}) as Record<string, unknown>;
  // Supadata's scrape shape: { content / markdown, title, description, name, image / ogImage, urls / links }.
  const content = asString(body.content) ?? asString(body.markdown) ?? asString(body.text) ?? "";
  const title = asString(body.title) ?? asString(body.name);
  const description = asString(body.description);
  const image = asString(body.image) ?? asString(body.ogImage) ?? asString(body.thumbnail);
  const urls = asStringArray(body.urls).length > 0 ? asStringArray(body.urls) : asStringArray(body.links);

  if (!content && !title && !description) {
    return {
      ok: false,
      error: "supadata_empty",
      status: raw.status,
      retryAfterSec: null,
      detail: "Supadata scrape returned no usable content",
    };
  }

  return { ok: true, data: { content, title, description, image, urls } };
}

/**
 * Fetch a video transcript via Supadata.
 *
 * Routes to the right endpoint by platform:
 *   - YouTube → `GET /youtube/transcript`
 *   - TikTok / Instagram / other → `GET /transcript`
 *
 * `lang` defaults to `en` (Supadata's API defaulted to `de` in testing —
 * ENG-994). If Supadata reports `availableLangs` that don't include the
 * requested language, the caller can re-request with a value from that list.
 */
export async function fetchTranscript(
  url: string,
  opts: { lang?: string; isYouTube?: boolean; fetchImpl?: FetchLike } = {},
): Promise<SupadataResult<SupadataTranscriptResult>> {
  const fetchImpl = opts.fetchImpl ?? (globalThis.fetch as FetchLike);
  const lang = opts.lang?.trim() || SUPADATA_DEFAULT_LANG;
  const path = opts.isYouTube ? "/youtube/transcript" : "/transcript";
  // `text=true` asks Supadata for a flattened transcript string rather than a
  // segmented array; we also pass `lang` to override the German default.
  const raw = await supadataGet(path, { url, lang, text: "true" }, fetchImpl);
  if (!raw.ok) {
    return {
      ok: false,
      error: raw.error,
      status: raw.status,
      retryAfterSec: raw.retryAfterSec,
      detail: raw.detail,
    };
  }

  const body = (raw.json ?? {}) as Record<string, unknown>;
  // Supadata transcript shape: { content / text / transcript, lang, availableLangs }.
  // `content` may be a string (text=true) or an array of { text } segments.
  let content = "";
  const rawContent = body.content ?? body.text ?? body.transcript;
  if (typeof rawContent === "string") {
    content = rawContent.trim();
  } else if (Array.isArray(rawContent)) {
    content = rawContent
      .map((seg) => {
        if (typeof seg === "string") return seg;
        if (seg && typeof seg === "object" && "text" in seg) return asString((seg as { text: unknown }).text) ?? "";
        return "";
      })
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  const langOut = asString(body.lang);
  const availableLangs = asStringArray(body.availableLangs);

  if (!content) {
    return {
      ok: false,
      error: "supadata_empty",
      status: raw.status,
      retryAfterSec: null,
      detail: "Supadata transcript returned no usable content",
    };
  }

  return { ok: true, data: { content, lang: langOut, availableLangs } };
}
