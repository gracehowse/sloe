import React, { useMemo, useState } from "react";
import { Dimensions, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

import { Accent, Spacing } from "@/constants/theme";
import type { FoodHistoryItem } from "@suppr/shared/nutrition/foodHistory";

import { TodayEatAgainBanner } from "./TodayEatAgainBanner";

/**
 * TodayEatAgainScroller — MacroFactor-style horizontal scroller that
 * stacks 2–3 Eat-Again candidates side by side, with page dots below.
 *
 * Premium-bar audit DC3 polish (2026-05-14). The single-candidate
 * case still routes to the bare `<TodayEatAgainBanner>` from the
 * host so this component only ever mounts when there's something to
 * page through.
 *
 * Layout posture matches the host: full-bleed pages (each card is
 * the screen width minus the Today scroll padding), `pagingEnabled`
 * so swipes snap to a card boundary, hidden horizontal scrollbar.
 * Page dots are a calm 6pt circles row beneath the scroller — the
 * active dot uses `Accent.primary`, inactive dots use the host's
 * secondary text colour at 30% alpha.
 */
export interface TodayEatAgainScrollerProps {
  candidates: readonly FoodHistoryItem[];
  slot: string;
  textColor: string;
  textSecondaryColor: string;
  /** Secondary colour used for the inactive page-dot tint. Same value
   *  the host passes to `textSecondaryColor` — accepted as a separate
   *  prop so a caller can theme dots independently if needed. */
  secondaryColor: string;
  surfaceBackgroundColor?: string;
  surfaceBorderColor?: string;
  /** Tapping "Log it" on card `i` fires with the candidate at index `i`. */
  onLog: (item: FoodHistoryItem) => void;
  /** Dismissal closes the whole scroller for today (matches single-card behaviour). */
  onDismiss: () => void;
}

// Matches the host's outer horizontal padding (`Spacing.xl` on each
// side = 20). Each page is the screen width minus that gutter so the
// card lines up flush with the rest of the Today column.
const PAGE_GUTTER = Spacing.xl * 2;

export function TodayEatAgainScroller({
  candidates,
  slot,
  textColor,
  textSecondaryColor,
  secondaryColor,
  surfaceBackgroundColor,
  surfaceBorderColor,
  onLog,
  onDismiss,
}: TodayEatAgainScrollerProps) {
  const pageWidth = useMemo(() => {
    const { width } = Dimensions.get("window");
    return Math.max(0, width - PAGE_GUTTER);
  }, []);

  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageWidth <= 0) return;
    const offset = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offset / pageWidth);
    if (idx !== activeIndex && idx >= 0 && idx < candidates.length) {
      setActiveIndex(idx);
    }
  };

  if (candidates.length === 0) return null;

  return (
    <View style={{ marginBottom: Spacing.md }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={pageWidth}
        snapToAlignment="start"
        onMomentumScrollEnd={handleScroll}
        onScrollEndDrag={handleScroll}
        scrollEventThrottle={16}
        // Negate the host's horizontal padding so each page can fill
        // the visible width and the page boundary sits flush with the
        // screen edge — this is the standard RN trick for paging
        // within an already-padded ScrollView.
        contentContainerStyle={{ paddingHorizontal: 0 }}
      >
        {candidates.map((c, i) => (
          <View key={`${c.recipeTitle}-${i}`} style={{ width: pageWidth }}>
            <TodayEatAgainBanner
              suggestion={c}
              slot={slot}
              textColor={textColor}
              textSecondaryColor={textSecondaryColor}
              surfaceBackgroundColor={surfaceBackgroundColor}
              surfaceBorderColor={surfaceBorderColor}
              onLog={() => onLog(c)}
              onDismiss={onDismiss}
            />
          </View>
        ))}
      </ScrollView>
      {/* Canonical 2026-05-22: pagination dots removed per Grace call.
          Swipe gesture alone carries the "more cards available" affordance.
          The dots row was visual chrome competing with the warm cohesive
          palette; the scroll-snap behaviour + horizontal scroll bar
          (hidden) is enough signal for users who interact, and absent
          dots match calmer brands (Things 3, Notion) over MFP-grade
          carousel indicators. */}
    </View>
  );
}

export default TodayEatAgainScroller;
