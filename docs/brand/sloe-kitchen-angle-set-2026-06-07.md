# Sloe — Two-Tone Kitchen Multi-Angle Set (2026-06-07)

> **What this is:** an 8-frame multi-angle set of the **Sloe test kitchen two-tone variant** — the
> cream Shaker perimeter + dark stained-oak island sanctioned by Grace 2026-06-07. Every frame is
> conditioned on the same reference image and uses the same seed range for reproducibility. This is
> the **Tier-1 marketing** kitchen asset set — the recognisable room that appears across social,
> landing, and App Store surfaces.
>
> **Status:** generated, pixel-reviewed, all 8 pass the spec checklist. Pending Grace sign-off.
>
> **Engine:** Nano Banana Pro (`fal-ai/nano-banana-pro/edit`), 2K resolution, image-to-image
> conditioned on the all-cream reference (`sloe-test-kitchen-reference.png`). Seeds `70100`–`70107`.

---

## 1. The set

All files live in [`screenshots/kitchen-set/`](../../screenshots/kitchen-set/). PNG, 2K resolution.

| # | File | Angle | Aspect | Seed | Suggested use |
|---|---|---|---|---|---|
| 01 | `01-establishing-two-tone-16x9.png` | **Establishing wide** — the hero. Full room: dark oak island foreground, cream Shaker perimeter behind, plaster arch over the range, copper on brass rails, side-window daylight. | 16:9 | 70100 | Landing hero, marketing banner, App Store lifestyle. The lead image. |
| 02 | `02-range-wall-arch-4x5.png` | **Range wall** — straight-on at the plaster arch. Lacanche-style black range centred, copper pots on brass rails flanking, plaster hood, cream cabinets, marble backsplash. Dark oak island edge in foreground. | 4:5 | 70101 | Social portrait (IG/TikTok feed), "the kitchen" post. |
| 03 | `03-island-sink-detail-4x5.png` | **Island sink** — close on the dark oak island. White apron-front farmhouse sink, aged brass bridge faucet + side-spray, cup-pull hardware, herbs in glass jar. Cream perimeter soft behind. | 4:5 | 70102 | Social portrait, product/brand detail shot. |
| 04 | `04-dining-sightline-16x9.png` | **Dining sightline** — from the dining table through to the kitchen. Worn table + linen runner foreground, ceramic vase of dried hydrangea, matte-black linear chandelier overhead. Dark island + arch in the mid-ground. | 16:9 | 70103 | Landing/marketing banner with text overlay. Shows the dining-to-kitchen flow + the black accent. |
| 05 | `05-window-herbs-detail-1x1.png` | **Window herbs** — intimate detail. Glass jar of basil + rosemary catching daylight on marble, speckled ceramic bowl of lemons, folded linen. Cream Shaker cabinets + brass knobs behind. | 1:1 | 70104 | IG grid square, "the Julienne shot", social detail post. |
| 06 | `06-copper-brass-detail-4x5.png` | **Copper/brass** — close detail of copper pots on brass wall-rail beside the range. Pot-filler visible. Plaster arch + hood behind. Burnished warm copper catching side-light. | 4:5 | 70105 | Social portrait, texture/detail carousel or story. |
| 07 | `07-overhead-island-1x1.png` | **Overhead island** — bird's-eye down at the white quartz top. Round wooden board with basil + thyme, lemons in ceramic bowl, olive oil, folded linen, copper measuring cup. Dark oak sides frame the white surface. Brass faucet + apron sink at one end. | 1:1 | 70106 | IG grid square, the most editorial/styled frame. |
| 08 | `08-reverse-angle-window-16x9.png` | **Reverse wide** — from range wall toward the island + windows. Rush/woven counter stools at the far side, worn dough bowl on island, white linen roman shades diffusing daylight. Plaster arch + copper visible on left. | 16:9 | 70107 | Landing banner (negative space for text), "the full room" alternative angle. |

**Aspect coverage:** 16:9 x3 (01, 04, 08) | 4:5 x3 (02, 03, 06) | 1:1 x2 (05, 07).

---

## 2. Spec checklist — all 8 pass

Every frame verified against the brand spec:

- [x] **Two-tone:** dark stained-oak island + cream Shaker perimeter — consistent across all 8
- [x] **White quartz countertop** on island, honed marble on perimeter
- [x] **Unlacquered/aged warm brass** hardware — soft patina, never bright chrome or polished gold
- [x] **White apron-front fireclay farmhouse sink** (visible in 01, 03, 04, 07, 08)
- [x] **Aged brass bridge faucet** with side-spray (visible in 01, 03, 07, 08)
- [x] **Plaster arched range niche + plaster hood** (visible in 01, 02, 04, 06, 08)
- [x] **Copper pots on brass wall-rail** (visible in 01, 02, 04, 06, 08)
- [x] **Brass pot-filler** (visible in 02, 06)
- [x] **Pale white-oak floor** — consistent warm tone
- [x] **Bright, airy, Modern Clean light** — side-window daylight, well-exposed, gentle shadows
- [x] **No people / hands / faces** — empty, considered scenes
- [x] **No text / logos / watermarks**
- [x] **Matte-black accent** — linear chandelier in 04 only (restrained, one accent)
- [x] **Props restrained** — herbs in glass, copper, linen, ceramic, lemons, olive oil, dough bowl
- [x] **Rush/woven counter stools** with linen cushions (08 only)

---

## 3. Reference + conditioning

- **Source reference:** [`docs/brand/sloe-test-kitchen-reference.png`](./sloe-test-kitchen-reference.png) (the all-cream original)
- **Model:** `fal-ai/nano-banana-pro/edit` (image-to-image conditioning)
- **Resolution:** 2K
- **The establishing shot (01)** was generated first, conditioned on the original all-cream reference. All subsequent angles (02–08) were conditioned on 01 to maintain room consistency.
- **Seeds are pinned** (`70100`–`70107`) — regenerate with the same seed to iterate a scene; change seed for a fresh take.

---

## 4. How to extend

1. **New angle of the same room:** use `fal-ai/nano-banana-pro/edit` with `image_urls` pointing to
   `01-establishing-two-tone-16x9.png` (upload to fal CDN first), a descriptive prompt for the new
   angle, and a fresh seed in the `701xx` range.
2. **Lifestyle (Template D) with phone in this kitchen:** same edit endpoint, describe the phone/iPad
   resting on the island or marble counter, use the Template D prop + never-list language.
3. **All-cream variant:** same workflow but conditioned on the original `sloe-test-kitchen-reference.png`
   without the dark-oak-island transformation.

---

## 5. Links

- Two-tone decision: [`docs/decisions/2026-06-07-sloe-kitchen-two-tone-and-world-cues.md`](../decisions/2026-06-07-sloe-kitchen-two-tone-and-world-cues.md)
- World reference board: [`docs/brand/sloe-world-reference-board.md`](./sloe-world-reference-board.md)
- House style: [`docs/brand/sloe-food-photo-house-style.md`](./sloe-food-photo-house-style.md)
- Prompt template: [`docs/brand/sloe-image-prompt-template.md`](./sloe-image-prompt-template.md)
- Original all-cream reference: [`docs/brand/sloe-test-kitchen-reference.png`](./sloe-test-kitchen-reference.png)
- Social lifestyle set (all-cream, FLUX 2 Pro): [`docs/brand/sloe-social-image-set-2026-06-07.md`](./sloe-social-image-set-2026-06-07.md)
- Sloe palette: [`docs/brand/sloe/sloe-brand.md`](./sloe/sloe-brand.md)
