/**
 * Mobile-side validation harness for Bundle 1B (N1).
 *
 * Demonstrates:
 *   1. Old vs new fallback string format side-by-side.
 *   2. Recents-style list with mix of real + synthetic-fallback rows,
 *      showing the filter behaviour.
 *
 * Reachable only via deeplink `suppr:///dev/health-import-labels`.
 */
import * as React from "react";
import { ScrollView, View, Text } from "react-native";
import { Stack } from "expo-router";
import {
  formatHealthImportFallbackTitle,
  isHealthImportFallbackTitle,
} from "@/lib/healthImportLabels";

const SAMPLE_RECENTS = [
  { id: "r1", title: "Spicy Feta Chicken Crunch", kcal: 235 },
  { id: "r2", title: "Best Lentil Soup", kcal: 464 },
  // Legacy fallback rows from existing TestFlight DBs.
  { id: "r3", title: "Food log (250 kcal)", kcal: 250 },
  { id: "r4", title: "Food log (80 kcal)", kcal: 80 },
  { id: "r5", title: "Greek Yoghurt Bowl", kcal: 320 },
  // New fallback rows produced by post-2026-05-03 builds.
  { id: "r6", title: "MyFitnessPal entry · 250 kcal", kcal: 250 },
  { id: "r7", title: "Lose It! entry · 80 kcal", kcal: 80 },
  { id: "r8", title: "Veggie Bibimbap", kcal: 520 },
] as const;

export default function HealthImportLabelsDevScreen() {
  const filtered = SAMPLE_RECENTS.filter((r) => !isHealthImportFallbackTitle(r.title));

  return (
    <>
      <Stack.Screen options={{ title: "Bundle 1B states" }} />
      <ScrollView style={{ flex: 1, backgroundColor: "#fafafa" }}>
        <View style={{ padding: 24 }}>
          <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 4 }}>
            Bundle 1B — visual validation (mobile)
          </Text>
          <Text style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
            HealthKit import fallback labels. N1 fix.
          </Text>

          {/* Old vs new format */}
          <View
            testID="format-comparison"
            style={{
              marginBottom: 24,
              padding: 16,
              backgroundColor: "white",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#e5e5e5",
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.2, color: "#666", marginBottom: 12 }}>
              FALLBACK STRING FORMAT
            </Text>
            <Text style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>BEFORE (legacy)</Text>
            <Text style={{ fontSize: 14, color: "#111", marginBottom: 12, fontFamily: "Menlo" }}>
              Food log (250 kcal) (via MyFitnessPal)
            </Text>
            <Text style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>AFTER (new)</Text>
            <Text style={{ fontSize: 14, color: "#111", fontFamily: "Menlo" }}>
              {formatHealthImportFallbackTitle({ sourceApp: "MyFitnessPal", calories: 250 })}
            </Text>
          </View>

          {/* Unfiltered list */}
          <View
            testID="recents-unfiltered"
            style={{
              marginBottom: 24,
              padding: 16,
              backgroundColor: "white",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#e5e5e5",
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.2, color: "#666", marginBottom: 12 }}>
              RECENTS (UNFILTERED — broken state)
            </Text>
            {SAMPLE_RECENTS.map((r) => (
              <RecentRow key={r.id} title={r.title} kcal={r.kcal} flagged={isHealthImportFallbackTitle(r.title)} />
            ))}
          </View>

          {/* Filtered list */}
          <View
            testID="recents-filtered"
            style={{
              padding: 16,
              backgroundColor: "white",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#e5e5e5",
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.2, color: "#0a8", marginBottom: 12 }}>
              RECENTS (AFTER FILTER — fixed state)
            </Text>
            {filtered.map((r) => (
              <RecentRow key={r.id} title={r.title} kcal={r.kcal} flagged={false} />
            ))}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

function RecentRow({ title, kcal, flagged }: { title: string; kcal: number; flagged: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0",
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 14,
            color: flagged ? "#aaa" : "#111",
            textDecorationLine: flagged ? "line-through" : "none",
          }}
        >
          {title}
        </Text>
        {flagged ? (
          <Text style={{ fontSize: 11, color: "#c44", marginTop: 2 }}>
            ⚠ filtered (fallback row)
          </Text>
        ) : null}
      </View>
      <Text style={{ fontSize: 13, color: "#666", marginLeft: 8 }}>{kcal} kcal</Text>
    </View>
  );
}
