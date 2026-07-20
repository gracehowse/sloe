/**
 * Auth boot must clear `loading` from onAuthStateChange, not only getSession.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const AUTH_FILE = join(__dirname, "..", "..", "context", "auth.tsx");
const TABS_LAYOUT = join(__dirname, "..", "..", "app", "(tabs)", "_layout.tsx");
const FONT_GATE = join(__dirname, "..", "..", "components", "FontGate.tsx");
const APP_CONFIG = join(__dirname, "..", "..", "app.config.ts");

describe("mobile auth boot gates", () => {
  it("clears loading inside onAuthStateChange (INITIAL_SESSION path)", () => {
    const src = readFileSync(AUTH_FILE, "utf8");
    const listenerBlock = src.slice(
      src.indexOf("onAuthStateChange"),
      src.indexOf("supabase.auth.getSession"),
    );
    expect(listenerBlock).toMatch(/setLoading\(false\)/);
  });

  it("tabs layout does not block on onboardingChecked launch screen", () => {
    const src = readFileSync(TABS_LAYOUT, "utf8");
    expect(src).not.toContain("onboardingChecked");
    expect(src).not.toContain("Getting Today ready");
  });

  it("FontGate does not block children while fonts load", () => {
    const src = readFileSync(FONT_GATE, "utf8");
    expect(src).toContain("return children");
    expect(src).not.toMatch(/import\s*\{[^}]*AppLaunchScreen/);
    expect(src).toContain("hideAsync");
  });

  it("AppLaunchScreen does not import theme context (breaks require cycle)", () => {
    const src = readFileSync(
      join(__dirname, "..", "..", "components", "AppLaunchScreen.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/from\s+["']@\/hooks\/use-theme-colors["']/);
    expect(src).not.toMatch(/from\s+["']@\/context\/theme["']/);
  });
});

/**
 * SEC-05/DI-05 (ENG-1389) — the E2E auto-login seam must be dev-only.
 * `EXPO_PUBLIC_*` vars are inlined into the JS bundle at build time, so a
 * stray EXPO_PUBLIC_E2E_PASSWORD in a release EAS profile would ship a real
 * auto-login credential. Two layers pin this shut:
 *   1. runtime `__DEV__` guard in context/auth.tsx (dead-code-eliminated out
 *      of release bundles);
 *   2. a build-time denylist assertion in app.config.ts that fails a
 *      release EAS build if the vars are set.
 */
describe("E2E auto-login seam is dev-only (SEC-05/DI-05)", () => {
  it("gates the EXPO_PUBLIC_E2E auto-login `if` behind __DEV__", () => {
    const src = readFileSync(AUTH_FILE, "utf8");
    const condIdx = src.indexOf("process.env.EXPO_PUBLIC_E2E_AUTH_ENABLED");
    expect(condIdx).toBeGreaterThan(-1);
    // The nearest enclosing `if (` before the E2E env condition must
    // include `__DEV__`, so the whole block (incl. the inlined password)
    // is compiled out of any release bundle where `__DEV__` is false.
    const ifIdx = src.lastIndexOf("if (", condIdx);
    expect(ifIdx).toBeGreaterThan(-1);
    const guard = src.slice(ifIdx, condIdx);
    expect(guard).toContain("__DEV__");
  });

  it("app.config.ts carries a release-build E2E denylist assertion", () => {
    const src = readFileSync(APP_CONFIG, "utf8");
    expect(src).toContain("EAS_BUILD_PROFILE");
    expect(src).toContain("EXPO_PUBLIC_E2E_PASSWORD");
    // Must actually throw (fail the build), not just warn.
    expect(src).toMatch(/throw new Error/);
  });
});

/**
 * Functional check of the app.config.ts assertion — imports the real config
 * factory and exercises the release-profile branch.
 */
describe("app.config release-build E2E credential guard (SEC-05/DI-05)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function loadConfigFactory() {
    const mod = await import("../../app.config");
    return mod.default as (ctx: { config: Record<string, unknown> }) => unknown;
  }

  it("throws when a production EAS build has E2E auto-login vars set", async () => {
    vi.stubEnv("EAS_BUILD_PROFILE", "production");
    vi.stubEnv("EXPO_PUBLIC_E2E_AUTH_ENABLED", "true");
    vi.stubEnv("EXPO_PUBLIC_E2E_EMAIL", "e2e@example.com");
    vi.stubEnv("EXPO_PUBLIC_E2E_PASSWORD", "hunter2");
    const factory = await loadConfigFactory();
    expect(() => factory({ config: {} })).toThrow(/E2E/);
  });

  it("throws for the preview profile too (internal distribution)", async () => {
    vi.stubEnv("EAS_BUILD_PROFILE", "preview");
    vi.stubEnv("EXPO_PUBLIC_E2E_PASSWORD", "hunter2");
    const factory = await loadConfigFactory();
    expect(() => factory({ config: {} })).toThrow();
  });

  it("does NOT throw for local dev / development profile (seam is dev-only)", async () => {
    vi.stubEnv("EAS_BUILD_PROFILE", "development");
    vi.stubEnv("EXPO_PUBLIC_E2E_AUTH_ENABLED", "true");
    vi.stubEnv("EXPO_PUBLIC_E2E_EMAIL", "e2e@example.com");
    vi.stubEnv("EXPO_PUBLIC_E2E_PASSWORD", "hunter2");
    const factory = await loadConfigFactory();
    expect(() => factory({ config: {} })).not.toThrow();
  });

  it("does NOT throw for a release build with no E2E vars set", async () => {
    vi.stubEnv("EAS_BUILD_PROFILE", "production");
    vi.stubEnv("EXPO_PUBLIC_E2E_AUTH_ENABLED", "");
    vi.stubEnv("EXPO_PUBLIC_E2E_EMAIL", "");
    vi.stubEnv("EXPO_PUBLIC_E2E_PASSWORD", "");
    const factory = await loadConfigFactory();
    expect(() => factory({ config: {} })).not.toThrow();
  });
});
