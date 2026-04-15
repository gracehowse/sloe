import { missingServerEnvKeys } from "@/lib/server/serverEnv";

/**
 * Runs once when the Node.js process starts (Next.js instrumentation hook).
 * Logs missing env so misconfiguration is visible in deploy logs, not only on first API call.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }

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
