/**
 * Recipe detail — editorial standfirst headnote (ENG-1247; prototype
 * `Sloe-App.html` `rd-standfirst`, L4353). Web parity: the standfirst paragraph
 * in `src/app/components/RecipeDetail.tsx`.
 *
 * A serif, editorial cookbook headnote under the hero. Uses the recipe's
 * description (`why`/description) when present; otherwise the prototype's
 * graceful fallback sentence (composed from the protein figure) so the slot
 * never reads empty. Gated by `recipe_detail_v3_conformance` upstream — this
 * component is pure presentation.
 */
import { Text } from "react-native";

import { FontFamily, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Prototype graceful fallback (L4353): a calm one-liner anchored on the
 * recipe's protein so the headnote slot is never blank. Body-neutral, no
 * health claim.
 */
export function standfirstFallback(proteinG: number): string {
  const p = Number.isFinite(proteinG) && proteinG > 0 ? Math.round(proteinG) : null;
  if (p != null) {
    return `A clean ${p}g of protein that sits comfortably inside what's left of today — quick enough for a weeknight, good enough to want again.`;
  }
  return "Quick enough for a weeknight, good enough to want again — and it sits comfortably inside what's left of your day.";
}

export function RecipeStandfirst({
  text,
  proteinG,
}: {
  /** The recipe's description / headnote, when present. */
  text: string | null;
  /** Per-serving protein, for the graceful fallback sentence. */
  proteinG: number;
}) {
  const colors = useThemeColors();
  const copy = text && text.trim().length > 0 ? text.trim() : standfirstFallback(proteinG);
  return (
    <Text
      testID="recipe-standfirst"
      style={{
        fontFamily: FontFamily.serifRegular,
        fontSize: 17,
        lineHeight: 26,
        color: colors.textSecondary,
        marginTop: Spacing.xs,
      }}
    >
      {copy}
    </Text>
  );
}
