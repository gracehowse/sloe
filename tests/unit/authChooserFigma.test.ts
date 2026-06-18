/**
 * Auth / sign-in chooser — Figma frame `296:2` conformance (2026-06-08).
 *
 * Pins the user-observable contract of the Sloe auth chooser so a future
 * edit can't silently drift it back to the old inline-form screen:
 *   - opens on a CHOOSER (progressive disclosure) — `view` defaults to
 *     "chooser", so no email/password fields render on first paint;
 *   - "Sloe" serif wordmark + the two-line positioning headline with an
 *     ITALIC "Still" (the brand line — keep exact);
 *   - the sync subtitle;
 *   - Continue with Apple (near-black `--foreground` fill) + Continue with
 *     email (outline) buttons;
 *   - Google is OMITTED (ENG-924 — Apple + email only);
 *   - Terms + Privacy fine-print links;
 *   - every auth handler is preserved (Apple OAuth, email sign-in/up,
 *     magic link, password reset) — restyle only, no flow change.
 *
 * Mirror of the mobile guard in `apps/mobile/tests/unit/loginChooserFigma.test.ts`.
 * Source-assertion style matches the sibling `authRoutesPremium.test.ts`.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const SRC = fs.readFileSync(path.join(ROOT, "app/login/ui.tsx"), "utf-8");

describe("auth chooser — Figma 296:2 (web)", () => {
  it("opens on the chooser view by default (no inline form first)", () => {
    // `view` state exists and defaults to "chooser".
    expect(SRC).toMatch(/useState<"chooser" \| "email">\("chooser"\)/);
    // The email/password inputs live inside the email branch only — the
    // first thing the user sees is the chooser.
    expect(SRC).toMatch(/view === "chooser" \?/);
  });

  it('renders the "Sloe" serif wordmark', () => {
    expect(SRC).toMatch(/aria-label="Sloe"/);
    expect(SRC).toMatch(/font-\[family-name:var\(--font-newsreader\)\]/);
    // The visible wordmark glyph is the capitalised "Sloe".
    expect(SRC).toMatch(/>\s*Sloe\s*</);
  });

  it("renders the two-line positioning headline with an italic Still", () => {
    expect(SRC).toMatch(/Cook what you love\./);
    expect(SRC).toMatch(/<span className="italic">Still<\/span> reach your goals\./);
  });

  it("renders the sync subtitle", () => {
    expect(SRC).toMatch(
      /Create an account or log in — your recipes and plan sync everywhere\./,
    );
  });

  it("renders Continue with Apple (near-black fill) and Continue with email (outline)", () => {
    expect(SRC).toMatch(/aria-label="Continue with Apple"/);
    expect(SRC).toMatch(/aria-label="Continue with email"/);
    // Apple button fills with the near-black ink token; email is the
    // outline (background + border) treatment.
    expect(SRC).toMatch(/background: "var\(--foreground\)"[\s\S]*?Continue with Apple/);
  });

  it("OMITS the Google button (ENG-924 — Apple + email only)", () => {
    expect(SRC).not.toMatch(/Continue with Google/i);
    expect(SRC).not.toMatch(/signInWithOAuth\(\{\s*provider:\s*"google"/);
    // The divergence is documented against the frame.
    expect(SRC).toMatch(/ENG-924/);
  });

  it("renders the Terms + Privacy fine print as links", () => {
    expect(SRC).toMatch(/By continuing you agree to our/);
    expect(SRC).toMatch(/href="\/terms"/);
    expect(SRC).toMatch(/href="\/privacy"/);
  });

  it("preserves every auth handler (restyle only — auth stop-zone)", () => {
    expect(SRC).toMatch(/supabase\.auth\.signInWithOAuth/);
    expect(SRC).toMatch(/supabase\.auth\.signInWithPassword/);
    expect(SRC).toMatch(/supabase\.auth\.signUp/);
    expect(SRC).toMatch(/supabase\.auth\.signInWithOtp/);
    expect(SRC).toMatch(/supabase\.auth\.resetPasswordForEmail/);
    // Post-auth routing unchanged.
    expect(SRC).toMatch(/initialMode === "signup" \? "\/onboarding" : "\/home"/);
  });

  it("has a close affordance and a back affordance (chooser <-> email)", () => {
    expect(SRC).toMatch(/aria-label="Close"/);
    // Back returns from the email step to the chooser.
    expect(SRC).toMatch(/setView\("chooser"\)/);
    expect(SRC).toMatch(/setView\("email"\)/);
  });

  it("ENG-897 — email step shows serif heading + signup tagline (296:33)", () => {
    expect(SRC).toMatch(/Create your account/);
    expect(SRC).toMatch(/Welcome back/);
    expect(SRC).toMatch(/Cook what you love\. Still reach your goals\./);
    expect(SRC).toMatch(/Sign in to continue\./);
    expect(SRC).toMatch(/Create Account/);
  });
});
