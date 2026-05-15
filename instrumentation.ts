import * as Sentry from "@sentry/nextjs";

/**
 * Server-side Sentry registration hook (Next.js 15+).
 *
 * `sentry.server.config.ts` and `sentry.edge.config.ts` are NOT
 * auto-loaded by the Next.js runtime — they have to be imported
 * here based on `NEXT_RUNTIME`. Without this file, server-side and
 * edge-runtime errors would never reach Sentry even though the
 * config files exist on disk.
 *
 * Follows the `sentry-nextjs-sdk` skill (Sentry's official guidance):
 * https://github.com/getsentry/sentry-for-ai/blob/main/skills/sentry-nextjs-sdk/SKILL.md
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Automatically captures all unhandled server-side request errors
 * — server actions, route handlers, RSC render errors, middleware
 * errors. Requires `@sentry/nextjs` >= 8.28.0 (we're on 10.47).
 *
 * Pre-`onRequestError`, server crashes on the request path would
 * only reach Sentry if explicitly wrapped — half of them slipped
 * through.
 */
export const onRequestError = Sentry.captureRequestError;
