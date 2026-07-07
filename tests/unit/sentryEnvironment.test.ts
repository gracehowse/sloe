/**
 * @vitest-environment node
 *
 * ENG-1404 (PRA-005 / IM-09) — Sentry `environment` resolution must key off
 * VERCEL_ENV, not NODE_ENV, so Vercel preview builds (which run
 * NODE_ENV=production) are bucketed as "preview" rather than polluting the
 * "production" view that alerting fires on.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveSentryEnvironment } from "../../src/lib/observability/sentryEnvironment";

const ORIG_VERCEL = process.env.VERCEL_ENV;
const ORIG_PUBLIC = process.env.NEXT_PUBLIC_VERCEL_ENV;
const ORIG_NODE = process.env.NODE_ENV;

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete (process.env as Record<string, string | undefined>)[key];
  else (process.env as Record<string, string | undefined>)[key] = value;
}

describe("resolveSentryEnvironment", () => {
  beforeEach(() => {
    delete (process.env as Record<string, string | undefined>).VERCEL_ENV;
    delete (process.env as Record<string, string | undefined>).NEXT_PUBLIC_VERCEL_ENV;
  });
  afterEach(() => {
    restore("VERCEL_ENV", ORIG_VERCEL);
    restore("NEXT_PUBLIC_VERCEL_ENV", ORIG_PUBLIC);
    restore("NODE_ENV", ORIG_NODE);
  });

  it("returns 'production' on the real prod deploy (VERCEL_ENV=production)", () => {
    process.env.VERCEL_ENV = "production";
    expect(resolveSentryEnvironment()).toBe("production");
  });

  it("returns 'preview' on a Vercel preview deploy — NOT 'production' (the core fix)", () => {
    process.env.VERCEL_ENV = "preview";
    // NODE_ENV is "production" on a Vercel preview build; the old default would
    // have mis-tagged this as production.
    process.env.NODE_ENV = "production";
    expect(resolveSentryEnvironment()).toBe("preview");
  });

  it("returns 'development' when VERCEL_ENV=development", () => {
    process.env.VERCEL_ENV = "development";
    expect(resolveSentryEnvironment()).toBe("development");
  });

  it("reads the client-side NEXT_PUBLIC_VERCEL_ENV when VERCEL_ENV is absent (browser bundle)", () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
    process.env.NODE_ENV = "production";
    expect(resolveSentryEnvironment()).toBe("preview");
  });

  it("prefers VERCEL_ENV over NEXT_PUBLIC_VERCEL_ENV when both are set", () => {
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
    expect(resolveSentryEnvironment()).toBe("production");
  });

  it("falls back to 'production' off-Vercel when NODE_ENV=production (no VERCEL_ENV)", () => {
    process.env.NODE_ENV = "production";
    expect(resolveSentryEnvironment()).toBe("production");
  });

  it("falls back to 'development' for local dev (NODE_ENV=development, no VERCEL_ENV)", () => {
    process.env.NODE_ENV = "development";
    expect(resolveSentryEnvironment()).toBe("development");
  });

  it("ignores a malformed VERCEL_ENV value and falls through to NODE_ENV", () => {
    process.env.VERCEL_ENV = "staging"; // not a real Vercel env value
    process.env.NODE_ENV = "development";
    expect(resolveSentryEnvironment()).toBe("development");
  });
});
