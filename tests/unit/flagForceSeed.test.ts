/**
 * @vitest-environment jsdom
 */
/**
 * ENG-840 — dev/QA flag-force SEEDING for manual browsing.
 *
 * The client window hook `window.__SUPPR_FORCE_FLAGS__` is the only path
 * that works in a real (bundled) build, but it was previously seeded ONLY
 * by Playwright's addInitScript. This suite covers the new manual-browsing
 * seeder in `src/lib/analytics/track.ts`: `?__force_flags=` query param +
 * localStorage persistence, hydrated lazily on the first flag read.
 *
 * Source contract:
 *  - `?__force_flags=flag:on,other:off` forces those flags; a bare `flag`
 *    (no `:state`) means ON. `on/true/1` → ON, `off/false/0` → OFF.
 *  - The parsed set is persisted to localStorage and survives navigation.
 *  - `?__force_flags=clear` wipes the persisted set.
 *  - Query param overlays (and wins over) any persisted localStorage value.
 *  - Inert in production.
 *
 * `today_log_again` is a non-redesign flag (default-OFF, PostHog-resolved),
 * so a forced value is unambiguously distinguishable from the live client.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const isEnabledMock = vi.fn();

vi.mock("posthog-js", () => ({
  default: {
    isFeatureEnabled: (flag: string) => isEnabledMock(flag),
    capture: vi.fn(),
    setPersonProperties: vi.fn(),
  },
}));

import {
  isFeatureEnabled,
  isFeatureDisabled,
  __resetForcedFlagSeedForTests,
} from "@/lib/analytics/track";

const FLAG = "today_log_again";
const HYPHEN_FLAG = "log-sheet-slot-selector";
const STORAGE_KEY = "__suppr_force_flags__";

type ForceGlobal = { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> };

function setSearch(search: string): void {
  window.history.replaceState({}, "", `/${search}`);
}

describe("web flag-force seeding (?__force_flags + localStorage)", () => {
  beforeEach(() => {
    isEnabledMock.mockReset();
    isEnabledMock.mockReturnValue(false);
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
    vi.stubEnv("NODE_ENV", "test");
    window.localStorage.clear();
    delete (window as ForceGlobal).__SUPPR_FORCE_FLAGS__;
    setSearch("");
    __resetForcedFlagSeedForTests();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("forces ON from the query param and persists to localStorage", () => {
    setSearch(`?__force_flags=${FLAG}:on`);
    expect(isFeatureEnabled(FLAG)).toBe(true);
    expect(isEnabledMock).not.toHaveBeenCalled();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual({
      [FLAG]: true,
    });
  });

  it("treats a bare flag (no :state) as ON", () => {
    setSearch(`?__force_flags=${FLAG}`);
    expect(isFeatureEnabled(FLAG)).toBe(true);
  });

  it("forces OFF from the query param even when PostHog reports ON", () => {
    isEnabledMock.mockReturnValue(true);
    setSearch(`?__force_flags=${FLAG}:off`);
    expect(isFeatureEnabled(FLAG)).toBe(false);
    expect(isFeatureDisabled(FLAG)).toBe(true);
    expect(isEnabledMock).not.toHaveBeenCalled();
  });

  it("parses multiple flags and mixed states in one param", () => {
    setSearch(`?__force_flags=${FLAG}:on,${HYPHEN_FLAG}:off`);
    expect(isFeatureEnabled(FLAG)).toBe(true);
    expect(isFeatureEnabled(HYPHEN_FLAG)).toBe(false);
  });

  it("hydrates from localStorage when no query param is present", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ [FLAG]: true }));
    setSearch("");
    expect(isFeatureEnabled(FLAG)).toBe(true);
    expect(isEnabledMock).not.toHaveBeenCalled();
  });

  it("query param overlays (wins over) the persisted localStorage value", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ [FLAG]: true }));
    setSearch(`?__force_flags=${FLAG}:off`);
    expect(isFeatureEnabled(FLAG)).toBe(false);
  });

  it("clears the persisted set with ?__force_flags=clear", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ [FLAG]: true }));
    setSearch("?__force_flags=clear");
    isEnabledMock.mockReturnValue(true);
    // Override wiped → falls through to the live PostHog client.
    expect(isFeatureEnabled(FLAG)).toBe(true);
    expect(isEnabledMock).toHaveBeenCalledWith(FLAG);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("is inert in production (query param ignored, PostHog-only)", () => {
    vi.stubEnv("NODE_ENV", "production");
    setSearch(`?__force_flags=${FLAG}:on`);
    isEnabledMock.mockReturnValue(false);
    expect(isFeatureEnabled(FLAG)).toBe(false);
    expect(isEnabledMock).toHaveBeenCalledWith(FLAG);
  });
});
