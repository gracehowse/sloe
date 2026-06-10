/**
 * Labels for a slot-aggregate line row on the meal-nutrition screen.
 *
 * Lives in its own module (no React / expo-router imports) so the
 * no-double-"Logged" contract can be unit-tested without mounting the screen
 * (which needs a live Supabase query chain).
 *
 * Sloe single-"Logged" affordance (Grace 2026-06-04): a logged item with no
 * recorded time previously showed "Logged" TWICE — once as the uppercase
 * overline (`time || "Logged"`) and once as the title fallback ("Logged item")
 * — so a timeless row read "LOGGED / Logged item". The Sloe meal row carries
 * exactly ONE quiet logged affordance. We keep the overline as that single
 * affordance (the time when known, else "Logged") and make the title fall back
 * to a neutral "Item" so the word "Logged" can never appear twice in one row.
 */
export function slotLineItemLabels(
  time: string | null | undefined,
  recipeTitle: string | null | undefined,
): { overline: string; title: string } {
  const t = time?.trim();
  const name = recipeTitle?.trim();
  return {
    overline: (t || "Logged").toUpperCase(),
    title: name || "Item",
  };
}
