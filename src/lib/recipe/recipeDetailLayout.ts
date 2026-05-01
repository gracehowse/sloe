/**
 * Recipe-detail layout helpers — shared between
 * `src/app/components/RecipeDetail.tsx` (web) and
 * `apps/mobile/app/recipe/[id].tsx` (mobile).
 *
 * 2026-04-30 ui-product-designer audit: collapse the clunky
 * "by emthenutritionist / Lunch / Prep · Cook · Servings / kcal /
 * Fits your day" stack into a single subtitle row, a compact (or
 * hidden-when-empty) time-stats row, and a fits-your-day verdict
 * fused INTO the calorie hero. These helpers exist so the
 * presentation logic is testable independently of RN/RTL renders.
 */

/** Render the time-stats row only when at least one timing is known. */
export function shouldRenderTimeStats(
  prepMin: number | null | undefined,
  cookMin: number | null | undefined,
): boolean {
  const hasPrep = prepMin != null && prepMin > 0;
  const hasCook = cookMin != null && cookMin > 0;
  return hasPrep || hasCook;
}

/**
 * Compose the subtitle row tokens.
 *
 * Renders left-to-right: "by {author} · {slots, lowercase} · serves N".
 * Each part is gated on real data — empty author / empty slots /
 * zero servings drop out so we don't render orphan separators.
 */
export function composeSubtitleParts(args: {
  authorLabel: string | null;
  slots: string[] | null | undefined;
  servings: number;
}): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  if (args.authorLabel) {
    out.push({ key: "by", label: `by ${args.authorLabel}` });
  }
  if (args.slots && args.slots.length > 0) {
    out.push({ key: "slot", label: args.slots.join(", ").toLowerCase() });
  }
  if (args.servings > 0) {
    out.push({ key: "serves", label: `serves ${args.servings}` });
  }
  return out;
}
