import { afterEach, describe, expect, it } from "vitest";
import { hasVisualGoldenCredentials, resolveVisualGoldenCredentials } from "../e2e/utils/auth";

const ENV_KEYS = [
  "E2E_VISUAL_EMAIL",
  "E2E_VISUAL_PASSWORD",
  "E2E_EMAIL",
  "E2E_PASSWORD",
  "CI",
  "GITHUB_ACTIONS",
  "E2E_VISUAL_DISABLE_E2E_FALLBACK",
] as const;

function snapshotEnv(): Record<string, string | undefined> {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(saved: Record<string, string | undefined>) {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
}

describe("resolveVisualGoldenCredentials", () => {
  const saved = snapshotEnv();

  afterEach(() => {
    restoreEnv(saved);
  });

  it("prefers dedicated E2E_VISUAL credentials", () => {
    process.env.E2E_VISUAL_EMAIL = "golden@example.com";
    process.env.E2E_VISUAL_PASSWORD = "secret";
    process.env.E2E_EMAIL = "daily@example.com";
    process.env.E2E_PASSWORD = "other";
    delete process.env.CI;

    expect(resolveVisualGoldenCredentials()).toEqual({
      email: "golden@example.com",
      password: "secret",
      source: "visual",
    });
  });

  it("falls back to E2E credentials in CI when visual secrets are absent", () => {
    delete process.env.E2E_VISUAL_EMAIL;
    delete process.env.E2E_VISUAL_PASSWORD;
    process.env.E2E_EMAIL = "ci@example.com";
    process.env.E2E_PASSWORD = "secret";
    process.env.CI = "true";

    expect(resolveVisualGoldenCredentials()).toEqual({
      email: "ci@example.com",
      password: "secret",
      source: "e2e-fallback",
    });
    expect(hasVisualGoldenCredentials()).toBe(true);
  });

  it("does not fall back locally without E2E_VISUAL credentials", () => {
    delete process.env.E2E_VISUAL_EMAIL;
    delete process.env.E2E_VISUAL_PASSWORD;
    process.env.E2E_EMAIL = "local@example.com";
    process.env.E2E_PASSWORD = "secret";
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;

    expect(resolveVisualGoldenCredentials()).toBeNull();
    expect(hasVisualGoldenCredentials()).toBe(false);
  });
});
