/**
 * ENG-1450 — `firstLogChoice` used to be write-only: captured on the
 * onboarding "One quick win" step, never read again, so Continue silently
 * skipped the promised first log regardless of which chip the user picked.
 *
 * `firstLogDeepLinkQs` (src/lib/onboarding/conversionFunnel.ts) is the
 * shared fix consumed by both completion handlers:
 *   - web: src/app/components/onboarding/web-flow.tsx
 *   - mobile: apps/mobile/components/onboarding/mobile-flow.tsx (via the
 *     `@suppr/shared/onboarding/conversionFunnel` re-export path)
 *
 * These are pure-function unit tests on the querystring builder itself —
 * the "does it actually open the sheet" behaviour is covered per-platform
 * (mobile: useLogSheetDeepLinks.test.ts; web: NutritionTracker reads
 * `openLog`/`openLogQuery` off useSearchParams, exercised via the existing
 * web LogSheet deep-link coverage).
 */
import { describe, it, expect } from "vitest";
import { firstLogDeepLinkQs } from "../../src/lib/onboarding/conversionFunnel";

describe("firstLogDeepLinkQs", () => {
  it("'search' opens the sheet with an empty (unscoped) search", () => {
    expect(firstLogDeepLinkQs("search")).toBe("&openLog=1");
  });

  it("'breakfast' opens the sheet pre-scoped to a real, searchable term", () => {
    // Deliberately does NOT invent preset nutrition (nutrition-accuracy
    // rule) — it seeds a search query so the user still picks a real,
    // validated food match.
    expect(firstLogDeepLinkQs("breakfast")).toBe(
      "&openLog=1&openLogQuery=Breakfast",
    );
  });

  it("'coffee' opens the sheet pre-scoped to a real, searchable term", () => {
    expect(firstLogDeepLinkQs("coffee")).toBe("&openLog=1&openLogQuery=Coffee");
  });

  it("'skip' adds nothing — straight to Today, as before", () => {
    expect(firstLogDeepLinkQs("skip")).toBe("");
  });

  it("null (step never reached / not answered) adds nothing", () => {
    expect(firstLogDeepLinkQs(null)).toBe("");
  });

  it("the querystring fragment is appendable — no leading '?' " , () => {
    // Callers append this to an existing `?onboarding_complete=1...`
    // querystring, so a leading `&` (not `?`) is load-bearing.
    for (const choice of ["search", "breakfast", "coffee"] as const) {
      const qs = firstLogDeepLinkQs(choice);
      expect(qs.startsWith("&")).toBe(true);
      expect(qs.startsWith("&&")).toBe(false);
    }
  });
});
