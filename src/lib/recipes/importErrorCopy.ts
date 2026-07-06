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
  // ENG-1309 (2026-07-02) — CSRF / server-config rejections from
  // `assertOrigin` are UI-reachable through every import route but
  // previously fell through the mapper and rendered as raw
  // "forbidden_origin" / "server_misconfigured" tokens.
  | "forbidden_origin"
  | "server_misconfigured"
  // Input shape
  | "invalid_url"
  | "invalid_json"
  | "invalid_body"
  | "invalid_form"
  | "expected_multipart"
  | "missing_image"
  | "missing_file"
  | "missing_text"
  | "invalid_pdf_type"
  | "file_too_large"
  // Rate limits + AI
  | "rate_limited"
  | "ai_rate_limited"
  | "ai_unavailable"
  | "ai_request_failed"
  // Blocker 3 (2026-05-14) — daily AI cost cap hit (per-user OR global).
  // Distinct from `ai_rate_limited` (vendor-side 429) and
  // `ai_unavailable` (vendor 5xx) so client copy + telemetry can
  // distinguish "the vendor is overloaded" from "Suppr stopped sending
  // calls because we crossed our daily spend ceiling".
  | "ai_capacity_reached"
  | "openai_not_configured"
  // ENG-1309 — the social-import branch emits `ai_not_configured`
  // (distinct token from `openai_not_configured`); map both.
  | "ai_not_configured"
  | "openai_http_error"
  | "unparseable_model_output"
  // Resolved-URL / network
  | "fetch_failed"
  | "redirect_blocked"
  | "url_not_allowed"
  | "timeout"
  | "not_html"
  | "no_recipe_schema"
  // Caption / social (ENG-1309: `social_no_caption`, `caption_too_long`,
  // `wrong_platform` and `feature_disabled` are emitted by the caption +
  // social routes but previously had no copy entry).
  | "caption_too_short"
  | "caption_too_long"
  | "social_no_caption"
  | "social_no_recipe"
  | "wrong_platform"
  | "feature_disabled"
  | "no_recipe_extracted"
  // Cookbook PDF import
  | "pdf_extract_failed"
  | "pdf_text_too_short"
  // Persistence
  | "save_failed"
  | "rls_denied"
  | "duplicate_recipe"
  // ENG-519 (2026-05-16) — PostHog kill-switch tripped on the
  // recipe-import family. Distinct from `ai_capacity_reached` (daily
  // cost ceiling) and `ai_unavailable` (vendor 5xx) so the client can
  // surface a calm "back shortly" message without conflating intent.
  | "service_unavailable"
  // Generic fallthroughs
  | "import_failed"
  | "network_error"
  | "unknown"
  // Client-side states (audit I07, 2026-05-05) — used for messages
  // that don't originate from the server but still need consistent
  // copy across mobile + web.
  | "client_signin_required"
  | "client_signin_required_to_save"
  | "client_clipboard_empty"
  | "client_paste_empty"
  | "client_url_required"
  | "client_unsupported_url"
  | "client_image_pick_failed"
  | "client_offline"
  // ENG-1456 — mobile build has no API base (missing supprApiUrl /
  // EXPO_PUBLIC_API_URL). A config problem on OUR side, not the
  // user's; production copy says so in user language. Dev builds keep
  // the diagnostic Alert at the call sites (`__DEV__` branch).
  | "client_api_not_configured";

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
  forbidden_origin: "We couldn't verify this request came from the app. Refresh the page and try again.",
  server_misconfigured: "Recipe import is temporarily unavailable. Try again shortly.",
  invalid_url: "That link isn't a valid URL. Check it and try again.",
  invalid_json: "We couldn't read the request. Try again.",
  invalid_body: "We couldn't read what you sent. Try again.",
  invalid_form: "We couldn't read the upload. Try again.",
  expected_multipart: "We couldn't read the uploaded file. Try again.",
  missing_image: "Add a photo to import from.",
  missing_file: "Choose a file to import from.",
  missing_text: "Paste some recipe text to import.",
  invalid_pdf_type: "That file isn't a PDF. Choose a PDF to import from.",
  file_too_large: "That image is too large. Try one under 6MB.",
  rate_limited: "You're importing a lot of recipes. Try again shortly.",
  ai_rate_limited: "Our import service is busy right now. Try again in a moment.",
  ai_unavailable: "Our import service is temporarily unavailable. Try again shortly.",
  ai_request_failed: "We couldn't process that import. Try again, or paste the recipe manually.",
  ai_capacity_reached: "AI is temporarily at capacity. Try again in a few hours or paste the recipe manually.",
  openai_not_configured: "Image import isn't available right now. Try the URL or caption import instead.",
  ai_not_configured: "Recipe import from posts isn't available right now. Paste the caption text instead.",
  openai_http_error: "We couldn't read that image. Try again, or paste the recipe text manually.",
  unparseable_model_output: "We couldn't read that image. Try a clearer photo, or paste the recipe text manually.",
  fetch_failed: "We couldn't reach that page. Check the URL or try again later.",
  redirect_blocked: "That link redirects somewhere we don't support. Try a different source.",
  url_not_allowed: "We don't support that URL. Try a different source.",
  timeout: "The page took too long to load. The site may be slow or blocking imports — try a different source.",
  not_html: "That link doesn't point to a recipe page we can read. Check the link, or paste the recipe text instead.",
  no_recipe_schema: "We couldn't find a recipe on that page. Check the link, or paste the recipe text instead.",
  caption_too_short: "We need at least a short caption to extract a recipe. If the post is video-only, try sharing one with a written caption.",
  caption_too_long: "That caption is too long to import. Trim it down and try again.",
  social_no_caption: "We couldn't read that post's caption. Copy the caption text and paste it instead, or screenshot the recipe and use image import.",
  social_no_recipe: "We couldn't find a recipe in that post. Copy the caption text and paste it instead, or screenshot the recipe and use image import.",
  wrong_platform: "That link doesn't need the caption path. Import it as a regular link instead.",
  feature_disabled: "This import method isn't enabled yet. Try the URL or image import instead.",
  no_recipe_extracted: "We couldn't extract a recipe from this. Try a different source, or paste it manually.",
  pdf_extract_failed: "We couldn't read that PDF. Try a different file, or paste the recipe text instead.",
  pdf_text_too_short: "We couldn't read enough text from that PDF. Export a searchable PDF from your scanner app, then try again.",
  save_failed: "We couldn't save the recipe. Try again.",
  rls_denied: "You don't have permission to save that recipe.",
  duplicate_recipe: "You've already saved this recipe.",
  service_unavailable: "Recipe import is temporarily unavailable. Try again shortly.",
  import_failed: "We couldn't import that recipe. Try again, or paste it manually.",
  network_error: "Network error. Check your connection and try again.",
  unknown: "Something went wrong. Try again.",
  // Client-side copy (audit I07, 2026-05-05). Used by mobile + web
  // import flows for non-server-originated states. Keep these short
  // and action-shaped — the user-facing string IS the call to action.
  client_signin_required: "Sign in to import recipes.",
  client_signin_required_to_save: "Sign in to save imported recipes to your library.",
  client_clipboard_empty: "Your clipboard is empty. Copy a recipe URL or text first.",
  client_paste_empty: "Add at least one ingredient line (e.g. 2 cups diced tomatoes).",
  client_url_required: "Paste a recipe URL first.",
  client_unsupported_url: "We don't support that link. Paste a recipe URL or use image import.",
  client_image_pick_failed: "We couldn't open the image picker. Try again.",
  client_offline: "You're offline. Reconnect and try again.",
  client_api_not_configured: "Something's wrong on our side. Try again later.",
};

/**
 * ENG-1456 — Alert title paired with `client_api_not_configured` on the
 * mobile import surfaces (plan-import, cookbook-import, create-recipe).
 * Lives here so the title + body ship as one register entry and can't
 * drift per-surface.
 */
export const IMPORT_UNAVAILABLE_ALERT_TITLE = "Import isn't available";

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
  // ENG-1309: "this Instagram post" must collapse to "this post" — the
  // bare-name substitution below alone produced "this post post".
  { pattern: /\b(?:Instagram|TikTok)\s+post\b/gi, replace: "post" },
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
 * ENG-1309 — raw-code detector. A stable error token ("forbidden_origin",
 * "unauthorized", "some_future_code") never contains whitespace; real
 * human copy always does. Anything whitespace-free is therefore a code
 * that missed the mapper and must NEVER reach pixels verbatim.
 */
function looksLikeRawErrorCode(s: string): boolean {
  return s.length > 0 && !/\s/.test(s);
}

/**
 * ENG-1309 — resolve one candidate string to human copy, or null when
 * the candidate is unusable (empty / a raw code token the mapper does
 * not know). Callers fall through to the next candidate.
 */
function resolveCandidate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (isImportErrorCode(trimmed)) return IMPORT_ERROR_COPY[trimmed];
  if (looksLikeRawErrorCode(trimmed)) return null;
  const sanitised = sanitiseImportErrorMessage(trimmed);
  if (!sanitised || looksLikeRawErrorCode(sanitised)) return null;
  return sanitised;
}

/**
 * Resolve a server response (or thrown Error / unknown) to a user-
 * facing message string.
 *
 * Resolution order:
 *   1. If `input` looks like a server response with a usable `message`
 *      string, sanitise + return it.
 *   2. If `input` has a known `error` code, return `IMPORT_ERROR_COPY[code]`.
 *   3. If `input` is an Error / has a string-shaped `.message`,
 *      sanitise + return it (defense-in-depth).
 *   4. Fall back to `IMPORT_ERROR_COPY.unknown`.
 *
 * ENG-1309 hardening: every candidate runs through `resolveCandidate`,
 * so a raw snake_case token (known or unknown) can never render — known
 * codes map to their copy, unknown codes fall through to the generic
 * fallback. Always returns a non-empty human string.
 */
export function userFacingImportError(input: unknown): string {
  if (input == null) return IMPORT_ERROR_COPY.unknown;

  if (typeof input === "string") {
    return resolveCandidate(input) ?? IMPORT_ERROR_COPY.unknown;
  }

  if (typeof input === "object") {
    const maybe = input as { error?: unknown; message?: unknown };
    const fromMessage =
      typeof maybe.message === "string" ? resolveCandidate(maybe.message) : null;
    if (fromMessage) return fromMessage;
    const fromCode =
      typeof maybe.error === "string" ? resolveCandidate(maybe.error) : null;
    if (fromCode) return fromCode;
    // `instanceof Error` objects land here too (message handled above).
  }

  return IMPORT_ERROR_COPY.unknown;
}

function isImportErrorCode(s: string): s is ImportErrorCode {
  return Object.prototype.hasOwnProperty.call(IMPORT_ERROR_COPY, s);
}

/**
 * ENG-1309 — coerce an untrusted server `error` field to a known
 * `ImportErrorCode`. Replaces the unsafe `data.error as ImportErrorCode`
 * casts in the import surfaces: a code the client doesn't know (newer
 * server, or a non-import route like `assertOrigin`) coerces to
 * `fallback` instead of flowing raw into scheduler state / copy lookups.
 */
export function coerceImportErrorCode(
  raw: unknown,
  fallback: ImportErrorCode = "import_failed",
): ImportErrorCode {
  return typeof raw === "string" && isImportErrorCode(raw) ? raw : fallback;
}

/**
 * ENG-1328 — image-GENERATION surface overrides. The `/api/recipe-import/
 * image-hero` route shares stable codes with the photo-IMPORT surface
 * (`pro_required`, `rate_limited`, …) whose mapped copy describes
 * importing ("Recipe imports from photos are a Pro feature.") — the wrong
 * story when the user tapped "Generate an image". This map is the
 * image-gen channel's own honest copy; codes not listed here fall through
 * to the shared resolver. ENG-865: `pro_required` copy is for regenerate;
 * first base Sloe hero is free.
 */
export const IMAGE_GEN_ERROR_COPY = {
  pro_required: "Trying another Sloe look is a Pro feature. Upgrade to regenerate.",
  unauthorized: "Sign in to generate a recipe image.",
  rate_limited: "You've generated a lot of images today. Try again tomorrow.",
  invalid_body: "We couldn't start that image. Try again.",
  service_unavailable: "Image generation is temporarily unavailable. Try again shortly.",
} satisfies Partial<Record<ImportErrorCode, string>>;

/**
 * ENG-1328 — the image-hero route degrades gracefully: fal unconfigured /
 * locked / errored returns 200 `{ok:false, skipped:true, reason}` with a
 * raw ops token (`fal_not_configured`, `generate_threw`, …). Every skip
 * means the same thing to the user, so they all collapse to this line.
 */
export const IMAGE_GEN_UNAVAILABLE_COPY =
  "We couldn't generate an image right now. Try again later.";

/**
 * Resolve an image-generation failure (server response / thrown Error /
 * unknown) to user-facing copy. Code-first: the surface override map
 * outranks any server `message`, because shared routes ship photo-import
 * copy for shared codes. Raw `reason` tokens never render.
 */
export function userFacingImageGenError(input: unknown): string {
  const obj =
    typeof input === "object" && input !== null
      ? (input as { error?: unknown; reason?: unknown; message?: unknown })
      : null;
  const code =
    typeof input === "string" ? input : typeof obj?.error === "string" ? obj.error : null;
  if (code && Object.prototype.hasOwnProperty.call(IMAGE_GEN_ERROR_COPY, code)) {
    return IMAGE_GEN_ERROR_COPY[code as keyof typeof IMAGE_GEN_ERROR_COPY];
  }
  if (obj && typeof obj.reason === "string" && obj.reason.trim()) {
    return IMAGE_GEN_UNAVAILABLE_COPY;
  }
  const resolved = userFacingImportError(input);
  // The shared "Something went wrong" fallback reads worse than the
  // surface-specific one here — keep the image-gen voice.
  return resolved === IMPORT_ERROR_COPY.unknown ? IMAGE_GEN_UNAVAILABLE_COPY : resolved;
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
