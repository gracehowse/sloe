/**
 * ENG-927 — user-facing copy must say Sloe, not Suppr.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { todayHealthConnectEnergyEmptyHint } from "../../src/lib/copy/today";
import { PROMO_CODE_PLACEHOLDER } from "../../src/lib/copy/promo";
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
    const shareCard = readFileSync(join(ROOT, "src/lib/share/buildRecipeShareCard.ts"), "utf8");
    // Rich share (ENG-978) lives in buildRecipeShareCard; legacy fallback stays in detail.
    expect(detail).toContain('"Open this recipe in Sloe"');
    expect(shareCard).toContain("made with Sloe");
    expect(detail).not.toMatch(/Open this recipe in Suppr/);
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
    const banner = readFileSync(
      join(ROOT, "apps/mobile/components/settings/SettingsSloeProBanner.tsx"),
      "utf8",
    );
    expect(banner).toContain("Get Sloe Pro");
    expect(banner).toContain("Sloe Pro — active subscription");
    expect(banner).not.toMatch(/Suppr Pro/);
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

  // ENG-1218 — the Adaptive TDEE how-it-works step must promise the bar at
  // which the feature actually SURFACES (MEDIUM confidence: 14 days / 5
  // weigh-ins), not the MIN_* compute floor (7 / 3). The floor is the earliest
  // the engine can run; `refreshAdaptiveTdee` skips low confidence and
  // `resolveMaintenance` rejects it, so a user never sees an estimate before
  // medium. Pin the rendered numbers to the engine constants (imported, not
  // hardcoded) so a silent revert to the floor breaks loudly.
  it("Adaptive TDEE step promises the MEDIUM surface threshold, not the MIN floor", async () => {
    const { HOW_IT_WORKS } = await import("../../src/lib/landing/content");
    const {
      MEDIUM_CONFIDENCE_LOGGING_DAYS,
      MEDIUM_CONFIDENCE_WEIGH_INS,
      MIN_LOGGING_DAYS,
      MIN_WEIGH_INS,
    } = await import("../../src/lib/nutrition/adaptiveTdee");

    const tdeeStep = HOW_IT_WORKS.find((s) => s.body.includes("Adaptive TDEE"));
    expect(tdeeStep).toBeDefined();
    const body = tdeeStep!.body;

    // Renders the surface threshold (14 days / 5 times).
    expect(body).toContain(
      `logged ${MEDIUM_CONFIDENCE_LOGGING_DAYS} days and weighed in ${MEDIUM_CONFIDENCE_WEIGH_INS} times`,
    );

    // The fixture is only meaningful if the floor and the surface bar differ —
    // guard against the engine constants being changed to collapse them.
    expect(MEDIUM_CONFIDENCE_LOGGING_DAYS).toBeGreaterThan(MIN_LOGGING_DAYS);
    expect(MEDIUM_CONFIDENCE_WEIGH_INS).toBeGreaterThan(MIN_WEIGH_INS);

    // Must NOT quote the compute floor (the stale pre-ENG-1218 claim).
    expect(body).not.toContain(
      `logged ${MIN_LOGGING_DAYS} days and weighed in ${MIN_WEIGH_INS} times`,
    );
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
    // ENG-1457: the placeholder is a shared constant now — the pricing
    // page still said SUPPR_PRO a month after Settings was reworded,
    // because this pin only watched Settings. Pin the constant's value
    // AND that both consumers reference it (no literal drift possible).
    expect(PROMO_CODE_PLACEHOLDER).toBe("e.g. SLOE_PRO");
    for (const rel of [
      "src/app/components/Settings.tsx",
      "app/pricing/PromoCodeBlock.tsx",
    ]) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src, rel).toContain("placeholder={PROMO_CODE_PLACEHOLDER}");
      expect(src, rel).not.toContain("SUPPR_PRO");
    }
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

  it("web onboarding narrative copy says Sloe (not Suppr)", () => {
    const narrative = readFileSync(
      join(ROOT, "src/app/components/onboarding/narrative.tsx"),
      "utf8",
    );
    expect(narrative).toContain("Sloe adapts");
    expect(narrative).not.toMatch(/\bSuppr\b/);
  });

  it("web onboarding goal step uses Figma question copy", () => {
    const goal = readFileSync(
      join(ROOT, "src/lib/onboarding/goalOptions.ts"),
      "utf8",
    );
    expect(goal).toContain("What brings you to Sloe?");
    expect(goal).toContain("We'll tailor everything to you.");
  });

  it("product page titles use Sloe suffix (not Suppr)", () => {
    const today = readFileSync(join(ROOT, "app/(product)/today/page.tsx"), "utf8");
    expect(today).toContain('"Today — Sloe"');
    expect(today).not.toContain('"Today — Suppr"');
  });

  it("meal share text uses Sloe attribution", () => {
    const src = readFileSync(join(ROOT, "src/lib/share/buildMealShareText.ts"), "utf8");
    expect(src).toContain("via Sloe");
    expect(src).not.toContain("via Suppr");
  });

  it("web help/legal product copy uses Sloe while preserving operational endpoints (mailboxes live on getsloe.com — suppr.app is dead)", () => {
    const helpPage = readFileSync(join(ROOT, "app/help/page.tsx"), "utf8");
    const helpClient = readFileSync(join(ROOT, "app/help/HelpClient.tsx"), "utf8");
    const terms = readFileSync(join(ROOT, "app/terms/page.tsx"), "utf8");
    const privacy = readFileSync(join(ROOT, "app/privacy/page.tsx"), "utf8");

    expect(helpPage).toContain('"Help — Sloe"');
    expect(helpClient).toContain("How Sloe works");
    expect(terms).toContain("&ldquo;Sloe&rdquo;");
    expect(terms).toContain("getsloe.com");
    expect(privacy).toContain("Sloe helps you log recipes");

    // Mailboxes and the live import crawler user-agent are infrastructure,
    // not user-facing product brand claims.
    expect(terms).toContain("support@getsloe.com");
    expect(terms).toContain("SupprBot");
    expect(privacy).toContain("privacy@getsloe.com");
    expect(privacy).toContain("dmca@getsloe.com");
  });

  // ── Transactional auth emails (ENG-1289, sweep V3) ──────────────────
  // The six Supabase auth templates + their config.toml subjects were
  // authored 2026-04-28 under the Suppr brand (gradient wordmark
  // #4c6ce0→#e04888, "Suppr" in subjects/bodies) and were never covered
  // by this guard, which only scanned app-UI files. Pin them here so the
  // retired brand can't silently return in the one surface every new
  // user sees before the app itself. Link HOSTS (suppr-club.com) are
  // infrastructure — the domain cutover is separate, deliberate work —
  // and stay out of scope: the case-sensitive \bSuppr\b token never
  // matches the lowercase host.
  const EMAIL_TEMPLATE_DIRS = [
    "supabase/templates", // canonical — what `supabase config push` applies
    "docs/emails/supabase-auth", // human-reference mirror
  ];

  it("supabase auth email templates carry the Sloe brand (no Suppr, no retired gradient)", () => {
    for (const dir of EMAIL_TEMPLATE_DIRS) {
      const files = readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".html"));
      expect(files.length, dir).toBe(6);
      for (const file of files) {
        const html = readFileSync(join(ROOT, dir, file), "utf8");
        const label = `${dir}/${file}`;
        expect(html, label).not.toMatch(/\bSuppr\b/);
        expect(html, label).not.toMatch(/#4c6ce0/i);
        expect(html, label).not.toMatch(/#e04888/i);
        // Wordmark + CTA/link ink is the Sloe plum, mirroring
        // --foreground-brand in src/styles/theme.css.
        expect(html, label).toMatch(/#3B2A4D/i);
        expect(html, label).toContain(">sloe</span>");
        // Footer mailbox matches the legal pages (app/privacy/page.tsx).
        expect(html, label).toContain("privacy@getsloe.com");
        expect(html, label).not.toContain("privacy@suppr-club.com");
      }
    }
  });

  it("docs mirror of the auth email templates is byte-identical to canonical", () => {
    const [canonicalDir, mirrorDir] = EMAIL_TEMPLATE_DIRS;
    for (const file of readdirSync(join(ROOT, canonicalDir)).filter((f) => f.endsWith(".html"))) {
      const canonical = readFileSync(join(ROOT, canonicalDir, file), "utf8");
      const mirror = readFileSync(join(ROOT, mirrorDir, file), "utf8");
      expect(mirror, file).toBe(canonical);
    }
  });

  it("supabase config.toml auth email subjects say Sloe (not Suppr)", () => {
    const config = readFileSync(join(ROOT, "supabase/config.toml"), "utf8");
    // Grab the subject line of every [auth.email.template.*] block.
    const subjects = [...config.matchAll(
      /\[auth\.email\.template\.\w+\]\s*\nsubject = "([^"]+)"/g,
    )].map((m) => m[1]);
    expect(subjects).toHaveLength(6);
    for (const subject of subjects) {
      expect(subject).not.toMatch(/\bSuppr\b/);
    }
    // Every brand-bearing subject (all but the brand-neutral
    // "Confirm your new email address") must actually carry the new mark.
    expect(subjects.filter((s) => s.includes("Sloe"))).toHaveLength(5);
  });
});

// ── ENG-1298 — stale-Suppr brand sweep (2026-07-01) ─────────────────────────
// Pixel-confirmed regressions from the July launch sweep: /roadmap rendered
// "sloe Suppr" side by side, /licences and /dmca were fully Suppr-branded,
// terms still pointed legal notices at the dead suppr.app mailbox, the web
// recipe-detail creator card bypassed the displayAttribution calm-over, and
// the ingredient-match rows rendered the raw DB source id "Suppr". Each fixed
// surface is pinned here so it cannot silently regress. Kept as its own
// describe block — the email-template lane extends this file separately.
describe("ENG-1298 — stale-Suppr sweep (user-facing surfaces)", () => {
  it("/roadmap header renders the wordmark only (no literal 'Suppr' beside it) and copy says Sloe", () => {
    const page = readFileSync(join(ROOT, "app/roadmap/page.tsx"), "utf8");
    expect(page).toContain('title: "Roadmap — Sloe"');
    expect(page).toContain("Sloe is evolving quickly");
    // The lockup bug: SupprLogoMark already renders "sloe"; a literal brand
    // word next to it reads "sloe Suppr". No bare Suppr token may render.
    expect(page).not.toMatch(/>\s*Suppr\s*</);
    expect(page).not.toMatch(/"[^"]*\bSuppr\b[^"]*"/);
  });

  it("/licences page is Sloe-branded and preserves the ODbL + trademark attributions", () => {
    const page = readFileSync(join(ROOT, "app/licences/page.tsx"), "utf8");
    expect(page).toContain('title: "Open-source licences — Sloe"');
    expect(page).toContain("USDA does not endorse Sloe.");
    expect(page).toContain("The software Sloe ships and the data Sloe displays");
    expect(page).not.toMatch(/\bSuppr\b/);
    // Attribution obligations must survive the rebrand byte-for-byte.
    expect(page).toContain("Open Database License 1.0 (ODbL)");
    expect(page).toContain("Data © Open Food Facts contributors.");
    expect(page).toContain("opendatacommons.org/licenses/odbl/1-0");
    expect(page).toMatch(/trademarks\s+of Apple Inc\./);
  });

  it("terms statutory legal contact is legal@getsloe.com (suppr.app is a dead domain)", () => {
    const terms = readFileSync(join(ROOT, "app/terms/page.tsx"), "utf8");
    expect(terms).toContain("legal@getsloe.com");
    expect(terms).not.toContain("legal@suppr.app");
  });

  it("/dmca page + takedown form are Sloe-branded", () => {
    const page = readFileSync(join(ROOT, "app/dmca/page.tsx"), "utf8");
    const form = readFileSync(join(ROOT, "app/dmca/_form/DmcaTakedownForm.tsx"), "utf8");
    expect(page).toContain("Sloe respects copyright");
    expect(page).toContain('title: "DMCA / Copyright takedown — Sloe"');
    expect(form).toContain("Sloe recipe ID or link");
    expect(form).not.toContain("Suppr recipe ID");
  });

  it("public recipe + creator SSR pages carry the Sloe title suffix and wordmark", () => {
    const recipe = readFileSync(join(ROOT, "app/recipe/[id]/page.tsx"), "utf8");
    const creator = readFileSync(join(ROOT, "app/creator/[id]/page.tsx"), "utf8");
    expect(recipe).toContain("— Sloe`");
    expect(recipe).toContain("Sloe plans your week from recipes like this one");
    expect(recipe).not.toMatch(/>\s*Suppr\s*</);
    expect(creator).toContain("— Sloe`");
    expect(creator).not.toMatch(/— Suppr/);
  });

  it("web recipe-detail creator card routes the name through displayAttribution (Suppr Kitchen → Sloe Kitchen)", async () => {
    const detail = readFileSync(join(ROOT, "src/app/components/RecipeDetail.tsx"), "utf8");
    // The card must not render recipe.creatorName raw — the DB seed keeps the
    // LEGAL string "Suppr Kitchen" (discoverSeedCopyright contract); the remap
    // happens at the display boundary only.
    expect(detail).toContain(
      "displayAttribution({ creatorName: recipe.creatorName }) || recipe.creatorName",
    );
    const { displayAttribution } = await import("../../src/lib/recipes/displayAttribution");
    expect(displayAttribution({ creatorName: "Suppr Kitchen" })).toBe("Sloe Kitchen");
  });

  it("settings Apple Health copy says Sloe on web (row subtitle + explainer dialog)", () => {
    const settings = readFileSync(join(ROOT, "src/app/components/Settings.tsx"), "utf8");
    const dialogs = readFileSync(
      join(ROOT, "src/app/components/settings/SettingsDialogs.tsx"),
      "utf8",
    );
    expect(settings).toContain("syncs from the Sloe app");
    expect(settings).not.toContain("the Suppr app");
    expect(dialogs).toContain("Apple Health connects in the Sloe iOS app");
    expect(dialogs).not.toContain("Suppr iOS app");
  });

  it("nutrition source display label maps the canonical 'Suppr' DB value to Sloe (and fixes USDA casing)", async () => {
    const { formatNutritionSourceLabel } = await import("../../src/lib/nutrition/sourceLabel");
    // "Suppr" stays canonical in the DB (CHECK constraint) — display remaps.
    expect(formatNutritionSourceLabel("Suppr")).toBe("Sloe");
    expect(formatNutritionSourceLabel("USDA")).toBe("USDA");
    expect(formatNutritionSourceLabel("USDA FoodData Central")).toBe("USDA FoodData Central");
    // Both add-ingredient match rows must route through the mapper.
    for (const rel of [
      "src/app/components/suppr/add-ingredient-dialog.tsx",
      "apps/mobile/components/AddIngredientSheet.tsx",
    ]) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src, rel).toContain("formatNutritionSourceLabel(match.source) ?? match.source");
    }
  });

  it("mobile image-generation alert says Sloe", () => {
    const src = readFileSync(join(ROOT, "apps/mobile/app/recipe/[id].tsx"), "utf8");
    expect(src).toContain("Sloe's image service is not configured");
    expect(src).not.toContain("Suppr's image service");
  });

  it("StoreKit test configs sell the subscription group as Sloe Pro", () => {
    for (const rel of ["apps/mobile/storekit/Suppr.storekit", "apps/mobile/ios/Suppr.storekit"]) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src, rel).toContain('"name": "Sloe Pro"');
      expect(src, rel).toContain("best value for the full Sloe loop");
      expect(src, rel).not.toContain("Suppr Pro");
    }
  });

  it("trust page revision-history link points at the current repo slug (ENG-1457)", () => {
    // The repo was renamed gracehowse/Suppr -> gracehowse/sloe. GitHub 301s
    // the old slug, so this link "worked" either way — pin the canonical
    // URL directly rather than relying on a redirect staying in place.
    const src = readFileSync(
      join(ROOT, "src/app/components/trust/TrustPageHeader.tsx"),
      "utf8",
    );
    expect(src).toContain("https://github.com/gracehowse/sloe/commits/main/");
    expect(src).not.toContain("github.com/gracehowse/Suppr/");
  });

  it("HealthKit write-failure diagnostic points at the Sloe Settings row (ENG-1457)", () => {
    // Sibling diagnostic in healthSync.ts already said "...Devices → Sloe.";
    // this one had drifted and still said Suppr.
    const src = readFileSync(join(ROOT, "apps/mobile/lib/healthKitMealWriter.ts"), "utf8");
    expect(src).toContain("Data Access & Devices → Sloe.");
    expect(src).not.toContain("Data Access & Devices → Suppr.");
  });
});
