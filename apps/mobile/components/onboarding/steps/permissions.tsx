import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Accent, MacroColors } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useOnboarding } from "../context";
import { MobileStepBody, MobileStepHeader, useStepOverline } from "../scaffold";

export function MobilePermissionsStep() {
  const { state, set } = useOnboarding();
  const overline = useStepOverline();
  return (
    <MobileStepBody>
      <MobileStepHeader
        overline={overline}
        title="A couple of permissions"
        subtitle="Both are optional and you can change them later in Settings."
      />
      <PermissionCard
        icon="heart-outline"
        iconColor={MacroColors.fat}
        title="Apple Health"
        body="Read your active energy and steps to refine your adaptive TDEE. Suppr does not write to Health."
        granted={state.healthGranted}
        onAllow={() => set({ healthGranted: true })}
        onSkip={() => set({ healthGranted: false })}
      />
      <PermissionCard
        icon="notifications-outline"
        iconColor={Accent.warning}
        title="Notifications"
        body="Gentle reminders only — an evening nudge when you're off-target, plus a Sunday recap of your week."
        granted={state.notifGranted}
        onAllow={() => set({ notifGranted: true })}
        onSkip={() => set({ notifGranted: false })}
      />
    </MobileStepBody>
  );
}

function PermissionCard({
  icon,
  iconColor,
  title,
  body,
  granted,
  onAllow,
  onSkip,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  body: string;
  granted: boolean | null;
  onAllow: () => void;
  onSkip: () => void;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: granted === true ? Accent.success + "66" : colors.border,
      }}
    >
      <View
        style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 12 }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: iconColor + "26",
          }}
        >
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: colors.text,
              letterSpacing: -0.2,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              marginTop: 4,
              lineHeight: 18,
            }}
          >
            {body}
          </Text>
        </View>
      </View>
      {granted === true ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="checkmark" size={14} color={Accent.successLight} />
          <Text style={{ fontSize: 12, fontWeight: "700", color: Accent.successLight }}>
            Allowed
          </Text>
        </View>
      ) : granted === false ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            Skipped — you can allow later
          </Text>
          <Pressable onPress={onAllow}>
            <Text
              style={{ fontSize: 12, fontWeight: "700", color: Accent.primaryLight }}
            >
              Undo
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={onAllow}
            accessibilityRole="button"
            accessibilityLabel="Allow"
            style={({ pressed }) => ({
              flex: 1,
              height: 40,
              borderRadius: 12,
              backgroundColor: Accent.primary,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: "#0a0a0f", fontSize: 13, fontWeight: "700" }}>
              Allow
            </Text>
          </Pressable>
          <Pressable
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel="Not now"
            style={({ pressed }) => ({
              flex: 1,
              height: 40,
              borderRadius: 12,
              backgroundColor: colors.inputBg,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
              Not now
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
