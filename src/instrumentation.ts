import * as Sentry from "@sentry/nextjs";
import { missingServerEnvKeys } from "@/lib/server/serverEnv";
import { assertEurSkuDisplayReadiness } from "@/lib/stripe/eurSkuDisplayGuard";

/**
 * Runs once when the Node.js process starts (Next.js instrumentation hook).
 * Logs missing env so misconfiguration is visible in deploy logs, not only on first API call.
 *
 * Next 15 prefers `src/instrumentation.ts` over root `instrumentation.ts` when
 * a `src/` source dir exists — the previous duplicate root file was dead
 * (shadowed) and its `onRequestError` export never wired up, which is why
 * `@sentry/nextjs` logged "Could not find `onRequestError` hook" on every build.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }

  // ENG-1442 (MP-10/LEGAL-009) — refuse to boot if a EUR Stripe Price
  // env var is set while the pricing display layer can't render EUR
  // yet (a shown-£/charged-€ mischarge risk). Throwing here — the one
  // guaranteed once-per-process-start hook — crashes server boot even
  // if `npm run verify:production-env` was skipped for this deploy.
  // See docs/decisions/2026-07-20-eng1442-currency-display-guard.md.
  assertEurSkuDisplayReadiness();

  const missing = missingServerEnvKeys();
  if (missing.length === 0) {
    if (process.env.NODE_ENV === "development") {
      console.info("[Suppr] Server env: all tracked keys present.");
    }
    return;
  }
  console.warn(
    `[Suppr] Missing server env (some features will be unavailable): ${missing.join(", ")}`,
  );
}

/**
 * Auto-captures unhandled errors on the server request path — server actions,
 * route handlers, RSC render errors, middleware. Required by `@sentry/nextjs`
 * >= 8.28 to wire up the Next 15 `onRequestError` hook.
 */
export const onRequestError = Sentry.captureRequestError;
