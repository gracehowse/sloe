/**
 * Central import-error copy + sanitiser (audit I01 + I07, 2026-05-05).
 *
 * Single source of truth for what the user sees when a recipe import
 * goes wrong. Replaces the per-surface ad-hoc copy that drifted across
 * mobile + web, and the per-route raw-error leaks that surfaced
 * vendor names / Postgrest messages / HTTP status codes to users.
 *
 * **Server contract:** every recipe-import API response ships
 * `{ ok: false, error: <stable_code>, message: <user-facing> }`. Only
 * `message` is meant for the UI; `error` is the stable token clients
 * use for analytics / state branching.
 *
 * **Client contract:** mobile + web both render `response.message`
 * with `userFacingImportError(response)` as a defensive fallback (e.g.
 * for a thrown Error from a fetch wrapper, where we never had a
 * server `message` to begin with).
 *
 * **Sanitiser:** `sanitiseImportErrorMessage` is a defense-in-depth
 * regex pass. If a future code path slips a vendor/Postgrest string
 * past the mapper, the sanitiser still catches it before it reaches
 * the UI. Tested via `tests/unit/importErrorCopy.test.ts`.
 */

/**
 * Stable error codes used across the recipe-import API surface. Adding
 * a new code: append here, add a copy entry to `IMPORT_ERROR_COPY`,
 * and use it in the route. Removing a code: keep the copy entry until
 * all clients on the version-skew window have been redeployed.
 */
export type ImportErrorCode =
  // Auth + access
  | "unauthorized"
  | "pro_required"
  // Input shape
  | "invalid_url"
  | "invalid_json"
  | "invalid_body"
  | "expected_multipart"
  | "missing_image"
  | "file_too_large"
  // Rate limits + AI
  | "rate_limited"
  | "ai_rate_limited"
  | "ai_unavailable"
  | "ai_request_failed"
  | "openai_not_configured"
  | "openai_http_error"
  | "unparseable_model_output"
  // Resolved-URL / network
  | "fetch_failed"
  | "redirect_blocked"
  | "url_not_allowed"
  | "timeout"
  // Caption / social
  | "caption_too_short"
  | "social_no_recipe"
  | "no_recipe_extracted"
  // Persistence
  | "save_failed"
  | "rls_denied"
  | "duplicate_recipe"
  // Generic fallthroughs
  | "import_failed"
  | "network_error"
  | "unknown";

/**
 * User-facing copy keyed by stable error code. Tone: calm,
 * actionable, no jargon. Never name a vendor (OpenAI, Supabase,
 * FatSecret, Instagram, TikTok). Never include an HTTP status or a
 * stack snippet. Never include `error.message` from a Postgres /
 * Supabase / OpenAI error verbatim.
 */
export const IMPORT_ERROR_COPY: Record<ImportErrorCode, string> = {
  unauthorized: "Sign in to import recipes.",
  pro_required: "Recipe imports from photos are a Pro feature.",
  invalid_url: "That link isn't a valid URL. Check it and try again.",
  invalid_json: "We couldn't read the request. Try again.",
  invalid_body: "We couldn't read what you sent. Try again.",
  expected_multipart: "We couldn't read the uploaded file. Try again.",
  missing_image: "Add a photo to import from.",
  file_too_large: "That image is too large. Try one under 6MB.",
  rate_limited: "You're importing a lot of recipes. Try again shortly.",
  ai_rate_limited: "Our import service is busy right now. Try again in a moment.",
  ai_unavailable: "Our import service is temporarily unavailable. Try again shortly.",
  ai_request_failed: "We couldn't process that import. Try again, or paste the recipe manually.",
  openai_not_configured: "Image import isn't available right now. Try the URL or caption import instead.",
  openai_http_error: "We couldn't read that image. Try again, or paste the recipe text manually.",
  unparseable_model_output: "We couldn't read that image. Try a clearer photo, or paste the recipe text manually.",
  fetch_failed: "We couldn't reach that page. Check the URL or try again later.",
  redirect_blocked: "That link redirects somewhere we don't support. Try a different source.",
  url_not_allowed: "We don't support that URL. Try a different source.",
  timeout: "The page took too long to load. The site may be slow or blocking imports — try a different source.",
  caption_too_short: "We need at least a short caption to extract a recipe. If the post is video-only, try sharing one with a written caption.",
  social_no_recipe: "We couldn't find a recipe in that post. Try screenshotting the recipe and using image import.",
  no_recipe_extracted: "We couldn't extract a recipe from this. Try a different source, or paste it manually.",
  save_failed: "We couldn't save the recipe. Try again.",
  rls_denied: "You don't have permission to save that recipe.",
  duplicate_recipe: "You've already saved this recipe.",
  import_failed: "We couldn't import that recipe. Try again, or paste it manually.",
  network_error: "Network error. Check your connection and try again.",
  unknown: "Something went wrong. Try again.",
};

/**
 * Patterns that indicate a vendor name, raw HTTP status, or
 * Postgrest leak slipped through the mapper. Each is replaced with a
 * neutral phrase so the user never sees the vendor / status / table.
 *
 * This is defense-in-depth: any code path that bypasses the mapper
 * (e.g. a thrown Error.message bubbling to a toast) gets cleaned at
 * the last stop before render.
 */
type VendorPattern = {
  pattern: RegExp;
  /** String replacement, or a function that receives the matched text and returns the replacement. */
  replace: string | ((match: string) => string);
};

const VENDOR_PATTERNS: ReadonlyArray<VendorPattern> = [
  // HTTP-status leaks before vendor substitution so the "OpenAI API
  // error: 429" pattern still parses (the code after "error:" lands
  // here before "OpenAI" gets renamed).
  { pattern: /\b(?:HTTP|status|error|code|response)\s*[:\s]*\d{3}\b/gi, replace: "" },
  { pattern: /\bAPI\s+error\s*[:\s]*\d{3}\b/gi, replace: "" },
  { pattern: /\(\s*\d{3}\s*\)/g, replace: "" },
  { pattern: /\b\d{3}\s+(?:Bad|Server|Forbidden|Unauthorized|Not Found)/gi, replace: "" },
  // Vendor + token names.
  { pattern: /\bOpenAI\b/gi, replace: "import" },
  { pattern: /\bopenai_http_error\b/gi, replace: "import" },
  { pattern: /\bunparseable_model_output\b/gi, replace: "import" },
  { pattern: /\bFatSecret\b/gi, replace: "nutrition" },
  { pattern: /\bSupabase\b/gi, replace: "database" },
  { pattern: /\bPostgrest\b/gi, replace: "database" },
  { pattern: /\bpostgres(?:ql)?\b/gi, replace: "database" },
  { pattern: /\bRLS\b/gi, replace: "permission" },
  { pattern: /\bJWT\b/gi, replace: "session" },
  { pattern: /\bInstagram\b/gi, replace: "post" },
  { pattern: /\bTikTok\b/gi, replace: "post" },
  // Stack snippets: quoted relation names, function-arg lines.
  { pattern: /relation\s+"[^"]+"/gi, replace: "saved item" },
  { pattern: /\bcolumn\s+"[^"]+"/gi, replace: "field" },
  { pattern: /\bduplicate key value violates unique constraint[^\n]*/gi, replace: "duplicate" },
  // Final pass: if a bare 3-digit HTTP-shape number survives in close
  // proximity to "error" / "import" / "failed", strip it. This catches
  // formats like "Failed (502)" or "import 429" that the named-prefix
  // patterns above miss.
  { pattern: /\b(?:error|import|failed|service|server)\s+\d{3}\b/gi, replace: (m: string) => m.replace(/\d{3}/, "").trim() },
  { pattern: /\b\d{3}\s+(?:error|import|failed|service|server)\b/gi, replace: (m: string) => m.replace(/\d{3}/, "").trim() },
];

/**
 * Strip vendor names, raw HTTP status, and Postgrest fragments from a
 * user-facing string. Idempotent — running twice produces the same
 * output.
 */
export function sanitiseImportErrorMessage(input: string): string {
  let out = input;
  for (const { pattern, replace } of VENDOR_PATTERNS) {
    out = typeof replace === "function" ? out.replace(pattern, replace) : out.replace(pattern, replace);
  }
  // Collapse multi-space artefacts the substitutions introduced.
  out = out.replace(/\s{2,}/g, " ").trim();
  return out;
}

/**
 * Resolve a server response (or thrown Error / unknown) to a user-
 * facing message string.
 *
 * Resolution order:
 *   1. If `input` looks like a server response with a `message`
 *      string, sanitise + return it.
 *   2. If `input` has a known `error` code, return `IMPORT_ERROR_COPY[code]`.
 *   3. If `input` is an Error / has a string-shaped `.message`,
 *      sanitise + return it (defense-in-depth).
 *   4. Fall back to `IMPORT_ERROR_COPY.unknown`.
 *
 * Always returns a non-empty string.
 */
export function userFacingImportError(input: unknown): string {
  if (input == null) return IMPORT_ERROR_COPY.unknown;

  if (typeof input === "string") {
    if (isImportErrorCode(input)) return IMPORT_ERROR_COPY[input];
    return sanitiseImportErrorMessage(input) || IMPORT_ERROR_COPY.unknown;
  }

  if (typeof input === "object") {
    const maybe = input as { error?: unknown; message?: unknown };
    if (typeof maybe.message === "string" && maybe.message.trim().length > 0) {
      return sanitiseImportErrorMessage(maybe.message);
    }
    if (typeof maybe.error === "string") {
      if (isImportErrorCode(maybe.error)) return IMPORT_ERROR_COPY[maybe.error];
      return sanitiseImportErrorMessage(maybe.error) || IMPORT_ERROR_COPY.unknown;
    }
  }

  if (input instanceof Error) {
    return sanitiseImportErrorMessage(input.message) || IMPORT_ERROR_COPY.unknown;
  }

  return IMPORT_ERROR_COPY.unknown;
}

function isImportErrorCode(s: string): s is ImportErrorCode {
  return Object.prototype.hasOwnProperty.call(IMPORT_ERROR_COPY, s);
}

/**
 * Helper for API routes: build the `{ok, error, message}` response
 * body. Prevents per-route drift on the response shape.
 */
export function importErrorResponse(code: ImportErrorCode, override?: string): {
  ok: false;
  error: ImportErrorCode;
  message: string;
} {
  return {
    ok: false,
    error: code,
    message: override != null ? sanitiseImportErrorMessage(override) : IMPORT_ERROR_COPY[code],
  };
}

/**
 * Map a Postgres / Supabase error to a stable import-error code.
 * Used by `saveImportedRecipe` and any other persistence path so
 * Postgrest messages never leak to the UI.
 */
export function mapPersistenceError(err: { code?: string; message?: string } | null | undefined): ImportErrorCode {
  if (!err) return "save_failed";
  const code = err.code ?? "";
  const msg = err.message ?? "";
  // Postgres unique-violation
  if (code === "23505" || /duplicate/i.test(msg)) return "duplicate_recipe";
  // Postgrest RLS / forbidden
  if (code === "42501" || /permission denied|RLS|new row violates/i.test(msg)) return "rls_denied";
  return "save_failed";
}
