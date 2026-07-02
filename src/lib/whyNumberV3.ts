/**
 * WhyNumber v3 grammar (ENG-1247 §A6). Shared web + mobile.
 */
import type { WhyThisNumberLine, WhyThisNumberResult } from "./nutrition/whyThisNumber";
import { formatKcalDisplay } from "./nutrition/formatMacro";

export const WHY_NUMBER_V3_COPY = {
  heroOverline: "Your daily target",
  kcalPerDay: "kcal / day",
  sectionOverline: "How it adds up",
  yourTarget: "Your target",
  keepThisTarget: "Keep this target",
  adjustPace: "Adjust my pace or goal",
} as const;

// ENG-1305: was locale-default .toLocaleString() — separator/grouping
// depends on the runtime's locale. Use the app-wide locale-independent
// formatter so web SSR and every mobile device locale render identically.
export function formatWhyNumberHeroKcal(targetCalories: number): string {
  return formatKcalDisplay(targetCalories);
}

export function buildWhyNumberResultSubtitle(lines: WhyThisNumberLine[]): string {
  const tdeeLine = lines.find((l) => l.key === "tdee");
  const resultLine = lines.find((l) => l.key === "result");
  if (!tdeeLine || !resultLine) return "";
  const maintenance = tdeeLine.value.split(" (")[0] ?? tdeeLine.value;
  if (resultLine.value.includes("deficit")) {
    const m = resultLine.value.match(/−([\d,]+)/);
    return m ? `${maintenance} − ${m[1]} deficit` : resultLine.value;
  }
  if (resultLine.value.includes("surplus")) {
    const m = resultLine.value.match(/\+([\d,]+)/);
    return m ? `${maintenance} + ${m[1]} surplus` : resultLine.value;
  }
  if (resultLine.value.includes("maintaining")) {
    return `${maintenance} — maintaining`;
  }
  return resultLine.value;
}

export function whyNumberCoachQuote(summary: string): string {
  return `“${summary}”`;
}

export function whyNumberConfidenceCard(
  confidence: "low" | "medium" | "high" | null,
  loggingDays: number | null | undefined,
): { title: string; body: string } | null {
  if (confidence === "high") {
    return {
      title: "High confidence",
      body:
        loggingDays != null && loggingDays > 0
          ? `Built on ${loggingDays} days of your real intake and weight trend — it keeps tuning itself as you log.`
          : "Built on your real intake and weight trend — it keeps tuning itself as you log.",
    };
  }
  if (confidence === "medium") {
    return {
      title: "Calibrating",
      body: "Your target is settling as you log — keep going for a sharper read.",
    };
  }
  if (confidence === "low") {
    return {
      title: "Early estimate",
      body: "Keep logging meals and weigh-ins — we'll sharpen this as we learn your rhythm.",
    };
  }
  return null;
}

export type WhyNumberV3RowKey = "tdee" | "goal";

export function whyNumberV3Rows(result: WhyThisNumberResult): Array<{
  key: WhyNumberV3RowKey;
  title: string;
  subtitle: string;
  value: string;
  highlight: boolean;
}> {
  const tdee = result.lines.find((l) => l.key === "tdee");
  const goal = result.lines.find((l) => l.key === "goal");
  const resultLine = result.lines.find((l) => l.key === "result");
  const paceDelta = resultLine?.value.match(/[−+][\d,]+/)?.[0] ?? "—";
  return [
    {
      key: "tdee",
      title: "Maintenance (TDEE)",
      subtitle: "What holds your weight steady",
      value: tdee?.value.split(" (")[0] ?? "—",
      highlight: true,
    },
    {
      key: "goal",
      title: goal?.value ?? "Goal",
      subtitle: "Your chosen pace",
      value: paceDelta,
      highlight: false,
    },
  ];
}
