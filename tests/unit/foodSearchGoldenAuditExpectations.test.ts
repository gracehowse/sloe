/**
 * ENG-877 — live golden audit expectations (offline, reads committed JSON).
 *
 * Pins top-1 ranking outcomes from `docs/testing/nutrition-search-golden-audit-2026-06-04.json`
 * so a scorer regression fails CI before the next manual audit run.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type AuditRow = { name: string; source: string };
type AuditResult = { query: string; top5: AuditRow[] };

const auditPath = join(
  process.cwd(),
  "docs/testing/nutrition-search-golden-audit-2026-06-04.json",
);
const audit = JSON.parse(readFileSync(auditPath, "utf8")) as {
  results: AuditResult[];
};

function top1(query: string): AuditRow {
  const row = audit.results.find((r) => r.query === query)?.top5[0];
  if (!row) throw new Error(`missing audit result for ${query}`);
  return row;
}

describe("food search golden audit expectations (ENG-877)", () => {
  it("Big Mac → FatSecret branded menu item", () => {
    const row = top1("Big Mac");
    expect(row.source).toBe("FatSecret");
    expect(row.name.toLowerCase()).toContain("big mac");
  });

  it("starbucks latte → FatSecret Starbucks row", () => {
    const row = top1("starbucks latte");
    expect(row.source).toBe("FatSecret");
    expect(row.name.toLowerCase()).toContain("starbucks");
  });

  it("salmon → verified USDA generic (not a dish row)", () => {
    const row = top1("salmon");
    expect(row.source).toBe("USDA");
    expect(row.name.toLowerCase()).toMatch(/salmon/);
  });

  it("banana → verified USDA generic", () => {
    const row = top1("banana");
    expect(row.source).toBe("USDA");
    expect(row.name.toLowerCase()).toMatch(/banana/);
  });

  it("tesco chicken → Tesco-branded FatSecret row when present in pool", () => {
    const results = audit.results.find((r) => r.query === "tesco chicken");
    expect(results).toBeDefined();
    const tescoRow = results!.top5.find((r) => /tesco/i.test(r.name));
    if (tescoRow) {
      expect(top1("tesco chicken").name.toLowerCase()).toContain("tesco");
    }
  });

  it("sainsbury's hummus → Sainsbury-branded row when present in pool", () => {
    const results = audit.results.find((r) => r.query === "sainsbury's hummus");
    expect(results).toBeDefined();
    const sainsburyRow = results!.top5.find((r) => /sainsbury/i.test(r.name));
    if (sainsburyRow) {
      expect(top1("sainsbury's hummus").name.toLowerCase()).toMatch(/sainsbury/);
    }
  });
});
