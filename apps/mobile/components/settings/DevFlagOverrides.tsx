import { useCallback, useState } from "react";
import { DevSettings, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  clearForcedFlags,
  getForcedFlags,
  setForcedFlag,
} from "@/lib/analytics";

/**
 * Dev-only flag-force panel (ENG-840). Lets you force any PostHog
 * feature flag ON / OFF / Auto on device or sim WITHOUT a production
 * PostHog ramp — the only previously-working path. Writes through to
 * the AsyncStorage-backed runtime override in `lib/analytics`
 * ({@link setForcedFlag}); `isFeatureEnabled` reads it first.
 *
 * Renders NOTHING outside `__DEV__`, so it never ships in a release
 * build (and the import is tree-shaken by Hermes DCE). It's mounted at
 * the bottom of the Settings scroll (`(tabs)/settings.tsx`).
 *
 * State semantics per flag:
 *   - ON   → forced `true`
 *   - OFF  → forced `false`
 *   - Auto → override cleared; the live PostHog / default value wins
 *
 * Toggling updates the in-memory map immediately, but most screens read
 * their flag once at mount — so after flipping, use "Reload app" (JS
 * bundle reload via DevSettings) to re-evaluate everything cleanly.
 */

/** Curated, human-orderable list of the flags worth previewing. Not
 *  exhaustive — the free-text row below forces any arbitrary key. Keep
 *  roughly in sync with the flags referenced across the mobile app;
 *  test-only probe flags are intentionally omitted. */
const KNOWN_FLAGS: readonly string[] = [
  "import-progress-v2",
  "onboarding-app-choice",
  "supadata-acquisition",
  "today-status-pills",
  "today-edit-entry-v2",
  "editable_eaten_at",
  "today-weekly-insight-mobile",
  "today_log_again",
  "today_log_usual_row_v2",
  "log-sheet-slot-selector",
  "reveal-macro-tile-paired-pct",
  "plan_empty_state_v2",
  "plan_source_selector",
  "plan_import_enabled",
  "progress-trend-summary-mobile",
  "progress_trajectory_box",
  "progress_digest_blend",
  "progress_digest_beige_v2",
  "goal_editor",
  "cookbook_import_enabled",
  "paywall-default-monthly",
  "onboarding_default_seeds",
];

type TriState = "on" | "off" | "auto";

function stateOf(map: Record<string, boolean>, flag: string): TriState {
  if (!Object.prototype.hasOwnProperty.call(map, flag)) return "auto";
  return map[flag] ? "on" : "off";
}

export function DevFlagOverrides() {
  const accent = useAccent();
  const colors = useThemeColors();
  const [map, setMap] = useState<Record<string, boolean>>(() => getForcedFlags());
  const [customFlag, setCustomFlag] = useState("");

  const apply = useCallback(async (flag: string, next: TriState) => {
    await setForcedFlag(flag, next === "auto" ? null : next === "on");
    setMap(getForcedFlags());
  }, []);

  const clearAll = useCallback(async () => {
    await clearForcedFlags();
    setMap(getForcedFlags());
  }, []);

  // Hard gate: never render anything in a release build. Placed AFTER all
  // hooks so the hook order is identical every render (rules-of-hooks).
  // `__DEV__` is a RN global; `typeof` guard keeps jsdom/vitest renders
  // from throwing.
  if (typeof __DEV__ === "undefined" || !__DEV__) return null;

  const rows = [
    ...KNOWN_FLAGS,
    // Surface any forced flag that isn't in the curated list so it can
    // still be cleared from the UI.
    ...Object.keys(map).filter((f) => !KNOWN_FLAGS.includes(f)),
  ];

  return (
    <View
      style={{
        marginTop: Spacing.lg,
        padding: Spacing.md,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Accent.warning,
        backgroundColor: colors.card,
        gap: Spacing.sm,
      }}
    >
      <Text style={{ ...Type.label, color: Accent.warningSolid }}>
        DEV · Flag overrides
      </Text>
      <Text style={{ ...Type.caption, color: colors.textSecondary }}>
        Force a feature flag without a PostHog ramp. Flip, then Reload app to
        re-evaluate every screen. Dev builds only.
      </Text>

      <ScrollView style={{ maxHeight: 360 }} nestedScrollEnabled>
        {rows.map((flag) => (
          <FlagRow
            key={flag}
            flag={flag}
            state={stateOf(map, flag)}
            onChange={(next) => void apply(flag, next)}
          />
        ))}
      </ScrollView>

      <View style={{ flexDirection: "row", gap: Spacing.sm, alignItems: "center" }}>
        <TextInput
          value={customFlag}
          onChangeText={setCustomFlag}
          placeholder="any-flag-key"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            ...Type.body,
            flex: 1,
            color: colors.text,
            backgroundColor: colors.inputBg,
            borderRadius: Radius.md,
            paddingHorizontal: Spacing.sm,
            paddingVertical: Spacing.xs,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Force custom flag on"
          disabled={!customFlag.trim()}
          onPress={() => {
            const f = customFlag.trim();
            if (!f) return;
            void apply(f, "on");
            setCustomFlag("");
          }}
          style={{
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.xs,
            borderRadius: Radius.md,
            backgroundColor: customFlag.trim() ? accent.primary : colors.border,
          }}
        >
          <Text style={{ ...Type.body, fontWeight: "700", color: accent.primaryForeground }}>
            Force ON
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: Spacing.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear all forced flags"
          onPress={() => void clearAll()}
          style={{
            flex: 1,
            alignItems: "center",
            paddingVertical: Spacing.sm,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: colors.borderStrong,
          }}
        >
          <Text style={{ ...Type.body, fontWeight: "700", color: colors.text }}>
            Clear all
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reload app to apply forced flags"
          onPress={() => DevSettings.reload()}
          style={{
            flex: 1,
            alignItems: "center",
            paddingVertical: Spacing.sm,
            borderRadius: Radius.md,
            backgroundColor: Accent.warning,
          }}
        >
          <Text style={{ ...Type.body, fontWeight: "700", color: "#ffffff" }}>
            Reload app
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function FlagRow({
  flag,
  state,
  onChange,
}: {
  flag: string;
  state: TriState;
  onChange: (next: TriState) => void;
}) {
  const accent = useAccent();
  const colors = useThemeColors();
  const options: TriState[] = ["auto", "off", "on"];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: Spacing.xs,
        gap: Spacing.sm,
      }}
    >
      <Text
        style={{ ...Type.caption, flex: 1, color: colors.text }}
        numberOfLines={1}
      >
        {flag}
      </Text>
      <View
        style={{
          flexDirection: "row",
          borderRadius: Radius.md,
          backgroundColor: colors.inputBg,
          overflow: "hidden",
        }}
      >
        {options.map((opt) => {
          const active = state === opt;
          const tint =
            opt === "on" ? Accent.success : opt === "off" ? Accent.destructive : accent.primary;
          return (
            <Pressable
              key={opt}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${flag} ${opt}`}
              onPress={() => onChange(opt)}
              style={{
                paddingHorizontal: Spacing.sm,
                paddingVertical: 6,
                backgroundColor: active ? tint : "transparent",
              }}
            >
              <Text
                style={{
                  ...Type.caption,
                  fontWeight: "700",
                  color: active ? "#ffffff" : colors.textSecondary,
                }}
              >
                {opt === "auto" ? "Auto" : opt === "on" ? "On" : "Off"}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
