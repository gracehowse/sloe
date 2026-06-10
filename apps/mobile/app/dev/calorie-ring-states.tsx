/**
 * Mobile-side mirror of `app/dev/daily-ring-states/page.tsx` (web).
 *
 * Renders CalorieRing in controlled states so Maestro (or a manual
 * iOS Simulator screenshot) can validate mobile parity:
 *   - N3 — centre value with `.toLocaleString()` matches budget line
 *   - N5 — empty state shows "Start your day" in BOTH display modes
 *   - OVER — the Apple-Watch overage wrap (2026-06-04): the plum ring
 *     stays plum and the over-target portion draws as a lighter-plum
 *     SECOND lap wrapping past 12 o'clock with a glow at the leading
 *     cap (no red). Two over states (~28% and ~64%) make the wrap +
 *     glow visible at both small and large overage.
 *
 * 404-equivalent in production by simply not being routed; Expo
 * Router includes the file but `app/_layout.tsx` doesn't expose
 * `/dev/calorie-ring-states` in any nav. Reachable only via deeplink
 * `suppr:///dev/calorie-ring-states` (used by Maestro).
 */
import * as React from "react";
import { ScrollView, View, Text } from "react-native";
import { Stack } from "expo-router";
import CalorieRing from "@/components/charts/CalorieRing";

const STATES = [
  {
    id: "empty",
    title: "EMPTY (NOTHING LOGGED)",
    consumed: 0,
    goal: 1832,
    note: "N5 — should show 'Start your day', not a giant '1,832 / REMAINING'",
  },
  {
    id: "partial",
    title: "PARTIAL (UNDER TARGET)",
    consumed: 800,
    goal: 1832,
    note: "Standard — '1,032 REMAINING' (with comma — N3)",
  },
  {
    id: "at-goal",
    title: "AT GOAL (EXACTLY TARGET)",
    consumed: 1832,
    goal: 1832,
    note: "Edge — '0 REMAINING'",
  },
  {
    id: "over",
    title: "OVER (APPLE-WATCH WRAP)",
    consumed: 2338,
    goal: 1832,
    note: "Plum stays plum; overage wraps as a lighter-plum 2nd lap (~28%) past 12 o'clock with a glow at the leading cap. NO red.",
  },
  {
    id: "over-big",
    title: "OVER — BIG (WRAP + GLOW OBVIOUS)",
    consumed: 3000,
    goal: 1832,
    note: "~64% overage — the lighter-plum wrap clears 12 o'clock by a wide margin so the leading-cap glow is unmistakable.",
  },
] as const;

export default function CalorieRingStatesScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Bundle 1A states" }} />
      <ScrollView style={{ flex: 1, backgroundColor: "#fafafa" }}>
        <View style={{ padding: 24 }}>
          <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 4 }}>
            Bundle 1A — visual validation (mobile)
          </Text>
          <Text style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
            CalorieRing in 4 states. Compare to expected behaviour in note.
          </Text>

          {STATES.map((s) => (
            <View
              key={s.id}
              testID={`state-${s.id}`}
              style={{
                marginBottom: 24,
                padding: 16,
                backgroundColor: "white",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#e5e5e5",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  letterSpacing: 1.2,
                  color: "#666",
                  marginBottom: 12,
                }}
              >
                {s.title}
              </Text>
              <View style={{ alignItems: "center", marginBottom: 12 }}>
                <CalorieRing
                  consumed={s.consumed}
                  goal={s.goal}
                  textColor="#111"
                  secondaryColor="#666"
                  trackColor="#e5e5e5"
                  proteinPct={0.4}
                  carbsPct={0.5}
                  fatPct={0.3}
                  expanded={false}
                  displayMode="remaining"
                />
              </View>
              <Text style={{ fontSize: 12, color: "#666" }}>{s.note}</Text>
              <Text style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
                consumed {s.consumed} · goal {s.goal}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </>
  );
}
