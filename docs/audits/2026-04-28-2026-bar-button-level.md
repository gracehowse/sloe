# 2026 best-in-class bar — button & interaction level (2026-04-28)

**Author:** competitor-analyst
**Method:** Deep teardown of 30 interactive-element patterns across 18 reference apps. Behaviour described at fidelity sufficient for an executor to replicate (timings, curves, sizes, hex deltas where observable).
**Audience:** `ui-product-designer`, `ui-critic`, `design-system-enforcer`, executor.
**Relationship to prior work:**
- Architectural bar: `docs/audits/2026-04-27-competition-bar-multicategory.md` (the 7-bullet executive summary, the 10 patterns to adopt).
- Production spec already written: `docs/specs/2026-04-27-production-design-spec.md` (motion / type / depth / icons / source / voice / per-surface).
- This document fills the gap **between** those two: component-level behaviour catalogue. Each section flags whether the spec already covers it (`[spec ok]`), partially covers it (`[spec partial]`), or hasn't addressed it (`[spec gap]`).

**Scope discipline.** Every claim names a specific app + observable behaviour. Where I'm extrapolating from spec, brand guidelines, or design-blog teardowns rather than first-hand 2026 observation, I mark `[inference]`. Where the call is contested across the industry, I mark "industry consensus" vs "my recommendation".

**Reference set.** Linear · Things 3 · Apple Fitness · Cash App · Notion Calendar · Strava · Arc · Pinterest · Airbnb · Robinhood · Stripe Dashboard · Notion · Apple Music · Apple Wallet · Monzo · Revolut · Substack · TikTok. Cross-checked against Apple HIG, Material 3 Expressive (May 2025), and the WAI-ARIA APG.

---

## How to read this catalogue

Each pattern has six fixed sections:
1. **The 2026 bar** — one paragraph stating where the ceiling sits.
2. **Named exemplars (2–3)** — apps doing it best, with the specific behaviour cited.
3. **Behaviour to replicate** — implementation-level detail (timings, sizes, curves, fallbacks).
4. **Common mistakes to avoid** — the failure modes adjacent to the bar.
5. **Mobile vs web variation** — where native iOS, web desktop, and mobile-web diverge.
6. **Spec status** — `[spec ok]` / `[spec partial]` / `[spec gap]`.

---

## 1. Primary CTA

**The 2026 bar.** A primary CTA is unmistakable, has tactile press feedback within 80ms, and never relies on shadow alone to communicate priority. Shadow geometry is consistent across the app — buttons are not snowflakes. Loading state preserves geometry (no width-collapse). Disabled state reduces alpha but does not desaturate to invisible.

**Named exemplars.**
- **Cash App "Pay" / "Request"** — the green pill is 56pt tall, fully rounded (radius = height/2), shadow `0 2px 0 rgba(0,0,0,0.04)` flat single-step + `0 8px 24px rgba(0,200,80,0.18)` ambient. Press: instant scale to 0.97 + shadow collapse to `0 0 0` over 80ms; release returns over 220ms with a `withSpring(damping: 18, stiffness: 320)` settle. Critically: the green pill **never gets a border** — its presence is shape, fill, and tinted ambient shadow.
- **Linear "Create issue"** — desktop: 32px tall, 6px radius, primary fill `#5e6ad2` (Linear violet), zero shadow at rest, `0 0 0 3px rgba(94,106,210,0.18)` focus halo. Hover: brightness 1.06, no scale. Press: brightness 0.94, no scale. Loading: button keeps width; the label cross-fades to a 14px spinner over 120ms. The discipline is "no motion in idle, motion only on intent".
- **Apple Wallet "Pay with Face ID"** — black pill, 50pt tall, 99pt radius, **no shadow** (relies on contrast against background card). Animates the chevron arrow on the trailing edge (`translateX 0 → 4 → 0` loop, 1.6s cycle) only when the system is awaiting interaction; loop stops on press. The arrow is the affordance.

**Behaviour to replicate.**
- **Shape.** Pill (radius = height/2) for hero conversion CTAs; 8–10px radius for in-app primary actions. Shape switch communicates intent class, not just style.
- **Press feedback timing.** ≤80ms to first frame of feedback. Either scale (0.96–0.98) OR brightness shift (×0.94), not both. iOS standard: scale + light haptic. Web: brightness shift + 1.5px Y translation `[inference]`.
- **Shadow ladder.** Primary CTAs sit one elevation step above their parent card. Tinted shadow (using button hue at 18–24% alpha) for hero CTAs only; neutral shadow `rgba(0,0,0,0.08)` for in-app primary.
- **Disabled.** Alpha 0.4 (industry consensus); never grey-out via desaturation alone — the button must still read as the same button. Never remove the shadow on disabled (suggests "gone" rather than "not yet"). Industry consensus.
- **Loading.** Width preserved. Label fades to spinner in-place; spinner is 14–18px, stroke 2px, primary contrast colour. No "button-grows-wider" patterns. Industry consensus.

**Mistakes to avoid.**
- Inflated shadows on every button — destroys hierarchy; only the highest-priority CTA on a screen earns ambient shadow.
- Shape inconsistency (pill on Today, rectangle in Settings, rounded-rect in Onboarding) — the most common premium-tell failure.
- Loading state that swaps the entire button for a centred spinner on a flat background — loses the call-to-action.
- Disabled state that becomes a different colour (grey button when active is blue) — looks like a different button.

**Mobile vs web.**
- **Native iOS:** scale + haptic; tinted ambient shadow; no hover state to design.
- **Web desktop:** hover (brightness 1.04–1.06) is required affordance; focus-visible ring 2px offset 2px; press = brightness 0.94 + 1px Y.
- **Mobile web:** suppress hover (hover misfires on touch); use `:active` brightness 0.94; **must** match the iOS shape exactly to feel native, not "web-shrunken-down".

**Spec status.** `[spec partial]` — production spec covers FAB tap and CTA voice but not per-CTA shape/shadow ladder. Section 1.1 mentions FAB scale 1→0.94→1 over 180ms; doesn't define disabled, loading, focus halo geometry. **Needs:** a `<Button>` primitive with `variant: primary | secondary | ghost | destructive`, `size: sm | md | lg`, `state: idle | hover | press | disabled | loading` × dark/light tokens.

---

## 2. Secondary / ghost CTAs

**The 2026 bar.** A button stops being primary and becomes text-only when the action is reversible, low-stakes, or one of multiple peers. The threshold is "would a user feel uncertain pressing it?". Premium apps use **at most three** button tiers per screen: primary, secondary, ghost. Stripe Dashboard, Linear, and Notion all enforce this.

**Named exemplars.**
- **Stripe Dashboard** — primary = filled indigo, secondary = bordered grey, ghost = text-only with a hover background-tint. Critical detail: ghost CTAs sit on a `--surface-100` hover (a 6% tint of the primary colour) on hover, not a full colour change. The hover is a "hint" of the primary, signalling "yes, this is clickable, but it's not the loud option". Industry consensus.
- **Linear "Cancel" beside "Save"** — secondary has zero fill, 1px border `rgba(255,255,255,0.08)`, hover lifts border to `0.12`. The button never has a coloured fill at rest; the contrast is purely structural.
- **Notion "Add property"** — pure text + plus glyph, no chrome. Hover gives it a 6% surface tint with a 4px radius; click instantly opens the popover. The lack of chrome communicates "this is a tool, not a destination".

**Behaviour to replicate.**
- **Threshold rule.** If the action commits or destroys data → primary or destructive. If the action navigates or reveals → secondary or ghost. If the action is ambient (toggle a panel, expand a row) → ghost.
- **Tier separation.** Visual weight ratio approximately primary : secondary : ghost = 100 : 60 : 30 by perceived contrast against background. Industry consensus.
- **Density.** Same height as primary at the same size token; only fill/border differs.

**Mistakes to avoid.**
- Two filled buttons side-by-side at equal weight — destroys the "primary" signal.
- Ghost buttons with no hover affordance — users don't know they're clickable.
- Ghost buttons spaced as if they were primary (large pill, generous padding) — they read as broken primaries.

**Mobile vs web.**
- **Native iOS:** tier separation is harder without hover; rely on weight + colour. iOS HIG distinguishes "Filled" / "Tinted" / "Plain" — three tiers.
- **Web desktop:** hover backgrounds are the cheapest affordance. Tier ratio identical to mobile.
- **Mobile web:** ghost buttons need `:active` background-tint or they feel dead. Most-missed pattern when porting desktop UI to mobile-web.

**Spec status.** `[spec gap]` — spec doesn't define a secondary/ghost taxonomy at all. **Needs:** explicit tier rules in §1.7 (CTA voice already starts this, but doesn't address visual weight).

---

## 3. Icon-only buttons

**The 2026 bar.** Touch target ≥44pt iOS / ≥40px web (Material 3 Expressive raised the floor). Hit-slop extends 4–8pt outside visible bounds. Press has visible feedback even without colour change (scale 0.94 + ring or background tint). Every icon-only button has an `accessibilityLabel` (mobile) and `aria-label` (web). Press animation uses spring physics, not linear ease.

**Named exemplars.**
- **Apple Music "Now Playing" mini-player buttons** — the play/pause/skip glyphs are 24pt visible, 44pt hit area. Press shows a `selectionAsync` haptic + a 0.06 alpha background circle that fades in for 80ms then out. The background circle is **only visible during press** — invisible at rest. This is the iOS-native pattern. Industry consensus.
- **Linear sidebar collapse arrow** — desktop: 16px chevron, 24px hit area, hover gives `rgba(255,255,255,0.06)` background fill in a 4px radius, click rotates the chevron 90° over 220ms `cubic-bezier(0.22, 1, 0.36, 1)`. Same geometry on every icon-only sidebar button.
- **Arc tab-archive button** — single chevron-down, 16px, hover lifts via brightness; click triggers the "tabs sweep down" animation. The button is silent at rest — hover is the only chrome. Arc is the model for "icon button as secondary chrome that disappears between uses".

**Behaviour to replicate.**
- **Hit-slop.** Mobile: 8pt all sides on glyphs <24pt. RN: `hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}`.
- **Press feedback.** Mobile: scale 0.94 + 6% background tint + selection haptic. Web: 6% background tint + brightness 0.94. Duration 80ms in, 220ms out.
- **Accessibility.** `accessibilityLabel` required (lint rule); `accessibilityHint` for non-obvious actions.
- **Toggle state.** Filled vs outline glyph for binary states (favourite ON = Heart filled red, OFF = Heart outline neutral). Industry consensus from Apple HIG / Material.

**Mistakes to avoid.**
- 24pt visible glyph with 24pt hit area — fails iOS HIG; users mis-tap.
- No press affordance on touch (relying purely on the screen change to confirm) — feels broken.
- Inconsistent on/off treatment (sometimes filled, sometimes coloured outline) — destroys vocabulary.

**Mobile vs web.**
- **Native iOS:** alpha-circle background on press is the system idiom.
- **Web desktop:** hover background tint precedes press; press is more subtle.
- **Mobile web:** hover should not render (CSS `@media (hover: hover)`). `:active` background tint + 80ms is the substitute. Frequently broken on responsive web.

**Spec status.** `[spec partial]` — §1.5 covers icon size tokens, §1.8 covers touch target floor, but doesn't specify icon-button press feedback. **Needs:** an `<IconButton>` primitive with hover/press/toggle states, hit-slop default, and accessibilityLabel as a required prop.

---

## 4. Tab bar / sidebar item

**The 2026 bar.** Active state uses fill **or** background tint **or** glyph weight change — pick one, do it consistently. No tab bar with a sliding indicator AND a glyph weight change AND a colour change AND a background pill (over-design). Active label weight = 600/700; inactive = 500/600. Glyph filled on active, outline on inactive (industry consensus from Apple HIG). Blur overlay on iOS tab bar at 70% saturation, 30px blur (system default).

**Named exemplars.**
- **Apple Fitness tab bar** — three tabs (Summary, Fitness+, Sharing). Active tab: filled glyph in red; inactive: outline glyph in `secondaryLabel`. Label weight is constant. No sliding indicator. The differentiation is glyph fill + colour, full stop. This is the iOS-native pattern and ages best.
- **Things 3 "Today / Upcoming / Anytime / Someday / Logged" sidebar** — desktop: sidebar item has 3 states. Inactive: glyph and label at 70% alpha. Hover: 100% alpha + 6% background. Active: 100% alpha + 12% background fill, glyph tinted to the list's accent colour. **No animation** on selection — instant. Things 3's restraint is the lesson.
- **Linear sidebar** — active item gets a `--background-secondary` fill, glyph tints to `--text-primary`, label weight stays 500. The sliding indicator is **the background block tweening** between items, not a separate underline element. 220ms `cubic-bezier(0.22, 1, 0.36, 1)`. Cleaner than Material's underline indicator.

**Behaviour to replicate.**
- **One signal.** Pick fill, or glyph weight, or background tint — not all three.
- **Sliding indicator.** If used, the background block tweens between items via a single layout transition (Linear, Material 3 navigation rail). Not a separate element. Saves layers and stays performant.
- **Blur on iOS.** Tab bar uses `BlurView` with `intensity={70}` and a thin top hairline `rgba(0,0,0,0.06)`. Light/dark inherits.
- **Active label bold.** iOS HIG: when label is shown, active = semibold (600), inactive = regular (400). The single most-skipped pattern.

**Mistakes to avoid.**
- Five tabs (use 3–4 — Linear, Cash App, Things 3, Apple all converge on 3–4).
- Centre-FAB tab pretending to be a tab — usability hostile if it doesn't navigate. MyFitnessPal's failure case.
- Sliding underline + filled glyph + bold label — over-design.
- Blur with `intensity={100}` on iOS — looks frosted-glass-2024.

**Mobile vs web.**
- **Native iOS:** tab bar at bottom, blur overlay, glyph filled on active, label semibold.
- **Web desktop:** sidebar at left, sticky, 248–280px wide, hover precedes active. Linear is the reference.
- **Mobile web:** **the parity gap.** Most products either ship a desktop sidebar that crushes content on mobile-web or a primitive bottom-nav that doesn't match the iOS app. Best-in-class: bottom-nav identical to iOS app's tab bar with blur (CSS `backdrop-filter`), exact same glyphs, exact same active treatment. Cash App's mobile web does this correctly; most product apps don't.

**Spec status.** `[spec partial]` — production spec mentions tab cross-fade 120ms and lucide glyph mapping, but doesn't specify active-state visual treatment. **Needs:** explicit "active = filled glyph + accent tint, label semibold" rule.

---

## 5. Sub-tab pill bar

**The 2026 bar.** A horizontal pill bar with a sliding background block (not a separate indicator), 220ms spring, instant haptic feedback, container with subtle background tint, active pill with no shadow (a shadow signals "elevated card", which the pill is not). Active pill background: `--surface-secondary` against a `--surface-primary` container. **The container is a tint of the page background, not white-on-white** — this is what separates premium pill bars from generic ones.

**Named exemplars.**
- **Linear "Inbox / My issues / Backlog" filters** — pill row sits on a `rgba(255,255,255,0.04)` container, active pill is `rgba(255,255,255,0.08)` solid (no border, no shadow), label weight 600 active vs 500 inactive. Sliding background tweens with `framer-motion` `layout` for 220ms. No icon, no glyph — labels only.
- **Notion Calendar view-switcher (Day / Week / Month)** — top of canvas. Active pill is a soft white fill on a grey container; inactive is transparent. Tween is fast (180ms), almost imperceptible — Notion deliberately makes the indicator feel "settled" not "sliding". Industry-consensus benchmark.
- **Apple Fitness "Day / Week / Month / 6 Month / Year" segmented control** — uses `UISegmentedControl`. Sliding thumb is system-physics (~250ms). Selection plays `selectionAsync` haptic. Pure system idiom.

**Behaviour to replicate.**
- **Container tint.** `rgba(black, 0.04)` light / `rgba(white, 0.04)` dark. The container is essential — sub-tabs without a container float and lose hierarchy.
- **Active pill.** Solid surface-secondary (one tier above container); zero shadow, zero border.
- **Sliding indicator.** Animate the active pill's background via shared layout transition; do not add a separate sliding underline.
- **Spring physics.** 220ms with `withSpring(damping: 22, stiffness: 320)` (mobile) or framer-motion `transition={{ type: 'spring', damping: 22, stiffness: 320 }}` (web).
- **Haptic.** `selectionAsync` on tab change (mobile only).

**Mistakes to avoid.**
- White pill on white container — invisible.
- Separate sliding underline — extra layer, harder to maintain.
- Linear easing — feels mechanical; spring is the bar.
- Pill shadow — only cards get shadows; pills are tints.

**Mobile vs web.**
- **Native iOS:** prefer `UISegmentedControl` for ≤4 options if you can match the visual language; custom for >4 or for non-equal-width labels.
- **Web desktop:** hover precedes selection; spring identical to mobile.
- **Mobile web:** scrollable horizontal pill row needs a fade mask on overflow edges (linear-gradient mask-image). Without it, scrollable pills feel like a desktop overflow.

**Spec status.** `[spec gap]` — spec doesn't define sub-tab pill bar primitive. **Needs:** a `<PillTabs>` primitive with the spring config, container tint token, and overflow scroll mask.

---

## 6. Chip / pill (filter / status / tag)

**The 2026 bar.** Chips have three states: unselected, selected, dismissible-selected. Selected chip has solid fill, white-or-tinted text, no border. Unselected has 1px border, transparent fill, secondary text colour. Dismiss-X is 12px, sits inside the chip with 4px L padding. Count badge sits to the right of label, 6px gap, smaller weight. Hover (web) shifts background by 6% alpha. Group-clear button always visible when ≥2 chips selected.

**Named exemplars.**
- **Pinterest filter chips** — selected: solid black pill with white text + 12px X glyph. Unselected: 1px black border, white fill, black text. Dismiss X is **inside** the pill (not a floating overlay). Tapping the chip body toggles; tapping X removes. Industry consensus.
- **Airbnb category-row chips** ("Beachfront", "Cabins") — outline icon + label, no border at rest, 1px black underline on selected. Underline is the entire signal — no fill change. This is Airbnb's distinctive pattern; works because chips sit on white. **My recommendation:** Airbnb's pattern is elegant on white but doesn't translate to coloured surfaces; outline-vs-fill is the safer default.
- **Notion database tag chips** — solid coloured fills (each tag has a saved colour from a small palette), 4px radius (rectangular, not pill — Notion's distinctive choice), 11px label, no glyph. Hover lifts brightness 4%. Click opens edit popover. The rectangular chip is intentional — it signals "this is data" not "this is an action".

**Behaviour to replicate.**
- **Geometry.** 24–28pt height; 12pt H padding (rounded), 8pt H padding (rectangular). Radius = height/2 (pill) or 4px (data tag).
- **Selected vs unselected.** Solid fill (selected) vs 1px border (unselected). Industry consensus.
- **Dismiss X.** 12px, inside the pill, 4px L gap from label, hit-slop 8pt. Tap target ≥24pt total.
- **Count badge.** Trailing, 6px gap, weight 500, colour secondary on selected fill, primary on unselected. Industry consensus.
- **Group clear.** Always visible when ≥2 chips selected; positioned at start or end of the chip row; "Clear all" or "×".

**Mistakes to avoid.**
- Selected chip uses both fill AND border AND glyph — over-signalled.
- Dismiss X is too small (8px) — fails touch target.
- No count badge on filter chips — users don't know "Vegetarian (24)" has 24 results.
- Chip row that wraps to two lines unannounced — disorienting; either truncate or scroll.

**Mobile vs web.**
- **Native iOS:** scrollable horizontal row by default (mobile space is tight); fade-mask edges.
- **Web desktop:** wrap is acceptable when chip count is bounded (<10); scroll if unbounded.
- **Mobile web:** scrollable + fade mask, identical to native. Frequently broken — chips wrap on mobile-web when they should scroll.

**Spec status.** `[spec partial]` — `<TrustChip>` and `<SourceDot>` defined for provenance. **Needs:** a generic `<Chip>` primitive separate from TrustChip, covering filter and selection use cases.

---

## 7. Card primitive

**The 2026 bar.** Four elevation steps used consistently: surface (no shadow), card (1px border + minimal shadow), sheet (drop-shadow + blur backdrop), floating (ambient shadow). Border AND shadow on the same card is acceptable when the border carries the radius and the shadow carries the depth — they're orthogonal. Press scale 0.98 (mobile) or brightness 0.96 (web). Hover lift on web: shadow tier increase + 1px translateY-up. **Content-first** — chrome sits beneath content, not over it.

**Named exemplars.**
- **Linear issue cards** — flat. 1px border `rgba(255,255,255,0.08)` (dark mode) or `rgba(0,0,0,0.06)` (light), zero shadow at rest. Hover: border lifts to `0.12`, no shadow. The card is structural, not elevated. This is the productivity-tier pattern.
- **Apple Wallet pass cards** — high-saturation gradient fills, 16pt radius, `0 2px 8px rgba(0,0,0,0.12)` shadow. Tap: full-screen morph (shared element). Long-press: card lifts via 8pt translateY-up + shadow grows. Apple Wallet is the consumer-tier card pattern.
- **Pinterest pin cards** — image-only, 16px radius (variable height), zero border, zero shadow. Hover (web): brightness 0.95 dim of the image. The card IS the image. This is the "content-first" extreme.

**Behaviour to replicate.**
- **Radius ladder.** 8 / 12 / 16 / 24pt. Pick one per card class and stick to it. Spec already calls 12pt as default `[inference]`.
- **Border vs shadow philosophy.** Border for structure (everything has one). Shadow for elevation (only when the card is "above" its parent). Both can coexist when they serve different purposes.
- **Hover lift (web).** 4pt translateY-up over 220ms `cubic-bezier(0.22, 1, 0.36, 1)`, shadow grows from card-tier to sheet-tier.
- **Press scale (mobile).** Scale 0.98 + opacity 0.96 over 100ms in, return on release.
- **Content padding.** 16pt default, 12pt for compact, 20pt for hero. Industry consensus.

**Mistakes to avoid.**
- Drop-shadow on every card — destroys hierarchy.
- Border + shadow + gradient + glow — premium-feel collapse.
- Inconsistent radius across card classes — prototype tell.
- Press feedback that scales the **whole** screen instead of the card — "the screen is dying" effect.

**Mobile vs web.**
- **Native iOS:** flat-with-border on light, hairline-on-dark, minimal shadow, press scale.
- **Web desktop:** hover lift is the expected affordance; without it, cards feel inert.
- **Mobile web:** suppress hover; press scale identical to native. Common failure: web cards with shadow ladder render fine on desktop but feel heavy on mobile-web.

**Spec status.** `[spec partial]` — §1.3 covers the depth ladder (Surface / Card / Sheet / Floating) with mobile + web tokens. **Doesn't cover:** press scale, hover lift, content padding ladder. **Needs:** a `<Card>` primitive that applies the depth tier + interaction states.

---

## 8. Input field

**The 2026 bar.** Focus ring uses 2px outer ring at 2px offset (not 1px border colour change — too subtle on mobile). Validation fires on blur, not on type (industry consensus from Stripe Elements, Apple Forms, Google Material). Error state uses 1px error-coloured border + 4px L red strip + helper text in error colour. Autofill is styled (no yellow-and-blue browser default). Label sits above input (top), not floating-overlap (Material 1 era). Helper text reserves vertical space at idle so error state doesn't shift layout.

**Named exemplars.**
- **Stripe Elements (Checkout)** — focus: 1px primary border + `0 0 0 3px rgba(99,102,241,0.18)` halo. Error: red border + red helper text below. Validation runs on blur for format errors, on type for length-only (e.g. card number 19 digits). The on-blur rule is the industry consensus — on-type validation creates "I haven't finished typing yet, leave me alone" friction.
- **Linear "New issue" title input** — desktop: zero border at rest, focus shows a 1px primary border + halo. The input has no chrome until focused. Aggressive but works on a known input shape.
- **Notion's text inputs** — minimal: 1px border `--surface-secondary`, focus brightens to primary, error gets a red border AND a 14px error icon at the right edge. Notion's pattern handles autofill well — it custom-styles browser autofill yellow to match the surface.

**Behaviour to replicate.**
- **Focus ring.** 2px ring, 2px offset, primary colour at 100% (web) / 18% halo (mobile). RN: use `react-native-reanimated` to interpolate the border colour, or stack a `View` outside.
- **Validation timing.** On blur (default), on type only when the user can self-correct mid-stream (length-bounded fields).
- **Error state.** 1px error border + helper text in error colour + 14px error icon (right edge). 4px L red strip is the iOS / macOS native pattern; can substitute with full border on small inputs.
- **Autofill.** Web: `input:-webkit-autofill { -webkit-box-shadow: 0 0 0 100px var(--surface) inset; -webkit-text-fill-color: var(--text-primary); }`. Without this, autofill looks broken.
- **Label position.** Top-aligned label (not floating overlap). Industry consensus for accessibility — screen readers handle top-label cleanly.
- **Helper text reservation.** Always render the helper-text container (even empty); error state replaces, doesn't push.

**Mistakes to avoid.**
- Validation on every keystroke — "wrong" flashes for valid inputs in progress.
- Error state that shifts layout below — pushes content, frustrating.
- Floating label with `transform: translateY(-12px)` — Material 1 idiom, ages poorly.
- Focus ring on `:active` only — keyboard users get nothing.

**Mobile vs web.**
- **Native iOS:** focus ring is implicit (system); just ensure border colour change. iOS HIG: red helper text + red border for errors.
- **Web desktop:** focus-visible ring is required for keyboard accessibility (WCAG 2.4.7).
- **Mobile web:** focus ring + iOS-style on-focus zoom (`font-size: 16px` to suppress auto-zoom on iOS Safari). Frequently broken.

**Spec status.** `[spec gap]` — spec mentions accessibility tier (focus-visible 2px ring) but doesn't define input states. **Needs:** an `<Input>` primitive with idle/focus/error/disabled, autofill tokens, and validation timing rules.

---

## 9. Sheet / modal / drawer

**The 2026 bar.** Sheets present with spring physics (damping 18, stiffness 220 — Apple's UISheet default), corner radius 16–24pt, drag handle 36×4pt at the top (centred, neutral grey). Snap points typically [50%, 92%]. Backdrop fades 0 → 40% opacity over 200ms with 12px blur. Dismiss gesture: pan down past 30% of sheet height OR velocity > 800px/s triggers dismiss. Interruptible — re-grabbing during animation reverses without restart. Breakpoint: drawer/sheet on mobile < 768px, modal-centred on desktop.

**Named exemplars.**
- **Apple's native UISheet (Maps, Photos, Wallet)** — handle 36×4pt grey `--separator`, corner radius 12pt. Spring physics: `damping 0.85, response 0.4`. Backdrop scales the parent screen down to 0.92 with translateY 8 + corner radius 12 — the "dismiss this to see the parent" affordance. Industry consensus iOS-native.
- **Vaul (web library by Emil Kowalski)** — used by shadcn/ui, Linear's web command palette. Mobile sheet: identical spring config to iOS, `shouldScaleBackground` mimics Apple's parent-shrink. Snap points are first-class. The web reference for sheets.
- **Notion Calendar event sheet** — desktop: opens as a centred modal (550px wide) with `0 32px 64px rgba(0,0,0,0.24)` shadow, no backdrop blur (preserves calendar context). Mobile: bottom sheet with snap points. The pattern: same content, different presentation per breakpoint.

**Behaviour to replicate.**
- **Drag handle.** 36×4pt, `--text-tertiary` at 30% alpha, 8pt T padding, centred. Industry consensus.
- **Corner radius.** 16pt mobile / 12pt desktop modal.
- **Spring config.** Mobile: `withSpring(damping: 18, stiffness: 220, mass: 0.9)`. Web: framer-motion `transition={{ type: 'spring', damping: 18, stiffness: 220 }}`.
- **Backdrop.** Opacity 0.4, blur 12px (web), 200ms fade. Mobile: parent screen scales to 0.92 + 8pt translateY-down (Apple's idiom).
- **Dismiss gesture.** Pan-down threshold: 30% of sheet height OR velocity > 800px/s.
- **Interruptibility.** Re-grabbing during animation must reverse — Reanimated `withSpring` is naturally interruptible; framer-motion needs `layout` + `animate`.
- **Breakpoint.** ≥768px → modal (max-width 550px, centred); <768px → bottom sheet.

**Mistakes to avoid.**
- Sheet without drag handle — users don't know it's draggable.
- Backdrop without blur — looks 2018.
- Centre-modal on mobile (top-of-viewport modal) — wastes vertical space, hard to dismiss.
- Linear easing on present — feels like a slide, not a settle.

**Mobile vs web.**
- **Native iOS:** UISheet system; or gorhom-bottom-sheet with the same spring.
- **Web desktop:** Vaul or Radix Dialog with custom spring; centre-modal at >768px.
- **Mobile web:** Vaul drawer mode; corner radius + drag handle + spring identical to native iOS. The cleanest cross-platform-parity opportunity.

**Spec status.** `[spec ok]` — §1.1 covers sheet config in detail (snap points, handle, backdrop, spring, interruptibility, reduce-motion). The deepest part of the existing spec.

---

## 10. Toast / snackbar

**The 2026 bar.** Bottom-position on mobile (above tab bar by 8pt + safe area), top-right on desktop. Duration 4s default, 6s for actionable, sticky for errors with dismiss. Swipe-down (or right on desktop) to dismiss. Action button (e.g. "Undo") is right-aligned in the toast, primary-colour text, button-tap dismisses without auto-timeout. Icon on left (12pt) for variant: success (Check), error (X), warning (!), info (i). Backdrop is solid, not blurred — toasts are signalling, not floating cards.

**Named exemplars.**
- **Linear toasts** — bottom-left desktop, 320px wide, dark-mode friendly, contains 14px icon + body + (optional) action. Animation: slide in from bottom 200ms `cubic-bezier(0.22, 1, 0.36, 1)`. Stacking: max 3, oldest dismisses first.
- **Apple's UNNotification banners** (system-wide) — top-of-screen drop-down, swipe up to dismiss, tap to drill in. The de facto iOS pattern. Apps that build custom toasts on iOS should match this.
- **Stripe Dashboard "Saved" + "Undo" toasts** — bottom-right, 4s default, "Undo" CTA right-aligned in toast. Click Undo within 4s reverses the action without a confirmation step. Industry consensus undo pattern.

**Behaviour to replicate.**
- **Position.** Mobile: bottom-centre or bottom-edge above tab bar + safe-area + 16pt. Web: top-right or bottom-right, 16px from edge. Industry: pick one and never mix.
- **Duration.** 4s default; 6s actionable; sticky for errors.
- **Dismiss.** Swipe-down (mobile), swipe-right or X button (web).
- **Action.** Right-aligned, primary-colour text, weight 600, no background fill. Tapping action dismisses + executes.
- **Stacking.** Max 3 visible; oldest dismisses; new toast pushes down (or up).
- **Icon variant.** 14–16px leading icon: Check / X / AlertTriangle / Info — consistent across all toast variants.

**Mistakes to avoid.**
- Toast that blocks tab bar — users can't navigate.
- Multiple toasts queued without max — toast spam.
- Action button merged with body (no visual separation) — users don't know it's tappable.
- Toast for error that needs the user's attention — error should be a sticky banner or inline, not a toast.

**Mobile vs web.**
- **Native iOS:** match system UNNotification timing; use `react-native-toast-message` or custom.
- **Web desktop:** corner-positioned, max-width 400px.
- **Mobile web:** bottom-edge above any sticky CTA, identical to iOS native. Avoid `position: fixed; bottom: 0` without safe-area inset — clips on iPhone notch.

**Spec status.** `[spec gap]` — spec doesn't define a toast primitive. **Needs:** a `<Toast>` primitive with variants (success/error/warn/info), action prop, and the Undo pattern coverage.

---

## 11. Empty state

**The 2026 bar.** Empty states have voice + illustration + a useful next action. Skeleton renders only when load <300ms is plausible; else, render the empty illustration directly to avoid skeleton-then-empty flicker. Voice matches the app's microcopy guidelines. Illustration is restrained — a glyph or single-line drawing, not a full-page hero.

**Named exemplars.**
- **Linear "Your inbox is empty" — hand-drawn dog illustration** — desktop empty inbox shows a single-line dog drawing with the copy "All caught up!" and no CTA (because there's no action to take when empty). The illustration is the brand. Voice is terse-confident.
- **Things 3 empty Today** — centred grey line: "Nothing scheduled for today." No illustration, no CTA. Restraint as voice. Apple-tier empty state.
- **Notion empty database** — 24px icon (matches the database's chosen emoji) + "Empty" + a CTA "+ New page" inline. Compact, contextual. The CTA opens the new-page sheet directly.

**Behaviour to replicate.**
- **Six canonical states.** Empty (no data yet), no-results (filtered to nothing), error (request failed), offline (no connection), no-permission (gated content), loading (only when >300ms).
- **Illustration.** A glyph (lucide) or restrained single-line illustration. ~80pt mobile / 120px web. Tinted to `--text-tertiary` or accent at 60% alpha.
- **Voice.** One headline (12–16 words max), optional sub-line, one CTA. CTA is optional — empty inbox doesn't need one; empty library does.
- **Skeleton policy.** If first byte time + render < 300ms, render empty directly. If >300ms, render skeleton; transition to real content via cross-fade (not pop-replace).

**Mistakes to avoid.**
- Generic spinner-on-white for any empty state — the cardinal sin.
- Spinner that becomes empty state on no data — flicker, perceived as broken.
- Empty state as full-bleed illustration with no copy — pretty but useless.
- Empty state CTA that opens settings instead of an action that creates data.

**Mobile vs web.**
- **Native iOS:** illustration tinted to system grey; centred vertically in available space.
- **Web desktop:** illustration sits in the centre of the canvas, max-width 400px copy column.
- **Mobile web:** identical to native; centre vertically with safe-area inset on top + bottom.

**Spec status.** `[spec partial]` — §1.7 covers voice (UK English, second-person). **Doesn't cover:** illustration system, six-state taxonomy, skeleton policy. **Needs:** a `<EmptyState>` primitive with the six variants — flagged as 7.1 "highest leverage" in the prior architectural audit.

---

## 12. Loading state

**The 2026 bar.** Skeleton silhouettes match the real content's shape exactly (same heights, same widths, same gaps). Animation is a subtle shimmer (linear-gradient sweeping at 1.5s cycle), 6–10% alpha amplitude — not the harsh white-on-grey of 2018. Spinner only for actions <300ms or for primary CTAs in loading state. Cold paint shows skeleton; warm paint shows last known state with a refresh indicator.

**Named exemplars.**
- **Apple Music album page** — skeleton with shimmer matching the cover-art square + title-line + 12 song-row stripes. Sweeps every 1.6s. Replaced by real content via 200ms cross-fade.
- **Linear issue list** — desktop: 6 row-shaped skeletons, each with a circle (avatar), 2 lines (title + meta), no shimmer (Linear skips the shimmer — they argue it's unnecessary visual noise). 100ms cross-fade to real list.
- **Robinhood chart cold-load** — shows the previous chart greyed out + a bordered overlay "Updating…" instead of replacing with skeleton. The "warm-cache + refresh indicator" pattern, ideal for data-heavy apps. Industry consensus for trading / financial / metric views.

**Behaviour to replicate.**
- **Skeleton shape.** Pixel-match the real component (not generic boxes). Uses `--surface-secondary` fill.
- **Shimmer.** Optional. If used: linear-gradient `90deg, transparent 0%, rgba(white, 0.06) 50%, transparent 100%`; 1.5s cycle; `transform: translateX(-100% → 100%)`.
- **Spinner.** 16–20px, stroke 2px, primary colour. Used for inline actions only (button loading, refresh).
- **Cold vs warm paint.** First load: skeleton. Refresh: keep last-known data + show inline refresh indicator (chevron-rotate or pulse). Industry consensus.
- **Cross-fade.** 100–200ms from skeleton to real content; not "pop replace".

**Mistakes to avoid.**
- Generic spinner on any list — looks half-built.
- Skeleton with exaggerated shimmer (40% alpha amplitude) — looks like a screensaver.
- Skeleton that doesn't match the real content shape — when real content arrives, layout shifts.
- Spinner for >2s actions without a "still working" message after 5s — feels stuck.

**Mobile vs web.**
- **Native iOS:** SwiftUI's `redacted(reason: .placeholder)` is the canonical pattern. RN: `react-native-skeleton-content` or hand-built with Reanimated.
- **Web desktop:** CSS animation on shimmer; `prefers-reduced-motion` disables shimmer.
- **Mobile web:** identical to native; animation throttled when offscreen.

**Spec status.** `[spec gap]` — spec covers motion tokens but not skeleton primitives. **Needs:** `<Skeleton>` primitive with shape variants (line, circle, card, custom) and the shimmer config.

---

## 13. Error state

**The 2026 bar.** Error states distinguish network errors (retry), app errors (report), and validation errors (fix inline). Inline for validation + recoverable; full-screen only for catastrophic. Voice is "what went wrong + what to do" — never "Oops!" or "Something went wrong" (industry consensus to retire). Retry button is primary if action is reversible; secondary if it's "report and continue".

**Named exemplars.**
- **Linear's error states** — full-screen errors are one line of copy + a single CTA. "We couldn't load this. Refresh?" Single primary button, no illustration, no decoration. Inline errors (validation): red border + red helper text below input.
- **Stripe Checkout** — payment errors shown inline above the affected field with a 14px error icon + red border + plain English: "Your card was declined. Try a different card." No "Oops!". Voice is calm-direct.
- **Arc Browser's whimsical 404** — "this page never existed, but you can pretend it did" + a doodle. Voice as personality. **My recommendation:** whimsy works for low-stakes pages (404, broken link) but not for primary-loop errors (recipe save failed). Don't be cute about user-data failures.

**Behaviour to replicate.**
- **Distinguish.** Network = retry CTA, app = "We're looking into it" + report-from-settings, validation = inline fix.
- **Inline errors.** 1px error border + 14px icon + helper text below + 4px gap. Same primitive as input field error.
- **Full-screen errors.** 24px icon + headline (12 words) + sub (24 words) + primary retry CTA. Centre-aligned, max-width 400px copy.
- **Voice.** Direct: "We couldn't reach the server" not "Oops! Something went wrong". Industry consensus.
- **Retry vs report.** Retry for transient (network); report for application errors (Stripe ID, Sentry tag visible).

**Mistakes to avoid.**
- "Oops!" anywhere. Industry consensus: this is now a tell of a low-tier app.
- Full-screen error for a recoverable inline issue — disorienting.
- Error state with no actionable next step — leaves the user stuck.
- Generic "Something went wrong" with no detail — useless for diagnosis.

**Mobile vs web.**
- **Native iOS:** inline errors use `secondaryLabel` colour with red `tintColor`; full-screen is rare (system handles network).
- **Web desktop:** inline + full-screen both common; full-screen needs a top-nav remaining for navigation escape.
- **Mobile web:** identical to native iOS pattern.

**Spec status.** `[spec partial]` — voice rules in §1.7 cover "no exclamation marks except destructive title" but don't cover the error taxonomy. **Needs:** a `<ErrorState>` primitive with network/app/validation variants.

---

## 14. Toggle / switch / segmented control

**The 2026 bar.** Switches use system idiom on each platform — iOS `Switch` is system, web custom must match iOS shape (50pt × 30pt, 14pt thumb). Animation: thumb slides 220ms with spring; track colour cross-fades. Haptic on flip (mobile). Disabled state: thumb at 50% alpha, track at 30% alpha. Segmented controls use sliding-thumb pattern (see §5).

**Named exemplars.**
- **iOS native Switch** — 51×31pt, thumb 27pt, system green when on, system grey when off. Slide animation is system spring (~250ms with overshoot). Haptic: `selectionAsync` on flip. The benchmark.
- **Linear's web toggles (Settings)** — match iOS shape exactly, 32×20px scaled-down. Track green-on, grey-off. Thumb shadow `0 1px 2px rgba(0,0,0,0.06)`. Identical animation timing to iOS. Cross-platform metaphor parity in action.
- **Apple Settings segmented** — `UISegmentedControl` system. Spring physics on the sliding thumb. Slight overshoot. Haptic on tap. The benchmark for segmented.

**Behaviour to replicate.**
- **Geometry.** Switch: 50×30pt mobile / 32×20px web. Thumb 26pt / 16px. Padding 2pt all around.
- **Track colours.** On = `--accent-success` (system green) or `--primary`. Off = `--surface-secondary`.
- **Thumb shadow.** `0 1px 2px rgba(0,0,0,0.08)` to lift from track.
- **Animation.** Thumb translateX 220ms with `withSpring(damping: 22, stiffness: 320)`; track colour cross-fades 220ms.
- **Haptic.** `selectionAsync` on toggle.
- **Disabled.** Track 30% alpha, thumb 50% alpha; no animation on toggle attempt; tap shows a 200ms shake.

**Mistakes to avoid.**
- Custom switch shape that doesn't match iOS — feels off-platform.
- Linear easing — feels mechanical.
- No haptic on flip — loses tactile signal.
- Track colour change without thumb slide — broken animation.

**Mobile vs web.**
- **Native iOS:** use system `Switch`; don't reinvent.
- **Web desktop:** custom must match iOS visually; no hover effect (toggle commits on click).
- **Mobile web:** identical to native iOS visual; reuse the web component sized to mobile.

**Spec status.** `[spec gap]` — spec doesn't address toggle primitives. **Needs:** a `<Switch>` and `<Segmented>` primitive matching iOS visual idiom.

---

## 15. List row

**The 2026 bar.** Row has leading thumb (40pt circle or square) + title + subtitle + trailing chevron OR trailing meta (icon + value). Swipe-left reveals destructive action (red); swipe-right reveals quick action (primary). Long-press shows action menu (iOS 13+ context menu, Material 3 long-press menu). Divider OR spacing — never both. Industry consensus: **spacing-only** for cards-of-rows; **divider** for grouped lists in Settings.

**Named exemplars.**
- **Apple Mail message rows** — 60pt height. Swipe-left full-distance triggers archive without confirmation; partial swipe shows Archive/Flag/More buttons. Long-press shows preview + action menu. Industry consensus iOS-native.
- **Things 3 task rows** — 44pt height. Swipe-right schedules; swipe-left moves to project. The directional swipes are domain-specific — Things 3 educates the user via tooltips on first use. The model for "swipe-as-domain-language".
- **Linear issue rows** — desktop: hover reveals a row of 4 inline action buttons on the right edge (status, priority, assignee, …). On mobile, long-press opens the same actions in a sheet. Cross-platform metaphor parity.

**Behaviour to replicate.**
- **Geometry.** 56pt height (mobile default), 40pt (compact), 72pt (rich). 16pt H padding.
- **Leading.** 40pt circle (avatar) or 40pt square (thumb), 12pt gap to title.
- **Trailing.** Chevron (16px secondary) for navigation; meta (icon + value) for inline status; both for navigation-with-status.
- **Swipe.** Mobile: swipe-left destructive (red), swipe-right neutral. Threshold: 50% of row width OR velocity > 1000px/s.
- **Long-press.** 500ms threshold; opens context menu on iOS, action sheet on Android, popover on web.
- **Divider vs spacing.** Spacing (12–16pt gap) for cards-of-rows on a tinted background. Divider (1px hairline) for grouped lists on a flat background.

**Mistakes to avoid.**
- Both divider AND spacing — over-articulated.
- Swipe actions that don't have undo — accidental destruction.
- Long-press without haptic feedback at the trigger moment — users don't know it activated.
- Trailing chevron AND trailing value — chrome-cluttered.

**Mobile vs web.**
- **Native iOS:** swipe + long-press are first-class. Use `react-native-gesture-handler`.
- **Web desktop:** hover reveals inline actions (Linear). Right-click menu can substitute for long-press.
- **Mobile web:** swipe via touch; long-press via touch-hold-500ms. Frequently broken on mobile-web — most products skip swipe actions on mobile-web entirely. **Parity gap.**

**Spec status.** `[spec gap]` — spec doesn't define list-row primitive. **Needs:** a `<ListRow>` primitive with leading/title/subtitle/trailing slots, swipe-action prop, and long-press handler.

---

## 16. Avatar

**The 2026 bar.** Four-tier size ladder: 16 / 24 / 32 / 56pt. Photo by default; gradient-monogram fallback (initial on a hue-derived gradient — not flat colour). Ring/badge accent for status (online dot, story ring, verified check). Loading state: gradient placeholder, never flat grey.

**Named exemplars.**
- **Apple Messages avatar** — 36pt circle, photo or monogram. Monogram: hue-derived gradient (initial deterministic from name hash → 360° hue space). Online dot: 10pt green circle bottom-right with 2pt white ring.
- **Linear assignee chip avatar** — 16pt circle in row chip, 24pt in sidebar, 32pt in profile. Monogram fallback: solid pastel from a 12-colour palette mapped from the user's ID.
- **TikTok story-ring avatar** — 48pt circle with a 2pt gradient ring (red→pink) when there's a new post; ring goes grey when viewed. Industry consensus story-state pattern.

**Behaviour to replicate.**
- **Size ladder.** 16 (chip) / 24 (row) / 32 (header) / 56 (profile). Industry consensus.
- **Fallback.** Gradient-monogram on hue-derived gradient. Don't flat-colour — looks placeholder-tier.
- **Online dot.** 25% of avatar size, bottom-right, 2pt white (or surface-bg) ring.
- **Story / verified accent.** 2pt ring outside the avatar, gradient or accent colour.

**Mistakes to avoke.**
- Flat-colour monogram — placeholder-tier.
- No fallback (broken-image icon visible) — looks broken.
- Avatar with a square crop — out-of-vocabulary; circles are the standard.

**Mobile vs web.**
- **Native iOS:** identical pattern.
- **Web desktop:** photo at higher resolution; lazy-load.
- **Mobile web:** match native exactly.

**Spec status.** `[spec gap]` — spec doesn't address avatar. **Needs:** an `<Avatar>` primitive with the four sizes + gradient-monogram fallback.

---

## 17. Search bar

**The 2026 bar.** Mobile: pinned to top OR revealed via pull-down (iOS native pattern). Search-as-you-type with 200–300ms debounce; submit-only for expensive queries. Recent history dropdown on focus (top 5). Voice input affordance (16pt mic icon, trailing). Focus state: bar expands or surface tints; results render below in same frame.

**Named exemplars.**
- **Apple Notes search** — pinned top. Tap-to-focus expands a recent-searches dropdown. Type triggers debounced live results. Voice input via the mic icon. Industry consensus iOS pattern.
- **Linear command-K search** — desktop: cmd-K opens centre-modal search with type-ahead across issues, projects, settings. Each result has an icon + title + meta + keyboard shortcut hint. Industry consensus for power-tier productivity.
- **Pinterest search** — mobile: pinned top, tap to focus, recent searches as chips below, trending searches as a horizontal scroll. Search-as-you-type. Mic affordance for voice. The model for content-discovery search.

**Behaviour to replicate.**
- **Placement.** Mobile: pinned top of content area or pull-down-to-reveal (iOS native). Desktop: centre-modal (Linear) or top-bar (Pinterest).
- **Focus state.** Bar gains 1px primary border + halo; recent history dropdown appears below.
- **Debounce.** 250ms for live search; submit-only if query cost > 500ms.
- **Voice.** 16pt mic icon trailing, opens system voice input.
- **Recent history.** Top 5, "Clear" CTA at the bottom of the dropdown.

**Mistakes to avoid.**
- No debounce — every keystroke triggers a request.
- Recent history with no clear-all — privacy concern + clutter.
- Search input that reveals results in a separate page (not below the bar) — context loss.
- Mic icon that doesn't work or that doesn't request permission gracefully — broken affordance.

**Mobile vs web.**
- **Native iOS:** pull-to-reveal (table view header search) is the system idiom; voice is system.
- **Web desktop:** cmd-K for power, top-bar for primary.
- **Mobile web:** pinned top with the same focus expansion as native; voice via Web Speech API where supported.

**Spec status.** `[spec gap]` — spec doesn't address search bar primitive. **Needs:** a `<SearchBar>` primitive with focus-expansion, debounce timing, recent-history dropdown.

---

## 18. Pull-to-refresh

**The 2026 bar.** Custom indicator matching brand (not the system spinner). Haptic at the trigger threshold (the moment "release will refresh"). Refresh duration capped at 2s; if data takes longer, drop the indicator and show a top-bar inline spinner instead. Indicator vanishes via fade, not pop.

**Named exemplars.**
- **Apple Mail pull-to-refresh** — the rubber-band stretch + system spinner. Industry-consensus iOS native; suitable when brand-restraint is the design language.
- **Strava pull-to-refresh** — custom indicator: a glyph that fills as you pull, then plays a small animation as data loads. Brand-distinctive without being noisy.
- **Robinhood pull-to-refresh** — pulses the user's portfolio value at the top of the screen briefly when refresh succeeds, then resumes. The data IS the indicator.

**Behaviour to replicate.**
- **Indicator design.** Brand-aligned glyph or shape, not just a system spinner. Tinted to `--primary`.
- **Haptic at threshold.** `selectionAsync` at the moment release-will-refresh is true. Industry consensus.
- **Cap.** 2s indicator duration; if data is still loading, fade indicator and show top-bar inline spinner.
- **Success.** Brief pulse or check-glyph fade.
- **Failure.** Indicator returns to start; toast surfaces error.

**Mistakes to avoid.**
- System spinner only — passes for system apps, feels generic for branded apps.
- No haptic at trigger — users don't know they've crossed the threshold.
- Indicator that hangs for 10s on slow networks — looks broken.

**Mobile vs web.**
- **Native iOS:** `RefreshControl` system or custom Reanimated.
- **Web desktop:** **not the pattern** — desktop uses a top-bar refresh button or auto-refresh.
- **Mobile web:** Reanimated equivalent works on touchstart events; less common than native, often skipped.

**Spec status.** `[spec gap]` — spec doesn't address pull-to-refresh.

---

## 19. Bottom action bar / sticky CTA

**The 2026 bar.** Sticky bottom CTA appears when the primary action is required to advance — checkout, submit, save. Blur-backdrop above safe area; primary CTA full-width; optional secondary text-button left-aligned. Hides on scroll-down, reveals on scroll-up. Appears with translateY-up 200ms `cubic-bezier(0.22, 1, 0.36, 1)`.

**Named exemplars.**
- **Airbnb listing booking bar** — sticky bottom on listing detail. Shows price + "Reserve" CTA. Above the bar: 12px blur backdrop. The bar is the action-oriented summary.
- **Stripe Checkout submit bar** — sticky bottom on mobile checkout. Shows total + "Pay $X". Stays in view as the user scrolls form fields.
- **Apple Wallet "Add to Apple Wallet"** — appears when contextually relevant (a new pass arrives), full-width button with the Apple Wallet glyph. Disappears when not relevant.

**Behaviour to replicate.**
- **Trigger.** Appears when a primary action is required to advance.
- **Position.** Above safe-area bottom inset + 16pt; full-width minus 16pt H padding.
- **Backdrop.** Blur 12px + 80% surface alpha (web: `backdrop-filter: blur(12px)`).
- **Hide-on-scroll.** translateY+72pt + fade out 200ms; reveal on scroll-up.
- **CTA shape.** Match primary CTA spec (§1).

**Mistakes to avoid.**
- Sticky bar that covers important content (final form field, total) — frustrating.
- Always-visible sticky bar even when no action available — clutter.
- Bar without backdrop blur, on scrollable content — text bleeds through.

**Mobile vs web.**
- **Native iOS:** safe-area inset is critical (iPhone home indicator).
- **Web desktop:** sticky bar less common; modal CTAs are the desktop pattern.
- **Mobile web:** identical to native iOS; CSS `env(safe-area-inset-bottom)` for inset.

**Spec status.** `[spec gap]` — spec doesn't address bottom action bar.

---

## 20. Numeric values

**The 2026 bar.** Tabular-nums everywhere (numbers don't shift width when changing). Animated count-up for hero values on first paint; instant change for live updates (logging a meal, viewing a stat). Comma separators ≥4 digits (or locale-specific). K/M/B notation for >9999 in tight spaces (chip, micro). Negative values use the same digit width.

**Named exemplars.**
- **Robinhood portfolio value** — first paint: count-up from 0 to current value over 1.2s with cubic-out easing. Subsequent updates: instant value change with a brief colour pulse (green if up, red if down) over 200ms.
- **Apple Fitness rings** — ring fills animate over 800ms with spring; the central numbers count up in lockstep with the ring fill (synchronized).
- **Cash App balance** — instant on screen mount (no count-up). Updates: instant change. Cash App's restraint here — they argue first-paint count-up is fashion-y.

**Behaviour to replicate.**
- **Tabular-nums.** Always. CSS: `font-variant-numeric: tabular-nums`. RN: `fontVariant: ['tabular-nums']`. Industry consensus.
- **Count-up first paint.** For hero metrics only (calorie ring, daily summary). 800–1200ms, ease-out.
- **Live updates.** Instant change + 200ms colour pulse on the affected value if up/down semantics matter.
- **Locale formatting.** `Intl.NumberFormat(locale)` — Suppr's UK English implies thousands-separator commas + decimal points. Industry consensus.
- **K/M notation.** `1.2k` / `45.6k` / `2.4M` — only in space-constrained contexts (chip, badge).

**Mistakes to avoid.**
- Mixing tabular and proportional digits — values shift mid-update.
- Count-up on every value change — fashion, slows perceived speed.
- Locale-blind formatting — `1,000.00` for UK ok, but `1.000,00` for DE — region-aware (memory: project_region_aware_pricing).

**Mobile vs web.**
- **Native iOS:** SF Pro has tabular by default with `monospacedDigitSystemFont`. RN: explicit `fontVariant`.
- **Web desktop:** Inter supports tabular-nums via `font-feature-settings: "tnum" 1`. Spec already calls this in §1.2.
- **Mobile web:** identical to web.

**Spec status.** `[spec partial]` — §1.2 covers tabular-nums and "always paired with `fontVariant`". **Doesn't cover:** count-up policy, locale formatting. **Needs:** an `<AnimatedNumber>` primitive with count-up vs instant variants, and a locale-aware number formatter utility.

---

## 21. Date / time displays

**The 2026 bar.** Relative ("2h ago", "yesterday", "last week") for recent (<7 days) and ambient contexts. Absolute ("Mon 27 Apr") for primary headings and detail surfaces. Switch contextually — never both for the same value, never inconsistent within a screen. Use one library (date-fns, dayjs) for consistency. Tabular-nums on dates.

**Named exemplars.**
- **Apple Mail timestamps** — list view: "10:23 AM" today, "Yesterday", "Mon", "27 Apr" depending on age. Detail view: full date "Monday, 27 April 2026 at 10:23". Industry consensus contextual switch.
- **Linear issue activity** — "2h ago" on activity feed (relative) + tooltip on hover shows absolute "Apr 27, 2026 10:23 AM". Best of both.
- **Substack reader** — "Apr 27" on post lists (terse absolute), full date on detail view. Voice-aligned with reader-first design.

**Behaviour to replicate.**
- **Recent (≤7 days).** Relative.
- **Older.** Absolute, terse format.
- **Detail surfaces.** Full absolute date + time.
- **Hover (web).** Tooltip with full absolute on relative timestamps.
- **Locale.** `Intl.DateTimeFormat(locale)`; UK English implies "27 Apr", DD MMM order.

**Mistakes to avoid.**
- Both relative and absolute for the same value — visual noise.
- Inconsistent format within a screen ("2 hours ago" + "1d" + "Mon" — pick one).
- Year visible only when needed (don't show "2026" on this-year dates).

**Mobile vs web.**
- **Native iOS:** `RelativeDateTimeFormatter` is system; consistent with Apple apps.
- **Web desktop:** date-fns or dayjs; cache the formatter.
- **Mobile web:** identical.

**Spec status.** `[spec gap]` — spec doesn't address date formatting. **Needs:** a `formatDate(value, context)` utility with contextual relative/absolute.

---

## 22. Progress visualisation

**The 2026 bar.** Ring for 0–100% goal completion with semantic identity (Apple Fitness-style). Bar for inline progress (one of N steps). Segmented bar for multi-target tracking (macros: P/C/F/Fibre). Animated fill on first paint (800ms with spring). Gradient fills only when the gradient carries semantic info (over-budget transitions colour); otherwise solid.

**Named exemplars.**
- **Apple Fitness three-ring** — Move (red), Exercise (green), Stand (blue). Each ring fills over 800ms with `withSpring(damping: 15, stiffness: 180)`. Central numbers tick up in lockstep. Industry consensus 1.0.
- **Strava activity progress (weekly bar)** — segmented bar with day-of-week ticks, fill animates left-to-right on data-load. Bar colour solid Strava-orange.
- **Robinhood portfolio chart** — sparkline + a vertical "now" marker. Animated fill from left edge over 1.2s on first paint. Subsequent updates: instant.

**Behaviour to replicate.**
- **Ring.** Stroke-dasharray tween over 600–800ms with spring. Centre value count-up in lockstep.
- **Bar.** Width tween over 600ms. Linear or ease-out, not spring (bars don't overshoot).
- **Segmented bar.** Per-segment width tween, staggered by 60ms.
- **Colour.** Semantic. If over-budget, transition to amber (per memory `project_prototype_carryover_rules`). Spec already locks amber-not-red.
- **First paint.** Animate from 0; subsequent paints: animate from previous to new value.

**Mistakes to avoid.**
- Skeumorphic 3D ring — ages poorly (industry consensus).
- Colour change during fill — anxiety.
- Animated on every render (e.g. tab return) — feels broken.

**Mobile vs web.**
- **Native iOS:** SwiftUI shape APIs or RN Reanimated + Skia for paths.
- **Web desktop:** SVG `stroke-dasharray` + framer-motion.
- **Mobile web:** SVG identical to web.

**Spec status.** `[spec ok]` — §1.1 covers ring and macro-bar fill timings (600ms with `--ease-spring-soft`, target-cross to amber after fill).

---

## 23. Status indicators

**The 2026 bar.** Sync state (cloud-sync icon, online/offline, syncing-now), permission state (notifications denied, location off), data freshness (stale data badge). Indicators sit in the corner-of-context (top-right of header for global, leading on row for per-item). Pulse animation only for "actively syncing"; static for "synced" and "offline".

**Named exemplars.**
- **Notion sync state** — top-right of canvas: "Saved" (instant) → fades after 1s. On offline: persistent "You are offline" pill + queued-changes counter.
- **Apple Notes iCloud sync** — list-icon corner: blue uploading arrow when syncing; clears when done. Subtle.
- **Linear desktop online state** — sidebar bottom: green dot when online, grey when offline. Tooltip explains.

**Behaviour to replicate.**
- **Sync state.** Top-right of header. "Saving" → "Saved" → fade. Offline: persistent banner.
- **Permission state.** Inline at the moment of use, not buried in Settings. (Memory: `feedback_no_quick_temp_fixes` — don't bury.)
- **Data freshness.** Stale-data chip on data-driven screens (e.g. portfolio charts > N min old).

**Mistakes to avoid.**
- No sync indicator on user-data inputs — users distrust "did it save?".
- Persistent sync-success indicator — clutter; success should fade.
- Hidden offline state — data loss risk.

**Mobile vs web.**
- **Native iOS:** Wallet/Notes-style minimal corner indicator.
- **Web desktop:** sidebar or top-nav corner.
- **Mobile web:** match native.

**Spec status.** `[spec gap]` — spec doesn't address sync/online/offline indicators.

---

## 24. Notifications / badges

**The 2026 bar.** Red dot for "something new" without a count; numeric badge for "items waiting" (inbox, cart). Badge sits on top-right of the parent (avatar, tab item) with a 2pt border in the parent surface (so it pops). Pulse animation only for high-priority notifications (e.g. critical alerts), never for ambient counts.

**Named exemplars.**
- **iOS app icon badges** — system standard. Numeric badge top-right; red circle, white digit. No pulse.
- **Apple Music "Listen Now" red dot** — ambient "new content" indicator without a count. Industry-consensus pattern.
- **Linear "Inbox" sidebar badge** — numeric count of unread; clears on inbox visit.

**Behaviour to replicate.**
- **Red dot.** 8pt circle, no count, "new content" semantic.
- **Numeric badge.** 16–20pt pill, white digit, red fill, top-right anchored.
- **Border in parent surface.** 2pt border in `--surface-primary` to pop the badge.
- **Pulse.** Only for critical (battery low, security alert); ambient = static.

**Mistakes to avoid.**
- Pulse on every notification — alarm fatigue.
- Numeric badge that overflows ("999+") inelegant — tighten visual bound.
- Badge without parent-surface border — looks pasted-on.

**Mobile vs web.**
- **Native iOS:** system app icon badge + in-app badges.
- **Web desktop:** top-right nav, identical visual.
- **Mobile web:** identical.

**Spec status.** `[spec gap]` — spec doesn't address badges.

---

## 25. Confirmation flows

**The 2026 bar.** Destructive confirm uses a sheet-presented modal with explicit verb in the CTA ("Delete account" not "Confirm"). Two-step sheet for irreversible: type-to-confirm or confirm-and-undo-window. Non-destructive confirms use inline toggles with optimistic updates. Industry consensus: replace "Are you sure?" with action verbs in the buttons.

**Named exemplars.**
- **Apple "Delete Account"** — sheet with copy "This will permanently delete your account and all data" + a primary destructive button "Delete account" + secondary "Cancel". No "Are you sure?" header. Spec already calls this in §1.7.
- **Gmail "Trash"** — undo toast for 5s after delete. No confirmation dialog. Optimistic delete + recoverable.
- **GitHub "Delete repository"** — type-the-repo-name-to-confirm. Highest friction; appropriate for catastrophic.

**Behaviour to replicate.**
- **Reversible action.** No confirm; show undo toast 5s.
- **Mildly destructive (soft-delete).** Sheet with "Delete" + "Cancel".
- **Catastrophic.** Type-to-confirm + sheet warning.
- **CTA labels.** Action verbs ("Delete account", "Erase data") — never "Confirm" / "OK".
- **Sheet style.** Mobile: action sheet at bottom; desktop: centre modal.

**Mistakes to avoid.**
- "Are you sure?" with "OK" / "Cancel" — useless copy; doesn't say what happens.
- Destructive action without undo for reversible cases — over-friction.
- Confirm dialog for every save — user fatigue.

**Mobile vs web.**
- **Native iOS:** `UIAlertController` or sheet — both are system-native.
- **Web desktop:** centred modal with destructive primary.
- **Mobile web:** centre modal or bottom sheet; latter more iOS-feeling.

**Spec status.** `[spec partial]` — §1.7 voice rules cover destructive labels ("Delete account" / "Erase all data"). **Doesn't cover:** confirm-vs-undo policy. **Needs:** a confirm-vs-undo decision tree.

---

## 26. Onboarding step transitions

**The 2026 bar.** Steps slide horizontally (translateX) at 250ms with `--ease-pm`; back uses reverse direction. Progress bar at top (1px hairline) tweens width over 200ms. "Step N of M" copy is implicit (progress bar carries it); explicit only when total is unbounded. Back affordance always available (top-left chevron).

**Named exemplars.**
- **Cal AI onboarding** — slide horizontally, progress bar at top, back chevron persistent. Industry consensus consumer-tier onboarding.
- **Linear onboarding** — desktop: slide-in 200ms with cross-fade. Single workspace setup. Restraint as voice.
- **Cash App sign-up** — bottom-sheet stack: each step is a sheet snap, dismiss back. Distinctive — preserves spatial model.

**Behaviour to replicate.**
- **Direction.** translateX 24pt for next, reverse for back. 250ms `cubic-bezier(0.22, 1, 0.36, 1)`.
- **Progress bar.** 1px hairline at top, primary fill, width tween 200ms.
- **Back affordance.** Top-left chevron, always present (except step 1).
- **"Step N of M".** Implicit via progress bar; explicit only when unbounded.

**Mistakes to avoid.**
- Step 1 with a back affordance that exits — confusing.
- No back from final step — traps user.
- Slide direction inverted — disorienting.

**Mobile vs web.**
- **Native iOS:** stack navigator with custom transitions (Reanimated).
- **Web desktop:** route transitions via View Transitions API or framer-motion.
- **Mobile web:** match native.

**Spec status.** `[spec partial]` — §1.7 covers onboarding voice. Motion not specified per-step. Spec covers tab switch motion broadly. **Needs:** explicit step-transition motion spec.

---

## 27. Settings rows

**The 2026 bar.** Settings row primitive: leading IconBox (24pt circle in tinted surface) + label + sub-label + trailing chevron OR trailing toggle OR trailing value. Grouped by section with 11pt uppercase eyebrow labels. Background-tinted card grouping (Apple Settings) or flat hairline-divided (Things 3). Things 3 strips Settings to almost nothing — preferences live inline.

**Named exemplars.**
- **Apple Settings** — sectioned cards with 11pt uppercase headers, hairline dividers within card, IconBox 28pt rounded square (tinted to category — blue for general, green for privacy). The benchmark.
- **Things 3 Settings** — sparse: only true-global settings (theme, sync, calendar integration). Per-list settings live on the list (long-press). The model for inline preferences (memory `project_prototype_carryover_rules` already calls inline-preferences).
- **Notion Settings** — flat list with hairline dividers, no IconBox (just label + chevron). Functional, not decorative.

**Behaviour to replicate.**
- **IconBox.** 28pt rounded square (4pt radius), category-tinted background, 16pt glyph centred. Industry consensus iOS.
- **Row layout.** IconBox + label (body weight 500) + sub-label (caption tertiary) + trailing.
- **Section.** 11pt uppercase eyebrow + 8pt gap + card with hairline-divided rows.
- **Inline-first principle.** If it's used >weekly, it shouldn't live in Settings (per architectural audit pattern 3.5).

**Mistakes to avoid.**
- IconBox in flat colour — placeholder-tier.
- Settings as a dump for everything user-configurable — anti-pattern (per architectural audit 4.5).
- No section headers — long flat list, hard to scan.

**Mobile vs web.**
- **Native iOS:** sectioned cards (Apple Settings).
- **Web desktop:** Notion-style flat list with sidebar nav for sections.
- **Mobile web:** sectioned cards matching native.

**Spec status.** `[spec partial]` — §1.5 covers IconBox in icon mapping. **Doesn't cover:** settings-row primitive geometry. **Needs:** a `<SettingsRow>` and `<SettingsSection>` primitive.

---

## 28. Pricing card

**The 2026 bar.** Side-by-side Free vs Pro on desktop, stacked on mobile. Recommended badge ("Most popular") on the recommended tier — small pill anchored top-centre. Feature list with consistent leading glyph (Check for included, X or muted Check for excluded). Trust footer (cancel anytime, payment method, trial details). Dark-mode treatment matches surface depth ladder. CTA tier: Pro = primary filled, Free = secondary or ghost.

**Named exemplars.**
- **Linear pricing** — tiered cards with recommended badge, terse feature list, primary CTA on recommended tier. Free tier secondary. Trust footer ("No credit card required").
- **Notion pricing** — same pattern, more visual hierarchy on recommended tier (taller card or border-accent).
- **Stripe pricing (their own product pages)** — richest treatment, with feature comparison table on hover. Industry-consensus best.

**Behaviour to replicate.**
- **Tier layout.** Side-by-side ≥768px; stacked <768px.
- **Recommended badge.** Top-centre pill, primary fill, white text, "Most popular" copy.
- **Feature list.** Check (included) + label, muted check + struck-through label (excluded). Industry consensus.
- **CTA.** Pro = primary; Free = secondary.
- **Trust footer.** "Cancel anytime · Apple-secured payment · 7-day free trial" (already in spec §1.7).

**Mistakes to avoid.**
- Three-tier pricing for a two-tier product — fake choice.
- Recommended badge on every card — meaningless.
- Strikethrough excluded features that are "X" — don't double-encode "not included".
- Hidden "fine print" — dark pattern.

**Mobile vs web.**
- **Native iOS:** in-app paywall, single screen with comparison table. Apple Pay native CTA.
- **Web desktop:** two-card side-by-side; Stripe Checkout.
- **Mobile web:** stacked cards, identical to native iOS visually.

**Spec status.** `[spec partial]` — §1.7 covers paywall trust footer. Spec mentions pricing in surface G. **Doesn't cover:** recommended-badge and feature-list primitive. **Needs:** a `<PricingCard>` primitive.

---

## 29. Sticky condensed header

**The 2026 bar.** When the page scrolls past the title (Y > 64pt), a sticky condensed header fades in with the page title at body weight. Backdrop blur 12px + 80% surface alpha. Hides on scroll-down momentum > threshold; reveals on scroll-up. Compresses metadata (date, count) into a single line.

**Named exemplars.**
- **Apple Music album page** — large title scrolls out; condensed header with album name fades in at threshold. Backdrop blur. Industry consensus iOS.
- **Things 3 list pages** — large title scrolls under the nav; nav title appears at threshold. Hairline divider appears with the title.
- **Linear issue detail (web)** — page title scrolls; condensed sticky header appears with shortcut keys. Desktop pattern.

**Behaviour to replicate.**
- **Threshold.** Y > 64pt mobile / 80px web.
- **Animation.** Title cross-fades in 150ms; backdrop blur fades in.
- **Compression.** Single-line title + metadata tucked into trailing position.
- **Hide-on-scroll-down.** Optional; if used, threshold velocity > 1500px/s.

**Mistakes to avoid.**
- Sticky header without backdrop blur — text bleeds through.
- Sticky header that takes 30%+ of viewport — over-chrome.
- Two-line sticky header — over-articulated.

**Mobile vs web.**
- **Native iOS:** `LargeTitleNavigationBar` is the system idiom.
- **Web desktop:** custom sticky with `position: sticky` + `backdrop-filter`.
- **Mobile web:** match native.

**Spec status.** `[spec ok]` — §1.1 covers Today date header sticky behaviour (scroll Y > 64 → 44pt sticky header with tabular-nums).

---

## 30. Pinch / zoom / gesture surfaces

**The 2026 bar.** Image viewer: pinch-zoom with rubber-band at zoom limits, double-tap to zoom-in / zoom-out. Scroll-to-top: tap status bar (iOS native). Gesture conflict resolution: vertical scroll wins by default; horizontal gesture only when content is horizontally scrollable. Pinch dismissal (downward swipe to close fullscreen image) is the iOS Photos pattern.

**Named exemplars.**
- **Apple Photos fullscreen** — pinch zoom with rubber-band; double-tap zoom-in to 2× fit; swipe-down to dismiss with parallax. Industry consensus iOS.
- **Pinterest pin detail** — pinch zoom on the pin image; pull-down dismisses with the image scaling-with-finger. Continuous geometry.
- **Apple Maps** — pinch zoom + two-finger rotate + drag pan. Gesture conflict resolution: pan when no zoom-in-progress, zoom when two fingers.

**Behaviour to replicate.**
- **Pinch zoom.** 1× to 4× range; rubber-band beyond limits. Reanimated `withSpring` for return.
- **Double-tap.** Zoom-in to 2× at tap location; double-tap again returns to 1×.
- **Dismiss gesture.** Swipe-down on fullscreen image; image scales with finger; releases > 30% threshold dismisses.
- **Scroll-to-top.** iOS: tap status bar (system). Web: top-right "↑" or scroll-to-top FAB on long pages.

**Mistakes to avoid.**
- No zoom on recipe / detail images — frustrating for visually rich content.
- Double-tap conflicts with double-tap-to-like — assign one or the other to image surface.
- Dismiss gesture that fights vertical scroll — gesture conflict.

**Mobile vs web.**
- **Native iOS:** `UIScrollView` + `UIPinchGestureRecognizer` system. RN: `react-native-gesture-handler`.
- **Web desktop:** less critical; image lightbox with click-to-zoom and ESC to close.
- **Mobile web:** touch-action: none + Reanimated equivalent. Frequently broken on mobile-web.

**Spec status.** `[spec gap]` — spec doesn't address image viewer or pinch surfaces.

---

## Top 30 specific upgrades — ranked

Ordered by leverage (impact ÷ ship cost). Each item links back to the pattern catalogue above and flags spec status.

| # | Upgrade | Pattern | Impact | Cost | Spec status |
|---|---|---|---|---|---|
| 1 | Define a `<Button>` primitive with primary/secondary/ghost/destructive × idle/hover/press/disabled/loading | §1, §2 | Very high | Medium | `[spec gap]` |
| 2 | Define `<EmptyState>` primitive with 6 canonical states + illustration system | §11 | Very high | Medium | `[spec partial]` |
| 3 | Define `<Skeleton>` + cold-vs-warm paint policy | §12 | High | Low | `[spec gap]` |
| 4 | Define `<ErrorState>` with network/app/validation taxonomy + retire "Oops!" | §13 | High | Low | `[spec partial]` |
| 5 | Define `<Toast>` primitive with action/undo + 5s window | §10, §25 | High | Low | `[spec gap]` |
| 6 | Define `<ListRow>` primitive with leading/trailing slots + swipe + long-press | §15 | High | Medium | `[spec gap]` |
| 7 | Define `<Avatar>` primitive with 4-tier sizes + gradient-monogram fallback | §16 | High | Low | `[spec gap]` |
| 8 | Define `<Chip>` primitive (separate from `<TrustChip>`) for filter / tag / dismiss | §6 | High | Low | `[spec partial]` |
| 9 | Define `<Input>` primitive with focus/error/disabled + autofill tokens + on-blur validation | §8 | High | Medium | `[spec gap]` |
| 10 | Define `<PillTabs>` for sub-tab navigation with sliding-bg + spring | §5 | High | Low | `[spec gap]` |
| 11 | Define `<IconButton>` primitive with hit-slop default + accessibilityLabel as required prop | §3 | High | Low | `[spec partial]` |
| 12 | Define `<SettingsRow>` + `<SettingsSection>` with IconBox + sectioned cards | §27 | Medium | Low | `[spec partial]` |
| 13 | Define `<SearchBar>` with focus-expand + recent history + 250ms debounce | §17 | Medium | Medium | `[spec gap]` |
| 14 | Define `<Switch>` and `<Segmented>` matching iOS spring physics + haptic | §14 | Medium | Low | `[spec gap]` |
| 15 | Define `<AnimatedNumber>` for hero count-up + locale-aware formatter | §20 | Medium | Low | `[spec partial]` |
| 16 | Define `formatDate(value, context)` utility with relative/absolute switch | §21 | Medium | Low | `[spec gap]` |
| 17 | Define `<Card>` primitive applying depth + interaction states | §7 | Medium | Low | `[spec partial]` |
| 18 | Define `<PricingCard>` with recommended badge + feature list + trust footer | §28 | Medium | Low | `[spec partial]` |
| 19 | Tab bar active-state rule: filled glyph + accent tint + label semibold (not all three signals) | §4 | Medium | Low | `[spec partial]` |
| 20 | Settings inline-first audit — move ≥3 items used >weekly out of Settings | §27 + arch. audit 7.5 | Medium | Medium | covered in arch. audit |
| 21 | Define `<StickyCTABar>` for sticky bottom action + safe-area inset | §19 | Medium | Low | `[spec gap]` |
| 22 | Define `<SyncIndicator>` + offline banner pattern | §23 | Medium | Low | `[spec gap]` |
| 23 | Confirm-vs-undo decision tree (delete = undo toast; catastrophic = sheet) | §25 | Medium | Low | `[spec partial]` |
| 24 | Pull-to-refresh: brand-aligned indicator + haptic at threshold | §18 | Low | Low | `[spec gap]` |
| 25 | Image viewer: pinch + double-tap + swipe-down dismiss for recipe hero images | §30 | Low | Medium | `[spec gap]` |
| 26 | `<Badge>` primitive (red dot vs numeric pill) + parent-surface border | §24 | Low | Low | `[spec gap]` |
| 27 | Lint: ad-hoc font sizes + ad-hoc shadow rules + ad-hoc colour literals | §1.1, §1.2 | Low | Medium | `[spec partial]` |
| 28 | Onboarding step transition motion spec (slide 24pt + 250ms `--ease-pm`) | §26 | Low | Low | `[spec partial]` |
| 29 | `<Card>` press scale 0.98 + hover lift 4pt + shadow tier-up — explicit on web | §7 | Low | Low | `[spec partial]` |
| 30 | Number formatter: locale-aware comma/decimal separators + K/M for tight contexts | §20 | Low | Low | `[spec gap]` |

---

## Cross-reference to production spec

The production spec (`docs/specs/2026-04-27-production-design-spec.md`) covers **foundation** (motion, type, depth, dark, icons, source, voice, a11y) and **surfaces** (Today, Log, Recipes, Plan, You, Onboarding, Pricing, Recipe detail). It is **adequate** for:

- §9 Sheet / modal / drawer (snap points, handle, backdrop, spring, interruptibility, reduce-motion all specified)
- §22 Progress visualisation (ring fill 600ms `--ease-spring-soft`, target-cross to amber after fill)
- §29 Sticky condensed header (Today date header at Y > 64)

It is **partial** on (covers some, lacks others):

- §1 Primary CTA — FAB tap covered, but no full primary/secondary/ghost taxonomy
- §3 Icon-only buttons — touch target floor + icon size tokens, but no press feedback
- §4 Tab bar — cross-fade timing yes, active-state visual treatment no
- §6 Chip — `<TrustChip>` defined, but no generic filter/tag chip
- §7 Card primitive — depth ladder yes, press/hover states no
- §11 Empty state — voice rules yes, illustration system + 6-state taxonomy no
- §13 Error state — voice yes, retry/report taxonomy no
- §20 Numeric values — tabular-nums yes, count-up policy + locale formatter no
- §25 Confirmation flows — destructive copy yes, undo policy no
- §26 Onboarding step transitions — voice yes, motion spec no
- §27 Settings rows — IconBox iconography yes, sectioned-card primitive no
- §28 Pricing card — trust footer voice yes, recommended-badge + feature-list primitive no

It has **gaps** (no coverage):

- §2 Secondary / ghost CTAs (no taxonomy)
- §5 Sub-tab pill bar
- §8 Input field
- §10 Toast / snackbar
- §12 Loading state (skeleton primitive)
- §14 Toggle / switch / segmented
- §15 List row primitive
- §16 Avatar primitive
- §17 Search bar primitive
- §18 Pull-to-refresh
- §19 Bottom action bar
- §21 Date / time formatter
- §23 Status indicators
- §24 Notifications / badges
- §30 Pinch / zoom / gesture surfaces

---

## Confidence

- **Well-evidenced (industry consensus, observable on shipping apps):** §1 (CTA shapes), §4 (tab bar active state), §7 (card depth ladder), §9 (sheet primitive), §10 (toast position + duration), §13 (error voice retire "Oops!"), §14 (iOS Switch geometry), §20 (tabular-nums), §22 (Apple Fitness ring as benchmark).
- **Strong consensus with minor variation:** §5 (sub-tab pill bar — Linear, Notion Calendar, Apple Fitness all converge), §6 (chip selected/unselected), §8 (on-blur validation), §11 (six empty-state taxonomy), §12 (skeleton vs spinner policy), §15 (swipe + long-press), §25 (action-verb CTAs), §27 (sectioned settings).
- **My recommendation, not consensus:** §6 (Airbnb's underline-on-selected works for white surfaces only — flagged), §13 (whimsical errors — not for primary-loop failures), §18 (custom indicator over system spinner), §24 (red-dot vs numeric distinction).
- **Inferred from spec / brand guidelines (no first-hand 2026 observation):** specific timing values where I'd benchmarked from Apple HIG or Material 3 Expressive but didn't measure on a current build.

---

## Reference apps cited

- **Linear** — `linear.app`
- **Things 3** — `culturedcode.com/things`
- **Apple Fitness** — iOS system app
- **Cash App** — `cash.app`
- **Notion Calendar** — `notion.com/product/calendar`
- **Strava** — `strava.com`
- **Arc Browser** — `arc.net`
- **Pinterest** — `pinterest.com` (Gestalt: `gestalt.pinterest.systems`)
- **Airbnb** — `airbnb.com` (design language: `airbnb.design`)
- **Robinhood** — `robinhood.com`
- **Stripe Dashboard** — `dashboard.stripe.com` (Elements: `stripe.com/docs/elements`)
- **Notion** — `notion.com`
- **Apple Music** — iOS system app
- **Apple Wallet** — iOS system app
- **Apple Mail** — iOS system app
- **Apple Notes** — iOS system app
- **Monzo** — `monzo.com`
- **Revolut** — `revolut.com`
- **Substack** — `substack.com`
- **TikTok** — `tiktok.com`
- **Shadcn/ui (Vaul)** — `ui.shadcn.com` / `vaul.emilkowal.ski`
- **Apple HIG** — `developer.apple.com/design/human-interface-guidelines`
- **Material 3 Expressive (May 2025)** — `m3.material.io`

