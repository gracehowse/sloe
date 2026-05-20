import React from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Sun,
} from "lucide-react-native";
import { Accent } from "@/constants/theme";
import DayStrip from "@/components/charts/DayStrip";
import { GradientAvatar } from "@/components/GradientAvatar";
import { StreakPip } from "@/components/today/StreakPip";

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
  /**
   * Premium-bar audit DC8 polish (2026-05-14) — pass-through props for
   * the inline StreakPip. The pip used to live above the date header
   * row; the audit moves it next to the "Today" pill so the week-
   * strip row reads as one calm unit. When `streakDays` is undefined
   * the pip is suppressed (matches the existing day-1 carve-out: pip
   * only renders for streaks ≥ 2; host gates that). `freezeProtected`
   * flips the Flame glyph to a Shield when a freeze covered today.
   * `onStreakPress` is the same router push the host used previously
   * (typically to `/weekly-recap`).
   */
  streakDays?: number;
  freezeProtected?: boolean;
  onStreakPress?: () => void;
  /**
   * Premium-bar audit DC8 polish (2026-05-14) — when supplied AND the
   * streak just reset (host detects with `didStreakReset`), render
   * a calm supportive reset-day copy in place of the streak pip. The
   * host owns the "just reset" detection (transient — one render
   * window) so this component stays presentation-only.
   */
  streakResetCopyVisible?: boolean;
  /**
   * Premium P1 cold-open (ENG-584): hide Day/Week toggle (Sun / grid).
   */
  hideViewModeToggle?: boolean;
  /**
   * Premium P1 cold-open (ENG-584): hide inline week day-strip row.
   * When true, title + calendar button open `onOpenCalendar`; chevrons
   * still step by day.
   */
  hideDayStrip?: boolean;
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
  streakDays,
  freezeProtected,
  onStreakPress,
  streakResetCopyVisible = false,
  hideViewModeToggle = false,
  hideDayStrip = false,
}: TodayDateHeaderProps) {
  const router = useRouter();
  const calmDateNav = hideDayStrip && viewMode === "day";
  const navIconButtonStyle = {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: cardColor,
    borderWidth: 1,
    borderColor: cardBorderColor,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable
            onPress={onNavigatePrev}
            hitSlop={12}
            style={navIconButtonStyle}
            accessibilityRole="button"
            accessibilityLabel={viewMode === "week" ? "Previous week" : "Previous day"}
          >
            <ChevronLeft size={16} color={textColor} />
          </Pressable>
          <Pressable
            onPress={calmDateNav ? onOpenCalendar : onTapTitle}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={
              calmDateNav ? "Choose date" : isToday ? "Today" : formatDateLabel(selectedDate)
            }
          >
            {/* Drop the eyebrow on any day-view render — the h1
                already says "Today" / "Yesterday" / "Tue 16 Jun"; the
                user doesn't need a second copy. Keep only for week
                view where the h1 = "This Week" and the eyebrow carries
                the range. */}
            {viewMode === "week" ? (
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
                {weekLabel}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 1 }}>
              <Text style={{ fontSize: 22, fontWeight: "700", color: textColor, letterSpacing: -0.4 }}>
                {viewMode === "week" ? "This Week" : isToday ? "Today" : formatDateLabel(selectedDate)}
              </Text>
              {/* 2026-05-14 (premium-bar audit DC8 polish): streak pip
                  rendered inline next to the "Today" h1 so the
                  week-strip row reads as a single unit (was: pip
                  floating above the date header). The host gates
                  `streakDays >= 2` per the existing day-0 / day-1
                  carve-out; this component just renders the pip
                  when the host hands it a value. Suppress on week
                  view to keep the week toggle uncrowded (matches
                  pre-move behaviour). */}
              {viewMode === "day" &&
                isToday &&
                typeof streakDays === "number" &&
                streakDays >= 2 &&
                !streakResetCopyVisible && (
                  <StreakPip
                    days={streakDays}
                    freezeProtected={freezeProtected}
                    onPress={onStreakPress}
                  />
                )}
            </View>
          </Pressable>
          {calmDateNav && !isToday ? (
            <Pressable
              onPress={onTapTitle}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Jump to today"
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: Accent.primary,
                }}
              >
                Today
              </Text>
            </Pressable>
          ) : null}
          {calmDateNav ? (
            <Pressable
              onPress={onOpenCalendar}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Open calendar"
              style={navIconButtonStyle}
            >
              <Calendar size={16} color={textSecondaryColor} strokeWidth={1.75} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={onNavigateNext}
            hitSlop={12}
            disabled={calmDateNav && isToday}
            accessibilityRole="button"
            accessibilityLabel={viewMode === "week" ? "Next week" : "Next day"}
            accessibilityState={{ disabled: calmDateNav && isToday }}
            style={[navIconButtonStyle, calmDateNav && isToday ? { opacity: 0.35 } : null]}
          >
            <ChevronRight size={16} color={textColor} />
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {!hideViewModeToggle ? (
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
                  backgroundColor: viewMode === "day" ? Accent.primary + "1F" : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Sun
                  size={14}
                  color={viewMode === "day" ? Accent.primary : textSecondaryColor}
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
                  backgroundColor: viewMode === "week" ? Accent.primary + "1F" : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <LayoutGrid
                  size={14}
                  color={viewMode === "week" ? Accent.primary : textSecondaryColor}
                />
              </Pressable>
            </View>
          ) : null}
          {/* Audit 2026-04-30: avatar pill is the universal profile-entry
              affordance (Cal AI / MFP / Lifesum all do this). Was a static
              `<View>` with no onPress — now routes to /profile. */}
          <Pressable
            onPress={() => router.push("/(tabs)/settings")}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            {/* Premium ink avatar (2026-05-20) — 36×36, matches Profile
                / Settings / sidebar; default `GradientAvatar` ink fill. */}
            <GradientAvatar
              size={36}
              initial={avatarLetter}
              fontSize={13}
              gradientIdSuffix="today-header"
            />
          </Pressable>
        </View>
      </View>
      {viewMode === "day" && !hideDayStrip && (
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
      {/* 2026-05-14 (premium-bar audit DC8 polish — Duolingo
          supportive reset-day copy): when the user's streak just
          broke (host detects the >=1 → 0 transition with
          `didStreakReset` and toggles `streakResetCopyVisible`), the
          numeric streak pip is suppressed and this calm one-line
          message takes its place under the week strip. Sits below
          the DayStrip so the reset framing isn't crammed into the
          tight header row. The pip continues to reappear once the
          user logs and the streak climbs back to 2+. */}
      {viewMode === "day" && isToday && streakResetCopyVisible && (
        <View
          accessibilityRole="text"
          accessibilityLabel="Streak reset — start fresh today"
          style={{
            paddingHorizontal: 4,
            paddingVertical: 6,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              color: textSecondaryColor,
              letterSpacing: 0.1,
            }}
            numberOfLines={2}
          >
            Every expert was once a beginner. Start fresh today.
          </Text>
        </View>
      )}
    </View>
  );
}

export default TodayDateHeader;
