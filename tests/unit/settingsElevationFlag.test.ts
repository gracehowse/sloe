/**
 * ENG-823 / Figma flat slab (2026-06-04) — web Settings resting cards.
 *
 * Settings routes resting surfaces through <SupprCard> (default
 * `elevation="slab-flat"`) and uses `.card-slab-flat` on inner divide-y
 * groups. The `design_system_elevation` flag gate is retired.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..", "..");
const SETTINGS_PATH = resolve(ROOT, "src/app/components/Settings.tsx");
const SUBCARD_PATH = resolve(
  ROOT,
  "src/app/components/settings/SubscriptionCard.tsx",
);
const THEME_PATH = resolve(ROOT, "src/styles/theme.css");

const settings = readFileSync(SETTINGS_PATH, "utf8");
const subCard = readFileSync(SUBCARD_PATH, "utf8");
const themeCss = readFileSync(THEME_PATH, "utf8");

describe("web Settings flat slab (ENG-823)", () => {
  it("routes resting cards through the canonical SupprCard primitive", () => {
    expect(settings).toContain("<SupprCard");
    expect(settings).not.toMatch(/isFeatureEnabled\("design_system_elevation"\)/);
  });

  it("uses card-slab-flat on inner settings groups (no always-on card-elevated)", () => {
    expect(settings).toContain("card-slab-flat");
    expect(settings).not.toMatch(/className="[^"]*card-elevated"/);
    expect(settings).not.toMatch(/className="[^"]*card-elevated-hero[^"]*"/);
  });

  it("SubscriptionCard is routed through SupprCard too (web billing parity surface)", () => {
    expect(subCard).toContain("<SupprCard");
    expect(subCard).not.toMatch(/className="[^"]*card-elevated"/);
  });

  it("the soft-elevation token remains declared in theme.css for other surfaces", () => {
    expect(themeCss).toContain("--elev-card-soft");
  });
});
