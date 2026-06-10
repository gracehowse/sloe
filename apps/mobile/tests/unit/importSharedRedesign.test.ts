/**
 * Import surface (import-shared.tsx) — premium-parity redesign guards.
 * ENG-997 / recipe-import-redesign (2026-06-09).
 *
 * Source-level pins for the import-surface fixes so they can't silently
 * regress. The screen reads the clipboard + entitlements + Supabase on
 * mount, so a full RN render harness is heavy; these guards pin the
 * load-bearing structural + token decisions directly against the file:
 *
 *   1. Photo OCR is Pro-gated server-side (403 pro_required). The affordance
 *      surfaces the gate BEFORE the tap — Lock badge + route Free → paywall.
 *   2. The old "IMPORT FROM" grid was a fake four-way router (all four tiles
 *      called onPasteFromClipboard). It is replaced by a non-tappable
 *      "WORKS WITH" trust-chip row.
 *   3. Recent-import badges drop the raw brand hexes (#000 / #E4405F) for the
 *      neutral mono chip.
 *   4. The two prominent controls (paste field + Import button) use the
 *      on-scale Radius.xl (12) — not the orphan 16.
 *   5. Section eyebrows use the section-eyebrow token (Type.label), not the
 *      old 13px/0.5-tracking heavy sub-label.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  resolve(__dirname, "../../app/import-shared.tsx"),
  "utf8",
);

describe("Import surface — photo Pro gate (gap #3)", () => {
  it("routes Free users to the paywall before the picker", () => {
    expect(SRC).toMatch(/onPhotoImportPress/);
    expect(SRC).toMatch(/if \(isFreeTier\)\s*\{\s*\n?\s*router\.push\("\/paywall\?from=import_photo"/);
  });

  it("resolves the user tier (cached + live reconcile) and derives isFreeTier", () => {
    expect(SRC).toMatch(/loadCachedUserTier/);
    expect(SRC).toMatch(/select\("user_tier"\)/);
    expect(SRC).toMatch(/const isFreeTier = userTier === "free"/);
  });

  it("shows a Lock + Pro badge on the photo affordance for Free users", () => {
    expect(SRC).toMatch(/isFreeTier &&[\s\S]{0,120}styles\.proPill/);
    expect(SRC).toMatch(/<Lock size=\{12\}/);
    expect(SRC).toMatch(/proPillText[\s\S]{0,80}>Pro</);
  });
});

describe("Import surface — honest source row (gap #2/#6)", () => {
  it("removed the fake four-way IMPORT FROM router", () => {
    // No tile should route to the clipboard paste flow as a fake source route.
    expect(SRC).not.toMatch(/IMPORT FROM/);
    expect(SRC).not.toMatch(/sourceIconBox/);
    expect(SRC).not.toMatch(/styles\.sourceButton/);
  });

  it("renders a non-tappable WORKS WITH trust-chip row (no onPress)", () => {
    expect(SRC).toMatch(/WORKS WITH/);
    // The trust chip is a <View>, never a <Pressable> — it carries no onPress.
    expect(SRC).toMatch(/<View key=\{s\.label\} style=\{styles\.trustChip\}/);
    expect(SRC).not.toMatch(/trustChip[\s\S]{0,60}onPress/);
  });
});

describe("Import surface — calm tokens (gap #5/#7/#10/#12)", () => {
  it("uses the neutral mono badge — no raw brand hexes", () => {
    expect(SRC).not.toMatch(/recentBadgeTT/);
    expect(SRC).not.toMatch(/recentBadgeIG/);
    expect(SRC).not.toMatch(/backgroundColor:\s*"#E4405F"/);
    expect(SRC).not.toMatch(/recentBadge:[\s\S]{0,160}backgroundColor:\s*"#000"/);
  });

  it("paste field + Import button use the on-scale Radius.xl (no orphan 16)", () => {
    expect(SRC).toMatch(/input:\s*\{[\s\S]{0,200}borderRadius:\s*Radius\.xl/);
    expect(SRC).toMatch(/primaryBtn:\s*\{[\s\S]{0,260}borderRadius:\s*Radius\.xl/);
    expect(SRC).not.toMatch(/borderRadius:\s*16\b/);
  });

  it("section eyebrows + top-bar title use the section-eyebrow token", () => {
    expect(SRC).toMatch(/sectionEyebrow:\s*\{\s*\n?\s*\.\.\.Type\.label/);
    expect(SRC).toMatch(/topTitle:\s*\{\s*\n?\s*\.\.\.Type\.label/);
  });
});

describe("Import surface — flag gating (CLAUDE.md)", () => {
  it("gates the unboxed idle behind recipe-import-redesign, legacy in the else", () => {
    expect(SRC).toMatch(/isFeatureEnabled\("recipe-import-redesign"\)/);
    expect(SRC).toMatch(/importRedesign \?/);
    // Legacy panelCard idle stays alive in the else branch.
    expect(SRC).toMatch(/Legacy boxed idle \(flag OFF\)/);
  });
});
