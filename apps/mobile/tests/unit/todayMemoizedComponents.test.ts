import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", p), "utf8");

const MEMOIZED_COMPONENTS = [
  "TodayMealsSection",
  "NorthStarBlock",
  "TodayWeekView",
  "TodayHeroRing",
  "TodayDashboardMacroTiles",
  "LogSheet",
  "onboarding-nudges/OnboardingNudgeBanner",
] as const;

describe("Today components memoization", () => {
  it.each(MEMOIZED_COMPONENTS)("wraps %s in React.memo while preserving exports", (componentName) => {
    const filePath = componentName.endsWith(".tsx") ? componentName : `${componentName}.tsx`;
    const source = read(`components/today/${filePath}`);
    const exportName = componentName.split("/").at(-1)?.replace(/\.tsx$/, "") ?? componentName;

    expect(source).toMatch(/import (?:React, )?\{[^}]*\bmemo\b[^}]*\} from "react";/);
    expect(source).toContain(`function ${exportName}Impl`);
    expect(source).toContain(`export const ${exportName} = memo(${exportName}Impl);`);
    expect(source).toContain(`export default ${exportName};`);
  });
});
