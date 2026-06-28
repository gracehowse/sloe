# Why Sloe reads "cheap & inconsistent" — forensic lever-by-lever diff

**Date:** 2026-06-28 · **Surfaces:** Today + Recipes (iOS, current v3 bundle, data-rich account) · **Bar:** Oura, Lifesum, Julienne (Grace's picks), plus CREME as a second editorial-recipe reference.

**Method note (honesty about the split):** Claude owns the *consistency* layer — drift, tokens, spacing, repetition — which is measurable and reliable. *Taste* (the cheap/premium gut call) is Grace's; Claude is weak there (see `feedback_see_dont_orchestrate`). So this diff is grounded in what is **visible in the rendered captures**, not impressions. All Suppr shots are the **live v3 app** pulled fresh off Metro on 2026-06-28 (not the prototype, not a stale bundle) — `docs/ux/mobbin-refs/sloe-current-2026-06-28/`. Reference shots are linked to their Mobbin pages.

---

## The one-sentence verdict

Sloe has **good bones the bar shares** — editorial serif headings, real food photography, a calm neutral palette — but it reads cheap because of **three fixable craft failures**, in priority order:

1. **Everything is flat white-on-white.** No material depth, no elevation hierarchy. The single biggest "this is a wireframe" tell.
2. **No single dominant accent + a grey dotted "skeleton" ring.** Three accents compete (plum / green / orange) and the hero ring's empty state looks like a loading state.
3. **Imagery is present but un-art-directed — and sometimes mismatched** (the "What to eat next" hero shows a salad photo titled *Protein banana bread*). Inconsistent photo mood + content/photo mismatch is an instant downgrade for a food app.

None of these need another redesign. They're surface-craft corrections on top of a structure that's already close to the bar.

---

## Reference bar — what "premium" is doing (Mobbin)

- **Oura** — near-monochrome dark, **full-bleed cinematic imagery behind every score card**, ONE blue accent, huge clean numerals, one card = one beat with big breathing room. Restraint + depth. [Today/Home](https://mobbin.com/screens/e9b7815f-8a3e-4774-a777-f0b121901b21) · [Readiness card](https://mobbin.com/screens/c1a31cec-0c1c-4fb5-9408-4fe8ad8baf80)
- **Lifesum** — **one theme colour per diet floods a gradient hero ring**; everything else neutral white cards with soft shadow + small food thumbnails. Depth via hero-vs-card contrast; restraint via theming. [Diary/dashboard](https://mobbin.com/screens/3cf10697-c796-4853-a252-8a6837f3bbcc) · [Green theme](https://mobbin.com/screens/253deefe-ac08-4ed2-900d-970150b9ac45)
- **Julienne** — the closest sibling: **serif headlines, enormous whitespace, ONE round food photo on a cream card, ghosted oversized "01/02" numerals for layered depth, single ochre accent.** Calm and editorial. [Discover feed](https://mobbin.com/screens/7f8388c3-b1e9-410b-bc6b-515b771175bc) · [Recipe card](https://mobbin.com/screens/e1386e1c-0100-43fb-a170-f21a21fb1c40)
- **CREME** — dark, **full-bleed glossy photography**, bold sans over image, creator avatar attribution. [Editor's pick](https://mobbin.com/screens/a607df34-9270-4400-a4f7-a3316cb9d721)

The common thread across all four: **one dominant accent, one consistent imagery mood, and a clear depth model.** Sloe currently has none of the three locked.

---

## Lever-by-lever

### 1. Typography / type-ramp — **STRENGTH, lightly over-used** (sev: low)
- **Sloe does well:** two-tier system — editorial serif for headings & hero numerals (*Sunday*, *Your kitchen*, recipe titles, *1,900*) + sans for body/labels. This is on-brand and matches Julienne's editorial register. Keep it.
- **Where it costs:** **eyebrow-label soup.** Every section repeats `ALL-CAPS GREY EYEBROW → Serif title → caption` (TODAY/Sunday/28 June · COOK/Your kitchen · YOUR TRENDS/Progress · NET ENERGY · SNACK SUGGESTION · GOAL/EATEN/BONUS). They're all the same weight, size and grey, so the eyebrow stops being hierarchy and becomes texture/noise. Oura uses a caps label **once per card** (READINESS), never stacked three-deep.
- **Fix:** keep the serif tiers; **cut the eyebrow on secondary modules** (the serif title alone carries it), and reserve the caps-eyebrow for true section headers only.

### 2. Spacing rhythm — **OK structure, too dense per viewport** (sev: medium)
- Today crams **three distinct modules into one screen** (calendar strip + giant ring + GOAL/EATEN/BONUS tri-stat + prompt). Julienne and Oura give **one hero per viewport** with big margins; the confidence comes from the emptiness.
- Gaps are inconsistent: lots of air *inside* the ring, then the tri-stat sits tight beneath it; the macro-rings row and "What to eat next" hero butt close together.
- **Fix:** enforce one vertical rhythm step between modules (snap to the 24 step per ENG-1099's "one 24 rhythm"), and let the ring own its viewport — push the tri-stat down so it isn't fighting the ring.

### 3. Depth / material — **THE primary cheapness driver** (sev: high)
- Every card is **flat white on a near-white page** (the `card_cohesion_white_v1` "flat white slab" decision). Recipe cards, NET ENERGY card, meal slots, suggestion rows — all the same plane, hairline-separated. There is **no elevation model and no material contrast.** That flatness is what reads as "prototype / wireframe," not premium.
- The bar always has a depth move: Oura = photographic dark cards; Lifesum = gradient hero vs soft-shadow white cards; Julienne = **cream cards on white + ghosted numerals** = two planes without shouting.
- **Fix (highest leverage of the whole doc):** introduce ONE depth treatment. Cheapest, most on-brand option = **Julienne's move**: shift card ground to a warm cream/off-white against a white page (or vice-versa) so cards read as a distinct plane, + a soft single-token shadow on page-ground cards (we already have `Elevation`). This is the "flat white for now, maybe circle back" decision (ENG-1081) coming back to bite — it's time to circle back.

### 4. Colour restraint — **too many co-equal accents + weak empty ring** (sev: high)
- Sloe runs **three accents at once with no dominant one:** plum/aubergine (brand), green (ring/on-target), orange (carbs/over), plus the macro letters P/C/F each individually coloured (over-signal). The bar each picks **one** dominant accent (Oura blue, Julienne ochre, Lifesum per-theme) and stays monochrome around it.
- The empty calorie ring is a **grey dotted track** — it looks like a loading skeleton / unfinished control, the most "cheap" single element on Today. This is likely *intentional* — ENG-1093 (`ring_empty_macro_parity_v1`) deliberately renders the empty day as the unpopulated multi-ring (grey tracks) to match a populated day's shape. **Intentional or not, on the primary hero it reads cheap** — a grey dotted skeleton is exactly the wireframe signal we're trying to shed. Worth reopening: empty should paint the brand gradient loop (the ENG-1086 cold-open look), not grey dots, even at the cost of the empty/populated shape parity.
- **Fix:** pick plum as the single dominant accent; demote green/orange to *status-only* (over/under), not decoration; collapse the multi-coloured macro letters to one muted treatment (Lifesum does this). And make the empty ring paint the brand gradient, never grey dots.

### 5. Imagery — **present but un-art-directed + a content mismatch** (sev: high for a food app)
- Sloe **has real photography** (recipe grid, hero cards) — a genuine asset most trackers lack. But:
  - **Content/photo mismatch:** the "What to eat next" hero is captioned *Protein banana bread* over a photo of a **salad** (`today-2-mid.png`). One mismatch like this torpedoes trust instantly.
  - **No consistent art direction:** mix of bright overhead shots and dark moody plates with no shared light/surface/crop language. Julienne (bright overhead on neutral surfaces) and CREME (dark glossy) are ruthlessly consistent — *that* consistency is what reads premium, more than the photos themselves.
- **Fix:** (a) guarantee photo↔content correctness (never show a generic stock image under a named dish — show a neutral branded placeholder instead); (b) define ONE imagery recipe (light direction, surface, crop) and regenerate/curate to it. This is where **fal.ai/FLUX** for consistent AI food imagery earns its place (already greenlit, lower priority — but it's the lever-5 tool).

### 6. Motion / haptics — **deferred, assess live** (sev: tbd)
- Not judgeable from stills. Do last, per the plan. Live check needed: ring sweep entrance, tab transitions, PressableScale haptic weights. Flagged so it isn't forgotten, not actioned now.

---

## Highest-leverage moves (do in this order)

1. **Give the app a depth model** (lever 3). Cream card-ground vs white page + one soft elevation token on page-ground cards. Single biggest perceived-quality jump; revisits the ENG-1081 "flat white for now" decision. *Mobile + web parity in the same change.*
2. **Collapse to one dominant accent + fix the empty ring** (lever 4). Plum dominant; green/orange status-only; macro letters one muted colour; empty ring = brand gradient, never grey dots.
3. **Imagery integrity + one art-direction recipe** (lever 5). Kill content/photo mismatches first (correctness), then unify the look (fal.ai/FLUX candidate).
4. **Thin the eyebrow-label soup** (lever 1). Serif title carries secondary modules; caps-eyebrow for section headers only.
5. **One module per viewport rhythm on Today** (lever 2).
6. **Motion/haptics pass** (lever 6), last.

Moves 1–2 are pure token/treatment changes with the most impact for the least risk — they're the answer to "cheap." Move 3 is the answer to "inconsistent." Everything here sits *on top of* the existing v3 structure; none of it is a re-architecture.

---

## Caveat / what this diff can't settle
The cheap↔premium gut call is Grace's to make on rendered pixels — this doc names *where* and *why* with evidence, but the final taste verdict (and whether the warm-editorial direction itself is right) stays human-owned. If the depth + accent + imagery moves don't close the gap when rendered, that's the signal to bring in the senior contract designer Grace is weighing (Contra/Toptal) for a one-off direction pass.
