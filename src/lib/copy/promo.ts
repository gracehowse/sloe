/**
 * Promo-code surface copy — ENG-1457 (partial: placeholder only).
 *
 * The example code shown in promo-input placeholders. One constant so
 * the surfaces can't drift: the pricing page still said
 * "e.g. SUPPR_PRO" a month after the Settings card was reworded to
 * SLOE_PRO — exactly the class of brand drift the Sloe rename sweep
 * pinned (see `tests/unit/brandDriftSloe.test.ts` D3, which now checks
 * both consumers reference this module).
 *
 * Consumers: `src/app/components/Settings.tsx` (web Settings promo
 * card), `app/pricing/PromoCodeBlock.tsx` (pricing page, the surface
 * mobile-web visitors see). Mobile-native inputs use the distinct
 * "Enter code" placeholder by design (collapsed expander pattern —
 * paywall + settings bundle).
 */

/** Example promo code shown to users. Brand-correct: Sloe, not Suppr. */
export const PROMO_CODE_EXAMPLE = "SLOE_PRO";

/** Input placeholder built from the example code. */
export const PROMO_CODE_PLACEHOLDER = `e.g. ${PROMO_CODE_EXAMPLE}`;
