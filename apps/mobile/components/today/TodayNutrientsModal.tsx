import React from "react";
import { Spacing } from "@/constants/theme";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";

/**
 * TodayNutrientsModal — "View all nutrients" day sheet.
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18).
 */
export interface TodayNutrientsModalProps {
  visible: boolean;
  onClose: () => void;
  rows: { key: string; label: string; value: string }[];
  backgroundColor: string;
  cardColor: string;
  cardBorderColor: string;
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
}

export function TodayNutrientsModal({
  visible,
  onClose,
  rows,
  backgroundColor,
  cardColor,
  cardBorderColor,
  textColor,
  textSecondaryColor,
  textTertiaryColor,
}: TodayNutrientsModalProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={{
            backgroundColor,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            paddingTop: Spacing.dense,
            paddingBottom: insets.bottom + 20,
            maxHeight: "82%",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 16,
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: "700", color: textColor }}>Day nutrients</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <X size={24} color={textSecondaryColor} strokeWidth={2.25} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {rows.map((row) => (
                <View
                  key={row.key}
                  style={{
                    width: "48%",
                    flexGrow: 1,
                    minWidth: 140,
                    paddingVertical: Spacing.dense,
                    paddingHorizontal: Spacing.dense,
                    borderRadius: 10,
                    backgroundColor: cardColor,
                    borderWidth: 1,
                    borderColor: cardBorderColor,
                  }}
                >
                  <Text style={{ fontSize: 10, color: textTertiaryColor }}>{row.label}</Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: textColor,
                      fontVariant: ["tabular-nums"],
                      marginTop: 4,
                    }}
                  >
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default TodayNutrientsModal;
