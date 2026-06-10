/**
 * SlotColors parity — ui-critic P2 #10 (2026-05-01).
 *
 * Background
 * ----------
 * Until 2026-05-01, the Snacks meal-slot tint reused `MacroColors.fat`
 * (magenta `#e04888`). This was a 1:1 colour collision with the Fat
 * macro tile rendered on the same Today screen — the same hue was
 * carrying two unrelated meanings ("snack slot" vs "fat macro").
 *
 * Resolution
 * ----------
 * Mobile ships a dedicated `SlotColors` object in
 * `apps/mobile/constants/theme.ts`; web ships matching `--slot-*` CSS
 * custom properties in `src/styles/theme.css` plus `slot-*` tones on
 * the `IconBox` primitive. The Snack tint is cyan (`#06b6d4`) — the
 * same value `Accent.cyan` / `--macro-water` carry, but routed
 * through the slot namespace so the magenta collision cannot regress.
 *
 * What this test pins
 * -------------------
 *  1. `SlotColors` exists on mobile with the four canonical roles and
 *     the snack tint is cyan, NOT magenta.
 *  2. `MacroColors.fat` does not appear in any *Meals* / *Slot* /
 *     planner slot-colour file — slot tints come from `SlotColors`.
 *  3. Web `--slot-*` tokens exist in both light and dark mode and the
 *     snack token is cyan family.
 *  4. Web `IconBox` exposes the four `slot-*` tones.
 *  5. Web `today-meals-section` uses `tone: "slot-snack"` (NOT
 *     `tone: "fat"`) for the Snacks slot.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Accent, MacroColors, SlotColors } from "../../constants/theme";

const REPO_ROOT = resolve(__dirname, "../../../..");

function read(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), "utf8");
}

describe("SlotColors token (ui-critic P2 #10 — magenta=fat=snack collision fix)", () => {
  describe("mobile theme exports", () => {
    it("exposes four canonical slot roles", () => {
      expect(SlotColors).toMatchObject({
        breakfast: expect.any(String),
        lunch: expect.any(String),
        dinner: expect.any(String),
        snack: expect.any(String),
      });
    });

    it("snack tint is teal (#4A7878), distinct from MacroColors.fat", () => {
      // Sloe Phase 0 (dossier D-4): snack → teal. Fat is amber (#C9892C);
      // teal keeps the snack slot collision-free with every macro hue.
      expect(SlotColors.snack.toLowerCase()).toBe("#4a7878");
      expect(MacroColors.fat.toLowerCase()).toBe("#c9892c");
      expect(SlotColors.snack.toLowerCase()).not.toBe(
        MacroColors.fat.toLowerCase(),
      );
    });

    it("breakfast/lunch/dinner map to amber/sage/damson (Sloe D-4)", () => {
      // Sloe Phase 0 (dossier D-4): breakfast amber, lunch sage, dinner damson.
      expect(SlotColors.breakfast.toLowerCase()).toBe("#c9892c");
      expect(SlotColors.lunch).toBe(Accent.success);   // sage — same token still
      expect(SlotColors.dinner).toBe(Accent.purple);   // damson
    });

    it("Accent.activity is Sloe honey, distinct from warning + carbs", () => {
      // Sloe Phase 0: activity/burn → honey (#D6A24A), distinct from the amber
      // warning/fat hue and from clay carbs. Breakfast slot is amber (not
      // honey), so activity no longer shares the breakfast hue.
      expect(Accent.activity.toLowerCase()).toBe("#d6a24a");
      expect(Accent.activity).not.toBe(Accent.carbs);
      expect(Accent.activity).not.toBe(Accent.warning);
    });
  });

  describe("mobile source — no MacroColors.fat in slot-colour files", () => {
    const SLOT_FILES = [
      "apps/mobile/components/today/TodayMealsSection.tsx",
      "apps/mobile/app/(tabs)/planner.tsx",
    ];

    for (const rel of SLOT_FILES) {
      it(`${rel} does not assign MacroColors.fat to a slot tint`, () => {
        const src = read(rel);
        // Strip block comments so the prose history doesn't trip the
        // grep — the regex below only fails on real code references
        // that bind `MacroColors.fat` next to a slot key.
        const code = src.replace(/\/\*[\s\S]*?\*\//g, "");
        // Match `Snack(s)?: MacroColors.fat` or `snacks?: MacroColors.fat`
        // (record literals) in either casing. Any such binding is the bug.
        expect(code).not.toMatch(/snacks?\s*:\s*MacroColors\.fat\b/i);
      });
    }

    it("TodayMealsSection wires Snacks/Snack via SlotColors.snack", () => {
      const src = read("apps/mobile/components/today/TodayMealsSection.tsx");
      expect(src).toMatch(/Snacks:\s*SlotColors\.snack\b/);
      expect(src).toMatch(/Snack:\s*SlotColors\.snack\b/);
    });

    it("planner wires snacks via SlotColors.snack", () => {
      const src = read("apps/mobile/app/(tabs)/planner.tsx");
      expect(src).toMatch(/snacks:\s*SlotColors\.snack\b/);
    });
  });

  describe("web — --slot-* tokens", () => {
    it("theme.css declares --slot-* tokens with the canonical Sloe hexes (light)", () => {
      const src = read("src/styles/theme.css");
      // Light-mode block — match against the first `:root` definitions.
      const rootStart = src.indexOf(":root");
      const darkStart = src.indexOf(".dark {");
      const lightBlock = src.slice(rootStart, darkStart);
      // Sloe Phase 0 (dossier D-4): Breakfast amber, Lunch sage, Dinner damson,
      // Snack teal.
      expect(lightBlock).toMatch(/--slot-breakfast:\s*#C9892C/i);
      expect(lightBlock).toMatch(/--slot-lunch:\s*#5E7C5A/i);
      expect(lightBlock).toMatch(/--slot-dinner:\s*#6A4B7A/i);
      expect(lightBlock).toMatch(/--slot-snack:\s*#4A7878/i);
      // Soft variants exist for tinted backgrounds (`bg-slot-snack-soft`).
      // Sloe Phase 0 (dossier A): light slot softs use the `12` alpha suffix.
      expect(lightBlock).toMatch(/--slot-snack-soft:\s*#4A787812/i);
    });

    it("theme.css declares --slot-* tokens for dark mode (Sloe lifted)", () => {
      const src = read("src/styles/theme.css");
      const darkStart = src.indexOf(".dark {");
      const themeStart = src.indexOf("@theme inline", darkStart);
      const darkBlock = src.slice(darkStart, themeStart);
      // Sloe Phase 0 dark — OLED-lifted variants of the light hexes. The
      // damson-accent family (dinner) lifts to #9A7BAA (mirrors web dark
      // --accent-win / --slot-dinner).
      expect(darkBlock).toMatch(/--slot-breakfast:\s*#D6A24A/i);
      expect(darkBlock).toMatch(/--slot-lunch:\s*#83A57E/i);
      expect(darkBlock).toMatch(/--slot-dinner:\s*#9A7BAA/i);
      // Dark snack is lifted teal, NOT magenta / cyan / purple.
      expect(darkBlock).toMatch(/--slot-snack:\s*#6FA3A3/i);
      expect(darkBlock).not.toMatch(/--slot-snack:\s*#(ff7eb3|e04888|22d3ee|ac93e2)/i);
    });

    it("theme.css exposes --color-slot-* in @theme inline so Tailwind picks them up", () => {
      const src = read("src/styles/theme.css");
      expect(src).toMatch(/--color-slot-breakfast:\s*var\(--slot-breakfast\)/);
      expect(src).toMatch(/--color-slot-lunch:\s*var\(--slot-lunch\)/);
      expect(src).toMatch(/--color-slot-dinner:\s*var\(--slot-dinner\)/);
      expect(src).toMatch(/--color-slot-snack:\s*var\(--slot-snack\)/);
      expect(src).toMatch(
        /--color-slot-snack-soft:\s*var\(--slot-snack-soft\)/,
      );
    });
  });

  describe("web — IconBox slot tones", () => {
    it("IconBox exposes the four slot-* tones", () => {
      const src = read("src/app/components/ui/icon-box.tsx");
      expect(src).toMatch(
        /"slot-breakfast":\s*"bg-slot-breakfast-soft text-slot-breakfast"/,
      );
      expect(src).toMatch(
        /"slot-lunch":\s*"bg-slot-lunch-soft text-slot-lunch"/,
      );
      expect(src).toMatch(
        /"slot-dinner":\s*"bg-slot-dinner-soft text-slot-dinner"/,
      );
      expect(src).toMatch(
        /"slot-snack":\s*"bg-slot-snack-soft text-slot-snack"/,
      );
    });
  });

  describe("web — today-meals-section Snacks tint routes through slot-snack", () => {
    it("Snacks slot uses tone: slot-snack (NOT tone: fat)", () => {
      const src = read("src/app/components/suppr/today-meals-section.tsx");
      // Strip block comments so the prose history doesn't trip the grep.
      const code = src.replace(/\/\*[\s\S]*?\*\//g, "");
      expect(code).toMatch(
        /name === "Snacks"[\s\S]{0,120}tone:\s*"slot-snack"/,
      );
      expect(code).not.toMatch(/name === "Snacks"[\s\S]{0,120}tone:\s*"fat"/);
    });
  });
});
