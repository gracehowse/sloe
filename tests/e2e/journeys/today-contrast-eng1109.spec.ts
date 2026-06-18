import { expect, test } from "@playwright/test";
import { hasE2ECredentials } from "../utils/auth";

const AA_NORMAL = 4.5;

function parseRgb(color: string): [number, number, number] {
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) throw new Error(`Unparseable color: ${color}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(fg: string, bg: string): number {
  const lf = relativeLuminance(parseRgb(fg));
  const lb = relativeLuminance(parseRgb(bg));
  const [hi, lo] = lf >= lb ? [lf, lb] : [lb, lf];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * ENG-1109 — Playwright getComputedStyle sweep on Today macro chips + slot pills.
 * Complements the static census in tests/unit/eng1109MacroContrastCensus.test.ts.
 */
test.describe("Today WCAG contrast (ENG-1109)", () => {
  test.beforeEach(() => {
    test.skip(!hasE2ECredentials(), "Set E2E_EMAIL and E2E_PASSWORD to run this journey.");
  });

  test("macro chip labels and slot pills meet AA on rendered Today", async ({ page }) => {
    await page.goto("/today");

    const acceptBtn = page.getByRole("button", { name: /accept all/i });
    if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await acceptBtn.click();
    }

    await expect(page.getByTestId("today-meals-section")).toBeVisible({
      timeout: 20_000,
    });

    const cardBg = await page.evaluate(() => {
      const el = document.querySelector("[data-testid='today-meals-section']");
      if (!el) return null;
      return getComputedStyle(el).backgroundColor;
    });
    expect(cardBg).toBeTruthy();

    const macroLabels = page.locator("[data-testid='today-macro-chip-label']");
    const macroCount = await macroLabels.count();
    if (macroCount > 0) {
      for (let i = 0; i < macroCount; i++) {
        const label = macroLabels.nth(i);
        const styles = await label.evaluate((el) => {
          const cs = getComputedStyle(el);
          return { color: cs.color, bg: cs.backgroundColor, fontSize: cs.fontSize };
        });
        const px = parseFloat(styles.fontSize);
        if (px >= 11 && styles.color && cardBg) {
          expect(contrastRatio(styles.color, styles.bg || cardBg!)).toBeGreaterThanOrEqual(
            AA_NORMAL,
          );
        }
      }
    }

    const slotPills = page.locator("[data-testid^='today-slot-aim-']");
    const pillCount = await slotPills.count();
    expect(pillCount).toBeGreaterThan(0);
    for (let i = 0; i < pillCount; i++) {
      const pill = slotPills.nth(i);
      const styles = await pill.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { color: cs.color, bg: cs.backgroundColor };
      });
      if (styles.color && (styles.bg || cardBg)) {
        expect(contrastRatio(styles.color, styles.bg || cardBg!)).toBeGreaterThanOrEqual(
          AA_NORMAL,
        );
      }
    }
  });
});
