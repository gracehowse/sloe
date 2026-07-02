import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const healthSyncSource = readFileSync(
  resolve(root, "lib/healthSync.ts"),
  "utf8",
);
const analyticsSource = readFileSync(resolve(root, "lib/analytics.ts"), "utf8");

describe("ENG-1023 health nutrition import flag", () => {
  it("keeps nutrition import behind the default-on kill switch", () => {
    expect(analyticsSource).toContain('"health_nutrition_import_enabled"');
    expect(healthSyncSource).toContain(
      'isFeatureEnabled("health_nutrition_import_enabled")',
    );
  });

  it("does not request full micronutrient import permissions in initHealthKit", () => {
    expect(healthSyncSource).toContain(
      "const HEALTH_KIT_DIETARY_INIT_READ: readonly string[] = [",
    );
    expect(healthSyncSource).toContain(
      "...HEALTH_DIETARY_CORE_PERMISSION_KEYS",
    );
    expect(healthSyncSource).not.toContain(
      "const HEALTH_KIT_DIETARY_INIT_READ: readonly string[] = [\n  ...HEALTH_DIETARY_IMPORT_PERMISSION_KEYS",
    );
  });
});
