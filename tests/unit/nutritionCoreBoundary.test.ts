import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const nutritionCoreDir = path.join(repoRoot, "src/lib/nutrition-core");
const nutritionDir = path.join(repoRoot, "src/lib/nutrition");
const forbiddenImportPattern = /(?:from\s+["']|import\(\s*["'])(?:next(?:\/|["'])|@\/lib\/(?:server|supabase\/server|supabase\/serverAnonClient|supabase\/serverAdminClient)|node:|fs(?:\/|["'])|path(?:\/|["']))/;
const nutritionReExportPattern = /export\s+\*\s+from\s+["']\.\.\/nutrition\/([^"']+)["'];/g;

function reExportedNutritionModules(file: string): string[] {
  return Array.from(fs.readFileSync(file, "utf8").matchAll(nutritionReExportPattern), (match) => match[1]);
}

describe("@suppr/nutrition-core boundary", () => {
  it("re-exports nutrition modules without Next, server-client, DOM, or filesystem imports", () => {
    const coreFiles = fs
      .readdirSync(nutritionCoreDir)
      .filter((file) => file.endsWith(".ts"))
      .map((file) => path.join(nutritionCoreDir, file));

    expect(coreFiles.length).toBeGreaterThan(1);

    const targetFiles = new Set<string>();
    for (const file of coreFiles) {
      expect(forbiddenImportPattern.test(fs.readFileSync(file, "utf8"))).toBe(false);
      for (const moduleName of reExportedNutritionModules(file)) {
        targetFiles.add(path.join(nutritionDir, `${moduleName}.ts`));
      }
    }

    expect(targetFiles.size).toBeGreaterThan(100);

    const offenders = Array.from(targetFiles).filter((file) => forbiddenImportPattern.test(fs.readFileSync(file, "utf8")));
    expect(offenders.map((file) => path.relative(repoRoot, file))).toEqual([]);
  });
});
