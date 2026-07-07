/**
 * ENG-689 / ENG-674 — provenance write parity for `nutrition_entries.source`.
 *
 * Every INSERT/upsert into `nutrition_entries` must stamp a value that
 * satisfies `nutrition_entries_source_canonical` (see
 * `supabase/migrations/20260527200000_nutrition_entries_source_check.sql`).
 *
 * Client paths route through `canonicalNutritionEntrySource()` so legacy
 * in-memory labels cannot re-hit the CHECK constraint. Server CSV import
 * tags (`mfp_import`, etc.) canonicalize to `"manual"` before write.
 *
 * Pattern mirrors `profileTargetCaloriesProvenance.test.ts` +
 * `nutritionEntriesGuardInventory.test.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CANONICAL_NUTRITION_ENTRY_SOURCES,
  canonicalNutritionEntrySource,
} from "../../src/lib/nutrition/canonicalNutritionEntrySource";

const REPO = resolve(__dirname, "../..");

/** Multiline — `.upsert` / `.insert` often wrap onto the next line. */
const NUTRITION_ENTRIES_WRITE_RE =
  /from\(\s*["']nutrition_entries["']\s*\)[\s\S]{0,120}\.(?:insert|upsert)/;

type Site = {
  file: string;
  /** Must call `canonicalNutritionEntrySource(` somewhere in the file. */
  usesCanonicalHelper?: boolean;
  /** Pin the DB payload `source` field shape near the write site. */
  payloadPin: RegExp;
  /**
   * The shared row-builder module stamps `source` for every consumer but
   * holds no `.from("nutrition_entries")` call itself — skip the
   * write-site sanity check for it.
   */
  isRowBuilder?: boolean;
};

// Launch-audit P1-2 (2026-06-12): every mobile journal write now routes
// through `buildNutritionEntryRow` / `buildNutritionEntryUpdatePayload`
// (`apps/mobile/lib/nutritionEntryRow.ts`), which stamps
// `canonicalNutritionEntrySource(meal.source)` centrally — so the mobile
// site pins assert the BUILDER wiring, and the canonical-helper call is
// pinned once on the builder module itself. healthSync stays a sanctioned
// builder bypass (allow-listed in nutritionEntryRowPersistence.test.ts).
//
// ENG-1466 (write-ahead web port, 2026-07-06): `useNutritionJournalState.ts`
// no longer calls `.from("nutrition_entries").upsert(...)` directly for its
// insert paths — that now lives in `useWebJournalWriteAhead.ts`'s `writeAhead`
// (enqueue-before-upsert-then-ack). The context file still stamps
// `canonicalNutritionEntrySource(meal.source)` on the row it hands to
// `writeAhead`, so the source-stamp pin stays; the write-site pin moves to
// the hook, mirroring mobile's TodayScreen -> useJournalWriteAhead split
// (isRowBuilder-shaped: canonicalHelper lives here, the actual
// `.from(...).upsert` call lives one level down).
const INVENTORY: Site[] = [
  {
    file: "src/context/appData/useNutritionJournalState.ts",
    usesCanonicalHelper: true,
    isRowBuilder: true,
    payloadPin: /source:\s*canonicalNutritionEntrySource\(meal\.source\)/,
  },
  {
    file: "src/hooks/useWebJournalWriteAhead.ts",
    payloadPin: /\.upsert\(rows,\s*\{\s*onConflict:\s*["']id["']\s*\}\)/,
  },
  {
    file: "apps/mobile/lib/nutritionEntryRow.ts",
    usesCanonicalHelper: true,
    isRowBuilder: true,
    payloadPin: /source:\s*canonicalNutritionEntrySource\(meal\.source\)/,
  },
  {
    file: "apps/mobile/hooks/useNutritionEntriesSync.ts",
    payloadPin: /\.upsert\(rows|buildNutritionEntryRow\(/,
  },
  {
    file: "apps/mobile/app/(tabs)/_today/TodayScreen.tsx",
    payloadPin: /buildNutritionEntryRow\(/,
  },
  {
    file: "apps/mobile/app/recipe/[id].tsx",
    payloadPin:
      /source:\s*["']Recipe["'][\s\S]{0,600}?\.insert\(buildNutritionEntryRow\(/,
  },
  {
    file: "apps/mobile/app/(tabs)/barcode.tsx",
    payloadPin:
      /source:\s*["']barcode["'][\s\S]{0,600}?\.insert\(buildNutritionEntryRow\(/,
  },
  {
    file: "apps/mobile/app/(tabs)/planner.tsx",
    payloadPin:
      /source:\s*["']Recipe["'][\s\S]{0,800}?\.insert\(buildNutritionEntryRow\(/,
  },
  {
    file: "apps/mobile/lib/healthSync.ts",
    payloadPin: /source:\s*["']apple_health["']/,
  },
  {
    file: "app/api/imports/mfp-csv/route.ts",
    usesCanonicalHelper: true,
    payloadPin: /source:\s*canonicalNutritionEntrySource\(\`\$\{adapterSource\}_import\`\)/,
  },
];

const CANONICAL_SET = new Set<string>(CANONICAL_NUTRITION_ENTRY_SOURCES);

describe("nutrition_entries.source write parity (ENG-674 / ENG-689)", () => {
  it("CANONICAL_NUTRITION_ENTRY_SOURCES matches the migration CHECK allow-list", () => {
    const migration = readFileSync(
      resolve(REPO, "supabase/migrations/20260527200000_nutrition_entries_source_check.sql"),
      "utf8",
    );
    for (const label of CANONICAL_NUTRITION_ENTRY_SOURCES) {
      expect(migration).toContain(`'${label.replace(/'/g, "''")}'`);
    }
  });

  for (const site of INVENTORY) {
    it(`${site.file} — stamps canonical source on write`, () => {
      const text = readFileSync(resolve(REPO, site.file), "utf8");
      if (!site.isRowBuilder) {
        expect(text).toMatch(NUTRITION_ENTRIES_WRITE_RE);
      }
      expect(text).toMatch(site.payloadPin);
      if (site.usesCanonicalHelper) {
        expect(text).toMatch(/canonicalNutritionEntrySource\s*\(/);
      }
    });
  }

  it("CSV import tags map to a CHECK-safe value before insert", () => {
    expect(canonicalNutritionEntrySource("mfp_import")).toBe("manual");
    expect(canonicalNutritionEntrySource("lose-it_import")).toBe("manual");
    expect(CANONICAL_SET.has(canonicalNutritionEntrySource("mfp_import")!)).toBe(true);
  });

  it("legacy UI labels used by journal sync map to CHECK-safe values", () => {
    expect(CANONICAL_SET.has(canonicalNutritionEntrySource("Manual")!)).toBe(true);
    expect(CANONICAL_SET.has(canonicalNutritionEntrySource("Meal plan")!)).toBe(true);
    expect(CANONICAL_SET.has(canonicalNutritionEntrySource("Open Food Facts")!)).toBe(true);
  });
});
