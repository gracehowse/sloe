import { expect, test } from "@playwright/test";
import { hasE2ECredentials } from "../utils/auth";

/**
 * Cook mode — step body text must stay HIGH-CONTRAST against the cook shell.
 *
 * The invariant flipped with the Sloe v3 cook shell (ENG-1247,
 * `recipe_detail_v3_conformance`, default-on): cook mode is now an immersive
 * DARK aubergine shell (`bg-[var(--primary-deep)]`, `cook-mode-v3`) with
 * near-white step text (`text-[#efe9f2]`), where the LEGACY shell was a cream
 * `bg-background` with `text-foreground` dark text. So the old guard ("step
 * text must not be pure white") is the wrong invariant for the dark shell —
 * near-white-on-dark is correct and high-contrast there.
 *
 * This guard is theme-agnostic: it measures the ACTUAL WCAG contrast ratio
 * between the rendered step-text colour and the cook shell's background, and
 * requires it to clear AA for large text. That catches the real failure mode
 * the test exists for (low-contrast / washed-out cook instructions) on either
 * shell, instead of pinning a single colour or class name.
 */
test.describe("Cook mode", () => {
  test.beforeEach(() => {
    test.skip(!hasE2ECredentials(), "Set E2E_EMAIL and E2E_PASSWORD to run cook mode journey.");
  });

  test("when I open cook mode from a recipe, step instructions are high-contrast on the shell", async ({
    page,
  }) => {
    await page.goto("/discover", { waitUntil: "domcontentloaded" });

    const acceptBtn = page.getByRole("button", { name: /accept all/i });
    if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await acceptBtn.click();
    }
    await page.getByPlaceholder(/search recipes/i).waitFor({ state: "visible", timeout: 25_000 });

    const recipeCard = page
      .getByRole("button", { name: /Classic Greek Salad|greek salad/i })
      .or(page.getByRole("link", { name: /greek salad|recipe/i }))
      .first();
    await recipeCard.click({ timeout: 15_000 });

    // Sloe redesign renamed the cook-mode launch button "Cook" → "Start Cooking".
    await page.getByRole("button", { name: /start cooking/i }).first().click({ timeout: 20_000 });

    // Cook mode opens to the mise-en-place ingredient checklist first
    // (cook_ingredient_checklist_v1, default-on, when the recipe has
    // ingredients). Advance past it via its "Start cooking" CTA to reach the
    // step instructions.
    const miseContinue = page.getByTestId("cook-mise-continue");
    if (await miseContinue.isVisible({ timeout: 5000 }).catch(() => false)) {
      await miseContinue.click();
    }

    // The cook shell — v3 immersive dark (`cook-mode-v3`) or the legacy cream
    // shell (`cook-mode`). Whichever rendered owns the background the step text
    // sits on.
    const shell = page.getByTestId("cook-mode-v3").or(page.getByTestId("cook-mode"));
    await expect(shell.first()).toBeVisible({ timeout: 15_000 });

    // Step body paragraph — v3 uses the near-white `text-[#efe9f2]` serif;
    // legacy uses `text-foreground`. Match either so the guard runs on both
    // shells.
    const stepText = page
      .locator(".leading-snug.text-\\[\\#efe9f2\\], .leading-relaxed.text-foreground")
      .first();
    await expect(stepText).toBeVisible({ timeout: 15_000 });

    // Measure the real WCAG contrast ratio between the step text and the
    // shell background. This is the load-bearing assertion: it fails if cook
    // instructions are ever washed out (e.g. white-on-cream, or a too-light
    // step colour on the dark shell), independent of theme or class names.
    const ratio = await stepText.evaluate((el, shellEl) => {
      const parseColor = (c: string): [number, number, number] => {
        // getComputedStyle always normalises to rgb(...) / rgba(...).
        const m = c.match(/rgba?\(([^)]+)\)/);
        const parts = (m ? m[1] : "0,0,0").split(",").map((p) => parseFloat(p.trim()));
        return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
      };
      const relLum = ([r, g, b]: [number, number, number]) => {
        const lin = (v: number) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      };
      const textColor = parseColor(window.getComputedStyle(el).color);
      // Walk up from the shell to find the first non-transparent background
      // (the shell root paints the colour; intermediate wrappers are
      // transparent). Fall back to the shell's own computed background.
      let bgColor: [number, number, number] = parseColor(
        window.getComputedStyle(shellEl as Element).backgroundColor,
      );
      let node: Element | null = shellEl as Element;
      while (node) {
        const bg = window.getComputedStyle(node).backgroundColor;
        if (bg && !bg.includes("rgba(0, 0, 0, 0)") && bg !== "transparent") {
          bgColor = parseColor(bg);
          break;
        }
        node = node.parentElement;
      }
      const l1 = relLum(textColor);
      const l2 = relLum(bgColor);
      const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
      return (hi + 0.05) / (lo + 0.05);
    }, await shell.first().elementHandle());

    // AA for large text (≥18pt / ≥14pt bold) is 3:1; the cook step body is a
    // big serif headline, so 3:1 is the correct floor. Near-white #efe9f2 on
    // the deep-aubergine shell clears this comfortably (~13:1).
    expect(ratio).toBeGreaterThanOrEqual(3);
  });
});
