# Sloe — Logo / Brand-Mark Brief

> **DECISION 2026-06-04 (Grace):** The Sloe logo is the **"sloe" wordmark ALONE — no berry mark, no berry+word lockup.**
> - **Font = Fraunces** (`opsz 144 · wght 540 · WONK 1`), confirmed 2026-06-04 as the exact cut Grace chose — the WONK axis produces the flagged "l", teardrop "s" terminals, and angled "e". **This supersedes the "Newsreader" line in §7** for the wordmark (Newsreader remains the body/UI/display face; the *wordmark* is Fraunces). Free, OFL.
> - The "o" is **hand-tweaked** (extra diagonal cant to match Grace's raster) and the wordmark ships as an **SVG asset** — also the clean mobile install (Expo's Fraunces package is static-only, no WONK; web uses the live variable font).
> - **App icon = the full "sloe" word** on the plum gradient (Shop-style — a 4-letter wordmark works as an icon; confirmed). No separate "s" monogram.
> - The watercolour sloe-berry illustrations (`assets/gen/watercolour*/`) are **parked as marketing/brand illustration**, NOT part of the logo. The Bloom-Berry *mark* recommendation below is **not the current direction** (kept for reference).
> - Still gated on TM clearance (§9.4) before any production ship / public reveal.
>
> **Status:** ACTIVE BRIEF for the first Figma vector logo pass. Owned by `brand-manager`.
> Generated 2026-06-04. This brief defines the mark, its variants, the design principles, and
> 5 concrete designable directions, and names a single recommended direction to build first.
>
> **It does not produce visuals** — it is the spec a vector designer (and the Figma pass) works
> from. Render the recommended direction, then judge it against the gut-check in §6 (the Tare
> lesson: a mark that reads fine on paper can die the moment it is rendered — so we render before
> we commit).
>
> **Companion sources (read alongside):**
> - `docs/brand/sloe/sloe-brand.md` — full Sloe brand spec (name story, palette, voice, taglines)
> - `docs/brand/sloe/brand.md` — the brand board (Grace's leading pick, ground-by-surface call)
> - `docs/brand/sloe/sloe-clearance.md` — preliminary TM clearance (the **commit gate**)
> - `docs/ux/brand-tokens.md` — **canonical** colour + font tokens (what is actually shipped)
> - `docs/brand/sloe/assets/sloe-avatar-{plum,cream}.svg` — existing first-draft berry avatars
> - `docs/brand/sloe-image-prompt-template.md` — imagery system (photography, not the mark)

---

## 0. Three conflicts this brief resolves up front

Before any vector work, three live contradictions across the existing Sloe material must be
settled, or the designer gets conflicting instructions:

1. **Typeface for the wordmark: Newsreader, not Fraunces.**
   `docs/brand/sloe/sloe-brand.md` §3 specifies **Fraunces** for display/wordmark. That is
   **stale.** The app actually ships **Newsreader** (`apps/mobile/app/_layout.tsx` loads
   `Newsreader_400/500/600`; `docs/ux/brand-tokens.md` §Fonts mandates Newsreader for
   headlines/display; web `app/layout.tsx` loads `--font-newsreader`). The canonical token doc
   wins. **The Sloe wordmark is set in Newsreader.** (`sloe-brand.md` §3 should be corrected in a
   follow-up — flagged in §9.)

2. **The shipped in-app mark is NOT yet the berry — it is the old concentric-ring "plate".**
   `src/app/components/ui/suppr-mark.tsx` still renders `SupprPlateMark` (two concentric circles,
   the "empty plate" motif, ENG-797) behind the `design_system_brandmark` flag, with a legacy
   "S" glyph as the flag-off fallback — both still labelled "Suppr". The Sloe **berry** exists only
   as two standalone avatar SVGs (`assets/sloe-avatar-*.svg`); it has **not** been adopted as the
   product brand-mark in code. So the logo work is genuinely unbuilt — this brief defines the mark
   that will replace the plate motif, and the `SupprMark`/`SupprPlateMark`/`SupprWordmark` exports
   are the components a future implementation PR will re-skin (and rename to `SloeMark` etc.).

3. **The existing avatar SVGs are a first draft, not the locked mark.**
   `sloe-avatar-plum.svg` / `sloe-avatar-cream.svg` already commit to a specific construction:
   a single berry (radial-gradient sphere) + one leaf + a stem + a soft frosted bloom on the
   upper-left. They are a useful **starting reference** and they prove the berry can carry the
   brand — but they are illustrative (gradient-heavy, soft-shadowed) and were not engineered to
   reduce to a 60px dock icon. **This brief supersedes them as the spec.** Directions below either
   refine that berry into an icon-grade mark or offer alternatives to test against it.

---

## 1. Concept + symbolism

**The name "Sloe" does double duty, and the mark must carry both halves:**

- **The sloe berry** (*Prunus spinosa*, blackthorn fruit) — a small, round, deep plum / blue-black
  hedgerow berry with a pale frosted "bloom" you can rub off with a thumb. It is the botanical
  behind sloe gin and the literal source of the brand's primary colour. It is, by nature, the
  **slow-food berry**: you wait for the first frost, then you wait again while it steeps.
- **"Slow"** (/sləʊ/, an exact homophone) — calm, mindful, unhurried, considered eating. The quiet
  antidote to gamified streak-anxiety (MyFitnessPal) and calorie-from-a-photo urgency (Cal AI).
  This is **felt, never stated** — the name does the work; the mark reinforces the calm through
  restraint, not through any literal "slow" symbol.

**What the mark must encode:** the **sloe berry** as the recognisable object, rendered with enough
**calm and restraint** that it also feels *slow* — unhurried, premium, considered. The berry is the
noun; calm is the adjective. The single ownable asset hiding inside the berry is the **frosted bloom**
(`Frost #C9C2D6` / `Frost Mist #EDEAF1`) — a pale, cool, dusty lilac-grey highlight that no competitor
in the lane owns and that doubles as the icon's contrast engine (see §5).

**What the mark must NOT encode:**
- **Not a gin / winery / jam / preserve brand.** A purple berry on a stem with a leaf is one styling
  choice away from reading as a drinks or conserve label — and `sloe-clearance.md` already flags
  drinks/food-class crowding around the word. Keep the mark **geometric and calm**, not rustic/
  hand-drawn/orchard-label. The berry should read as *a considered dot*, not *a fruit product*.
- **Not the category clichés** — see §3.

---

## 2. Variants needed

Every variant is derived from one master mark. Define all five so the Figma pass produces a complete
set, not just a hero lockup.

| # | Variant | Spec | Notes |
|---|---|---|---|
| **(a)** | **iOS app icon** | 1024×1024 master; must read on a rounded-square (iOS auto-masks the corners — design to a full-bleed square, never pre-round) and survive down to **60px** (home-screen) and **40px** (Spotlight/Settings). | The hardest constraint. The mark + field must hold a clear silhouette and a luminance gap at 60px. No wordmark on the icon — the symbol stands alone. See §5. |
| **(b)** | **Social avatar** | 1:1, must survive a **circular crop** (IG/TikTok/X/YouTube all circle-mask). Keep the mark centred with ≥12% radial safe-margin so nothing important touches the crop edge. | Reuses the app-icon master but verified against a *circular* mask, not just a rounded-square. The existing `sloe-avatar-*.svg` are this variant's first draft. |
| **(c)** | **Full wordmark** | "Sloe" set in **Newsreader** + the standalone glyph (d) to its left, horizontal lockup. Lowercase **"sloe"** in product and most marketing; sentence-start "Sloe" only in running prose. | Define the glyph-to-text gap, the optical baseline alignment (the berry's centre aligns to the x-height midline, not the cap line), and the minimum clear-space (= the berry's diameter on all sides). Mirrors today's `SupprWordmark` composition, re-skinned. |
| **(d)** | **Standalone glyph / mark** | The berry (or chosen symbol) alone, no wordmark, no background field. Must work placed on Oat `#FBF8F3`, on white, and on the plum gradient. | This is the atom every other variant composes from. It is also the favicon, the tab-bar brand chip, the loading mark, and the push-notification icon. |
| **(e)** | **Monochrome** | A single-colour cut of the glyph that holds with **no gradient and no bloom** — pure solid. Two cuts: **plum `#3B2A4D` on light** and **white `#FFFFFF` on dark/plum**. | For embossing, app-store contexts, favicons at 16px, watermarking, single-colour print, and the `--brand-mark-ring` token (light = plum, dark = white, per `brand-tokens.md`). If the mark **only** works in full colour with the bloom, it has failed the monochrome test and must be simplified. |

---

## 3. Design principles

A Sloe mark is on-brand only if it is:

1. **Simple** — one idea, legible as a silhouette. If you can't describe it in one sentence, it's
   too busy.
2. **Recognisable small** — holds at 16px (favicon) and 60px (dock). This is the gating constraint,
   not the hero size.
3. **Premium** — quiet-premium, the brand's pillar. Restraint over ornament. Earns trust without
   shouting. (Newsreader + plum + frost already read premium; the mark must not undercut that with
   cartoon styling.)
4. **Calm** — unhurried, considered, never breathless or gamified. The mark should feel *settled*.
5. **Ownable** — distinct enough that a competitor can't reuse it, and tied to *this* name (the
   berry + the bloom are the ownable assets).

**Explicitly avoid the category clichés:**
- ❌ a generic **leaf** (every wellness/plant app)
- ❌ **fork-and-knife / cutlery** (every recipe app)
- ❌ an **apple** (the most generic food/health glyph there is)
- ❌ a **flame** (every calorie/burn app — and it's the gamified-anxiety energy Sloe rejects)
- ❌ a **plate ring / concentric circles** — note: this is what we are *replacing*. The current
  `SupprPlateMark` is a plate-ring; do not carry it forward. (One nuance: a *single* ring can still
  appear as the calorie ring **inside the product** — that's a feature, not the brand-mark. The
  brand-mark must not be "a ring", or it collapses into the competitor set below.)

**What makes a Sloe mark distinct vs the competitor set** — most of the lane is **a coloured ring or
a single letter**, so the cheapest way to be ownable is to be *neither*:

| Competitor | Their mark | Why Sloe must differ |
|---|---|---|
| **MyFitnessPal** | Blue circle/ring + flame-ish glyph | Sloe is not a blue ring; not a flame. |
| **Lifesum** | Coloured ring / petal-ring | Sloe is not a ring. |
| **Cronometer** | Green ring / "C" | Not a ring, not a letter-in-a-circle. |
| **MacroFactor** | Bold "M" monogram | A serif-cut "S" (Direction 2) is a *different* monogram register — editorial, not geometric-tech — but the **berry is the safer differentiator**: nobody in the lane owns a berry. |
| **Cal AI** | Rounded-square + glyph, bright/techy | Sloe is calm-editorial, not bright-tech. |
| **Julienne** | Clean type-forward / minimal | Closest in restraint; Sloe out-owns it with the berry + bloom + the plum colour (Julienne has no ownable colour). |

**The one-line differentiator:** *nobody in the recipe/nutrition lane owns a berry, and nobody owns
the frosted-bloom plum.* Lead with the asset the category can't copy.

---

## 4. Concept directions (5 — span the space)

Each is precise enough to hand to a vector designer, with why it's ownable and its app-icon
suitability. They deliberately span: literal-berry → typographic → botanical → fused-with-product →
minimal-abstract.

### Direction 1 — **The Bloom Berry** (single berry + frosted bloom) ★ RECOMMENDED

**Idea:** A single, near-perfect **circle** = the sloe berry, filled deep plum (`#3B2A4D`, or the
Damson→Sloe gradient for the colour variant). A soft, **off-centre frosted-bloom highlight** sits
upper-left (`Frost #C9C2D6`, low opacity, soft-edged) — the literal thumb-rubbable bloom on a real
sloe. Optional: a **single tiny stem nick** at top (a 2–3px plum notch or a hair-thin stem), *no
leaf* in the icon-grade cut (the leaf stays for the richer marketing/avatar lockup only — it's the
part that drifts toward "jam label"). The whole thing is one disc + one soft highlight: maximum
restraint, maximum calm.

**Why ownable:** the berry is uncontested in the lane; the **bloom** is the signature no one else has;
a plum disc with a cool off-centre bloom is instantly *not* a flame, ring, leaf, apple, or letter. It
is also the cut already prototyped in the avatar SVGs, so it builds on committed direction rather than
inventing a sixth.

**App-icon suitability:** ★★★★★ — the best of the five. A circle is the most legible silhouette at
60px and 16px. The bloom gives the luminance gap that stops a plum-on-plum icon reading as a dark
blob (see §5). It needs **zero** detail to survive shrinking. This is the one to build first.

> Refinement vs the existing avatar SVG: drop the leaf and stem for the icon (keep them only for the
> larger avatar/marketing lockup), tighten the berry to a true circle (the avatar's is already
> circular — good), and make the bloom a *defined* shape with intent, not just a fading radial wash,
> so it survives WebP/PNG compression and reads at 40px.

### Direction 2 — **The Serif "S"** (monogram cut from Newsreader)

**Idea:** A single lowercase or capital **"S"** cut from **Newsreader's** serif — using the
typeface's editorial contrast (thick/thin stroke modulation, the elegant terminals) as the mark
itself. Plum on light, white on plum. The serif "S" is the wordmark's first letter promoted to a
glyph, so the brand-mark and wordmark are literally the same DNA.

**Why ownable:** the lane's monograms are **geometric/sans** (MacroFactor's bold "M", Cronometer's
"C") — a *serif* "S" with editorial contrast reads premium and literary, a different register
entirely. It ties the mark to the Newsreader typography that is already the brand's signature.

**App-icon suitability:** ★★★☆☆ — a serif "S" can be beautiful but is **riskier small**: serifs and
thin strokes can disappear or clog at 16–40px, and "letter-in-a-rounded-square" is the single most
common app-icon shape (less ownable than the berry). Works best as a secondary glyph (favicon
fallback, loading mark) rather than the hero icon. **Build as the alternate to test against
Direction 1** — Grace may prefer a typographic mark at gut level, which is exactly why it's here.

### Direction 3 — **Berry on the Branch** (berry + blackthorn sprig)

**Idea:** The berry plus a small **blackthorn detail** — a single leaf and/or a hair-thin thorn-stem,
as in the current avatar SVGs but composed as a deliberate **botanical stamp**. More editorial-
cookbook, richer, more obviously "a real plant". `Sage #5E7C5A` leaf, plum berry, frost bloom.

**Why ownable:** the most *botanically specific* — it says "blackthorn" precisely, not just "a berry".
Distinct and characterful for packaging/marketing moments.

**App-icon suitability:** ★★☆☆☆ — the leaf + stem add detail that **muddies at small sizes** and pull
the mark toward the "jam/gin label" read this brief warns against (§1). Best used as the **larger
avatar and marketing stamp** (the role the existing SVGs already play), **not** the app icon. Keep it
in the system as the "full botanical" lockup; don't make it the dock glyph.

### Direction 4 — **Berry-in-Bowl / Berry-in-Ring fusion** (mark meets the product)

**Idea:** Fuse the berry with a product cue — the berry sitting in a **minimal open bowl** (a single
arc beneath it), *or* the berry as the filled centre of a thin open ring (the calorie ring the
product is built around). One stroke + one disc. Plum disc, plum or frost arc/ring.

**Why ownable:** ties the brand-mark to the product's actual hero object (the bowl of food / the
calorie ring) — a conceptual bridge between "berry" (name) and "eat well to your goals" (positioning).

**App-icon suitability:** ★★★☆☆ — the bowl-arc version is clean and works small; the ring version is
**dangerous** because it walks straight back into the "coloured ring" competitor cliché (§3) and the
plate-ring we're explicitly replacing. If this direction is explored, do the **bowl-arc**, not the
ring. Keep as a concept to test, but it's a half-step less ownable than the pure berry — the bowl is
a softer cliché than cutlery, but still a food cliché.

### Direction 5 — **The Calm Dot** (minimal berry-dot motif)

**Idea:** The most abstract: the berry reduced to a **single plum dot** — possibly with the bloom as
the *only* detail, possibly as a dot that doubles as the full stop in "sloe." (nodding to
`sloe.life` and the *full-stop = calm, finished, unhurried* idea from `sloe-brand.md` Concept C).
The dot is the berry abstracted to its purest geometry: a considered point, the opposite of a busy
flame.

**Why ownable:** extreme restraint = extreme calm = the brand pillar made literal. A single dot is
unmistakably *not* the busy competitor set. It is the "Calm/Zoe" register — abstract, premium,
confident.

**App-icon suitability:** ★★★★☆ — a dot is supremely legible small, BUT a *bare* dot risks reading as
**generic / "is that a loading indicator?"** with nothing to anchor it to "berry" or "Sloe". It needs
the **bloom** to carry meaning, at which point it converges with Direction 1 — so treat Direction 5 as
the *most-reduced end of Direction 1's spectrum* rather than a fully separate mark. Useful as the
favicon / 16px / notification cut of the recommended direction.

> **Spectrum note:** Directions 1 and 5 are the same idea at two reduction levels (berry-with-bloom →
> dot-with-bloom), and Direction 3 is Direction 1 with the botanical detail added back. So the real
> decision is **berry (1) vs serif-S (2)**, with 3/4/5 as the dial settings and adjacent concepts to
> pressure-test the berry against. Render 1, 2, and 3 side by side; that triad spans the whole space.

---

## 5. App-icon specifics

The app icon is the highest-stakes variant (it's the first impression in the dock, App Store, and
TestFlight) and the hardest to get right. Specifics:

**Background field — recommended: the plum gradient, NOT cream.**
- The brand has a reserved **AccentWinGradient (plum → clay → amber)** and a **brand gradient
  (Damson `#6A4B7A` → Sloe `#3B2A4D`, optionally lifting to `Frost #C9C2D6` at the edge)**. Either is
  on-brand for the icon field — the icon is exactly the "marketing / emphasis" context where the
  gradient is *allowed* (it's banned in core product chrome, not here).
- **Recommended: the brand gradient (Damson→Sloe with a Frost edge-lift)** as the field, with a
  lighter berry+bloom sitting on it — OR invert it (see the contrast rule below). The plum gradient
  field reads premium, owns the plum colour at icon scale, and differentiates instantly from the
  white/bright icons around it in the dock.
- **The AccentWinGradient (plum→clay→amber)** is a strong *alternative* field — it's warmer and more
  energetic (the clay/amber pull toward the "warm-coaching" side of the brand). Worth rendering as a
  B-option. Risk: amber at icon scale can read slightly "sunset/wellness-generic"; the cooler
  Damson→Sloe→Frost gradient is the safer, more ownable, calmer default. **Render both; default to
  the cooler plum gradient unless the warm one clearly wins the gut-check.**
- **Cream `#F6F5F2` / Oat `#FBF8F3` field is the weaker choice for the icon** — a plum berry on cream
  is legible but reads quieter/more generic in the dock and gives away the plum colour-ownership at
  the exact moment (icon scale) when colour does the most identifying work. Keep cream as the
  *avatar/marketing* ground (per the brand board's ground-by-surface split), not the app icon.

**The mark treatment + the contrast rule (the make-or-break):**
- **The single biggest failure mode is a plum berry on a plum field reading as a dark blob at 60px.**
  Deep-plum-on-deep-plum has almost no luminance contrast. To avoid it, engineer a **luminance gap**:
  - Make the **berry lighter than the field** (a Damson/lifted-plum berry on a deeper Sloe-Deep
    `#241733` field), **or**
  - Make the **field lighter and the berry deepest** (a Frost-edged lighter gradient with a deep-plum
    berry), **or**
  - Lean on the **frost bloom** as a hard luminance pop (`#C9C2D6` / near-white) catching the
    upper-left — this is the cleanest solution and the reason Direction 1 wins: the bloom *is* the
    contrast.
- Whichever, **verify the silhouette and the berry/field separation at 60px and 40px in greyscale** —
  if it survives greyscale shrinking, the colour will only help.
- **No wordmark, no text on the icon.** The symbol alone (Direction 1's berry). Text on an icon is an
  anti-pattern and illegible at 60px.

**Safe margins:**
- Design to a **full-bleed 1024×1024 square** — iOS masks the corners; never pre-round.
- Keep the berry within the **central ~76%** (≥12% margin all sides) so the rounded-square mask and
  the circular avatar crop both clear it comfortably. The berry should sit **optically centred**
  (a touch high, since a circle reads low when mathematically centred).
- The bloom can sit closer to the upper-left edge but must not touch the mask line.

**"Looks good in the dock next to Apple's apps" gut-check:**
- Place the rendered icon in a mock dock between, say, **Photos** (bright multicolour), **Messages**
  (green), and **Health** (white + red heart). Sloe's plum-gradient + frosted-berry should read as
  the **calm, dark, premium jewel** in that row — distinct because it's *the only deep-plum one*, and
  premium because it's restrained where the others are busy. If it instead reads as "a dark smudge"
  or "indistinguishable from Settings/any dark icon", the luminance gap has failed — go back to the
  contrast rule.
- Cross-check at the **App Store** scale (the rounded icon next to competitor listings): against
  MyFitnessPal's blue, Cronometer's green, Cal AI's bright tech-icon, the deep-plum berry should be
  the one that looks like it costs more and shouts less.

---

## 6. The gut-check before committing (the Tare lesson)

`docs/brand/sloe/sloe-brand.md` exists *because* Tare read fine on paper and died when rendered. Apply
the same gate to the mark. After the Figma pass renders the recommended direction (and the 1/2/3
triad), judge against:

- [ ] **Does it read at 60px and 16px?** (Shrink it. If the bloom/silhouette dies, it's not the mark.)
- [ ] **Does it survive greyscale + the monochrome cut (§2e)?** (If it only works in full colour, simplify.)
- [ ] **Does it look like a berry / Sloe — and NOT a gin label, a jam, a leaf, a flame, or a loading dot?**
- [ ] **In a mock dock next to Apple's apps, does it read calm + premium + distinct?** (§5 gut-check.)
- [ ] **Circular crop (avatar) — does anything important get clipped?**
- [ ] **Could a competitor reuse this verbatim?** If yes, it's too generic — the berry + bloom + plum
      should make that impossible.
- [ ] **Does it feel *slow* — settled, unhurried — not breathless?**

If any box fails, fix and re-render before committing. Do not ship the mark on a typed approval.

---

## 7. Colour + type reference (from the canonical tokens)

Pulled from `docs/ux/brand-tokens.md` so the designer uses the *shipped* values, not the stale spec.

**The six Sloe hues** (token names unchanged from the old palette; only hex moved — Phase 0,
2026-06-03):

| Hue | Hex | Role in the mark |
|---|---|---|
| **Plum** ★ primary | `#3B2A4D` | The berry fill; the wordmark ink; the monochrome-on-light cut. The brand anchor. |
| Sloe Deep | `#241733` | Deepest field option for the icon gradient. |
| Damson | `#6A4B7A` | Lifted plum — the gradient's light stop; a lighter berry for the luminance gap. |
| **Frost** ★ ownable | `#C9C2D6` | The bloom highlight — the contrast engine and the asset no competitor owns. |
| Frost Mist | `#EDEAF1` | Faint cool wash; the empty calorie-ring track. |
| Clay | `#C8794E` | Warmth — only if the AccentWinGradient (plum→clay→amber) icon field is chosen. |
| Sage | `#5E7C5A` | The leaf, in the botanical lockup (Direction 3) only. |
| Amber | `#C9892C` | Warm gradient stop (AccentWinGradient field option) only. |
| Oat | `#FBF8F3` | Avatar / marketing ground (NOT the app-icon field — see §5). |
| White | `#FFFFFF` | In-product UI ground; the monochrome-on-dark cut of the mark. |

**Gradients available to the icon:**
- **Brand gradient:** Damson `#6A4B7A` → Sloe `#3B2A4D` (→ Frost `#C9C2D6` edge-lift) — **recommended icon field.**
- **AccentWinGradient:** plum → clay → amber — warm alternative icon field (render as B-option).

**Typeface (wordmark):** **Newsreader** (serif), the shipped display face. Lowercase **"sloe"**.
- Web: `--font-newsreader` (`app/layout.tsx`). Mobile: `@expo-google-fonts/newsreader`
  (`apps/mobile/app/_layout.tsx`), weights 400/500/600.
- Set the wordmark at a **low-to-mid weight (400–500)** for the editorial, unhurried, literary feel —
  *slow* made visible. Generous tracking. Not bold (bold reads urgent, off-brand).
- The old `SupprWordmark` sets the text bold + Inter — that is the **Suppr** treatment to replace.

**Body / data (not the mark, for context):** Inter, `tabular-nums` on numerals.

---

## 8. Implementation note (where the mark lands in code, later)

Not part of this Figma pass, but so the brief is self-contained for the eventual build PR:
- The web mark lives at `src/app/components/ui/suppr-mark.tsx` — exports `SupprMark` (entry point),
  `SupprPlateMark`, `SupprWordmark`, `SupprPlateWordmark`. The Sloe berry replaces the
  `SupprPlateMark` ring motif; components get renamed `Sloe*` and re-pathed in the same PR.
- There is a mobile mirror referenced by `apps/mobile/tests/unit/brandMark.test.tsx` and a web test
  `tests/unit/brandMark.test.tsx` (both currently assert the ring/circle motif and the "Suppr" word)
  — both must be rewritten to assert the berry + "Sloe" when the mark ships.
- Tokens already in place: `--brand-mark-ring` (light = plum `#3B2A4D`, dark = white) and
  `--brand-mark-bg` — the monochrome cuts (§2e) map straight onto these.
- The change is visual + structural → it ships **behind a feature flag** per CLAUDE.md (reuse/replace
  the existing `design_system_brandmark` flag), with the old mark alive in the `else`, ramped via
  PostHog. Web + mobile must land the mark in the **same** change (parity).

---

## 9. Brand gaps surfaced + follow-ups

1. **`docs/brand/sloe/sloe-brand.md` §3 + §4 are stale on the typeface** — they say Fraunces; the
   product ships Newsreader. **Action:** correct that doc to Newsreader (or note the deliberate
   supersession) so the canonical brand spec and the shipped app agree. Routed as a doc-fix, not a
   design change.
2. **No defined behaviour for the mark on a *photographic* background** (e.g. the wordmark over a
   marketing food photo). The brief covers Oat / white / plum-gradient grounds; add a rule (likely:
   use the monochrome white cut + a subtle scrim) when that surface is designed.
3. **No animated/loading treatment defined.** The berry will be the loading mark and the splash;
   define its motion (a calm, slow fade/bloom — *not* a spinner) when the splash is built. Flagged
   for `ui-product-designer`.
4. **The mark is gated behind formal TM clearance.** `sloe-clearance.md` is a preliminary screen,
   **not** clearance — the class-9 register pull (incl. phonetic "slow"/"slo" variants) is the commit
   gate. **Do not ship the rebranded mark to production or announce it until counsel clears Sloe.**
   Designing and rendering it now is fine and correct (it feeds the go/no-go); committing the rebrand
   is not, until legal signs off. Route to `legal-reviewer`.

---

## 10. Coordination needed

- **`ui-product-designer`** — the Figma vector pass itself (render Directions 1/2/3, then the full
  variant set for the chosen mark); plus the loading/splash motion treatment (§9.3).
- **`legal-reviewer`** — the mark is gated on Sloe TM clearance (§9.4); confirm the commit gate before
  any production ship or public reveal.
- **`design-system-enforcer`** — when the mark lands in code: token-level audit (`--brand-mark-*`,
  the flag-gated swap, web/mobile parity).
- **`copy-reviewer`** — for the wordmark casing rule and any lockup tagline pairing (taglines live in
  `sloe-brand.md` §6; "Cook what you love. Hit your goals anyway." is the lead — landing/App-Store
  only, never in app chrome).
- **`product-memory`** — record the typeface resolution (Newsreader over Fraunces) and the
  recommended mark direction once Grace confirms.

---

## Summary — single recommended direction to build first

**Build Direction 1 — "The Bloom Berry" — first.**

A single deep-plum berry (a near-perfect circle, `#3B2A4D` or the Damson→Sloe gradient) with one
soft, off-centre **frosted-bloom highlight** upper-left in `Frost #C9C2D6`. **No leaf, no stem in the
icon-grade cut** (those stay only in the larger botanical avatar/marketing lockup, Direction 3). On
the app icon, set it on the **brand gradient field (Damson → Sloe, with a Frost edge-lift)** —
render the warm AccentWinGradient (plum→clay→amber) as a B-option, but default to the cooler plum
gradient unless it clearly loses the gut-check.

**Why this one:** it leads with the two assets the competitor lane cannot copy — **the berry** (no
tracker or recipe app owns one) and **the frosted bloom + plum** (no one owns the colour). It is the
most legible silhouette at 60px and 16px (a circle always is), and the bloom doubles as the luminance
contrast that stops a plum-on-plum icon dying as a dark blob in the dock. It builds on the berry the
existing avatar SVGs already committed to (refining, not reinventing), and it reduces cleanly to the
favicon/dot (Direction 5) and expands cleanly to the botanical stamp (Direction 3) — one coherent
system from one atom.

**Render alongside it:** Direction 2 (the serif "S" cut from Newsreader) and Direction 3 (berry on
the branch), so Grace can judge berry-vs-monogram at gut level — that triad spans the whole space. But
Direction 1 is the mark to design, shrink, greyscale, and dock-test first.
