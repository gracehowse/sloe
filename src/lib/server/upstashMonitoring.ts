import * as Sentry from "@sentry/nextjs";

import { AnalyticsEvents } from "@/lib/analytics/events";
import { serverTrack } from "@/lib/analytics/serverTrack";

export type UpstashSubsystem = "rate_limit" | "vendor_cache" | "vendor_quota" | "ai_budget" | "fatsecret_token";
export type UpstashFailureMode = "call_threw" | "env_missing" | "read_failed" | "write_failed" | "quota_consume_failed";

export type UpstashFailureMetric = {
  subsystem: UpstashSubsystem;
  mode: UpstashFailureMode;
  operation: string;
  failBehavior: "open" | "closed" | "soft";
  severity?: "warning" | "error";
  vendor?: string;
  keyPrefix?: string;
  message?: string;
};

function serialiseError(err: unknown): string | undefined {
  if (err == null) return undefined;
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * ENG-1114 — shared Upstash monitoring hook. Upstash backs rate limits,
 * AI-budget enforcement, vendor cache/quota, and FatSecret token caching
 * (ENG-1120), so failures must create an alertable signal instead of only
 * appearing as console output in one call path.
 */
export function recordUpstashFailure(metric: UpstashFailureMetric, err?: unknown): void {
  const errorMessage = metric.message ?? serialiseError(err);
  const properties = {
    subsystem: metric.subsystem,
    mode: metric.mode,
    operation: metric.operation,
    fail_behavior: metric.failBehavior,
    vendor: metric.vendor,
    key_prefix: metric.keyPrefix,
    error_message: errorMessage,
  };

  try {
    Sentry.captureMessage(`[Upstash] ${metric.subsystem} ${metric.mode}`, {
      level: metric.severity ?? "error",
      tags: {
        dependency: "upstash",
        subsystem: metric.subsystem,
        mode: metric.mode,
        fail_behavior: metric.failBehavior,
      },
      extra: properties,
      fingerprint: ["upstash", metric.subsystem, metric.mode, metric.operation],
    });
  } catch {
    // Best-effort monitoring must never change the fail-open/closed decision.
  }

  void serverTrack(AnalyticsEvents.upstash_dependency_failure, "system:upstash", properties).catch(() => {
    // Best-effort metric emission; the original request path owns the response.
  });
}
