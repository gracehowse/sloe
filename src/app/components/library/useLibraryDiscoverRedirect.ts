import { useEffect } from "react";

/**
 * ENG-100 (2026-05-16, Grace decision = "default to Discover only"):
 * Library is empty for new users — the first thing a user sees when
 * they click into the Recipes group is a blank slate that doesn't tell
 * the product story. Redirect to /discover while saved recipes = 0.
 * After the first save, the normal Library landing kicks in. Mirrors
 * the mobile `useFocusEffect` in `apps/mobile/app/(tabs)/library.tsx`.
 *
 * ENG-1313 — the redirect must NEVER fire before the deciding data has
 * settled. `savedRecipesForLibrary` is transiently empty on a cold load
 * (auth session, cloud saves, and authored recipes all resolve async),
 * which sent ~40% of /library loads to Discover for users who DO have
 * recipes. Mobile has guarded this with `!loading` since ENG-100; this
 * hook is the web equivalent, keyed on `libraryDataReady`.
 */
export function useLibraryDiscoverRedirect(opts: {
  /** `libraryDataReady` from AppDataContext — the settle signal. */
  ready: boolean;
  /** Composed Library entry count (saves + authored + imported). */
  savedCount: number;
  onGoDiscover?: () => void;
}) {
  const { ready, savedCount, onGoDiscover } = opts;
  useEffect(() => {
    if (!ready) return;
    if (savedCount === 0 && onGoDiscover) {
      onGoDiscover();
    }
  }, [ready, savedCount, onGoDiscover]);
}
