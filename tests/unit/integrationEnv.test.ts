import { afterEach, describe, expect, it, vi } from "vitest";

import { hasFatSecretEnv } from "@/lib/env/integrationEnv";

describe("hasFatSecretEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts CONSUMER_KEY + CLIENT_SECRET", () => {
    vi.stubEnv("FATSECRET_CONSUMER_KEY", "k");
    vi.stubEnv("FATSECRET_CLIENT_SECRET", "s");
    expect(hasFatSecretEnv()).toBe(true);
  });

  it("accepts legacy CONSUMER_SECRET", () => {
    vi.stubEnv("FATSECRET_CONSUMER_KEY", "k");
    vi.stubEnv("FATSECRET_CONSUMER_SECRET", "s");
    expect(hasFatSecretEnv()).toBe(true);
  });

  it("is false when secret alias missing", () => {
    vi.stubEnv("FATSECRET_CONSUMER_KEY", "k");
    // Root `.env.local` is loaded in tests/setup.ts — clear secret aliases so
    // this case is not polluted by real credentials.
    vi.stubEnv("FATSECRET_CLIENT_SECRET", "");
    vi.stubEnv("FATSECRET_CONSUMER_SECRET", "");
    expect(hasFatSecretEnv()).toBe(false);
  });
});
