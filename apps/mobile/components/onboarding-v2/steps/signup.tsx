import * as React from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Accent, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useOnboardingV2 } from "../context";
import { MobileStepBody, MobileStepHeader } from "../scaffold";

export function MobileSignupStep() {
  const { state, set, go } = useOnboardingV2();
  const colors = useThemeColors();
  return (
    <MobileStepBody>
      <MobileStepHeader
        overline="Step 02 of 12"
        title="Create your account"
        subtitle="One account, same data on your phone and on the web."
      />

      <Pressable
        onPress={() => {
          set({ authMethod: "apple" });
          go(1);
        }}
        accessibilityRole="button"
        accessibilityLabel="Sign in with Apple"
        style={({ pressed }) => ({
          height: 48,
          borderRadius: 12,
          backgroundColor: "#000",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          marginBottom: 16,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Ionicons name="logo-apple" size={18} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
          Sign in with Apple
        </Text>
      </Pressable>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          marginVertical: 16,
        }}
      >
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text
          style={{
            fontSize: 11,
            color: colors.textTertiary,
            fontWeight: "600",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          Or
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>

      <LabelledField
        label="First name"
        value={state.name}
        onChange={(v) => set({ name: v })}
        placeholder="Grace"
      />
      <View style={{ height: 10 }} />
      <LabelledField
        label="Email"
        value={state.email}
        onChange={(v) => set({ email: v })}
        placeholder="you@example.com"
        keyboardType="email-address"
      />

      <Text
        style={{
          fontSize: 11,
          color: colors.textTertiary,
          marginTop: 16,
          lineHeight: 17,
        }}
      >
        By continuing you agree to Suppr&apos;s Terms and Privacy Policy.
      </Text>
    </MobileStepBody>
  );
}

function LabelledField({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address";
}) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: Radius.md,
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: 1,
          color: colors.textTertiary,
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={keyboardType === "email-address" ? "none" : "words"}
        style={{
          fontSize: 16,
          color: colors.text,
          paddingVertical: 0,
        }}
      />
    </View>
  );
}
