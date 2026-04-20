import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Accent, Radius, Spacing } from "@/constants/theme";

/**
 * TodayHeroVariantPicker — user-facing "change hero style" chooser.
 *
 * Ported from the 2026-04-19 Claude Design prototype
 * (`docs/prototypes/2026-04-19-whole-app-experience/project/screens-mobile.jsx`).
 * The web prototype used an absolute-positioned popover anchored to a
 * grid icon in the hero card's top-right. On mobile we use a Modal
 * (backdrop + centred sheet) — more idiomatic for React Native,
 * accessible out of the box (Escape / back button / backdrop tap).
 *
 * The grid icon ("change hero style") is rendered by the parent in the
 * absolute corner of the hero card — not by this component — so the
 * picker is just the modal. Keep separation of concerns clean.
 */
export type TodayHeroVariant = "ring" | "bar" | "number";

export interface TodayHeroVariantPickerProps {
  visible: boolean;
  active: TodayHeroVariant;
  onSelect: (variant: TodayHeroVariant) => void;
  onClose: () => void;
  cardBackgroundColor: string;
  borderColor: string;
  textColor: string;
  textTertiaryColor: string;
}

type Option = {
  id: TodayHeroVariant;
  label: string;
  sub: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
};

const OPTIONS: Option[] = [
  { id: "ring", label: "Ring", sub: "Macros on tap", icon: "ellipse-outline" },
  { id: "bar", label: "Bar", sub: "Linear progress", icon: "remove-outline" },
  { id: "number", label: "Number", sub: "Big & plain", icon: "pricetag-outline" },
];

export function TodayHeroVariantPicker({
  visible,
  active,
  onSelect,
  onClose,
  cardBackgroundColor,
  borderColor,
  textColor,
  textTertiaryColor,
}: TodayHeroVariantPickerProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close hero style picker"
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.67)",
          justifyContent: "center",
          alignItems: "center",
          padding: Spacing.xl,
        }}
      >
        {/* Stop propagation — taps inside the card shouldn't dismiss */}
        <Pressable
          onPress={() => {}}
          style={{
            width: "100%",
            maxWidth: 320,
            backgroundColor: cardBackgroundColor,
            borderWidth: 1,
            borderColor: borderColor,
            borderRadius: Radius.lg,
            padding: Spacing.md,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "600",
              color: textTertiaryColor,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              paddingHorizontal: Spacing.sm,
              paddingBottom: Spacing.sm,
            }}
          >
            Hero style
          </Text>
          {OPTIONS.map((opt) => {
            const isActive = active === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => {
                  onSelect(opt.id);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${opt.label} hero — ${opt.sub}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: Spacing.md,
                  padding: Spacing.md,
                  borderRadius: Radius.md,
                  backgroundColor: isActive ? `${Accent.primary}20` : "transparent",
                }}
              >
                <Ionicons
                  name={opt.icon}
                  size={18}
                  color={isActive ? Accent.primary : textTertiaryColor}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: isActive ? Accent.primary : textColor,
                    }}
                  >
                    {opt.label}
                  </Text>
                  <Text style={{ fontSize: 11, color: textTertiaryColor, marginTop: 2 }}>
                    {opt.sub}
                  </Text>
                </View>
                {isActive && (
                  <Ionicons name="checkmark" size={16} color={Accent.primary} />
                )}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default TodayHeroVariantPicker;
