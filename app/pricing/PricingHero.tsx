/**
 * Gradient hero panel for `/pricing`.
 *
 * D13 (design-system sweep 2026-04-21) — brand gradient background,
 * "The full meal planning loop" title, value prop, and TestFlight
 * disclosure line.
 *
 * 2026-05-14 (premium-sweep-v2 P0 rows 3.1 + 3.3 + 4.1): removed the
 * "SUPPR" pill from the hero (duplicates the top-bar wordmark 60px
 * above) and compressed vertical padding further so the Monthly/Annual
 * toggle reaches the first 900px viewport without scroll on desktop
 * and the £7.99 Pro price renders in the first mobile viewport.
 *
 * Kept as its own server component so `/pricing/page.tsx` stays readable
 * and the gradient + copy can be shared if the paywall route ever needs
 * a sibling surface. No client interactivity — rendered directly in the
 * RSC tree.
 *
 * The gradient hex pair (`#588CE4` → `#DF5EBC`) matches the wordmark in
 * the header and the prototype's paywall banner one-to-one. Do not
 * replace with a token — this is the fixed brand gradient.
 */
export function PricingHero() {
  return (
    <div
      // 2026-05-14 (premium-sweep-v2 rows 3.1 + 4.1): py-8 sm:py-14
      // → py-6 sm:py-10. Compresses the hero ~30% so the toggle is
      // reachable in 900px desktop viewport and the Pro price reads
      // in the first mobile viewport. Prior V15 reduction was a step
      // in this direction; this finishes the job.
      className="relative rounded-3xl px-8 py-6 sm:py-10 mb-12 text-white overflow-hidden"
      style={{
        backgroundImage:
          "linear-gradient(135deg, #588CE4 0%, #DF5EBC 100%)",
      }}
    >
      <div className="max-w-2xl mx-auto text-center">
        {/* 2026-05-14 (premium-sweep-v2 row 3.3): "SUPPR" Sparkles pill
            removed — duplicated the top-bar Suppr wordmark 60px above,
            which made the brand-mark appear twice in the same viewport
            with no functional reason for the second instance. */}
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
