/**
 * Sentry event redaction helpers.
 *
 * Used by `sentry.client.config.ts`, `sentry.server.config.ts`,
 * `sentry.edge.config.ts` and `apps/mobile/lib/errorTracking.ts` to
 * enforce a single PII posture across every Sentry transport.
 *
 * Two functions:
 *   - `redactPII(event)`  — full event with PII keys stripped. Used
 *     post-consent on the client and unconditionally on server +
 *     mobile (defence in depth).
 *   - `stripToCore(event)` — minimal "redacted core" payload (event_id,
 *     level, exception value+type, fingerprint, release, environment,
 *     allow-listed tags). Used pre-consent on the web client behind
 *     the `sentry-pre-consent-capture` feature flag — preserves
 *     operational visibility for cold-open crashes from paid-acquisition
 *     cohorts (Phase 1 viral launch, see
 *     `docs/decisions/2026-05-14-sentry-pre-consent-capture.md`).
 *
 * The shapes here intentionally mirror @sentry/core's `Event` interface
 * but are kept structurally-typed so the same helpers can be reused by
 * `@sentry/nextjs` (web) and `@sentry/react-native` (mobile) without a
 * direct dependency on either package's type exports.
 */

/** Keys that must never leave the device/server (case-insensitive). */
const PII_KEY_PATTERN =
  /token|secret|email|password|cookie|authorization|api[_-]?key|session|weight|height|body[_-]?fat|measurement|sex[_-]?at[_-]?birth|goal[_-]?weight|bmi|waist|hip|chest|neck|dob|birthdate|birth[_-]?date/i;

/** Breadcrumb categories considered safe to retain when stripping to core. */
const CORE_BREADCRUMB_CATEGORIES = new Set([
  "navigation",
  "console.error",
]);

/** Tag keys that are allow-listed onto the stripped-core event. */
const CORE_TAG_ALLOWLIST = new Set([
  "route",
  "feature",
  "consent_state",
]);

/** Truncate length for exception.value in stripped-core mode. */
const STRIPPED_EXCEPTION_MAX = 200;

/** Patterns that mark a breadcrumb message/data as PII-bearing. */
const PII_VALUE_PATTERNS = [
  /[\w.+-]+@[\w-]+\.[\w.-]+/, // email
  /(?:bearer\s+)?[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/, // JWT-like
  /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{16,}/, // stripe-style keys
];

/**
 * Structural shape used by the helpers. Intentionally loose so callers
 * can pass `@sentry/nextjs` `ErrorEvent`, `@sentry/react-native` events,
 * or hand-rolled fixtures interchangeably. We treat everything as
 * `Record<string, unknown>`-shaped internally and rely on the caller's
 * `as` cast at the SDK boundary.
 */
export type SentryEventLike = Record<string, unknown>;

type ExceptionLike = {
  type?: string;
  value?: string;
  stacktrace?: { frames?: Array<Record<string, unknown>> };
};

/** Recursively strip object keys matching the PII pattern. */
function deepRedactKeys<T>(input: T, depth = 0): T {
  if (depth > 8 || input === null || input === undefined) return input;
  if (Array.isArray(input)) {
    return input.map((v) => deepRedactKeys(v, depth + 1)) as unknown as T;
  }
  if (typeof input !== "object") return input;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (PII_KEY_PATTERN.test(k)) continue;
    out[k] = deepRedactKeys(v, depth + 1);
  }
  return out as unknown as T;
}

function breadcrumbMentionsPII(crumb: {
  message?: string;
  data?: Record<string, unknown>;
}): boolean {
  if (crumb.message) {
    for (const re of PII_VALUE_PATTERNS) {
      if (re.test(crumb.message)) return true;
    }
  }
  if (crumb.data) {
    const flat = JSON.stringify(crumb.data);
    for (const re of PII_VALUE_PATTERNS) {
      if (re.test(flat)) return true;
    }
    for (const key of Object.keys(crumb.data)) {
      if (PII_KEY_PATTERN.test(key)) return true;
    }
  }
  return false;
}

/**
 * Strip PII keys from a full Sentry event in place of a structural copy.
 *
 * Removes:
 *   - `user` (entire object — id/email/ip)
 *   - `request.cookies`
 *   - `request.headers.{authorization, cookie, x-api-key, ...}`
 *   - `request.data` keys matching the PII pattern
 *   - any key (recursive) whose name matches `token|secret|email|...`
 *   - breadcrumbs whose message/data contains an email, JWT, or matching key
 *
 * Returns a NEW event — never mutates input.
 */
export function redactPII<T extends SentryEventLike>(event: T): T {
  const next = { ...event } as Record<string, unknown>;

  // Drop user wholesale — id/email/ip-address all sit here.
  delete next.user;

  const req = next.request as
    | { cookies?: unknown; headers?: unknown; data?: unknown; [k: string]: unknown }
    | undefined;
  if (req) {
    const reqOut: Record<string, unknown> = { ...req };
    delete reqOut.cookies;
    if (reqOut.headers && typeof reqOut.headers === "object") {
      const headers: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(reqOut.headers as Record<string, unknown>)) {
        if (PII_KEY_PATTERN.test(k)) continue;
        headers[k] = v;
      }
      reqOut.headers = headers;
    }
    if (reqOut.data && typeof reqOut.data === "object") {
      reqOut.data = deepRedactKeys(reqOut.data);
    }
    next.request = reqOut;
  }

  const crumbs = next.breadcrumbs as Array<{ message?: string; data?: Record<string, unknown> }> | undefined;
  if (Array.isArray(crumbs)) {
    next.breadcrumbs = crumbs.filter((c) => !breadcrumbMentionsPII(c));
  }

  if (next.contexts && typeof next.contexts === "object") {
    next.contexts = deepRedactKeys(next.contexts);
  }
  if (next.extra && typeof next.extra === "object") {
    next.extra = deepRedactKeys(next.extra);
  }
  if (next.tags && typeof next.tags === "object") {
    // Tags are user-supplied and could carry token-shaped values.
    const tags: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(next.tags as Record<string, unknown>)) {
      if (PII_KEY_PATTERN.test(k)) continue;
      tags[k] = v;
    }
    next.tags = tags;
  }

  return next as T;
}

/**
 * Reduce an event to the minimum "redacted core" payload safe to send
 * before cookie consent has been granted. Privacy-by-design: name
 * everything we keep, drop everything else.
 *
 * Keeps:
 *   - event_id, level, release, environment, fingerprint
 *   - exception.values[*].{type, value (truncated to 200 chars)}
 *   - allow-listed tags (`route`, `feature`, `consent_state`)
 *   - breadcrumbs filtered to category in {navigation, console.error},
 *     message-only, with PII-pattern crumbs dropped
 *
 * Drops:
 *   - user, request, contexts, extra, non-allow-listed tags
 *   - stacktrace frame vars (local variables can echo PII)
 *   - breadcrumbs outside the allow-list
 */
export function stripToCore<T extends SentryEventLike>(event: T): SentryEventLike {
  const src = event as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (typeof src.event_id === "string") out.event_id = src.event_id;
  if (typeof src.level === "string") out.level = src.level;
  if (typeof src.release === "string") out.release = src.release;
  if (typeof src.environment === "string") out.environment = src.environment;
  if (Array.isArray(src.fingerprint)) {
    out.fingerprint = [...(src.fingerprint as string[])];
  }

  const exception = src.exception as { values?: ExceptionLike[] } | undefined;
  if (exception?.values && Array.isArray(exception.values)) {
    out.exception = {
      values: exception.values.map((ex): Record<string, unknown> => {
        const safe: Record<string, unknown> = {};
        if (ex.type) safe.type = ex.type;
        if (typeof ex.value === "string") {
          safe.value = ex.value.length > STRIPPED_EXCEPTION_MAX
            ? `${ex.value.slice(0, STRIPPED_EXCEPTION_MAX)}…`
            : ex.value;
        }
        // Intentional: drop `stacktrace.frames[*].vars` (local var
        // snapshots can echo back form input, auth tokens, recipe
        // bodies). The frames themselves stay so panel + line numbers
        // remain visible — only `vars` is purged, not the trace.
        const stacktrace = ex.stacktrace as { frames?: Record<string, unknown>[] } | undefined;
        if (stacktrace?.frames && Array.isArray(stacktrace.frames)) {
          safe.stacktrace = {
            frames: stacktrace.frames.map((f) => {
              const { vars: _vars, ...rest } = f as Record<string, unknown> & { vars?: unknown };
              return rest;
            }),
          };
        }
        return safe;
      }),
    };
  }

  if (src.tags && typeof src.tags === "object") {
    const tags: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src.tags as Record<string, unknown>)) {
      if (CORE_TAG_ALLOWLIST.has(k)) tags[k] = v;
    }
    if (Object.keys(tags).length > 0) out.tags = tags;
  }

  const crumbs = src.breadcrumbs as Array<{
    category?: string;
    message?: string;
    data?: Record<string, unknown>;
  }> | undefined;
  if (Array.isArray(crumbs)) {
    const safe = crumbs
      .filter((c) => c.category && CORE_BREADCRUMB_CATEGORIES.has(c.category))
      .filter((c) => !breadcrumbMentionsPII(c))
      .map((c) => ({
        category: c.category,
        message: c.message,
        // Intentional: drop `data` — Sentry crumb data is free-form and
        // commonly carries fetch URLs with query params, console.error
        // arguments, etc.
      }));
    if (safe.length > 0) out.breadcrumbs = safe;
  }

  return out;
}
