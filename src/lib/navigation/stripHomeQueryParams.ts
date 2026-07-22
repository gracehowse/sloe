/**
 * Strip consumed deep-link params from the /home URL in place (no
 * navigation, no scroll). The `?openLog=1` effect in
 * `NutritionTracker.tsx` and the `?mealShare=<token>` accept host
 * (ENG-1642, `shared-meal-accept-host.tsx`) both consume one-shot query
 * params and must erase them so a refresh/back doesn't replay the
 * action — this is that shared eraser.
 */
export function stripHomeQueryParams(
  router: { replace: (href: string, opts?: { scroll?: boolean }) => void },
  pathname: string,
  searchParams: { toString(): string },
  keys: readonly string[],
): void {
  const params = new URLSearchParams(searchParams.toString());
  for (const key of keys) params.delete(key);
  const q = params.toString();
  const base = pathname || "/home";
  router.replace(q ? `${base}?${q}` : base, { scroll: false });
}
