/**
 * Web onboarding tour — drives through every onboarding step and
 * captures a screenshot per step. Creates a real Supabase account on
 * the signup step (step 02) using a unique email; account is left
 * unconfirmed (Supabase email confirmation default) which is fine for
 * the visual capture purpose of this audit.
 *
 * Output: `apps/mobile/screenshots/latest/web-onb-{step}-{viewport}.png`
 *
 * Skipped by default — opt-in via `CAPTURE_TOUR=1` because the spec
 * exercises a real signup flow that's flaky against CI's freshly-
 * built Next runtime. Local capture run:
 *
 *   CAPTURE_TOUR=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 \
 *     npx playwright test tests/e2e/screenshots/web-onboarding-tour.spec.ts
 */
import { devices, expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

// Capture-only spec — opt in with CAPTURE_TOUR=1 (see file header).
test.skip(!process.env.CAPTURE_TOUR, "capture-only; set CAPTURE_TOUR=1");

const OUTPUT_DIR = join(process.cwd(), "apps/mobile/screenshots/latest");
mkdirSync(OUTPUT_DIR, { recursive: true });

const VIEWPORTS = [
  { tag: "desktop", width: 1440, height: 900 },
  {
    tag: "mobile",
    ...devices["iPhone 13"].viewport,
    deviceScaleFactor: 2,
  },
];

function makeUniqueEmail(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `e2e-sweep-${ts}-${Math.floor(Math.random() * 1e6)}@suppr-test.example`;
}

async function shoot(page: import("@playwright/test").Page, name: string, vp: string) {
  await page.waitForTimeout(450);
  await page.screenshot({
    path: join(OUTPUT_DIR, `web-${vp}-onb-${name}.png`),
    fullPage: false,
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`web onboarding tour — ${vp.tag}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`captures every onboarding step (${vp.tag})`, async ({ page }) => {
      // Start at /onboarding which lands on Welcome (step 01).
      await page.goto("/onboarding", { waitUntil: "networkidle", timeout: 30_000 });
      await shoot(page, "01-welcome", vp.tag);

      // Welcome → continue.
      const continueBtn = page.getByRole("button", { name: /continue|get started|let'?s go/i }).first();
      await continueBtn.click().catch(() => undefined);
      await page.waitForTimeout(600);

      // Step 02 — Signup.
      await shoot(page, "02-signup-empty", vp.tag);

      const email = makeUniqueEmail();
      const password = "TestPass-2026-05-05!";
      await page.getByPlaceholder(/email|you@/i).first().fill(email).catch(() => undefined);
      await page.getByPlaceholder(/password|min/i).first().fill(password).catch(() => undefined);
      const termsCheckbox = page.getByRole("checkbox").first();
      if (await termsCheckbox.isVisible({ timeout: 1500 }).catch(() => false)) {
        await termsCheckbox.check().catch(() => undefined);
      }
      await shoot(page, "02-signup-filled", vp.tag);

      const submitSignup = page
        .getByRole("button", { name: /create account|sign up|continue/i })
        .first();
      await submitSignup.click().catch(() => undefined);
      await page.waitForTimeout(2500);
      await shoot(page, "02-signup-after-submit", vp.tag);

      // Step 03+ — best-effort drive through. If signup blocked on
      // email confirmation, capture remains on the gate; otherwise we
      // capture each subsequent step.
      const remainingSteps = [
        { name: "03-goal", click: /lose weight|maintain|build muscle|gain/i },
        { name: "04-sex", click: /female|male|other/i },
        { name: "05-age", input: "28" },
        { name: "06-height", input: "165" },
        { name: "07-weight", input: "70" },
        { name: "08-activity", click: /moderately active|sedentary|active/i },
        { name: "09-pace", click: /steady|moderate|fast|recommended/i },
        { name: "10-diet", click: /no preference|continue|skip/i },
        { name: "11-strategy", click: /balanced|continue|recommended/i },
        { name: "12-reveal", click: /continue|let'?s go|next/i },
        { name: "13-data-bridges", click: /continue|skip|finish|done/i },
      ];

      for (const step of remainingSteps) {
        await page.waitForTimeout(700);
        await shoot(page, `${step.name}-arrive`, vp.tag);

        if ("input" in step && step.input) {
          const input = page.locator("input[type='number'], input[type='tel'], input[type='text']").first();
          await input.fill(step.input).catch(() => undefined);
          await shoot(page, `${step.name}-filled`, vp.tag);
        }

        if ("click" in step && step.click) {
          const target = page
            .getByRole("button", { name: step.click })
            .first();
          await target.click({ timeout: 2500 }).catch(() => undefined);
        }

        // Try a generic Continue button afterwards if visible.
        const cont = page
          .getByRole("button", { name: /^continue$|^next$/i })
          .first();
        if (await cont.isVisible({ timeout: 800 }).catch(() => false)) {
          await cont.click().catch(() => undefined);
        }
      }

      // Final landing — most likely /home or a still-mid-onboarding state.
      await page.waitForTimeout(1500);
      await shoot(page, "99-final", vp.tag);

      expect(true).toBeTruthy(); // Always pass — this spec is for capture, not assertion.
    });
  });
}
