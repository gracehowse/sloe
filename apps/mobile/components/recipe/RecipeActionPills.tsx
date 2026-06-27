/**
 * Recipe detail — action-pill row (Figma `332:2`, section 3). Web parity:
 * the action-pill row in `src/app/components/RecipeDetail.tsx`.
 *
 * Horizontal pills, rounded-full, on the `SupprButton` grammar
 * (`docs/decisions/2026-06-12-button-system-solid-primary.md`):
 *   - Log ("Add to today") — `SupprButton variant="primary"`: SOLID aubergine
 *     fill + white PlusCircle/label, the DOMINANT top-row action → opens the
 *     log flow. Logging is the product's spine, so it is the everyday primary
 *     here (premium-audit 2026-06-09, gap 1 + CTA map
 *     `docs/ux/specs/2026-06-09-skia-ring-cta-map-serif-titles.md` §2). The
 *     solid fill IS the affordance — no border, no shadow (flat-card canon).
 *   - Edit — `SupprButton variant="ghost"`: transparent, plum Pencil/label →
 *     edit recipe (owner-only; hidden otherwise). Replaces the old cream fill.
 *
 * Cook entry deduped (premium-audit 2026-06-09, gap 1): the top-row
 * "Start Cooking" pill was the SAME destination as the sticky-footer
 * "Cook Mode" pill at near-equal weight. The single cook entry is now the
 * floating Cook Mode pill in `RecipeServingsFooter`; this row no longer
 * carries a cook CTA.
 *
 * ENG-1247 (v3 conformance, flag `recipe_detail_v3_conformance`): when the
 * conformance flag is ON, Log moves DOWN into the sticky CTA bar
 * (`RecipeServingsFooter`) as the single filled primary, and this row
 * collapses to the owner-only Edit pill (pass `showLog={false}`). The whole
 * row renders nothing for non-owners in that mode. Flag-OFF keeps the legacy
 * Log (dominant) + Edit row below.
 *
 * The "Ask" pill from the frame is intentionally OMITTED: there is no
 * AI-coach / assistant handler in the app (Ask is net-new, Figma frame
 * `185:2`). Building a placeholder screen would violate the no-fakes rule.
 * See report + `docs/ux/redesign/figma-migration-tracker.md`.
 */
import { Text, View } from "react-native";
import { Pencil, PlusCircle } from "lucide-react-native";

import { FontFamily, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { SupprButton } from "@/components/ui/SupprButton";

type RecipeActionPillsProps = {
  onLog: () => void;
  logging: boolean;
  /** When set, render the Edit pill (owner-only). */
  onEdit?: () => void;
  haptic?: "confirm" | "none";
  /** ENG-1247 — flag-OFF (legacy) renders the dominant Log pill here; flag-ON
   *  passes `false` so Log lives in the sticky CTA bar and this row is
   *  Edit-only (and renders nothing for non-owners). Default true = legacy. */
  showLog?: boolean;
};

export function RecipeActionPills({
  onLog,
  logging,
  onEdit,
  haptic = "none",
  showLog = true,
}: RecipeActionPillsProps) {
  // Aubergine accent for the ghost Edit pill's plum label/icon. The dominant
  // "Log" CTA's solid fill + white label come from SupprButton variant="primary".
  const accent = useAccent();

  const pillLabel = {
    fontFamily: FontFamily.sansSemibold,
    fontSize: 14,
    fontWeight: "700" as const,
  };

  // ENG-1247 — in flag-ON (Log-in-footer) mode the row is purely the owner
  // Edit pill; for a non-owner there is nothing to show, so skip the row.
  if (!showLog && !onEdit) return null;

  return (
    <View
      style={{ flexDirection: "row", gap: Spacing.dense }}
      testID="recipe-action-pills"
    >
      {showLog ? (
        <SupprButton
          variant="primary"
          haptic={haptic}
          onPress={onLog}
          loading={logging}
          accessibilityLabel="Log this recipe"
          testID="recipe-action-log"
          // Dominant primary — wider than the owner Edit pill.
          style={{ flex: 1.6, gap: Spacing.sm }}
        >
          <PlusCircle size={18} color="#fff" />
          <Text style={[pillLabel, { color: "#fff" }]} numberOfLines={1}>
            Log
          </Text>
        </SupprButton>
      ) : null}

      {onEdit ? (
        <SupprButton
          variant="ghost"
          onPress={onEdit}
          accessibilityLabel="Edit recipe"
          testID="recipe-action-edit"
          // Flag-ON Edit-only row: the lone owner Edit pill takes the row.
          style={{ flex: 1, gap: Spacing.sm }}
        >
          <Pencil size={16} color={accent.primarySolid} />
          <Text
            style={[pillLabel, { color: accent.primarySolid }]}
            numberOfLines={1}
          >
            Edit
          </Text>
        </SupprButton>
      ) : null}
    </View>
  );
}
