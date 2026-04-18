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

            <View style={{ flexDirection: "row", gap: Spacing.md }}>
              {[
                { icon: "time-outline" as const, label: "Previous", onPress: onOpenPrevious },
                { icon: "search" as const, label: "Search", onPress: onOpenSearch },
                { icon: "barcode-outline" as const, label: "Scan", onPress: onOpenBarcode },
                { icon: "add-circle-outline" as const, label: "Quick Add", onPress: onOpenQuickAdd },
              ].map((item) => (
                <Pressable
                  key={item.label}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  onPress={item.onPress}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    paddingVertical: Spacing.lg,
                    borderRadius: Radius.md,
                    backgroundColor: Accent.primary + "15",
                    borderWidth: 1,
                    borderColor: Accent.primary + "30",
                  }}
                >
                  <Ionicons
                    name={item.icon}
                    size={24}
                    color={Accent.primary}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: Accent.primary, marginTop: 6 }}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: Spacing.md, marginTop: Spacing.sm }}>
              {[
                { icon: "camera-outline" as const, label: "Photo (AI)", onPress: onOpenPhotoLog },
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
                  }}
                >
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={textSecondaryColor}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                  <Text style={{ fontSize: 11, fontWeight: "600", color: textSecondaryColor, marginTop: 4 }}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default TodayFabSheet;
