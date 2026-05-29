import { describe, expect, it } from "vitest";

import {
  isPlanImportSourceName,
  matchesPlanImportPill,
  planImportFilterLabels,
  planImportPillId,
} from "@/lib/planning/planImport/libraryFilters";
import { PLAN_IMPORT_SOURCE_PREFIX } from "@/lib/planning/planImport/types";

describe("planImport libraryFilters", () => {
  it("detects plan-import source names", () => {
    expect(isPlanImportSourceName(`${PLAN_IMPORT_SOURCE_PREFIX}Week 1`)).toBe(true);
    expect(isPlanImportSourceName("My recipe")).toBe(false);
    expect(isPlanImportSourceName(null)).toBe(false);
  });

  it("collects unique sorted filter labels", () => {
    const labels = planImportFilterLabels([
      `${PLAN_IMPORT_SOURCE_PREFIX}Week 1`,
      `${PLAN_IMPORT_SOURCE_PREFIX}Week 2`,
      `${PLAN_IMPORT_SOURCE_PREFIX}Week 1`,
      "Manual",
      null,
    ]);
    expect(labels).toEqual([
      `${PLAN_IMPORT_SOURCE_PREFIX}Week 1`,
      `${PLAN_IMPORT_SOURCE_PREFIX}Week 2`,
    ]);
  });

  it("builds and matches plan-import pill ids", () => {
    const label = `${PLAN_IMPORT_SOURCE_PREFIX}Fast 800`;
    const pill = planImportPillId(label);
    expect(pill).toBe(`plan-import:${label}`);
    expect(matchesPlanImportPill(pill, label)).toBe(true);
    expect(matchesPlanImportPill("diet:vegan", label)).toBe(false);
  });
});
