/**
 * ENG-1313 — /library intermittently rendered Discover (~40% of loads).
 *
 * Root cause: the ENG-100 empty-library → Discover redirect fired on
 * `savedRecipesForLibrary.length === 0` with NO data-ready guard. On a
 * cold load the composed list is transiently empty (auth session, cloud
 * saves, and authored recipes all resolve async), so users WITH recipes
 * were bounced to Discover whenever the effect ran before the fetches
 * settled. Mobile has guarded this with `!loading` since ENG-100.
 *
 * These tests pin the web guard: no redirect until `libraryDataReady`,
 * redirect exactly when ready + genuinely empty, and the loading state
 * renders the Library skeleton — never Discover, never a blank page.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useLibraryDiscoverRedirect } from "@/app/components/library/useLibraryDiscoverRedirect";

describe("useLibraryDiscoverRedirect (ENG-1313 guard)", () => {
  it("does NOT redirect while the deciding data is unresolved, even with an empty list", () => {
    const onGoDiscover = vi.fn();
    renderHook(() => useLibraryDiscoverRedirect({ ready: false, savedCount: 0, onGoDiscover }));
    expect(onGoDiscover).not.toHaveBeenCalled();
  });

  it("redirects once the data settles and the library is genuinely empty (ENG-100)", () => {
    const onGoDiscover = vi.fn();
    const { rerender } = renderHook(
      ({ ready, savedCount }: { ready: boolean; savedCount: number }) =>
        useLibraryDiscoverRedirect({ ready, savedCount, onGoDiscover }),
      { initialProps: { ready: false, savedCount: 0 } },
    );
    expect(onGoDiscover).not.toHaveBeenCalled();
    rerender({ ready: true, savedCount: 0 });
    expect(onGoDiscover).toHaveBeenCalledTimes(1);
  });

  it("never redirects when the settled library has recipes — the reported bug", () => {
    const onGoDiscover = vi.fn();
    const { rerender } = renderHook(
      ({ ready, savedCount }: { ready: boolean; savedCount: number }) =>
        useLibraryDiscoverRedirect({ ready, savedCount, onGoDiscover }),
      // Cold load: not ready, list transiently empty…
      { initialProps: { ready: false, savedCount: 0 } },
    );
    // …then the fetches land WITH recipes.
    rerender({ ready: true, savedCount: 7 });
    expect(onGoDiscover).not.toHaveBeenCalled();
  });

  it("no-ops without an onGoDiscover handler", () => {
    expect(() =>
      renderHook(() => useLibraryDiscoverRedirect({ ready: true, savedCount: 0 })),
    ).not.toThrow();
  });
});

describe("libraryDataReady wiring (source pins)", () => {
  const APP_DATA = readFileSync(
    resolve(__dirname, "../../src/context/AppDataContext.tsx"),
    "utf8",
  );
  const AUTH = readFileSync(
    resolve(__dirname, "../../src/context/AuthSessionContext.tsx"),
    "utf8",
  );
  const LIBRARY = readFileSync(
    resolve(__dirname, "../../src/app/components/Library.tsx"),
    "utf8",
  );

  it("readiness composes auth + saves + authored settle signals", () => {
    expect(APP_DATA).toMatch(
      /libraryDataReady = authResolved && savesResolved && authoredResolved/,
    );
  });

  it("auth resolution is a real first-emission signal, not a default", () => {
    expect(AUTH).toMatch(/const \[authResolved, setAuthResolved\] = useState\(false\)/);
    // Both the initial getSession and the auth-state listener settle it.
    expect(AUTH.match(/setAuthResolved\(true\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("Library renders the skeleton while unresolved-and-empty, and guards the redirect", () => {
    expect(LIBRARY).toMatch(
      /if \(!libraryDataReady && savedRecipesForLibrary\.length === 0\) return <LibraryLoadingSkeleton \/>/,
    );
    expect(LIBRARY).toMatch(/useLibraryDiscoverRedirect\(\{\s*ready: libraryDataReady/);
    // The old unguarded effect shape must not come back.
    expect(LIBRARY).not.toMatch(/savedRecipesForLibrary\.length === 0 && onGoDiscover\) \{/);
  });
});
