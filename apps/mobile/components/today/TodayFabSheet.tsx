import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Accent, Radius, Spacing } from "@/constants/theme";

/**
 * TodayFabSheet — FAB + its bottom sheet of log actions.
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18). Host owns the sheet visibility and action wiring; the
 * component renders the FAB button + the sheet.
 */
export interface TodayFabSheetProps {
  fabVisible: boolean;
  sheetVisible: boolean;
  onOpenSheet: () => void;
  onCloseSheet: () => void;
  onOpenPrevious: () => void;
  onOpenSearch: () => void;
  onOpenBarcode: () => void;
  onOpenQuickAdd: () => void;
  onOpenPhotoLog: () => void;
  onOpenVoiceLog: () => void;
  cardColor: string;
  inputBgColor: string;
  borderColor: string;
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
}

export function TodayFabSheet(props: TodayFabSheetProps) {
  const insets = useSafeAreaInsets();
  const {
    fabVisible,
    sheetVisible,
    onOpenSheet,
    onCloseSheet,
    onOpenPrevious,
    onOpenSearch,
    onOpenBarcode,
    onOpenQuickAdd,
    onOpenPhotoLog,
    onOpenVoiceLog,
    cardColor,
    inputBgColor,
    borderColor,
    textColor,
    textSecondaryColor,
    textTertiaryColor,
  } = props;

  return (
    <>
      {fabVisible && (
        <Pressable
          onPress={onOpenSheet}
          accessibilityRole="button"
          accessibilityLabel="Log food"
          accessibilityHint="Opens a menu to add meals"
          style={{
            position: "absolute",
            right: Spacing.xl,
            bottom: 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: Accent.primary,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: Accent.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <Ionicons
            name="add"
            size={28}
            color="#fff"
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </Pressable>
      )}

      <Modal visible={sheetVisible} transparent animationType="slide" onRequestClose={onCloseSheet}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.5)" }]}
            onPress={onCloseSheet}
          />
          <View
            style={{
              backgroundColor: cardColor,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingTop: Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
              paddingHorizontal: Spacing.xl,
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: borderColor,
                alignSelf: "center",
                marginBottom: Spacing.lg,
              }}
            />
            <Text style={{ fontSize: 16, fontWeight: "700", color: textColor, marginBottom: Spacing.sm }}>
              Log Food
            </Text>
            <Text style={{ fontSize: 11, color: textTertiaryColor, marginBottom: Spacing.lg, lineHeight: 16 }}>
              Photo and voice send data to our servers and may use AI (see Privacy policy in More).
            </Text>

            {/* P1-18 (TestFlight 2026-04-25 ui-critic): the previous
                4+2 grid of equally-weighted icon tiles offered six
                top-level entry points with no hierarchy. Search is the
                expected default — promote to a full-width row at top
                that reads as the primary input surface; demote the
                rest to a single 4-icon-strip below (Previous / Scan /
                Photo / Voice). Quick Add was redundant with the
                in-page accordion on Today and is dropped from the
                sheet (still reachable on Today directly). */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Search foods"
              onPress={onOpenSearch}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: Spacing.sm,
                paddingHorizontal: Spacing.md,
                paddingVertical: 14,
                borderRadius: Radius.md,
                backgroundColor: Accent.primary,
                marginBottom: Spacing.md,
              }}
            >
              <Ionicons name="search" size={18} color="#fff" />
              <Text style={{ flex: 1, fontSize: 14, fontWeight: "700", color: "#fff" }}>
                Search foods…
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#fff" />
            </Pressable>

            <View style={{ flexDirection: "row", gap: Spacing.sm }}>
              {[
                { icon: "time-outline" as const, label: "Previous", onPress: onOpenPrevious },
                { icon: "barcode-outline" as const, label: "Scan", onPress: onOpenBarcode },
                { icon: "camera-outline" as const, label: "Photo", onPress: onOpenPhotoLog },
                { icon: "mic-outline" as const, label: "Voice", onPress: onOpenVoiceLog },
              ].map((item) => (
                <Pressable
                  key={item.label}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  onPress={item.onPress}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    paddingVertical: Spacing.md,
                    borderRadius: Radius.md,
                    backgroundColor: inputBgColor,
                    borderWidth: 1,
                    borderColor: borderColor,
                  }}
                >
                  <Ionicons
                    name={item.icon}
                    size={22}
                    color={textSecondaryColor}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                  <Text style={{ fontSize: 11, fontWeight: "600", color: textSecondaryColor, marginTop: 6 }}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {/* Quick Add demoted to a footer link — still reachable but
                no longer competing with Search for primary visual
                weight. The in-page Today accordion remains the main
                quick-add surface. */}
            <Pressable
              onPress={onOpenQuickAdd}
              accessibilityRole="button"
              accessibilityLabel="Quick add (calories or macros)"
              style={{ alignItems: "center", paddingVertical: Spacing.md, marginTop: Spacing.sm }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: Accent.primary }}>
                Or enter calories manually
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default TodayFabSheet;
