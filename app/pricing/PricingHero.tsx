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
      className="relative rounded-3xl px-8 py-14 mb-12 text-white overflow-hidden"
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
      </div>
    </div>
  );
}
