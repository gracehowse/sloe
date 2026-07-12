/**
 * Mobile login chooser — Figma frame `296:2` conformance (2026-06-08).
 *
 * Mirror of the web guard in `tests/unit/authChooserFigma.test.ts`. Pins the
 * user-observable contract so a future edit can't drift the mobile login
 * back to the old inline-form-first screen:
 *   - opens on a CHOOSER (progressive disclosure) — `view` defaults to
 *     "chooser", so no email/password inputs render first;
 *   - the "Sloe" wordmark + the two-line positioning headline with an
 *     ITALIC "Still" (the brand line — keep exact);
 *   - the sync subtitle;
 *   - Continue with Apple (ink fill) + Continue with email (outline);
 *   - Google is OMITTED (ENG-924);
 *   - Terms + Privacy fine-print;
 *   - every auth handler + testID is preserved (Apple ID-token sign-in,
 *     email sign-in/up, magic link, password reset, the signed-in →
 *     /(tabs) redirect) — restyle only, auth stop-zone respected.
 *
 * Source-assertion style matches the sibling `loginAuthRedirect.test.ts`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(
  join(__dirname, "..", "..", "app", "login.tsx"),
  "utf8",
);
// ENG-1474: presentation styles were extracted to `components/login/loginStyles.tsx`
// (screen-budget shrink). Style-definition assertions read from there; JSX
// wiring + handler/testID assertions still read `login.tsx` above.
const STYLES_SRC = readFileSync(
  join(__dirname, "..", "..", "components", "login", "loginStyles.tsx"),
  "utf8",
);

describe("mobile login chooser — Figma 296:2", () => {
  it("opens on the chooser view by default (no inline form first)", () => {
    expect(SRC).toMatch(/useState<"chooser" \| "email">\("chooser"\)/);
    expect(SRC).toMatch(/view === "chooser" \?/);
  });

  it('renders the "Sloe" wordmark and the italic-Still positioning headline', () => {
    expect(SRC).toMatch(/SloeHeaderWordmark/);
    expect(SRC).toMatch(/Cook what you love\./);
    // Italic "Still" via the serif-italic style on a nested Text run. The JSX
    // wiring stays in login.tsx; the style definition lives in loginStyles.tsx.
    expect(SRC).toMatch(/headlineItalic/);
    expect(STYLES_SRC).toMatch(/headlineItalic/);
    expect(STYLES_SRC).toMatch(/serifItalic/);
    expect(SRC).toMatch(/<Text style={styles\.headlineItalic}>Still<\/Text> reach your goals\./);
  });

  it("renders the sync subtitle", () => {
    expect(SRC).toMatch(
      /Create an account or log in — your recipes and plan sync everywhere\./,
    );
  });

  it("renders Continue with Apple and Continue with email", () => {
    expect(SRC).toMatch(/Continue with Apple/);
    expect(SRC).toMatch(/Continue with email/);
    expect(SRC).toMatch(/testID="login-continue-email"/);
  });

  it("OMITS Google (ENG-924 — Apple + email only)", () => {
    expect(SRC).not.toMatch(/Continue with Google/i);
    expect(SRC).not.toMatch(/provider:\s*"google"/);
    expect(SRC).toMatch(/ENG-924/);
  });

  it("renders the Terms + Privacy fine print", () => {
    expect(SRC).toMatch(/By continuing you agree to our/);
    expect(SRC).toMatch(/legalUrl\("\/terms"\)/);
    expect(SRC).toMatch(/legalUrl\("\/privacy"\)/);
  });

  it("preserves every auth handler + testID (restyle only — auth stop-zone)", () => {
    expect(SRC).toMatch(/supabase\.auth\.signInWithIdToken/);
    expect(SRC).toMatch(/supabase\.auth\.signInWithPassword/);
    expect(SRC).toMatch(/supabase\.auth\.signUp/);
    expect(SRC).toMatch(/supabase\.auth\.signInWithOtp/);
    expect(SRC).toMatch(/supabase\.auth\.resetPasswordForEmail/);
    // Preserved testIDs the Maestro / unit layers depend on.
    expect(SRC).toMatch(/testID="login-email"/);
    expect(SRC).toMatch(/testID="login-password"/);
    expect(SRC).toMatch(/testID="login-submit"/);
    // Signed-in redirect unchanged.
    expect(SRC).toMatch(/session\?\.user\?\.id/);
    expect(SRC).toMatch(/Redirect\s+href=["']\/\(tabs\)["']/);
  });

  it("has a close affordance and a back affordance (chooser <-> email)", () => {
    expect(SRC).toMatch(/testID="login-close"/);
    expect(SRC).toMatch(/testID="login-back"/);
    expect(SRC).toMatch(/setView\("chooser"\)/);
    expect(SRC).toMatch(/setView\("email"\)/);
    // ENG-1514: the ✕ only renders when login was PUSHED onto a stack — a
    // root session-less launch has no destination, so no stray close; and
    // it pops back in-app rather than opening Safari.
    expect(SRC).toMatch(/router\.canGoBack\(\) &&/);
    expect(SRC).toMatch(/onPress={\(\) => router\.back\(\)}/);
    expect(SRC).not.toMatch(/login-close[\s\S]{0,300}Linking\.openURL/);
  });
});
