/**
 * ENG-1211 — each import method tile must DELIVER its method, not drop the user
 * on a generic screen.
 *
 * Before: "Paste text" routed to `/recipe/create` (the guided wizard, which has
 * no paste affordance) and "Scan" routed to `/create-recipe` with no param, so
 * the barcode scanner never opened (it only auto-opens on `?autoPhoto=1`-style
 * handshakes).
 *
 * After: both tiles route to `/create-recipe` — which already owns the
 * paste-list modal AND the barcode scanner — with `?autoPaste=1` / `?autoBarcode=1`,
 * and `create-recipe.tsx` auto-opens the matching affordance once on arrival,
 * mirroring the existing `?autoPhoto=1` pattern.
 *
 * These are source-text assertions because the screens pull native modules
 * (expo-image-picker, camera) that don't load under vitest — the project
 * convention for screen routing/param guards (see
 * createRecipeActionSheetProGate.test.ts).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");

const IMPORT_SHARED = read("app/import-shared.tsx");
const CREATE_RECIPE = read("app/create-recipe.tsx");

describe("Import method tiles route with a method hint (ENG-1211)", () => {
  it("Paste text tile routes to /create-recipe with autoPaste=1", () => {
    expect(IMPORT_SHARED).toMatch(
      /const onPasteTextImportPress = useCallback\(\(\) => \{\s*router\.push\("\/create-recipe\?autoPaste=1" as any\);/,
    );
  });

  it("Scan tile routes to /create-recipe with autoBarcode=1", () => {
    expect(IMPORT_SHARED).toMatch(
      /const onScanImportPress = useCallback\(\(\) => \{\s*router\.push\("\/create-recipe\?autoBarcode=1" as any\);/,
    );
  });

  it("no longer dead-ends Paste text on the paste-less wizard (/recipe/create)", () => {
    expect(IMPORT_SHARED).not.toContain('router.push("/recipe/create" as any)');
  });
});

describe("create-recipe reads the method hints and auto-activates (ENG-1211)", () => {
  it("declares autoPaste + autoBarcode params alongside autoPhoto", () => {
    expect(CREATE_RECIPE).toMatch(/autoPhoto\?: string;/);
    expect(CREATE_RECIPE).toMatch(/autoPaste\?: string;/);
    expect(CREATE_RECIPE).toMatch(/autoBarcode\?: string;/);
  });

  it("autoPaste opens the paste-list modal once, then clears the param", () => {
    expect(CREATE_RECIPE).toMatch(/if \(params\.autoPaste !== "1"\) return;/);
    expect(CREATE_RECIPE).toMatch(/autoPasteFiredRef\.current = true;/);
    expect(CREATE_RECIPE).toMatch(
      /router\.setParams\(\{ autoPaste: undefined \} as Record<string, undefined>\);/,
    );
    expect(CREATE_RECIPE).toMatch(/setPasteModalOpen\(true\);/);
  });

  it("autoBarcode opens the barcode scanner once, then clears the param", () => {
    expect(CREATE_RECIPE).toMatch(/if \(params\.autoBarcode !== "1"\) return;/);
    expect(CREATE_RECIPE).toMatch(/autoBarcodeFiredRef\.current = true;/);
    expect(CREATE_RECIPE).toMatch(
      /router\.setParams\(\{ autoBarcode: undefined \} as Record<string, undefined>\);/,
    );
    expect(CREATE_RECIPE).toMatch(/setBarcodeOpen\(true\);/);
  });

  it("mirrors the autoPhoto fire-once-then-clear handshake (parity guard)", () => {
    // The pattern these new effects follow must stay alive.
    expect(CREATE_RECIPE).toMatch(/if \(params\.autoPhoto !== "1"\) return;/);
    expect(CREATE_RECIPE).toMatch(/autoPhotoFiredRef\.current = true;/);
  });
});
