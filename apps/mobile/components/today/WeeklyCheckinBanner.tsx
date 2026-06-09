/**
 * WeeklyCheckinBanner — Sunday-morning prompt on Today that routes to
 * the Weekly Recap surface (which hosts the TDEE delta + goal-pace
 * re-tune).
 *
 * Spec: extended-competitor-audit task (2026-04-30, Step 3).
 *
 * Visibility rules (the host wires these — banner is presentational):
 *   - Today's local day-of-week matches the user's `weekStartDay`
 *     boundary (i.e. it's the first day of a fresh week — Sunday for
 *     Sunday-start, Monday for Monday-start).
 *   - The banner has not been dismissed for the current `weekKey`.
 *   - The user has logged at least one day in the previous week (so
 *     there's something to recap). The host computes this against the
 *     existing `byDay` map.
 *
 * Posture: same calm rules as the Digest. No emoji, no celebration, no
 * "Don't break your streak" copy. The banner is a quiet pointer.
 *
 * ── Card chrome (Figma 654:2 "flat slabs" sweep, 2026-06-08) ──
 * Renders the SAME flat `<SupprCard lift="flat">` cream slab as every
 * other resting Today card (`TodayActivityCard`, `WeeklyInsightCard`,
 * planned meals, …). It used to be the lone bordered card — an inline
 * `<View>` with a peach `${Accent.primary}08` tint + a clay
 * `${Accent.primary}30` hairline — which read as inconsistent next to
 * the borderless slabs (Grace, 2026-06-08). The nudge semantics now ride
 * the CONTENT (the clay "WEEKLY CHECK-IN" eyebrow + the clay "OPEN"
 * button), never the card surface — the same rule the rest of Today
 * follows (eyebrows/icons/CTAs carry meaning, the slab is neutral).
 *
 * Mobile-only — web does not surface this banner because the Digest
 * card already lives on the web Progress dashboard (the Sunday cadence
 * is built into the Digest's `shouldShowRecap` gate).
 */

import { Pressable, Text, View } from "react-native";
import { X } from "lucide-react-native";

import { Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { SupprCard } from "@/components/ui/SupprCard";

export interface WeeklyCheckinBannerProps {
  textColor: string;
  textSecondaryColor: string;
  onOpen: () => void;
  onDismiss: () => void;
}

export function WeeklyCheckinBanner({
  textColor,
  textSecondaryColor,
  onOpen,
  onDismiss,
}: WeeklyCheckinBannerProps) {
  // Secondary accent (Frost flag → damson, else clay) for the eyebrow + the
  // OPEN CTA. The nudge accent rides the content, not the (neutral) card.
  const accent = useAccent();
  return (
    <SupprCard
      lift="flat"
      padding="md"
      testID="weekly-checkin-banner"
      style={{ marginBottom: Spacing.md }}
      innerStyle={{
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.sm,
      }}
    >
      <View style={{ flex: 1 }}>
        {/* Accent eyebrow — the nudge accent now lives in the CONTENT, not a
            card border (the slab is neutral cream like every Today card). */}
        <Text
          style={{
            fontSize: 10,
            fontWeight: "700",
            color: accent.primary,
            letterSpacing: 1,
          }}
        >
          WEEKLY CHECK-IN
        </Text>
        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: textColor,
            marginTop: 2,
          }}
        >
          Your weekly check-in is ready.
        </Text>
        <Text
          style={{
            fontSize: 11,
            color: textSecondaryColor,
            marginTop: 2,
            lineHeight: 15,
          }}
        >
          See last week&rsquo;s intake, weight delta, and adjust your goal pace.
        </Text>
      </View>
      {/* Sloe treatment system (2026-06-08): primary inline CTA →
          aubergine outline (transparent fill + 1.5px primarySolid border
          + primarySolid label), not a filled slab. Mobile-only banner
          (no web mirror — web surfaces the Digest on Progress instead). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open weekly check-in"
        onPress={onOpen}
        testID="weekly-checkin-banner-open"
        style={({ pressed }) => ({
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: Radius.sm,
          backgroundColor: "transparent",
          borderWidth: 1.5,
          borderColor: accent.primarySolid,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: accent.primarySolid,
            letterSpacing: 0.5,
          }}
        >
          OPEN
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss weekly check-in banner"
        onPress={onDismiss}
        hitSlop={8}
        testID="weekly-checkin-banner-dismiss"
        style={{ padding: 4 }}
      >
        <X size={18} color={textSecondaryColor} />
      </Pressable>
    </SupprCard>
  );
}

export default WeeklyCheckinBanner;
