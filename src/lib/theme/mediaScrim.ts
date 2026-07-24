/**
 * On-photo legibility scrim — shared between web and mobile.
 *
 * The veil that sits between a recipe photograph and the title overlaid on
 * it. Distinct from `MODAL_OVERLAY_SCRIM` (ENG-1013), which is a flat sheet
 * backdrop over the whole app; this one is a *gradient* over media and must
 * therefore expose its stop colour and stop opacities separately.
 *
 * Two rules this token exists to hold:
 *
 * 1. **Pure black, never a tinted "near-black".** A hue-bearing veil shifts
 *    the food's colour; pure black only removes luminance.
 * 2. **Always feathered, never a flat band.** A hard-edged scrim (e.g. an
 *    absolutely-positioned `height: "55%"` rect) puts a razor line across
 *    the photo: bright above, crushed below, which reads as the card
 *    printing its picture twice at two different crops. Consume
 *    `MEDIA_SCRIM_STOPS` end-to-end so the veil always fades out.
 *
 * The stop ladder mirrors the web Tailwind spelling this was derived from —
 * `bg-gradient-to-t from-black/70 via-black/20 to-transparent`.
 */
export const MEDIA_SCRIM_COLOR = "#000000" as const;

/** Bottom → top: opaque end first, transparent end last. */
export const MEDIA_SCRIM_STOPS = [
  { offset: "0", opacity: 0.7 },
  { offset: "0.5", opacity: 0.2 },
  { offset: "1", opacity: 0 },
] as const;
