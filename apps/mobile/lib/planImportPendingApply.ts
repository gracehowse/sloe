import type { DayPlan } from "../../../src/types/recipe";

let pendingDayPlan: DayPlan[] | null = null;

export function setPendingImportDayPlan(plan: DayPlan[]): void {
  pendingDayPlan = plan;
}

export function consumePendingImportDayPlan(): DayPlan[] | null {
  const p = pendingDayPlan;
  pendingDayPlan = null;
  return p;
}
