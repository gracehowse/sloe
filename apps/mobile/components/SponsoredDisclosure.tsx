import * as React from "react";
import { StyleProp, Text, TextStyle, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Accent, Radius } from "@/constants/theme";

/**
 * SponsoredDisclosure — mobile parallel to the web primitive at
 * `src/app/components/suppr/sponsored-disclosure.tsx`. Universal
 * pattern for marking any partner / affiliate / sponsored content
 * surface.
 *
 * Spec: docs/decisions/2026-04-27-sponsored-disclosure-pattern.md
 *
 * The disclosure is a hard requirement under FTC §255.5 (US) +
 * ASA CAP Code §3 (UK) + EU UCPD 2005/29/EC. It must be:
 *   - clear (no euphemisms — "sponsored" / "affiliate" / "ad")
 *   - prominent (above the fold, not buried)
 *   - in the same language as surrounding content
 *   - visible, not just on long-press
 *
 * Three variants (sponsored / affiliate / ad) and two visual
 * treatments (inline pill / block banner). Match the web component
 * by-construction so a Suppr user gets the same disclosure UX
 * cross-platform.
 *
 * Doesn't trigger anywhere yet (no partners as of 2026-04-27). Ship
 * the primitive ready so the first deal doesn't have to invent
 * disclosure-pattern UI on the fly.
 */

export type DisclosureKind = "sponsored" | "affiliate" | "ad";

const DISCLOSURE_LABEL: Record<DisclosureKind, string> = {
  sponsored: "Sponsored",
  affiliate: "Affiliate link",
  ad: "Ad",
};

const DISCLOSURE_TOOLTIP: Record<DisclosureKind, string> = {
  sponsored:
    "Sloe was paid by the partner to feature this content. Our editorial review still applies.",
  affiliate:
    "Sloe earns a commission if you purchase via this link, at no extra cost to you. We only link to products we'd recommend regardless.",
  ad: "Paid placement. Sloe does not endorse the advertised product.",
};

export interface SponsoredDisclosureProps {
  kind: DisclosureKind;
  /** When set, renders the partner's name inline ("Sponsored · Brand"). */
  partnerName?: string;
  /**
   * `inline` (default) — small pill matching the existing Badge visual scale.
   * `block` — full-width banner above a list of cards (sponsored row).
   */
  variant?: "inline" | "block";
  /** Themed text color for the partner-name suffix; defaults to muted. */
  textColor?: string;
  /** Optional override for the muted background. */
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function SponsoredDisclosure({
  kind,
  partnerName,
  variant = "inline",
  textColor,
  backgroundColor,
  style,
  textStyle,
}: SponsoredDisclosureProps) {
  const label = DISCLOSURE_LABEL[kind];
  const tooltip = DISCLOSURE_TOOLTIP[kind];
  const bg = backgroundColor ?? "rgba(148,163,184,0.18)"; // slate-400 @ 18%
  const fg = textColor ?? "#64748b"; // slate-500
  const a11yLabel = partnerName ? `${label} by ${partnerName}` : label;

  if (variant === "block") {
    return (
      <View
        accessibilityRole="text"
        accessibilityLabel={a11yLabel}
        accessibilityHint={tooltip}
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: "rgba(148,163,184,0.35)",
            backgroundColor: bg,
          },
          style,
        ]}
      >
        <Ionicons name="information-circle-outline" size={14} color={fg} />
        <Text
          style={[
            {
              color: fg,
              fontSize: 12,
              fontWeight: "500",
            },
            textStyle,
          ]}
        >
          {label}
          {partnerName ? <Text style={{ fontWeight: "400" }}> · {partnerName}</Text> : null}
        </Text>
      </View>
    );
  }

  // Inline pill — matches Badge visual scale.
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}
      accessibilityHint={tooltip}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 999,
          backgroundColor: bg,
          alignSelf: "flex-start",
        },
        style,
      ]}
    >
      <Ionicons name="information-circle-outline" size={11} color={fg} />
      <Text
        style={[
          {
            color: fg,
            fontSize: 10,
            fontWeight: "500",
            textTransform: "uppercase",
            letterSpacing: 0.4,
          },
          textStyle,
        ]}
      >
        {label}
        {partnerName ? (
          <Text style={{ fontWeight: "400", textTransform: "none", letterSpacing: 0 }}>
            {" "}· {partnerName}
          </Text>
        ) : null}
      </Text>
    </View>
  );
}

export { DISCLOSURE_LABEL, DISCLOSURE_TOOLTIP };
// keep `Accent` import live to mirror sibling component pattern
void Accent;
