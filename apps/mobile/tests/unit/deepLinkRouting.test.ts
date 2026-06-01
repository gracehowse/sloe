/**
 * Lock the regression on the (tabs) deeplink-routing bug discovered
 * by the 2026-04-29 mobile E2E audit + screenshot tour.
 *
 * Pre-fix: the inline `forward` callback in `app/_layout.tsx` always
 * called `router.replace("/")` for any `suppr://` URL whose
 * `urlFromDeepLink` returned null — silently capturing every
 * navigation deep link (suppr:///settings, suppr:///more, etc.) and
 * forcing the user back to Today. That broke push notifications +
 * share-sheet handoffs + Maestro flows targeting any (tabs)-grouped
 * or hidden route.
 *
 * Post-fix: navigation deep links are returned as `ignore` so Expo
 * Router resolves them normally; only deep links that actually carry
 * a recipe URL trigger the share-intent forward to /import-shared.
 *
 * See `docs/audits/2026-04-29-mobile-e2e-audit-findings.md` and
 * `lib/deepLinkRouting.ts`.
 */
import { describe, expect, it, vi } from "vitest";

import { decideDeepLinkAction } from "../../lib/deepLinkRouting";

// `lib/deepLinkRouting` transitively imports `expo-linking` through
// `lib/resolveImportUrl`. Stub `expo-linking.parse` with a minimal
// URL-parser-shaped implementation so the test can run in node/vitest
// without the native runtime.
vi.mock("expo-linking", () => ({
  parse: (href: string) => {
    try {
      // Custom-scheme URLs like `suppr:///settings` aren't perfectly
      // parsed by the WHATWG URL constructor, but normalising to
      // `https:` is enough to extract pathname + query for our needs.
      const normalised = href.replace(/^[a-z][a-z0-9+.-]*:/i, "https:");
      const u = new URL(normalised);
      const queryParams: Record<string, string> = {};
      u.searchParams.forEach((v, k) => {
        queryParams[k] = v;
      });
      return {
        scheme: href.split(":")[0] ?? null,
        hostname: u.hostname || null,
        path: u.pathname.replace(/^\//, "") || null,
        queryParams,
      };
    } catch {
      return { scheme: null, hostname: null, path: null, queryParams: {} };
    }
  },
}));

describe("decideDeepLinkAction — navigation deeplinks must NOT be intercepted", () => {
  it("ignores bare suppr:// (lets Expo Router default to home)", () => {
    expect(decideDeepLinkAction("suppr://")).toEqual({ kind: "ignore" });
  });

  it("ignores suppr:///settings", () => {
    expect(decideDeepLinkAction("suppr:///settings")).toEqual({ kind: "ignore" });
  });

  it("ignores suppr:///more", () => {
    expect(decideDeepLinkAction("suppr:///more")).toEqual({ kind: "ignore" });
  });

  it("ignores suppr:///fasting", () => {
    expect(decideDeepLinkAction("suppr:///fasting")).toEqual({ kind: "ignore" });
  });

  it("ignores suppr:///health-sync", () => {
    expect(decideDeepLinkAction("suppr:///health-sync")).toEqual({ kind: "ignore" });
  });

  it("ignores suppr:///notifications", () => {
    expect(decideDeepLinkAction("suppr:///notifications")).toEqual({ kind: "ignore" });
  });

  it("ignores suppr:///profile", () => {
    expect(decideDeepLinkAction("suppr:///profile")).toEqual({ kind: "ignore" });
  });

  it("ignores suppr:///create-recipe", () => {
    expect(decideDeepLinkAction("suppr:///create-recipe")).toEqual({ kind: "ignore" });
  });

  it("ignores suppr:///whats-new", () => {
    expect(decideDeepLinkAction("suppr:///whats-new")).toEqual({ kind: "ignore" });
  });

  it("ignores suppr:///progress", () => {
    expect(decideDeepLinkAction("suppr:///progress")).toEqual({ kind: "ignore" });
  });

  it("ignores suppr:///library", () => {
    expect(decideDeepLinkAction("suppr:///library")).toEqual({ kind: "ignore" });
  });

  it("ignores suppr:///discover", () => {
    expect(decideDeepLinkAction("suppr:///discover")).toEqual({ kind: "ignore" });
  });
});

describe("decideDeepLinkAction — share-sheet handoffs must forward", () => {
  it("forwards suppr:// with a TikTok URL in the `url` query param", () => {
    const action = decideDeepLinkAction(
      "suppr://import-shared?url=https%3A%2F%2Fwww.tiktok.com%2F%40chef%2Fvideo%2F123",
    );
    expect(action).toEqual({
      kind: "forward-to-import",
      url: "https://www.tiktok.com/@chef/video/123",
    });
  });

  it("forwards suppr://import-shared with an Instagram URL in `link` query param", () => {
    const action = decideDeepLinkAction(
      "suppr://import-shared?link=https%3A%2F%2Fwww.instagram.com%2Freel%2Fabc",
    );
    expect(action).toEqual({
      kind: "forward-to-import",
      url: "https://www.instagram.com/reel/abc",
    });
  });

  it("forwards a raw https Instagram URL (Android Open with)", () => {
    expect(decideDeepLinkAction("https://www.instagram.com/p/abc/")).toEqual({
      kind: "forward-to-import",
      url: "https://www.instagram.com/p/abc/",
    });
  });

  it("forwards a raw https TikTok URL", () => {
    expect(decideDeepLinkAction("https://www.tiktok.com/@chef/video/123")).toEqual({
      kind: "forward-to-import",
      url: "https://www.tiktok.com/@chef/video/123",
    });
  });
});

describe("decideDeepLinkAction — well-known path aliases (ENG-800)", () => {
  // The Plan tab's route file is `app/(tabs)/planner.tsx`, so its
  // canonical path is `/planner`. External surfaces address it by the
  // user-facing label `plan` (`suppr:///plan`). Before the fix that
  // path had no registered route and Expo Router fell through to
  // `+not-found.tsx` — the "recipe may have been deleted" 404. These
  // tests lock the alias → Plan-tab resolution.
  it("navigates suppr:///plan to the Plan tab (three-slash form)", () => {
    expect(decideDeepLinkAction("suppr:///plan")).toEqual({
      kind: "navigate",
      pathname: "/(tabs)/planner",
    });
  });

  it("navigates suppr://plan to the Plan tab (two-slash / host form)", () => {
    expect(decideDeepLinkAction("suppr://plan")).toEqual({
      kind: "navigate",
      pathname: "/(tabs)/planner",
    });
  });

  it("navigates suppr:///plan even with a trailing slash", () => {
    expect(decideDeepLinkAction("suppr:///plan/")).toEqual({
      kind: "navigate",
      pathname: "/(tabs)/planner",
    });
  });

  it("navigates suppr:///plan with a query string (e.g. push attribution)", () => {
    expect(decideDeepLinkAction("suppr:///plan?ref=push")).toEqual({
      kind: "navigate",
      pathname: "/(tabs)/planner",
    });
  });

  it("is case-insensitive on the alias path (suppr:///Plan)", () => {
    expect(decideDeepLinkAction("suppr:///Plan")).toEqual({
      kind: "navigate",
      pathname: "/(tabs)/planner",
    });
  });

  it("does NOT alias suppr:///planner (already a real route → ignore)", () => {
    expect(decideDeepLinkAction("suppr:///planner")).toEqual({ kind: "ignore" });
  });

  it("does NOT alias an unrelated path that merely starts with 'plan'", () => {
    expect(decideDeepLinkAction("suppr:///plant-based")).toEqual({ kind: "ignore" });
  });

  it("still ignores a recipe-carrying plan link is impossible — recipe URL wins", () => {
    // A `suppr://` link that embeds a recipe URL must still forward to
    // import, never get swallowed by the alias map.
    expect(
      decideDeepLinkAction(
        "suppr:///plan?url=https%3A%2F%2Fwww.tiktok.com%2F%40chef%2Fvideo%2F9",
      ),
    ).toEqual({
      kind: "forward-to-import",
      url: "https://www.tiktok.com/@chef/video/9",
    });
  });
});

describe("decideDeepLinkAction — defers to Siri handler", () => {
  it("returns siri for log_water shortcut", () => {
    expect(decideDeepLinkAction("suppr://log/water?ml=500")).toEqual({ kind: "siri" });
  });

  it("returns siri for start_fast shortcut", () => {
    expect(decideDeepLinkAction("suppr://fast/start?hours=16")).toEqual({ kind: "siri" });
  });
});

describe("decideDeepLinkAction — junk inputs", () => {
  it("ignores empty string", () => {
    expect(decideDeepLinkAction("")).toEqual({ kind: "ignore" });
  });

  it("ignores plain text without a URL", () => {
    expect(decideDeepLinkAction("hello world")).toEqual({ kind: "ignore" });
  });

  it("ignores https URLs that aren't social-share recipes", () => {
    expect(decideDeepLinkAction("https://example.com/page")).toEqual({ kind: "ignore" });
  });
});
