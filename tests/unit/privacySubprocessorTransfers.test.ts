/**
 * @vitest-environment node
 *
 * ENG-1406 (PRA-007) — the privacy page's "International transfers" section
 * must disclose EVERY US-located sub-processor named in the sub-processor
 * table. The 2026-07-05 audit's re-verify pass caught residual drift: Vercel
 * and Supadata were listed in the table with a US region but omitted from the
 * transfers parenthetical (Vercel receives IP addresses — personal data under
 * GDPR — so its omission was a real accuracy gap on a launch-gating page).
 *
 * This test locks the invariant so the table and the transfers list can never
 * drift apart again: add a US sub-processor row and forget the transfers
 * disclosure, and CI fails here.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const PRIVACY_PATH = path.resolve(__dirname, "..", "..", "app", "privacy", "page.tsx");
const SRC = readFileSync(PRIVACY_PATH, "utf8");

/** The parenthetical list inside the "International transfers" paragraph. */
function transfersDisclosureList(): string {
  const anchor = SRC.indexOf('id="transfers"');
  expect(anchor).toBeGreaterThan(-1);
  const region = SRC.slice(anchor, anchor + 900);
  const m = region.match(/located in the United States \(([^)]+)\)/);
  expect(m, "transfers paragraph names its US sub-processors in a parenthetical").not.toBeNull();
  // Collapse JSX line-wrapping so multi-line lists match cleanly.
  return (m as RegExpMatchArray)[1].replace(/\s+/g, " ");
}

/** Provider names from table rows whose Region cell mentions the US. */
function usProvidersInTable(): string[] {
  const rows = SRC.match(/<tr><td>[^<]+<\/td>(?:<td>[^<]*<\/td>){2}<td>[^<]*<\/td><\/tr>/g) ?? [];
  const us: string[] = [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<td>([^<]*)<\/td>/g)].map((c) => c[1]);
    const [provider, , , region] = cells;
    if (/\bUS\b|United States/.test(region)) us.push(provider);
  }
  return us;
}

describe("Privacy policy — US sub-processors are disclosed for international transfers", () => {
  it("the transfers list explicitly names Vercel and Supadata (the ENG-1406 gap)", () => {
    const list = transfersDisclosureList();
    expect(list).toContain("Vercel");
    expect(list).toContain("Supadata");
  });

  it("every US-region sub-processor row also appears in the transfers disclosure", () => {
    const list = transfersDisclosureList();
    const missing = usProvidersInTable().filter((provider) => {
      // Match on the provider's first token so "Expo / EAS" → "Expo" and
      // "USDA FoodData Central" → "USDA" line up with the shorthand used in
      // the transfers parenthetical.
      const key = provider.split(/[\s/(]/)[0];
      return !list.includes(key);
    });
    expect(missing, `US sub-processors missing from the transfers disclosure: ${missing.join(", ")}`).toEqual([]);
  });

  it("found a non-trivial set of US sub-processors (guards against a parsing regression)", () => {
    expect(usProvidersInTable().length).toBeGreaterThanOrEqual(8);
  });
});
