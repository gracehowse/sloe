import React from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Sun,
} from "lucide-react-native";
import { Accent } from "@/constants/theme";
import DayStrip from "@/components/charts/DayStrip";
import { GradientAvatar } from "@/components/GradientAvatar";

/**
 * TodayDateHeader — day/week nav buttons, title, view-mode toggle, avatar,
 * and the DayStrip row.
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18).
 */
export interface TodayDateHeaderProps {
  viewMode: "day" | "week";
  onViewModeChange: (mode: "day" | "week") => void;
  selectedDate: Date;
  weekLabel: string;
  isToday: boolean;
  formatDateLabel: (d: Date) => string;
  weekStartDay: "monday" | "sunday";
  loggedDays: Set<string>;
  protectedDateKeys: Set<string>;
  onSelectDate: (d: Date) => void;
  onOpenCalendar: () => void;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  onTapTitle: () => void;
  avatarLetter: string;
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
  cardColor: string;
  cardBorderColor: string;
  /** Foreground for the primary-tinted active toggle pill (Day / Week
   *  glyph). Wired through from the host to avoid hardcoding `#fff`
   *  here — see Colors.{light,dark}.primaryForeground. */
  primaryForegroundColor: string;
}

export function TodayDateHeader({
  viewMode,
  onViewModeChange,
  selectedDate,
  weekLabel,
  isToday,
  formatDateLabel,
  weekStartDay,
  loggedDays,
  protectedDateKeys,
  onSelectDate,
  onOpenCalendar,
  onNavigatePrev,
  onNavigateNext,
  onTapTitle,
  avatarLetter,
  textColor,
  textSecondaryColor,
  textTertiaryColor,
  cardColor,
  cardBorderColor,
  primaryForegroundColor,
}: TodayDateHeaderProps) {
  const router = useRouter();
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable
            onPress={onNavigatePrev}
            hitSlop={12}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: cardColor,
              borderWidth: 1,
              borderColor: cardBorderColor,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChevronLeft size={16} color={textColor} />
          </Pressable>
          <Pressable onPress={onTapTitle} hitSlop={8}>
            {/* 2026-05-12 (premium-bar audit, Today header upgrade):
                drop the small-caps date eyebrow when the h1 is already
                "Today" — the eyebrow's "Apr 22 · Tuesday" duplicates
                what the h1 implies. Keep the eyebrow for non-today
                date selections (so "Sat Apr 19" h1 still has the
                weekday-name context above it) and for the week view
                (`weekLabel` is the date range). */}
            {!(viewMode === "day" && isToday) ? (
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 11,
                  fontWeight: "500",
                  color: textTertiaryColor,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                }}
              >
                {viewMode === "week"
                  ? weekLabel
                  : `${selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${selectedDate.toLocaleDateString("en-US", { weekday: "long" })}`}
              </Text>
            ) : null}
            <Text style={{ fontSize: 22, fontWeight: "700", color: textColor, letterSpacing: -0.4, marginTop: 1 }}>
              {viewMode === "week" ? "This Week" : isToday ? "Today" : formatDateLabel(selectedDate)}
            </Text>
          </Pressable>
          <Pressable
            onPress={onNavigateNext}
            hitSlop={12}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: cardColor,
              borderWidth: 1,
              borderColor: cardBorderColor,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChevronRight size={16} color={textColor} />
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {/* F-84 (2026-04-25) — icon-style scope toggle. Was "Day | Week"
              text, which read as date-nav alongside the prev/next chevrons
              and week strip and confused first-time users (customer-lens
              2026-04-25: "three time-navigation things on one screen.
              Why?"). Sun = Day (single-day dashboard), grid = Week (week
              roll-up). Accessibility labels carry the original text so
              screen readers still announce "Day view" / "Week view". */}
          <View
            style={{
              flexDirection: "row",
              borderRadius: 8,
              backgroundColor: cardColor,
              borderWidth: 1,
              borderColor: cardBorderColor,
              overflow: "hidden",
            }}
          >
            <Pressable
              onPress={() => onViewModeChange("day")}
              accessibilityRole="button"
              accessibilityLabel="Day view"
              accessibilityState={{ selected: viewMode === "day" }}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 6,
                backgroundColor: viewMode === "day" ? Accent.primary : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sun
                size={14}
                color={viewMode === "day" ? primaryForegroundColor : textSecondaryColor}
              />
            </Pressable>
            <Pressable
              onPress={() => onViewModeChange("week")}
              accessibilityRole="button"
              accessibilityLabel="Week view"
              accessibilityState={{ selected: viewMode === "week" }}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 6,
                backgroundColor: viewMode === "week" ? Accent.primary : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <LayoutGrid
                size={14}
                color={viewMode === "week" ? primaryForegroundColor : textSecondaryColor}
              />
            </Pressable>
          </View>
          {/* Audit 2026-04-30: avatar pill is the universal profile-entry
              affordance (Cal AI / MFP / Lifesum all do this). Was a static
              `<View>` with no onPress — now routes to /profile. */}
          <Pressable
            onPress={() => router.push("/profile")}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            {/* Audit 2026-05-04 #12: previously a flat blue rounded
                square. The prototype + brand carryover rules call for
                the brand-gradient circular avatar (matches Profile,
                Settings, the More tab) — same paint path as the
                shared `<GradientAvatar>` primitive.

                ENG-99 (2026-05-13): the prototype canon spec is a
                **36×36** gradient avatar — bumped from 32 so the
                Today header's primary profile-entry affordance
                reaches the prototype size. Day/Week toggle to the
                left of this is functional view-mode scope (not the
                "theme toggle" the audit also called out — theme was
                already moved to More/Settings). */}
            <GradientAvatar
              size={36}
              initial={avatarLetter}
              fontSize={13}
              gradientIdSuffix="today-header"
            />
          </Pressable>
        </View>
      </View>
      {viewMode === "day" && (
        <DayStrip
          selectedDate={selectedDate}
          weekStartDay={weekStartDay}
          loggedDays={loggedDays}
          protectedDateKeys={protectedDateKeys}
          onSelectDate={onSelectDate}
          onOpenCalendar={onOpenCalendar}
          textColor={textColor}
          secondaryColor={textSecondaryColor}
        />
      )}
    </View>
  );
}

export default TodayDateHeader;
