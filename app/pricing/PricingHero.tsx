import { Sparkles } from "lucide-react";

/**
 * Gradient hero panel for `/pricing`.
 *
 * D13 (design-system sweep 2026-04-21) — mirrors the prototype paywall
 * hero in `docs/ux/claude-design-bundles/prototype/project/flows.jsx:555-564`:
 * brand gradient background, "SUPPR" pill with a Sparkles glyph, then the
 * "The full meal planning loop" title + a one-line value prop.
 *
 * Kept as its own server component so `/pricing/page.tsx` stays readable
 * and the gradient + copy can be shared if the paywall route ever needs
 * a sibling surface. No client interactivity — rendered directly in the
 * RSC tree.
 *
 * The gradient hex pair (`#4c6ce0` → `#e04888`) matches the wordmark in
 * the header and the prototype's paywall banner one-to-one. Do not
 * replace with a token — this is the fixed brand gradient.
 */
export function PricingHero() {
  return (
    <div
      // V15 (2026-05-11 visual sweep): mobile hero took ~50% of the
      // viewport before any pricing was visible. Reduced vertical
      // padding on small screens (py-8 → py-14 desktop) so the
      // billing toggle is reachable in one viewport-height on a
      // standard iPhone.
      className="relative rounded-3xl px-8 py-8 sm:py-14 mb-12 text-white overflow-hidden"
      style={{
        backgroundImage:
          "linear-gradient(135deg, #4c6ce0 0%, #e04888 100%)",
      }}
    >
      <div className="max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-[11px] font-semibold tracking-[0.05em] mb-4">
          <Sparkles className="w-3 h-3" aria-hidden="true" />
          SUPPR
        </div>
        <h1 className="text-4xl font-bold tracking-tight leading-tight mb-3">
          The full meal planning loop
        </h1>
        <p className="text-base opacity-85 leading-relaxed">
          Plans that hit your macros, one-tap shopping lists, cook mode
          with timers. Pick the plan that fits your goals.
        </p>
        {/* V13 (2026-05-11 visual sweep): the old subtitle was all-caps
            "WEB WORKS EVERYWHERE · MOBILE APP IS IPHONE ONLY (TESTFLIGHT)"
            which read as internal-team copy on a marketing surface.
            Same disclosure (per customer-lens P1 #30 / project memory
            `project_ios_only_no_android.md`), but written in sentence
            case so it reads as customer-facing context rather than a
            console log. */}
        <p className="mt-3 text-xs opacity-80 leading-relaxed">
          Web works on every device. Mobile app is iPhone-only via TestFlight today.
        </p>
      </div>
    </div>
  );
}
