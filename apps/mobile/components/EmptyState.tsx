import * as React from "react";
import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";
import { Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Mobile `<EmptyState />` — RN mirror of web
 * `src/app/components/suppr/empty-state.tsx` (audit M5, 2026-04-18).
 *
 * 2026-05-02 (ui-critic finding #6, P1) — type ladder + illustration
 * upgrade. The previous primitive surfaced empty tabs as 13pt bold
 * over a tiny gap — too quiet to read as a state. The new primitive:
 *   - Optional `illustration` slot rendered inside a 72pt circular
 *     `accent.primarySoft` primary-tinted disc (scheme-resolved; ENG-1521
 *     snapped the old 6.25% ad-hoc alpha UP to the sanctioned Soft step).
 *   - Title routed through `Type.headline` (17pt / 22 lh).
 *   - Description routed through `Type.body` (14pt / 20 lh).
 *   - 12pt rhythm between elements; 20pt paddingTop/Bottom.
 *   - Optional `cta` prop (alias for `action`) — primary button below.
 *
 * Prop contract stays backward compatible — `icon`, `title`,
 * `description`, `action`, `style`, `titleStyle`, `descriptionStyle`
 * still accepted. New props are additive: a caller of
 * `<EmptyState title="..." />` still renders correctly.
 *
 * Copy stays at the call site — the component enforces no rules
 * beyond a factual, non-shame voice.
 */

/** Diameter (and tinted background size) of the optional illustration
 *  disc. 72pt is the production design spec §1.5 hero-icon container
 *  size — large enough to read as a state, small enough not to
 *  dominate the parent surface. */
const ILLUSTRATION_DISC = 72;

export interface EmptyStateProps {
  /** Backwards-compat — small leading icon rendered above the title.
   *  New callers should prefer `illustration` for the 72pt disc. */
  icon?: React.ReactNode;
  /** Optional ~32pt lucide glyph rendered inside a 72pt
   *  `accent.primarySoft` tinted disc (scheme-resolved via `useAccent()`). */
  illustration?: React.ReactNode;
  /** Short title — typically a plain string, but accepts any React
   *  node so callers can preserve existing inline emphasis. */
  title: React.ReactNode;
  /** Optional multi-sentence factual description. */
  description?: React.ReactNode;
  /** Backwards-compat alias for `cta`. Either prop renders the same
   *  slot — the component prefers `cta` if both are passed. */
  action?: React.ReactNode;
  /** Optional primary CTA below the description. Same slot as
   *  `action`; alias added 2026-05-02 for parity with the web spec. */
  cta?: React.ReactNode;
  style?: ViewStyle;
  /** Optional override for the title text style (e.g. for callers that
   *  need a different size). Applied after the default style. */
  titleStyle?: TextStyle;
  /** Optional override for the description text style. */
  descriptionStyle?: TextStyle;
}

export function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
  cta,
  style,
  titleStyle,
  descriptionStyle,
}: EmptyStateProps) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the illustration
  // disc's tinted backing.
  const accent = useAccent();
  const isStringTitle = typeof title === "string";
  const isStringDescription = typeof description === "string";
  // `cta` wins when both are passed — keeps the API forward-looking
  // while preserving every legacy `action`-only call site.
  const ctaNode = cta ?? action;
  return (
    <View style={[styles.container, style]} accessibilityRole="summary">
      {illustration ? (
        <View
          style={[
            styles.illustrationDisc,
            // ENG-1521 — sanctioned Soft step (12% light / 18% dark),
            // snapped UP from the old 6.25% ad-hoc alpha (sub-10% snaps
            // to Soft per the ruling). Web parity: `--accent-primary-soft`.
            { backgroundColor: accent.primarySoft },
          ]}
        >
          {illustration}
        </View>
      ) : icon ? (
        <View style={styles.icon}>{icon}</View>
      ) : null}
      {isStringTitle ? (
        <Text
          style={[
            styles.title,
            { color: colors.text },
            titleStyle,
          ]}
        >
          {title}
        </Text>
      ) : (
        <View style={styles.titleWrap}>{title}</View>
      )}
      {description ? (
        isStringDescription ? (
          <Text
            style={[
              styles.description,
              { color: colors.textSecondary },
              descriptionStyle,
            ]}
          >
            {description}
          </Text>
        ) : (
          <View style={styles.descriptionWrap}>{description}</View>
        )
      ) : null}
      {ctaNode ? <View style={styles.action}>{ctaNode}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  icon: {
    marginBottom: 4,
  },
  illustrationDisc: {
    width: ILLUSTRATION_DISC,
    height: ILLUSTRATION_DISC,
    borderRadius: ILLUSTRATION_DISC / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...Type.headline,
    textAlign: "center",
  },
  titleWrap: {
    alignItems: "center",
  },
  description: {
    ...Type.body,
    textAlign: "center",
  },
  descriptionWrap: {
    alignItems: "center",
  },
  action: {
    marginTop: Spacing.sm,
  },
});

export default EmptyState;
