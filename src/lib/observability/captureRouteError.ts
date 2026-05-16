import * as Sentry from "@sentry/nextjs";

/**
 * 2026-05-16 (ENG-518) — uniform error capture for API route handlers.
 *
 * The 2026-05-14 production-readiness audit flagged that only 9
 * `captureException` sites existed across web + mobile. Most route
 * errors flow through generic try/catch that logs to `console.error`
 * and swallows — silent business-logic failures stay invisible until a
 * user complains.
 *
 * This helper is a thin, best-effort wrapper around
 * `Sentry.captureException` with two extras:
 *  1. `tags.route` so Sentry's issue search can pivot by endpoint.
 *  2. `extra` payload for non-PII context (provider, status, body
 *     fingerprint hash, etc.). DO NOT pass raw request bodies — the
 *     redactor in `sentry.server.config.ts` covers known PII shapes,
 *     but route-specific payloads aren't reliably scrubbed.
 *
 * Safe to call inside any catch block:
 *   - Never throws (own try/catch around the Sentry call).
 *   - Doesn't change the response shape — caller still controls the
 *     `NextResponse.json(...)` return.
 *   - Tag and extra both optional; minimum useful signal is just the
 *     error itself.
 */
export function captureRouteError(
  err: unknown,
  route: string,
  extra?: Record<string, unknown>,
): void {
  try {
    Sentry.captureException(err, {
      tags: { route },
      ...(extra ? { extra } : {}),
    });
  } catch {
    // best-effort — Sentry can fail to initialise (missing DSN, network
    // error during initial fetch). Routes must still return their
    // intended response.
  }
}
