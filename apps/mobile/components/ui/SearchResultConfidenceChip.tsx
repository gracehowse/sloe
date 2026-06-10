import * as React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Check, Info } from "lucide-react-native";

import { Accent, Radius } from "@/constants/theme";

/**
 * `<SearchResultConfidenceChip>` — the legible Verified / Estimated
 * confidence chip from the 2026-05-31 search-results redesign
 * (`docs/prototypes/2026-05-31-design-direction/surface-search-results.html`).
 *
 * Replaces the old near-invisible 14px green tick that fought the green
 * macro "P" letters. Two honest tiers, each with its own glyph + colour:
 *   - "verified"  → soft-blue chip, Lucide `Check`. Authoritative source
 *     AND a strong match (caller derives this — the chip never invents it).
 *   - "estimated" → amber chip, Lucide `Info`. Community / commercial /
 *     AI-estimated data, or a weak match.
 *
 * CLAUDE.md trust posture: this component renders ONLY the tier the caller
 * passes. Callers must derive "verified" from a real provenance + match
 * signal (e.g. a verified USDA/OFF barcode row), never from a UI default.
 * AI-estimated surfaces (voice log) are always "estimated" — an estimate
 * is never "Verified".
 *
 * Shared by the barcode-scan result (`app/(tabs)/barcode.tsx`) and the
 * voice-log result (`VoiceLogSheet` / `AiLogReviewItem`) so the chip
 * language cannot drift between the three logging entry points. Mirrors
 * the search-results prototype `.conf.verified` / `.conf.estimated`.
 *
 * NOTE: distinct from `components/ui/ConfidenceChip.tsx` (the neutral grey
 * low/medium/high TDEE pill, D-2026-04-27-12) — different role, different
 * tokens. Do not collapse the two.
 */

export type SearchResultConfidenceTier = "verified" | "estimated";

export interface SearchResultConfidenceChipProps {
  tier: SearchResultConfidenceTier;
  /** Optional label override. Defaults to "Verified" / "Estimated". */
  label?: string;
  style?: ViewStyle;
  testID?: string;
}

const defaultLabel: Record<SearchResultConfidenceTier, string> = {
  verified: "Verified",
  estimated: "Estimated",
};

// Prototype colours: Verified = soft-blue (#eef3fb / brand blue text),
// Estimated = amber (#fbf2e2 / #bf8324 text). Mapped onto the mobile
// tokens — `Accent.primary` (clay) for `verified` and a warm amber for
// `estimated` (the closest to the prototype's #bf8324 without reaching for
// the orange `warning` slot which reads as "over-budget").
//
// The `verified` fg reads the static clay `Accent.primary` directly and is
// intentionally NOT routed through `useAccent()` — this is a CONFIDENCE /
// provenance indicator, not a CTA. (The Frost secondary-colour exploration was
// retired 2026-06-08, ENG-997 — clay is now the unconditional accent.)
const TIER_STYLE: Record<
  SearchResultConfidenceTier,
  { bg: string; fg: string }
> = {
  verified: { bg: "rgba(88, 140, 228, 0.12)", fg: Accent.primary },
  estimated: { bg: "rgba(191, 131, 36, 0.14)", fg: "#BF8324" },
};

export function SearchResultConfidenceChip({
  tier,
  label,
  style,
  testID,
}: SearchResultConfidenceChipProps) {
  const displayLabel = label ?? defaultLabel[tier];
  const { bg, fg } = TIER_STYLE[tier];
  const Glyph = tier === "verified" ? Check : Info;

  return (
    <View
      testID={testID ?? "confidence-chip"}
      accessibilityRole="text"
      accessibilityLabel={`${displayLabel} nutrition data`}
      style={[styles.chip, { backgroundColor: bg }, style]}
    >
      <Glyph size={11} color={fg} strokeWidth={tier === "verified" ? 3 : 2.4} />
      <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    height: 20,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
  },
  label: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.2,
    lineHeight: 14,
  },
});

export default SearchResultConfidenceChip;
