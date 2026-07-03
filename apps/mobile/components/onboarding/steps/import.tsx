import * as React from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
// ENG-120: lucide has no brand glyph — Ionicons retained for logo-* only
import { Ionicons } from "@expo/vector-icons";
import { Check, Globe, Link2 } from "lucide-react-native";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useMacroColors } from "@/lib/macroColors";
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
              paddingHorizontal: Spacing.md,
              paddingVertical: Spacing.dense,
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
              style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}
            >
              <Link2 size={14} color={colors.textTertiary} />
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
              marginBottom: Spacing.sm,
            }}
          >
            Or pick a source
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <SourceTile
              icon={
                <Ionicons
                  name="logo-instagram"
                  size={22}
                  color={colors.textSecondary}
                />
              }
              name="Instagram"
              onPress={() => runImport("instagram")}
            />
            <SourceTile
              icon={
                <Ionicons
                  name="logo-tiktok"
                  size={22}
                  color={colors.textSecondary}
                />
              }
              name="TikTok"
              onPress={() => runImport("tiktok")}
            />
            <SourceTile
              icon={<Globe size={22} color={colors.textSecondary} />}
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
  icon: React.ReactNode;
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
      {icon}
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
        padding: Spacing.xl,
        alignItems: "center",
      }}
    >
      <ActivityIndicator size="large" color={accent.primaryLight} />
      <Text
        style={{
          fontFamily: Type.bodyLarge.fontFamily,
          fontSize: Type.bodyLarge.fontSize,
          lineHeight: Type.bodyLarge.lineHeight,
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
              gap: Spacing.sm,
              alignItems: "center",
              paddingVertical: Spacing.sm,
              opacity: i <= cur ? 1 : 0.35,
            }}
          >
            {i < cur ? (
              <Check size={14} color={Accent.successLight} />
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
                ...Type.captionSmall,
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
  const { colors: macro } = useMacroColors();
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
          <Check size={14} color={Accent.successLight} />
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
          style={{ ...Type.captionSmall, color: colors.textSecondary, marginBottom: Spacing.md }}
        >
          {`4 servings · 32 min · ${src}`}
        </Text>
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            paddingTop: Spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <MiniStat n="620" u="kcal" c={Accent.successLight} />
          <MiniStat n="48" u="P g" c={macro.protein} />
          <MiniStat n="52" u="C g" c={macro.carbs} />
          <MiniStat n="22" u="F g" c={macro.fat} />
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
          fontFamily: Type.bodyLarge.fontFamily,
          fontSize: Type.bodyLarge.fontSize,
          lineHeight: Type.bodyLarge.lineHeight,
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
