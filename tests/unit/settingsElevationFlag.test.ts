/**
 * Web Settings — card elevation (ENG-823, re-pinned to one-treatment).
 *
 * Re-pinned to the "one card treatment" rule (Grace 2026-06-09), updated by
 * the one-card-grammar ruling (2026-07-10, ENG-1497/1499,
 * `docs/decisions/2026-07-10-card-grammar-rounder-flat.md`): every resting
 * card is flat + hairline via `.card-slab` (`.card-slab-flat` retired —
 * byte-identical). Settings routes its section surfaces through <SupprCard>;
 * the Tracking-extras grouped list rides `.card-slab` directly. The
 * `design_system_elevation` flag gate is retired.
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

  it("keeps the Tracking-extras grouped list on the flat card-slab shell", () => {
    // One card grammar (ENG-1499): `.card-slab-flat` is retired; the grouped
    // list is a page-ground card — 24px corner + flat `.card-slab`.
    expect(settings).toContain("rounded-card-lg bg-card divide-y divide-border card-slab");
    expect(settings).not.toContain("card-slab-flat");
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
