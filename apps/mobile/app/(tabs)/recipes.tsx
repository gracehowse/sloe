/**
 * /recipes — redirect to /library.
 *
 * V1 (2026-05-11 visual sweep): the tab bar label says "Recipes" but
 * the actual route is `/library` (historical naming — the file used
 * to be `library.tsx`). External links and Maestro tours that target
 * `/recipes` would hit `+not-found.tsx` and see "We couldn't find
 * that". This redirect closes the mismatch without renaming the
 * existing route (which would break every previously-shared link).
 *
 * Hidden from the tab bar via `href: null` in `(tabs)/_layout.tsx`.
 */
import { Redirect } from "expo-router";

export default function RecipesRedirect() {
  return <Redirect href="/library" />;
}
