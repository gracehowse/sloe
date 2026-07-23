import { Text, View, type ViewStyle } from "react-native";
import { CheckCircle2, ChevronRight } from "lucide-react-native";
import { formatKcalDisplay } from "@suppr/nutrition-core/formatMacro";
import { PressableScale } from "@/components/ui/PressableScale";
import { FontFamily, Radius, Spacing, Type } from "@/constants/theme";
import type { buildWeekStats } from "@/lib/progressWeekReport";

type WeekStats = ReturnType<typeof buildWeekStats>;
type ThemeTokens = {
  text: string;
  sub: string;
  dim: string;
  accent: string;
  green: string;
  amber: string;
  red: string;
  protein: string;
  border: string;
};
type CardSurface = ViewStyle;

function formatLongDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

type SectionProps = {
  weekStats: WeekStats;
  targets: { calories: number; protein: number };
  todayKey: string;
  t: ThemeTokens;
  cardSurface: CardSurface;
  onOpenDay: (dateKey: string) => void;
};

export function ProgressMetricCaloriesSection({ weekStats, targets, todayKey, t, cardSurface, onOpenDay }: SectionProps) {
  return (
    <>
      <View style={{ marginTop: Spacing.lg, borderRadius: Radius.lg, padding: Spacing.lg, ...cardSurface }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: t.text, marginBottom: Spacing.md }}>Daily intake</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: 120 }}>
          {weekStats.days.map((d) => {
            const maxCal = Math.max(targets.calories, ...weekStats.days.map((x) => x.calories), 1);
            const barH = maxCal > 0 ? Math.max(6, (d.calories / (maxCal * 1.15)) * 88) : 6;
            const over = d.calories > d.targetCalories;
            const isToday = d.key === todayKey;
            return (
              <PressableScale key={d.key} haptic="selection" onPress={() => onOpenDay(d.key)} style={{ flex: 1, alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 10, color: t.dim, fontVariant: ["tabular-nums"] }}>
                  {d.calories > 0 ? (d.calories >= 1000 ? `${(d.calories / 1000).toFixed(1)}k` : String(d.calories)) : "—"}
                </Text>
                <View style={{ width: "100%", height: barH, borderRadius: 6, backgroundColor: d.calories === 0 ? t.border : over ? t.red : t.green, opacity: isToday ? 1 : 0.85 }} />
                <Text style={{ fontSize: 11, fontWeight: isToday ? "800" : "600", color: isToday ? t.accent : t.dim }}>{d.label}</Text>
              </PressableScale>
            );
          })}
        </View>
      </View>
      {weekStats.days.map((d) => (
        <PressableScale
          key={`row-${d.key}`}
          haptic="selection"
          onPress={() => onOpenDay(d.key)}
          style={{ marginTop: Spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: Spacing.md, borderRadius: Radius.md, ...cardSurface }}
        >
          <View>
            <Text style={{ fontSize: 14, fontWeight: "700", color: t.text }}>{formatLongDate(d.key)}</Text>
            <Text style={{ ...Type.captionSmall, color: t.dim, marginTop: 0 }}>{d.label}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: t.text, fontVariant: ["tabular-nums"] }}>{formatKcalDisplay(d.calories)} kcal</Text>
            <Text style={{ fontSize: 11, color: d.calories > 0 ? t.sub : t.dim }}>
              {d.calories > 0 ? `${Math.round((d.calories / Math.max(d.targetCalories, 1)) * 100)}% of goal${!d.isSnapshot && d.key !== todayKey ? " (approx)" : ""}` : "Nothing logged"}
            </Text>
          </View>
          <ChevronRight size={18} color={t.dim} strokeWidth={1.75} />
        </PressableScale>
      ))}
    </>
  );
}

export function ProgressMetricProteinSection({ weekStats, targets, t, cardSurface, onOpenDay }: SectionProps) {
  return (
    <>
      <View style={{ marginTop: Spacing.lg, flexDirection: "row", gap: Spacing.md }}>
        <View style={{ flex: 1, padding: Spacing.md, borderRadius: Radius.md, ...cardSurface }}>
          <Text style={{ fontSize: 11, color: t.dim, fontWeight: "600" }}>AVG / DAY</Text>
          <Text style={{ fontFamily: FontFamily.serifRegular, fontSize: 22, color: t.protein, marginTop: 4, fontVariant: ["tabular-nums"] }}>
            {weekStats.avgProtein}
            <Text style={{ fontFamily: FontFamily.sansBold, fontSize: 14, fontWeight: "800" }}>g</Text>
          </Text>
        </View>
        <View style={{ flex: 1, padding: Spacing.md, borderRadius: Radius.md, ...cardSurface }}>
          <Text style={{ fontSize: 11, color: t.dim, fontWeight: "600" }}>ON TARGET</Text>
          <Text style={{ fontFamily: FontFamily.serifRegular, fontSize: 22, color: t.accent, marginTop: 4, fontVariant: ["tabular-nums"] }}>{weekStats.proteinOnTarget}/7</Text>
        </View>
      </View>
      <Text style={{ ...Type.captionSmall, color: t.sub, marginTop: Spacing.md, lineHeight: 18 }}>
        Weekly protein adherence vs goal: {weekStats.proteinAdherence}%. Carbs {weekStats.carbsAdherence}% · Fat {weekStats.fatAdherence}%
      </Text>
      {weekStats.days.map((d) => {
        const dayProteinTarget = d.targetProtein > 0 ? d.targetProtein : targets.protein;
        const hit = dayProteinTarget > 0 && d.protein >= dayProteinTarget * 0.9;
        const pct = dayProteinTarget > 0 ? Math.round((d.protein / dayProteinTarget) * 100) : 0;
        return (
          <PressableScale
            key={d.key}
            haptic="selection"
            onPress={() => onOpenDay(d.key)}
            style={{ marginTop: Spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: Spacing.md, borderRadius: Radius.md, ...cardSurface }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: t.text }}>{formatLongDate(d.key)}</Text>
              <View style={{ height: 6, borderRadius: 4, backgroundColor: t.border, marginTop: 8, overflow: "hidden" }}>
                <View style={{ width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: 4, backgroundColor: hit ? t.green : t.amber }} />
              </View>
            </View>
            <View style={{ alignItems: "flex-end", marginLeft: Spacing.md }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: t.protein, fontVariant: ["tabular-nums"] }}>{Math.round(d.protein)}g</Text>
              <Text style={{ fontSize: 11, color: hit ? t.green : t.dim }}>{hit ? "On target" : `${pct}% of goal`}</Text>
            </View>
            <ChevronRight size={18} color={t.dim} strokeWidth={1.75} style={{ marginLeft: 8 }} />
          </PressableScale>
        );
      })}
    </>
  );
}

export function ProgressMetricStreakSection({
  streakDays,
  streakDaysDetail,
  t,
  cardSurface,
  onOpenDay,
}: {
  streakDays: number;
  streakDaysDetail: Array<{ key: string; mealCount: number; calories: number }>;
  t: ThemeTokens;
  cardSurface: CardSurface;
  onOpenDay: (dateKey: string) => void;
}) {
  return (
    <>
      {streakDays > 0 ? (
        <View style={{ marginTop: Spacing.lg, padding: Spacing.lg, borderRadius: Radius.lg, ...cardSurface }}>
          <Text style={{ fontFamily: FontFamily.serifRegular, fontSize: 36, color: t.accent, fontVariant: ["tabular-nums"] }}>{streakDays}</Text>
          <Text style={{ fontSize: 14, fontWeight: "600", color: t.text, marginTop: 4 }}>consecutive logging day{streakDays !== 1 ? "s" : ""}</Text>
        </View>
      ) : null}
      {streakDaysDetail.length === 0 ? (
        <Text style={{ fontSize: 14, color: t.sub, marginTop: Spacing.lg }}>Log a meal on Today to start a streak.</Text>
      ) : (
        <>
          <Text style={{ fontSize: 13, fontWeight: "700", color: t.text, marginTop: Spacing.lg }}>Days in this streak</Text>
          {streakDaysDetail.map((row) => (
            <PressableScale
              key={row.key}
              haptic="selection"
              onPress={() => onOpenDay(row.key)}
              style={{ marginTop: Spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: Spacing.md, borderRadius: Radius.md, ...cardSurface }}
            >
              <View>
                <Text style={{ fontSize: 14, fontWeight: "700", color: t.text }}>{formatLongDate(row.key)}</Text>
                <Text style={{ ...Type.captionSmall, color: t.dim, marginTop: 0 }}>
                  {row.mealCount} item{row.mealCount !== 1 ? "s" : ""} · {formatKcalDisplay(row.calories)} kcal
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <CheckCircle2 size={22} color={t.green} strokeWidth={1.75} />
                <ChevronRight size={18} color={t.dim} strokeWidth={1.75} />
              </View>
            </PressableScale>
          ))}
        </>
      )}
    </>
  );
}
