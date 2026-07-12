import Image from "next/image";

import { CARD_CREAM } from "../../src/lib/recipe/recipeHeroFallback.ts";

/**
 * Photo hero panel for `/pricing` — Sloe Pro paywall (Figma `284:2`).
 *
 * 2026-06-08 (Figma `284:2` rebuild): replaced the old brand-gradient
 * banner (`#588CE4 → #DF5EBC`, flagged as palette drift in
 * `docs/ux/redesign/paywall.md` §3c) with the frame's full-bleed
 * finished-dish food photograph + soft fade into the page, the
 * "SLOE PRO" clay eyebrow, and the editorial positioning headline
 * "Cook what you love. / *Still* reach your goals." (Newsreader serif,
 * "Still" italic). This is the emotional, desire-first opener the
 * Julienne benchmark uses — food before a single word of feature copy.
 *
 * Kept as its own server component so `/pricing/page.tsx` stays
 * readable. No client interactivity — rendered directly in the RSC
 * tree. The headline / eyebrow are the same strings the mobile paywall
 * hero renders (`apps/mobile/app/paywall.tsx`) so the two surfaces
 * read identically.
 *
 * The hero photo (`/paywall/paywall-hero.jpg`) is a licensed editorial
 * finished-dish image per the IMAGERY RULE — ceramic-bowl, natural
 * light, shallow DoF — not a generic gradient. It is decorative
 * (`alt=""`) — the headline carries the meaning for screen readers.
 */
export function PricingHero() {
  return (
    <div className="relative mb-10 -mx-6 sm:mx-0 sm:rounded-card-lg overflow-hidden">
      {/* Full-bleed food photograph — the frame's hero image. Fades
          softly into the page background at the bottom so the eyebrow +
          headline read as overlaid on the fade, matching `284:2`. */}
      <div
        className="relative h-[200px] sm:h-[320px] w-full"
        // ENG-1374 PR 2 — opaque underlay on the wrapper itself so a failed
        // or slow hero-photo load can never expose page white. CARD_CREAM
        // (§11.4), not a cuisine tint: the bundled paywall photo has no
        // recipe identity to key a tint from.
        style={{ backgroundColor: CARD_CREAM }}
      >
        <Image
          src="/paywall/paywall-hero.jpg"
          alt=""
          fill
          priority
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover"
        />
        {/* Soft fade to the page background. The bottom third dissolves
            into `--background` so the headline sits on the fade, not on
            the photo — the calm Sloe treatment, not a hard scrim. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0) 30%, var(--background) 100%)",
          }}
        />
      </div>

      {/* Eyebrow + headline — overlaid on the fade, bottom-anchored.
          Left-aligned per the frame. */}
      <div className="absolute inset-x-0 bottom-0 px-6 sm:px-8 pb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--accent-primary-solid)] mb-2">
          Sloe Pro
        </p>
        <h1 className="text-3xl sm:text-4xl font-medium font-[family-name:var(--font-newsreader)] tracking-tight leading-[1.1] text-foreground-brand">
          Cook what you love.
          <br />
          <em className="italic font-normal">Still</em> reach your goals.
        </h1>
      </div>
    </div>
  );
}
