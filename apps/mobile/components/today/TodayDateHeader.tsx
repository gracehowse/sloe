import React from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, LayoutGrid, Sun } from "lucide-react-native";
import { Spacing, Type } from "@/constants/theme";
import DayStrip from "@/components/charts/DayStrip";
import { GradientAvatar } from "@/components/GradientAvatar";
import { StreakPip } from "@/components/today/StreakPip";

/**
 * TodayDateHeader — day/week nav buttons, title, view-mode toggle, avatar,
 * and the DayStrip row.
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
  primaryForegroundColor: string;
  streakDays?: number;
  freezeProtected?: boolean;
  onStreakPress?: () => void;
  streakResetCopyVisible?: boolean;
  hideViewModeToggle?: boolean;
  hideDayStrip?: boolean;
  dayGreeting?: string;
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
  dayGreeting,
}: TodayDateHeaderProps) {
  const router = useRouter();
  const calmDateNav = hideDayStrip && viewMode === "day";

  const navChromeStyle = {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: cardColor,
    borderWidth: 1,
    borderColor: cardBorderColor,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  const navGhostStyle = {
    width: 28,
    height: 28,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  const titleText =
    viewMode === "week" ? "This Week" : isToday ? "Today" : formatDateLabel(selectedDate);

  // Canonical 2026-05-22 A3: streak chip removed from cold-open Today.
  // Anti-MFP brand should not surface streak shame as a default. Streak
  // data still flows through here; chip rendering is now permanently
  // gated. If we later want a tap-to-reveal affordance, the gate can
  // flip to `streakRevealRequested` (a future state). For now, hidden.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _streakAvailable = typeof streakDays === "number" && streakDays >= 2 && !streakResetCopyVisible;
  void _streakAvailable;
  const showStreakPip = false;

  if (calmDateNav) {
    return (
      <View style={{ gap: Spacing.xs }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Pressable
            onPress={onNavigatePrev}
            hitSlop={14}
            style={navGhostStyle}
            accessibilityRole="button"
            accessibilityLabel="Previous day"
          >
            <ChevronLeft size={20} color={textSecondaryColor} strokeWidth={2} />
          </Pressable>

          <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 2 }}>
            <Pressable
              onPress={onOpenCalendar}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Choose date"
            >
              <Text style={{ ...Type.headline, color: textColor }} numberOfLines={1}>
                {titleText}
              </Text>
              {dayGreeting && isToday ? (
                <Text
                  testID="today-greeting"
                  numberOfLines={1}
                  style={{ ...Type.caption, color: textSecondaryColor, marginTop: 1 }}
                >
                  {dayGreeting}
                </Text>
              ) : null}
            </Pressable>
            {!isToday ? (
              <Pressable
                onPress={onTapTitle}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Jump to today"
                style={{ marginTop: 2, alignSelf: "flex-start" }}
              >
                <Text style={{ ...Type.caption, fontWeight: "600", color: textSecondaryColor }}>
                  Jump to today
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Pressable
            onPress={onNavigateNext}
            hitSlop={14}
            disabled={isToday}
            style={[navGhostStyle, isToday ? { opacity: 0.2 } : null]}
            accessibilityRole="button"
            accessibilityLabel="Next day"
            accessibilityState={{ disabled: isToday }}
          >
            <ChevronRight size={20} color={textSecondaryColor} strokeWidth={2} />
          </Pressable>

          {showStreakPip ? (
            <StreakPip
              days={streakDays!}
              freezeProtected={freezeProtected}
              onPress={onStreakPress}
            />
          ) : null}

          <Pressable
            onPress={() => router.push("/(tabs)/settings")}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, marginLeft: 2 })}
          >
            <GradientAvatar size={32} initial={avatarLetter} fontSize={12} gradientIdSuffix="today-header" />
          </Pressable>
        </View>

        {streakResetCopyVisible ? (
          <Text style={{ ...Type.caption, color: textSecondaryColor }} numberOfLines={2}>
            Every expert was once a beginner. Start fresh today.
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable
            onPress={onNavigatePrev}
            hitSlop={12}
            style={navChromeStyle}
            accessibilityRole="button"
            accessibilityLabel={viewMode === "week" ? "Previous week" : "Previous day"}
          >
            <ChevronLeft size={16} color={textColor} />
          </Pressable>
          <Pressable
            onPress={onTapTitle}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={isToday ? "Today" : formatDateLabel(selectedDate)}
          >
            {viewMode === "week" ? (
              <Text numberOfLines={1} style={{ ...Type.label, color: textTertiaryColor }}>
                {weekLabel}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 1 }}>
              <Text style={{ ...Type.headline, color: textColor }}>{titleText}</Text>
              {showStreakPip ? (
                <StreakPip
                  days={streakDays!}
                  freezeProtected={freezeProtected}
                  onPress={onStreakPress}
                />
              ) : null}
            </View>
            {dayGreeting && viewMode === "day" && isToday ? (
              <Text
                testID="today-greeting"
                numberOfLines={1}
                style={{ ...Type.caption, color: textSecondaryColor, marginTop: 2 }}
              >
                {dayGreeting}
              </Text>
            ) : null}
          </Pressable>
          <Pressable
            onPress={onNavigateNext}
            hitSlop={12}
            style={navChromeStyle}
            accessibilityRole="button"
            accessibilityLabel={viewMode === "week" ? "Next week" : "Next day"}
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
                  backgroundColor:
                    viewMode === "day" ? textSecondaryColor + "18" : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Sun size={14} color={viewMode === "day" ? textColor : textSecondaryColor} />
              </Pressable>
              <Pressable
                onPress={() => onViewModeChange("week")}
                accessibilityRole="button"
                accessibilityLabel="Week view"
                accessibilityState={{ selected: viewMode === "week" }}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                  backgroundColor:
                    viewMode === "week" ? textSecondaryColor + "18" : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <LayoutGrid
                  size={14}
                  color={viewMode === "week" ? textColor : textSecondaryColor}
                />
              </Pressable>
            </View>
          ) : null}
          <Pressable
            onPress={() => router.push("/(tabs)/settings")}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <GradientAvatar size={36} initial={avatarLetter} fontSize={13} gradientIdSuffix="today-header" />
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
      {viewMode === "day" && isToday && streakResetCopyVisible && (
        <Text style={{ ...Type.caption, color: textSecondaryColor }} numberOfLines={2}>
          Every expert was once a beginner. Start fresh today.
        </Text>
      )}
    </View>
  );
}

export default TodayDateHeader;
