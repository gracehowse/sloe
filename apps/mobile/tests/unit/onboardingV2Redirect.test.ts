/**
 * Regression test for audit A3 — `/onboarding-v2` was renamed to
 * `/onboarding` on 2026-04-30 but the deep-link continued to be
 * referenced by AsyncStorage keys (`suppr.onboarding-v2.state`),
 * push-notification scaffolding, and historical bookmarks. Without
 * a redirect screen, every such link 404s with the generic
 * "We couldn't find that. The link may be stale or the recipe may
 * have been deleted" page.
 *
 * This test pins the redirect file's existence and that it
 * forwards to `/onboarding` (not `/login`, not the 404 fallback).
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REDIRECT_FILE = join(__dirname, "..", "..", "app", "onboarding-v2.tsx");

describe("audit A3 — /onboarding-v2 deep-link redirect", () => {
  it("redirect file exists at app/onboarding-v2.tsx", () => {
    expect(existsSync(REDIRECT_FILE)).toBe(true);
  });

  it("forwards to /onboarding via expo-router Redirect", () => {
    const src = readFileSync(REDIRECT_FILE, "utf8");
    expect(src).toContain('from "expo-router"');
    expect(src).toMatch(/Redirect\s+href=["']\/onboarding["']/);
    // Belt-and-braces: must NOT redirect to /login or back to itself.
    expect(src).not.toMatch(/href=["']\/login["']/);
    expect(src).not.toMatch(/href=["']\/onboarding-v2["']/);
  });
});
