import { PLAN_IMPORT_SOURCE_PREFIX } from "./types";

const PREFIX = PLAN_IMPORT_SOURCE_PREFIX;

/** True when recipe was saved from a plan import batch. */
export function isPlanImportSourceName(sourceName: string | null | undefined): boolean {
  return typeof sourceName === "string" && sourceName.trim().startsWith(PREFIX);
}

/** Extract unique plan import labels for Library filter chips. */
export function planImportFilterLabels(
  sourceNames: readonly (string | null | undefined)[],
): string[] {
  const set = new Set<string>();
  for (const raw of sourceNames) {
    const s = raw?.trim();
    if (s && s.startsWith(PREFIX)) set.add(s);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function planImportPillId(sourceName: string): string {
  return `plan-import:${sourceName}`;
}

export function matchesPlanImportPill(
  pillId: string,
  sourceName: string | null | undefined,
): boolean {
  if (!pillId.startsWith("plan-import:")) return false;
  const label = pillId.slice("plan-import:".length);
  return (sourceName?.trim() ?? "") === label;
}
