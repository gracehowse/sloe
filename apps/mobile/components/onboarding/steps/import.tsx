import * as React from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Accent, MacroColors, Radius } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useOnboarding } from "../context";
import type { ImportSource } from "@/lib/onboarding";
import { MobileStepBody, MobileStepHeader, useStepOverline } from "../scaffold";

type Phase = "idle" | "parsing" | "done";

export function MobileImportStep() {
  const { state, set } = useOnboarding();
  const overline = useStepOverline();
  const [url, setUrl] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("idle");
  const colors = useThemeColors();

  const runImport = (src: ImportSource) => {
    set({ importSource: src });
    setPhase("parsing");
    const t = setTimeout(() => setPhase("done"), 2200);
    return () => clearTimeout(t);
  };

  return (
    <MobileStepBody>
      <MobileStepHeader
        overline={overline}
        title="Try importing a recipe"
        subtitle="Paste a link or pick a source — Sloe parses ingredients and matches each against USDA / Open Food Facts."
      />

      {phase === "idle" ? (
        <>
          <View
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: Radius.md,
              paddingHorizontal: 14,
              paddingVertical: 10,
              marginBottom: 16,
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
              Recipe URL
            </Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Ionicons name="link-outline" size={14} color={colors.textTertiary} />
              <TextInput
                value={url}
                onChangeText={setUrl}
                placeholder="https://www.instagram.com/reel/…"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                keyboardType="url"
                style={{
                  flex: 1,
                  fontSize: 16,
                  color: colors.text,
                  paddingVertical: 0,
                }}
              />
            </View>
          </View>
          <Pressable
            onPress={() => runImport("instagram")}
            accessibilityRole="button"
            accessibilityLabel={url ? "Import this recipe" : "Try a sample recipe"}
            style={({ pressed }) => ({
              height: 48,
              borderRadius: 12,
              backgroundColor: colors.inputBg,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>
              {url ? "Import this recipe" : "Try a sample recipe"}
            </Text>
          </Pressable>

          <Text
            style={{
              fontSize: 11,
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: 1,
              color: colors.textTertiary,
              marginTop: 20,
              marginBottom: 10,
            }}
          >
            Or pick a source
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <SourceTile
              icon="logo-instagram"
              name="Instagram"
              onPress={() => runImport("instagram")}
            />
            <SourceTile
              icon="logo-tiktok"
              name="TikTok"
              onPress={() => runImport("tiktok")}
            />
            <SourceTile
              icon="globe-outline"
              name="Any blog"
              onPress={() => runImport("blog")}
            />
          </View>
        </>
      ) : phase === "parsing" ? (
        <ImportParsing />
      ) : (
        <ImportDone source={state.importSource} />
      )}
    </MobileStepBody>
  );
}

function SourceTile({
  icon,
  name,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  name: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Import from ${name}`}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: Radius.md + 2,
        padding: 16,
        alignItems: "center",
        gap: 8,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Ionicons name={icon} size={22} color={colors.textSecondary} />
      <Text
        style={{ fontSize: 12, fontWeight: "600", color: colors.text }}
      >
        {name}
      </Text>
    </Pressable>
  );
}

function ImportParsing() {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the parsing spinner
  // and the in-progress step marker. Completed steps keep `Accent.successLight`
  // (green status), and the matched-macro stats keep their `MacroColors`.
  const accent = useAccent();
  const steps = [
    "Fetching recipe…",
    "Parsing ingredients with natural-language model",
    "Matching against USDA food database",
    "Calculating macros and confidence",
  ];
  const [cur, setCur] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(
      () => setCur((c) => Math.min(steps.length - 1, c + 1)),
      500,
    );
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: Radius.md + 2,
        padding: 22,
        alignItems: "center",
      }}
    >
      <ActivityIndicator size="large" color={accent.primaryLight} />
      <Text
        style={{
          fontSize: 15,
          fontWeight: "700",
          color: colors.text,
          marginVertical: 16,
        }}
      >
        Importing your recipe
      </Text>
      <View style={{ alignSelf: "stretch" }}>
        {steps.map((s, i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              gap: 10,
              alignItems: "center",
              paddingVertical: 6,
              opacity: i <= cur ? 1 : 0.35,
            }}
          >
            {i < cur ? (
              <Ionicons name="checkmark" size={14} color={Accent.successLight} />
            ) : (
              <View
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  borderWidth: 1.5,
                  borderColor:
                    i === cur ? accent.primaryLight : colors.cardBorder,
                  backgroundColor:
                    i === cur ? accent.primary + "33" : "transparent",
                }}
              />
            )}
            <Text
              style={{
                fontSize: 12,
                color: i <= cur ? colors.text : colors.textSecondary,
              }}
            >
              {s}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ImportDone({ source }: { source: ImportSource }) {
  const colors = useThemeColors();
  const src =
    source === "tiktok"
      ? "tiktok.com"
      : source === "blog"
        ? "seriouseats.com"
        : "instagram.com";
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderColor: Accent.success + "66",
        borderWidth: 1,
        borderRadius: Radius.md + 2,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          aspectRatio: 16 / 9,
          backgroundColor: colors.inputBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 1.5,
            color: colors.textTertiary,
            fontWeight: "600",
          }}
        >
          recipe photo
        </Text>
      </View>
      <View style={{ padding: 16 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <Ionicons name="checkmark" size={14} color={Accent.successLight} />
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 1,
              color: Accent.successLight,
            }}
          >
            Example · matched against USDA
          </Text>
        </View>
        <Text
          style={{
            fontSize: 17,
            fontWeight: "700",
            color: colors.text,
            letterSpacing: -0.4,
            marginBottom: 4,
          }}
        >
          Sheet-pan chicken with roasted peppers
        </Text>
        <Text
          style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 14 }}
        >
          {`4 servings · 32 min · ${src}`}
        </Text>
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            paddingTop: 14,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <MiniStat n="620" u="kcal" c={Accent.successLight} />
          <MiniStat n="48" u="P g" c={MacroColors.protein} />
          <MiniStat n="52" u="C g" c={MacroColors.carbs} />
          <MiniStat n="22" u="F g" c={MacroColors.fat} />
        </View>
      </View>
    </View>
  );
}

function MiniStat({ n, u, c }: { n: string; u: string; c: string }) {
  const colors = useThemeColors();
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          fontSize: 15,
          fontWeight: "700",
          color: colors.text,
          fontVariant: ["tabular-nums"],
          letterSpacing: -0.3,
        }}
      >
        {n}
      </Text>
      <Text
        style={{
          fontSize: 10,
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: 0.8,
          marginTop: 2,
          color: c,
        }}
      >
        {u}
      </Text>
    </View>
  );
}
