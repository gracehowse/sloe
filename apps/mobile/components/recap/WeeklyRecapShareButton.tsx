import { useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, View } from "react-native";
import type SvgType from "react-native-svg";
import { SupprButton } from "@/components/ui/SupprButton";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Radius, Spacing } from "@/constants/theme";
import { MODAL_OVERLAY_SCRIM } from "@suppr/shared/theme/modalOverlay";
import {
  deriveWeeklyRecapStats,
  type RecapWeekDayTotals,
} from "@suppr/nutrition-core/weeklyRecapStats";
import { WeeklyRecapCard } from "./WeeklyRecapCard";
import { shareRecapPng } from "@/lib/recapShare";

/**
 * WeeklyRecapShareButton (mobile, ENG-1225 #4) — the parity mirror of the web
 * `WeeklyRecapDialog`'s share path: a "Share this week" trigger that opens the
 * shareable `WeeklyRecapCard` in a house bottom-sheet and hands the rasterised
 * PNG to the iOS share sheet (`shareRecapPng`). Self-contained so the pinned
 * recap screen only adds one line. Stats derive from the same shared
 * `deriveWeeklyRecapStats` as web.
 */
export function WeeklyRecapShareButton({
  weekLabel,
  days,
  targetCalories,
}: {
  weekLabel: string;
  days: RecapWeekDayTotals[];
  targetCalories: number;
}) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<SvgType>(null);

  const { dailyCalories, onTargetDays, narrative } = deriveWeeklyRecapStats(
    days,
    targetCalories,
  );

  const onShare = async () => {
    setSharing(true);
    try {
      const res = await shareRecapPng(cardRef.current);
      // A user-cancelled share sheet reports share_failed — don't nag for that.
      if (!res.ok && res.reason !== "share_failed") Alert.alert("Couldn't share", res.message);
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      <SupprButton
        variant="ghost"
        label="Share this week"
        onPress={() => setOpen(true)}
        accessibilityLabel="Share this week's recap"
      />

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <Pressable
            onPress={() => setOpen(false)}
            style={{ flex: 1, backgroundColor: MODAL_OVERLAY_SCRIM, justifyContent: "flex-end" }}
          >
            <Pressable
              onPress={() => {}}
              style={{
                backgroundColor: colors.card,
                borderTopLeftRadius: SHEET_RADIUS,
                borderTopRightRadius: SHEET_RADIUS,
                padding: Spacing.lg,
                paddingBottom: Spacing.xl,
                alignItems: "center",
                gap: Spacing.md,
              }}
            >
              <View style={{ width: 36, height: 4, borderRadius: Radius.full, backgroundColor: colors.cardBorder }} />
              <View style={{ borderRadius: 24, overflow: "hidden" }}>
                <WeeklyRecapCard
                  ref={cardRef}
                  weekLabel={weekLabel}
                  onTargetDays={onTargetDays}
                  dailyCalories={dailyCalories}
                  targetCalories={Math.round(targetCalories)}
                  narrative={narrative}
                  width={300}
                />
              </View>
              <View style={{ flexDirection: "row", gap: Spacing.sm, alignSelf: "stretch" }}>
                <View style={{ flex: 1 }}>
                  <SupprButton variant="ghost" label="Done" onPress={() => setOpen(false)} />
                </View>
                <View style={{ flex: 1 }}>
                  <SupprButton
                    variant="primary"
                    label="Share"
                    loading={sharing}
                    onPress={() => void onShare()}
                    accessibilityLabel="Share recap image"
                  />
                </View>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

export default WeeklyRecapShareButton;
