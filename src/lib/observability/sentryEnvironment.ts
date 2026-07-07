/**
 * Resolve the Sentry `environment` tag for the web runtimes (server, edge,
 * browser).
 *
 * ENG-1404 (PRA-005 / IM-09): none of the three `Sentry.init` calls set
 * `environment`, so Sentry falls back to `NODE_ENV`. On Vercel that tags
 * *preview* deploys (which build with `NODE_ENV=production`) as "production",
 * conflating preview traffic with real production and making prod alerting
 * unreliable — the audit's "100% of production Sentry volume is dev/preview
 * noise" finding. We key off `VERCEL_ENV` instead, matching the app's own
 * production signal (see `middleware.ts` — the prod gate is `VERCEL_ENV`, not
 * `NODE_ENV`, precisely because CI's `next start` runs `NODE_ENV=production`
 * with no `VERCEL_ENV`).
 *
 * Runtime differences:
 *  - Server + edge read `process.env.VERCEL_ENV` directly.
 *  - The browser bundle only inlines `NEXT_PUBLIC_*`, so the client reads
 *    `NEXT_PUBLIC_VERCEL_ENV` (Vercel auto-exposes it when "Automatically
 *    expose System Environment Variables" is enabled — the default). Reading
 *    the bare `VERCEL_ENV` in client code is safe: it simply inlines to
 *    `undefined` and falls through.
 *
 * `VERCEL_ENV` is always one of `production | preview | development`. Off
 * Vercel, a production-mode process with no `VERCEL_ENV` still tags
 * "production" (CI emits nothing — it never has a Sentry DSN configured);
 * anything else is "development".
 */
export function resolveSentryEnvironment(): "production" | "preview" | "development" {
  const vercelEnv = process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (vercelEnv === "production" || vercelEnv === "preview" || vercelEnv === "development") {
    return vercelEnv;
  }
  return process.env.NODE_ENV === "production" ? "production" : "development";
}
