/**
 * ENG-927 — user-facing copy must say Sloe, not Suppr.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { todayHealthConnectEnergyEmptyHint } from "../../src/lib/copy/today";
import { PLAN_SOURCE_ROW_META } from "../../src/lib/planning/planSource";

const ROOT = join(__dirname, "../..");

describe("ENG-927 — Sloe brand copy (user-facing)", () => {
  it("today health-connect empty hint says Sloe", () => {
    expect(todayHealthConnectEnergyEmptyHint()).toContain("in Sloe yet");
    expect(todayHealthConnectEnergyEmptyHint()).not.toContain("in Suppr yet");
  });

  it("plan source subtitles say Sloe's recipes", () => {
    expect(PLAN_SOURCE_ROW_META.library_and_discovery.subtitle).toContain("Sloe's recipe picks");
    expect(PLAN_SOURCE_ROW_META.discovery.subtitle).toContain("Sloe's recipes");
  });

  it("web whats-new page title says Sloe", () => {
    const page = readFileSync(join(ROOT, "app/whats-new/page.tsx"), "utf8");
    const titleBlock = page.match(/data-testid="whats-new-title"[\s\S]{0,120}/)?.[0] ?? "";
    expect(titleBlock).toMatch(/What(?:&rsquo;|'|')s new in Sloe/);
    expect(titleBlock).not.toMatch(/Suppr/);
  });

  it("recipe share strings say Sloe", () => {
    const detail = readFileSync(join(ROOT, "src/app/components/RecipeDetail.tsx"), "utf8");
    expect(detail).toContain('title: "Recipe on Sloe"');
    expect(detail).toContain('text: "Open this recipe in Sloe"');
  });

  // ── Visual-surface sweep (TF57 BRAND lane, 2026-06-12) ──────────────
  // The paywall, settings membership banner, web signup terms line, and
  // the landing/pricing content SSOT are the highest-traffic conversion
  // surfaces a returning "Suppr" could regress on. Pin each one so a
  // future SSOT or screen edit can't silently reintroduce the old mark.

  it("mobile paywall sells the plan as Sloe Pro (no Suppr Pro)", () => {
    const paywall = readFileSync(join(ROOT, "apps/mobile/app/paywall.tsx"), "utf8");
    expect(paywall).toContain('"SLOE PRO"');
    expect(paywall).not.toMatch(/"SUPPR PRO"/);
  });

  it("mobile settings membership banner says Sloe Pro", () => {
    const settings = readFileSync(
      join(ROOT, "apps/mobile/components/settings/SettingsBundleContent.tsx"),
      "utf8",
    );
    expect(settings).toContain("Get Sloe Pro");
    expect(settings).toContain("Manage your Sloe Pro subscription");
    expect(settings).not.toMatch(/Suppr Pro/);
  });

  it("web signup terms checkbox says Sloe (not Suppr)", () => {
    const signup = readFileSync(
      join(ROOT, "src/app/components/onboarding/steps/signup.tsx"),
      "utf8",
    );
    expect(signup).toContain("I agree to Sloe&apos;s");
    expect(signup).not.toContain("I agree to Suppr&apos;s");
  });

  it("landing content SSOT how-it-works + FAQ copy says Sloe", async () => {
    const { HOW_IT_WORKS, FAQS } = await import("../../src/lib/landing/content");
    const blob =
      HOW_IT_WORKS.map((s) => s.body).join(" ") +
      " " +
      FAQS.map((f) => `${f.q} ${f.a}`).join(" ");
    // The brand word must read Sloe wherever the SSOT names the product.
    // (URLs / email mailboxes like suppr-club.com are infrastructure and
    // are intentionally excluded — they carry no bare "Suppr " brand token.)
    expect(blob).not.toMatch(/\bSuppr\b/);
    expect(blob).toContain("Sloe imports ingredients");
    expect(blob).toContain("Sloe picks combinations");
    expect(blob).toContain("Sloe is a personal tracking tool");
  });

  // Parity review D1–D4 (2026-06-12): four user-visible surfaces the first
  // sweep missed — pinned so they can never regress to "Suppr".
  it("welcome notification title says Sloe (D1)", () => {
    const src = readFileSync(join(ROOT, "src/context/NotificationContext.tsx"), "utf8");
    expect(src).toContain('"Welcome to Sloe"');
    expect(src).not.toContain('"Welcome to Suppr"');
  });

  it("MFP CSV import card copy says Sloe (D2)", () => {
    const src = readFileSync(
      join(ROOT, "src/app/components/imports/MfpCsvImportCard.tsx"),
      "utf8",
    );
    expect(src).toContain("meal history into Sloe");
    expect(src).not.toContain("meal history into Suppr");
  });

  it("promo code placeholder example says SLOE_PRO (D3)", () => {
    const src = readFileSync(join(ROOT, "src/app/components/Settings.tsx"), "utf8");
    expect(src).toContain('placeholder="e.g. SLOE_PRO"');
    expect(src).not.toContain("SUPPR_PRO");
  });

  it("DR outage banner default body says Sloe on BOTH platforms (D4)", () => {
    for (const rel of [
      "src/app/components/ops/DrOutageBanner.tsx",
      "apps/mobile/components/ops/DrOutageBanner.tsx",
    ]) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src, rel).toContain("Sloe is temporarily having issues");
      expect(src, rel).not.toContain("Suppr is temporarily having issues");
    }
  });
});
