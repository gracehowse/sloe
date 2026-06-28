/**
 * Group G IA Batches B–E — `SettingsBundleContent` is the single
 * render surface for the legacy "More" sections (Membership, Goals &
 * targets, Connections, Recipes, Household, Legal, Build, Danger
 * zone, Sign Out + modals). Mounted on `/(tabs)/settings`.
 *
 * Batch E (2026-05-14): `/(tabs)/more` deleted entirely (grace period
 * complete). This test pins:
 *   1. The bundle file exists and exports `SettingsBundleContent`.
 *   2. Every row that Apple Health / Daily targets / Delete account
 *      / Reset / Caffeine / Alcohol / Weekly recap depends on is
 *      present (testIDs pinned).
 *   3. `settings.tsx` imports the bundle.
 *   4. The 7 modals are still rendered inside the bundle so they
 *      self-portal correctly.
 *
 * Source-level structural check — no React rendering.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const BUNDLE_PATH = resolve(
  ROOT,
  "components/settings/SettingsBundleContent.tsx",
);
const SETTINGS_PATH = resolve(ROOT, "app/(tabs)/settings.tsx");

const bundle = readFileSync(BUNDLE_PATH, "utf8");
const settings = readFileSync(SETTINGS_PATH, "utf8");

describe("SettingsBundleContent — parity contract", () => {
  it("exports the SettingsBundleContent component", () => {
    expect(bundle).toMatch(/export\s+function\s+SettingsBundleContent/);
    expect(bundle).toMatch(/export\s+default\s+SettingsBundleContent/);
  });

  it("renders all load-bearing settings rows by testID", () => {
    const expectedTestIds = [
      "settings-bundle-upgrade-row",
      "settings-bundle-daily-targets-row",
      "settings-bundle-dashboard-widgets-row",
      "settings-bundle-week-start-row",
      "settings-bundle-caffeine-row",
      "settings-bundle-alcohol-row",
      // 2026-05-02 (`claude/fasting-findable-urgent`) — Build 40
      // feedback: typing "fast" in Settings search returned "No
      // matches" and the fasting window had no in-app config path
      // outside onboarding. The Fasting row in Goals & targets is
      // now the canonical entry to /fasting (which hosts the
      // window picker matching the web FastingTimer presets).
      "settings-bundle-fasting-row",
      "settings-bundle-apple-health-row",
      "settings-bundle-notifications-row",
      "settings-bundle-weekly-recap-row",
      "settings-bundle-create-recipe-row",
      "settings-bundle-export-csv-row",
      // 2026-04-30: legacy `settings-bundle-export-json-row`
      // (client-side stitched profile + entries + saves) was
      // retired in favour of the server-authoritative
      // `settings-bundle-export-everything-row` which calls
      // `/api/export/me` and includes recipes, weights, plans,
      // custom foods, etc. — counters lock-in anxiety per the
      // user-sentiment audit. See `docs/operations/data-export.md`.
      "settings-bundle-export-everything-row",
      "settings-bundle-barcode-contributions-row",
      "settings-bundle-help-row",
      "settings-bundle-privacy-row",
      "settings-bundle-terms-row",
      "settings-bundle-reset-row",
      "settings-bundle-delete-account-row",
      // 2026-05-01 (`claude/settings-mobile-structural-fix`): the
      // bundle no longer renders its own destructive-bordered Sign
      // Out (P1-5). The single neutral Sign Out row lives in
      // `app/(tabs)/settings.tsx` beneath the bundle (Sign Out is
      // reversible — red is reserved for irreversible actions).
      //
      // P0-1 / Tracking extras toggles (caffeine + alcohol Today
      // opt-in) — migrated from the legacy `/(tabs)/settings.tsx`
      // Tracking extras section into a "Display & extras" section
      // in the bundle.
      "settings-bundle-track-caffeine-toggle",
      "settings-bundle-track-alcohol-toggle",
      // P0-1: Manage subscription + promo-code rows migrated from
      // the legacy in-file Plan section into the Membership card so
      // base/pro users can cancel and testers can redeem codes.
      "settings-manage-subscription-row",
      "settings-bundle-promo-code-input",
      "settings-bundle-promo-code-apply",
      // "Your name" field — personalises the Today greeting. Writes
      // `user_metadata.full_name` via the shared `saveDisplayName`
      // (`src/lib/account/displayName.ts`); the greeting reads it back
      // via `firstNameFromMetadata`. Web mirror in
      // `src/app/components/Settings.tsx`. 2026-06-04: relocated under a
      // "Personal" section heading (was a lone "Your name" card) so it
      // groups with the user's personal settings — testIDs preserved;
      // placement pinned in `tests/unit/settingsYourNameParity.test.ts`.
      "settings-card-name",
      "settings-bundle-name-input",
      "settings-bundle-name-save",
    ];
    for (const id of expectedTestIds) {
      expect(bundle).toContain(`testID="${id}"`);
    }
  });

  it("renders the core settings modals and keeps <Modal>/open-state parity", () => {
    // 2026-05-12 (premium-bar audit DC9): a 7th modal was added for
    // the type-RESET-to-confirm gate on Erase Everything. The Apple
    // pattern for irreversible destruction — friction proportional to
    // consequence. Replaces the earlier Alert.alert version (no text
    // input possible).
    // 2026-05-26: an 8th modal — the "Deficit summary" window picker —
    // moved here from the Today card (Grace: the toggle belongs in
    // Settings). Mirrors the web Settings "Deficit summary" control.
    expect(bundle).toContain("setResetModalOpen");
    expect(bundle).toContain("setEraseConfirmOpen");
    expect(bundle).toContain("setWidgetPickerOpen");
    expect(bundle).toContain("setWeekStartPickerOpen");
    expect(bundle).toContain("setMealSlotPickerOpen");
    expect(bundle).toContain("setCaffeineTargetPickerOpen");
    expect(bundle).toContain("setAlcoholTargetPickerOpen");
    expect(bundle).toContain("setWeeklyRecapPushPickerOpen");
    expect(bundle).toContain("setDeficitWindowPickerOpen");
    // Every modal-open state drives exactly one <Modal> and vice versa — a
    // self-deriving count, so adding a settings modal (gate-1 meal-slot,
    // gate-2 pantry, …) doesn't require hand-bumping a magic number. Still
    // catches real drift: an orphan <Modal> with no open-state, or a
    // set<X>(Picker|Modal|Confirm)Open with no matching <Modal>.
    const modalCount = (bundle.match(/<Modal\b/g) ?? []).length;
    const modalSetters = new Set(
      bundle.match(/set[A-Za-z]+(?:Picker|Modal|Confirm)Open\b/g) ?? [],
    );
    expect(modalCount).toBe(modalSetters.size);
    expect(modalCount).toBeGreaterThanOrEqual(9);
  });

  it("erase-everything modal enforces type-RESET-to-confirm (DC9, 2026-05-12)", () => {
    // Source-greps to pin the type-confirm gate: the CTA must check
    // `eraseConfirmInput === "RESET"` before allowing handleNuke to
    // fire, and the placeholder + label must surface "RESET" to the
    // user. This fails CI if a future refactor relaxes the gate.
    expect(bundle).toContain("setEraseConfirmInput");
    expect(bundle).toMatch(/eraseConfirmInput\s*!==\s*"RESET"/);
    expect(bundle).toContain('placeholder="RESET"');
    expect(bundle).toContain('testID="erase-confirm-cta"');
    expect(bundle).toContain('testID="erase-confirm-input"');
  });

  it("delete-account flow still posts to /api/account/delete with bearer token", () => {
    expect(bundle).toMatch(/fetch\(`\$\{base\}\/api\/account\/delete`/);
    expect(bundle).toContain('method: "DELETE"');
    expect(bundle).toMatch(/Authorization:\s*`Bearer/);
  });

  it("surfaces barcode contribution withdrawal from Settings Account", () => {
    expect(bundle).toContain("BARCODE_CONTRIBUTIONS_SETTINGS_LABEL");
    expect(bundle).toContain("settings-bundle-barcode-contributions-list");
    expect(bundle).toContain(".from(\"user_foods\")");
    expect(bundle).toContain(".delete()");
    expect(bundle).toContain(".eq(\"submitted_by\", userId)");
  });

  it("delete-account flow still requires typing 'delete' to confirm", () => {
    // Two-step deliberate confirm: Alert → Alert.prompt → typed 'delete'.
    expect(bundle).toMatch(/Alert\.prompt\?\.\(/);
    expect(bundle).toContain('!== "delete"');
  });

  it("reset modal surfaces refresh-plan and erase-everything paths (2026-05-11 simpler flow)", () => {
    // 2026-05-11 (Grace TF feedback): "Reset targets" inline path replaced
    // by "Refresh my plan" — always re-runs the canonical /onboarding flow
    // (Lose It-style) so users can update weight/height/goals/macros.
    // Post-onboarding a one-shot prompt asks "Keep my logs and weight
    // history?". "Erase everything" remains the nuclear option.
    expect(bundle).toContain("Refresh my plan");
    expect(bundle).toContain("Erase everything");
    expect(bundle).toContain("handleRefreshPlan");
    expect(bundle).toContain("handleNukeEverything");
    expect(bundle).toContain("nukeAllUserAppData");
  });

  it("refresh-plan sets the post-onboarding prompt flag (2026-05-11)", () => {
    // Refresh writes `suppr.reset-plan-pending-prompt` to AsyncStorage so
    // `apps/mobile/components/onboarding/mobile-flow.tsx` `handleComplete`
    // can show the "Keep my logs and weight history?" prompt at the end
    // of the re-run. Without this flag the prompt is suppressed.
    expect(bundle).toContain('"suppr.reset-plan-pending-prompt"');
  });

  it("erase routes to canonical /onboarding (post-rename, was /onboarding-v2 — issue #13)", () => {
    // The legacy `/onboarding` route was deleted 2026-04-30 and the
    // v2 flow promoted to the canonical name. `router.replace` must
    // point at the canonical path.
    expect(bundle).toContain('"/onboarding"');
  });

  it("erase clears suppr.onboarding-v2.state AsyncStorage scratchpad (issue #14)", () => {
    // Without this, the next session pre-fills the onboarding form
    // with the deleted user's answers — violating the "Erase" promise.
    // KEY NAME PRESERVED: the storage key still uses the `-v2` suffix
    // because renaming it would orphan in-flight onboarding state for
    // existing users. Live data — keep verbatim.
    expect(bundle).toContain('"suppr.onboarding-v2.state"');
  });

  it("erase confirm dialog enumerates the full delete list (issue #19)", () => {
    // Section paragraph and confirm dialog must agree on what gets wiped.
    // Pre-fix the confirm dialog only mentioned "food log, saved recipes,
    // and meal plans" while the paragraph promised six categories.
    // 2026-05-01 (P1-6, `claude/settings-mobile-structural-fix`):
    // the alert title changed from "Erase everything?" to "Delete
    // your data and start fresh?" as part of the calm-streak copy
    // pass. Body still enumerates the categories so the test pin
    // stays meaningful.
    expect(bundle).toContain("Delete your data and start fresh?");
    expect(bundle).toMatch(/journal/i);
    expect(bundle).toMatch(/library saves/i);
    expect(bundle).toMatch(/shopping lists/i);
    expect(bundle).toMatch(/imported recipes/i);
    expect(bundle).toMatch(/synced activity/i);
  });

  it("/settings imports and mounts the bundle", () => {
    expect(settings).toContain(
      'from "@/components/settings/SettingsBundleContent"',
    );
    expect(settings).toContain('<SettingsBundleContent context="settings"');
  });

  it("self-routing 'Settings' row in the bundle is gated for the legacy More context", () => {
    // The bundle still carries a context-gated Palette icon row that
    // would have routed to /(tabs)/settings when rendered on /more.
    // Post-Batch D the bundle never renders with context="more", but
    // the gate stays in place to keep the bundle revertible (Batch D
    // is the only batch that flipped /more → redirect).
    expect(bundle).toMatch(/context === "more" \?[\s\S]*?Palette/);
  });
});

/**
 * Figma frame `335:2` reskin (2026-06-08) — the Settings ROOT was rebuilt
 * to the canonical Sloe design: centred serif title, plum-avatar profile
 * row + plan label, peach "Sloe Pro" banner, ALL-CAPS grey section
 * eyebrows, circle-outline row icons, a REMINDERS section split out of
 * Connections, and a centred clay "Delete account" at the bottom. These
 * pins fail if a future edit drops a frame element.
 */
describe("Settings — Figma `335:2` frame reskin", () => {
  it("renders the profile row as a tap-to-edit plum avatar (no card chrome)", () => {
    expect(bundle).toContain('testID="settings-profile-row"');
    // Plum (navPrimary) filled circle avatar — the frame's identity header.
    expect(bundle).toMatch(
      /settings-profile-row[\s\S]*?backgroundColor: colors\.navPrimary/,
    );
    // Plan label reads "Free plan" / "Pro plan" (not a bare tier pill).
    expect(bundle).toMatch(/"Pro plan"\s*:\s*"Free plan"/);
  });

  it("renders the peach Sloe Pro upsell banner with a Manage affordance", () => {
    expect(bundle).toContain('testID="settings-sloe-pro-banner"');
    expect(bundle).toMatch(/>\s*Sloe Pro\s*</);
    expect(bundle).toMatch(/>\s*Manage\s*</);
  });

  it("groups reminder rows under a dedicated REMINDERS section", () => {
    // Notifications + Weekly recap moved out of Connections into their own
    // card to match the frame's REMINDERS group.
    expect(bundle).toContain('<SettingsCard testID="settings-card-reminders"');
    expect(bundle).toMatch(
      /settings-card-reminders[\s\S]*?settings-bundle-notifications-row[\s\S]*?settings-bundle-weekly-recap-row/,
    );
    // Apple Health stays the lone wired Connections row.
    expect(bundle).toMatch(
      /settings-card-connections[\s\S]*?settings-bundle-apple-health-row/,
    );
  });

  it("section eyebrows are ALL-CAPS Inter grey, not serif plum", () => {
    // Isolate the SectionHeading function body (up to the next top-level
    // `function`) so the assertions don't bleed into later components that
    // legitimately use the serif face (e.g. the profile name).
    const headingBody =
      bundle.slice(bundle.indexOf("function SectionHeading")).split(
        "\nfunction ",
      )[0] ?? "";
    // Now uses the sans family + uppercase transform + muted colour (was
    // FontFamily.serifSemibold + navPrimary).
    expect(headingBody).toMatch(/textTransform: "uppercase"/);
    expect(headingBody).toMatch(/color: colors\.textSecondary/);
    expect(headingBody).toMatch(/fontFamily: FontFamily\.sansSemibold/);
    expect(headingBody).not.toMatch(/fontFamily: FontFamily\.serifSemibold/);
    expect(headingBody).not.toMatch(/color: colors\.navPrimary/);
  });

  it("row icon plates are white circles with a hairline ring (circle-outline)", () => {
    // Isolate the IconBox function body so the assertions don't bleed.
    const iconBoxBody =
      bundle.slice(bundle.indexOf("function IconBox")).split("\nfunction ")[0] ??
      "";
    // IconBox swapped the colour-tinted rounded square (color + "18") for a
    // white circle (background + cardBorder ring) per the frame.
    expect(iconBoxBody).toMatch(/borderRadius: size \/ 2/);
    expect(iconBoxBody).toMatch(/borderColor: colors\.cardBorder/);
    expect(iconBoxBody).not.toMatch(/backgroundColor: color \+ "18"/);
  });

  it("delete account is a centred clay text affordance, not a destructive card row", () => {
    // The delete-account row moved below the Danger-zone card as a centred
    // clay Pressable; the flow is unchanged (handleDeleteAccount).
    expect(bundle).toMatch(/>\s*Delete account\s*</);
    expect(bundle).toContain("handleDeleteAccount");
    expect(bundle).toMatch(
      /settings-bundle-delete-account-row[\s\S]{0,200}?onPress=\{handleDeleteAccount\}/,
    );
  });

  it("the screen title is centred in the top bar (shell)", () => {
    expect(settings).toMatch(/textAlign: "center"/);
    expect(settings).toMatch(/<Text style=\{\[styles\.title[\s\S]*?>\s*Settings\s*<\/Text>/);
    // The cold subtitle was removed.
    expect(settings).not.toContain("Plan, targets, and how the app shows up.");
  });
});
