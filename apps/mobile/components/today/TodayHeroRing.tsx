import React from "react";
import { Pressable, Text, View } from "react-native";
import { HelpCircle } from "lucide-react-native";
import CalorieRing from "@/components/charts/CalorieRing";
import { Accent, FontWeight, Radius, Spacing } from "@/constants/theme";

/**
 * TodayHeroRing — ring hero variant.
 *
 * Originally extracted from `apps/mobile/app/(tabs)/index.tsx`
 * (audit H3, 2026-04-18) as a thin wrapper over `CalorieRing`.
 * Ported to match the 2026-04-19 Claude Design prototype
 * (`docs/prototypes/2026-04-19-whole-app-experience/project/screens-mobile.jsx`
 *  → `HeroRing`) on 2026-04-20 — then pared back same day to drop the
 * in-card macro-row list + logged/burned/net mini-stats row that
 * duplicate the adherence bar + 2x2 macro tile grid shown below the
 * hero on Today (see `feedback_no_duplicate_today_hero_content.md`).
 *
 * Current behaviour:
 *   - Ring sits inside a bordered card.
 *   - Tap → expands into concentric protein/carbs/fat rings (handled
 *     by `CalorieRing`); no text row is added under the ring.
 *   - Long-press → toggles the central number between "Remaining" and
 *     "Logged" kcal (legacy gesture preserved — no regression).
 *   - Two-chip segmented control under the ring → discoverable parity
 *     with web's `today-hero-ring.tsx` "Remaining / Consumed" pill
 *     (Wave 8a finding #9, 2026-05-01). Long-press is undiscoverable
 *     on mobile and the chips give first-time users a visible
 *     affordance for the same state. Chip taps and long-press write
 *     the same host-owned state; default is "remaining" (matches web).
 */
export interface TodayHeroRingProps {
  consumed: number;
  goal: number;
  baseGoal: number | undefined;
  textColor: string;
  secondaryColor: string;
  trackColor: string;
  cardBackgroundColor: string;
  borderColor: string;

  // Macro progress (0..1) for the inner rings when expanded
  proteinPct: number;
  carbsPct: number;
  fatPct: number;

  // Interaction — host-owned
  expanded: boolean;
  onToggleExpanded: () => void;
  displayMode: "remaining" | "consumed";
  /** Long-press toggles the mode (legacy gesture, kept for power users). */
  onToggleDisplayMode: () => void;
  /** Chip tap sets the mode explicitly. Wave 8a parity with web. */
  onSetDisplayMode: (mode: "remaining" | "consumed") => void;
  textTertiaryColor: string;

  /** Audit gap #10 transparency moat (2026-05-01). When provided, a
   *  small "Why this number?" pill button renders directly under the
   *  ring; tapping it should open the host-owned `WhyThisNumberSheet`.
   *  Sized + spaced so it does not interfere with the ring's tap /
   *  long-press affordances. */
  onPressWhy?: () => void;
}

export function TodayHeroRing({
  consumed,
  goal,
  baseGoal,
  textColor,
  secondaryColor,
  trackColor,
  cardBackgroundColor,
  borderColor,
  proteinPct,
  carbsPct,
  fatPct,
  expanded,
  onToggleExpanded,
  displayMode,
  onToggleDisplayMode,
  onSetDisplayMode,
  textTertiaryColor: _textTertiaryColor,
  onPressWhy,
}: TodayHeroRingProps) {
  return (
    <View
      style={{
        backgroundColor: cardBackgroundColor,
        borderWidth: 1,
        borderColor: borderColor,
        borderRadius: Radius.lg,
        // F-60 (2026-04-22): xl(20) → md(12) to tighten the card
        // vertical rhythm after the ring itself shrank 160 → 140.
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        alignItems: "center",
        gap: Spacing.md,
      }}
    >
      <CalorieRing
        consumed={consumed}
        goal={goal}
        baseGoal={baseGoal}
        textColor={textColor}
        secondaryColor={secondaryColor}
        trackColor={trackColor}
        proteinPct={proteinPct}
        carbsPct={carbsPct}
        fatPct={fatPct}
        expanded={expanded}
        onToggle={onToggleExpanded}
        displayMode={displayMode}
        onToggleDisplayMode={onToggleDisplayMode}
      />
      {/* Display-mode segmented control — Wave 8a parity with web's
          `today-hero-ring.tsx` (lines 61-79). Two subtle chips under
          the ring give first-time users a visible affordance for the
          remaining/consumed toggle that was previously gated behind an
          undiscoverable long-press. Visual treatment intentionally
          subtle (small caps, secondary text on inactive) so the chips
          stay secondary to the ring's headline number.
          F-47 (2026-04-22): gesture caption removed — tester flagged
          "middle section cluttered". Chips replace it with a control
          rather than a caption, so we're not regressing that finding. */}
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Calorie ring display"
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: borderColor,
          borderRadius: Radius.sm,
          padding: 2,
          gap: 2,
        }}
      >
        {(["remaining", "consumed"] as const).map((mode) => {
          const active = displayMode === mode;
          return (
            <Pressable
              key={mode}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={mode === "remaining" ? "Remaining" : "Consumed"}
              testID={`today-hero-ring-chip-${mode}`}
              onPress={() => onSetDisplayMode(mode)}
              style={{
                paddingHorizontal: Spacing.md,
                paddingVertical: Spacing.xs,
                borderRadius: Radius.sm - 2,
                backgroundColor: active ? cardBackgroundColor : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  color: active ? textColor : secondaryColor,
                }}
              >
                {mode === "remaining" ? "Remaining" : "Consumed"}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {/* Audit gap #10 transparency moat (2026-05-01) — small "Why this
          number?" pill that opens the WhyThisNumberSheet. Renders only
          when the host passes `onPressWhy`; sized so it doesn't fight
          the ring's tap target. Sits below the segmented control so the
          two affordances stack rather than compete for the same line. */}
      {onPressWhy ? (
        <Pressable
          testID="today-hero-why-this-number"
          accessibilityRole="button"
          accessibilityLabel="Why this number? Open calorie target explanation"
          onPress={onPressWhy}
          hitSlop={6}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: Spacing.md,
            paddingVertical: 6,
            borderRadius: Radius.full,
            backgroundColor: pressed ? `${Accent.primary}30` : `${Accent.primary}14`,
          })}
        >
          <HelpCircle size={12} color={Accent.primary} strokeWidth={2.25} />
          <Text style={{ fontSize: 11, fontWeight: "700", color: Accent.primary, letterSpacing: 0.2 }}>
            Why this number?
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default TodayHeroRing;
