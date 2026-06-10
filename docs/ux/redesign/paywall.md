# Paywall & Monetisation — Best-in-Class Redesign Spec

**Surface:** Paywall & monetisation (pricing, Free vs Pro, upgrade triggers)
**Spec date:** 2026-06-02
**Status:** Design spec — not yet implemented
**Related audit:** Input A (functional inventory, evidence-grounded) + Input B (Mobbin-validated benchmarks)
**Functionality gate:** every feature, gate, limit, event, and entitlement logic item listed in the audit MUST survive unchanged. This spec is an aesthetic and information-architecture elevation only.

---

## 1. Surface overview

### Purpose

Convert Free users to Pro at the point of genuine intent, without pressure tactics. Communicate the value of Pro honestly and completely. Support the subscription lifecycle (upgrade, trial, restore, manage, downgrade).

### Role in the product

Monetisation is the fuel for everything else. The paywall surface must:
- Reflect Suppr's "permission not restriction" positioning — track what you love, Pro makes it limitless.
- Trust-maximise before conversion, not after — if the user doubts the renewal terms, they cancel the day they forget. The CMA-compliant disclosure and trust chips are a differentiator, not clutter.
- Never feel coercive. No countdowns, no fake scarcity, no spin-wheels. Suppr benchmarks exclusively against honest premium tools (MacroFactor, Julienne, AllTrails, Oura) — not Cal AI's coercive patterns.

### Navigation entry points (all preserved)

**Mobile:** deep link `suppr:///paywall`; `/paywall?from=<surface>` route; tapping AI features as Free; recipe-save cap alert; planner day-count gate; cookbook import gate; Settings → Membership card. Accepted `from` values: `voice_log`, `photo_log`, `settings`, `onboarding`, `trial_end`, `deep_link`, `recipes_library`, `shopping_list`, `profile`, `recipe_create`, `recipe_import`, `meal_planner`.

**Web:** `/pricing?from=<surface>`; AI logging dialog gate; upgrade prompt in Settings; checkout success receipt at `/checkout/success`; account billing at `/account/billing`.

---

## 2. Current design audit

### 2a. Mobile full paywall (`paywall.tsx`)

**Strengths in the current design (keep exactly):**
- CMA-compliant auto-renew disclosure with cadence-in-days (not stale calendar date) — ahead of every Mobbin app in the corpus.
- Nutrition-estimate note: "Nutrition values are estimates — always review before saving." — honest, differentiating.
- Trust chips: "Cancel anytime in App Store" + "7-day refund, no email needed" + "Price never changes mid-trial" — exceeds Julienne (which has none of these).
- Persistent "Restore purchases" footer — correct premium-bar behaviour.
- Computed (not hardcoded) savings badge — no stale "Save 37%" drift.
- Optimistic Pro card with FALLBACK_PRICES while RC loads + App Store escape hatch on empty offerings — best-in-class StoreKit failure handling.
- Poll-until-entitled with "Almost there" fallback (ENG-684).
- `paywall-default-monthly` flag controlling billing default (ENG-698).
- Trial applies to annual only — `trialApplies = billing === "annual"`.
- CTA colour semantics: success green for trial, terracotta primary otherwise — correct per locked palette.

**Weaknesses in the current design (address in redesign):**
1. **Hero is flat** — no food photography at the top. Julienne opens with a full-bleed hyperreal ceramic-bowl grid. This is the single highest-leverage visual gap.
2. **Typography is sans-only** — 32pt price numeral in Inter. Julienne/the design system calls for Fraunces/Newsreader (serif display) for big numerals, editorial titles, and section headers. The paywall title is the most prominent editorial text in the product and it's in a sans.
3. **TierCard period selection** — selected state uses basic `borderColor`. Julienne's unselected-terracotta-tint / selected-white-with-ring treatment is warmer, clearer, and on-brand.
4. **Trial timeline** — 4 steps exist in `TIMELINE` but are rendered as a simple list. The Headway/stoic. connected-vertical-line with lock→bell→star icon nodes is the corpus standard for trust maximisation here. Missing: "Remind me before trial ends" toggle (Vocabulary pattern) — a concrete trust gesture absent from every Julienne and MacroFactor screen.
5. **Pro feature list** — bullet list only, no Free-vs-Pro matrix. Users cannot see what Free retains. This reads as "Free is restricted" rather than "Pro is expanded" — contradicts the permission-not-restriction positioning.
6. **Period toggle** — savings badge is present but rendered as plain text. A sage or terracotta pill on the Annual segment (Mindvalley) reads better. Absolute-currency saving alongside the percentage ("save £35.89/yr") would land harder (Everyday Rewards) — Suppr already computes the reference line, this is a copy elevation only.
7. **Loading state** — optimistic card is correct but its typography will look mismatched after the hero + serif upgrade. Restyle in tandem.
8. **Promo expander** — functional and correct; only needs typography/spacing alignment with the new card treatment.

### 2b. Web pricing page (`/pricing`)

**Strengths:**
- Tier grid with monthly/annual toggle, shared SSOT with mobile (`pricingTiers.ts`).
- `CurrentTierBadge` — shows entitlement without making entitled users feel they're being sold to.
- `PaywallTrustStrip` — trust signals exist on web.
- `PromoCodeBlock` — parity with mobile promo expander.

**Weaknesses:**
1. **Off-brand colours (real drift):** `CheckoutButton.tsx:80` uses `from-violet-600 to-indigo-600`. Hero gradient `#588CE4 → #DF5EBC`. Trust-icon tokens are `var(--macro-*)`. None of these match the locked palette (terracotta `#C2683E`, sage `#7C8466`, white base, warm near-black). This is not a style preference — it is palette drift that violates the locked design system.
2. **No food photography** — same gap as mobile. The Julienne benchmark requires a hyperreal finished-dish hero at the top of the pricing surface.
3. **Serif typography absent** — web pricing page uses sans throughout. Pricing headline should be Fraunces/Newsreader (serif display).
4. **No trial timeline block** — web `/pricing` has no equivalent to the mobile trial timeline. Intentional divergence (web has no IAP trial concept), but the trust message ("your first charge is after 7 days for annual") should still surface prominently on the annual toggle state.
5. **AI paywall copy bug (parity gap):** `ai-paywall-dialog.tsx:68` says "unlimited AI photo logging (100/day)". Mobile's `AiPaywallSheet.tsx:75` correctly says "up to 100 a day". Web is stale — fix in the same implementation commit.

### 2c. In-flow AI gate (`AiPaywallSheet` / `ai-paywall-dialog`)

**Strengths:** fires `ai_paywall_sheet_viewed/dismissed/cta_tapped`; context-aware copy (voice vs photo); bottom-sheet (mobile-native); dialog (web-native).

**Weaknesses:** current styling is functional but not warm-coach editorial. The X-pattern (tight, serif one-liner, two-row icon list, terracotta CTA + quiet "Maybe later") is cleaner and more on-brand.

### 2d. Settings → Membership card

**Strengths:** shows current tier, cached-tier anti-flash (AsyncStorage), `presentCustomerCenter()` escape to RevenueCat. Web equivalent at `/account/billing`.

**Weaknesses:** card is a standard row list without the Future-pattern "Active" status prominence, renewal date, or the tasteful Free-user upsell ("Save 37% with annual → upgrade") (Uber Eats pattern). The information hierarchy undersells the Pro status for entitled users and under-prompts Free users.

---

## 3. Component redesign specs

### 3a. Full paywall — mobile (`paywall.tsx`)

#### Hero block

**Current purpose:** kicker + title + subtitle text only.

**Current weaknesses:** flat, no imagery, generic.

**Best-in-class benchmark:** Julienne Pro paywall — https://mobbin.com/screens/3cbc1928-a4e0-4ab6-83a7-4ce825088e67 — full-bleed hyperreal ceramic-bowl food-photography grid, serif display headline, editorial feel before a single word of feature copy.

**Proposed redesign:**

```
[ Full-bleed horizontal image strip ]
  3–4 hyperreal finished-dish photographs
  per the locked IMAGERY RULE:
  ceramic bowls, linen, shallow DoF, natural light
  moody / @_foodstories_ aesthetic
  height: ~240pt (44% of visible screen before scroll)
  top: safe-area flush
  bottom: 24pt gradient fade to white (#FFFFFF)

[ Kicker — over-image or immediately below fade ]
  "SUPPR PRO" / "CHOOSE YOUR PLAN"
  Font: Inter 11pt, letter-spacing 0.08em, uppercase
  Color: #7C8466 (sage)

[ Display title ]
  Context-adaptive (existing logic preserved verbatim):
    trial_end  → "Your trial ended — pick a plan"
    voice/photo → "Unlock AI logging"
    trial applies → "Try Pro free for 7 days"
    else → "Pick the plan that fits"
  Font: Fraunces or Newsreader, 28pt, weight 600
  Color: #1B1814 (warm near-black)
  Max width: 300pt, left-aligned

[ Subtitle ]
  Existing logic preserved verbatim.
  Font: Inter, 15pt, weight 400
  Color: #1B1814 at 60% opacity
  margin-top: 6pt
```

**User benefit:** creates emotional desire (the food looks achievable and delicious) before rational comparison begins. Julienne's conversion improvement on this pattern is industry-confirmed.

---

#### Billing toggle

**Current purpose:** segmented Monthly/Annual control with savings badge.

**Current weaknesses:** badge is plain text; savings stated as percentage only.

**Best-in-class benchmark:** Mindvalley — https://mobbin.com/screens/d407f2c0-1f79-4ced-a972-8f1e2ed242f3 — badge riding on the active segment. Everyday Rewards — https://mobbin.com/screens/ce1bd7b8-93f3-4554-9aeb-d9f652fa2b20 — absolute-currency saving stated alongside percentage.

**Proposed redesign:**

```
[ "BILLING" eyebrow — Inter 11pt, sage, letter-spacing 0.08em ]

[ Segmented control ]
  Background: #F6F5F2 (warm-grey)
  Selected segment: white, hairline border #ECEAE4, radius 8pt
  Font: Inter 14pt weight 500

  Monthly segment:  "Monthly"
  Annual segment:   "Annual  [Save 37%]"
                    Badge: 11pt Inter, terracotta #C2683E pill
                    on the right of the label text
  Computed badge value: computeAnnualSavingsBadge() — never hardcoded

[ Annual reference line — visible below toggle when Annual is selected ]
  Computed: computeAnnualReferenceLine()
  e.g. "£2.50/mo · save £35.89 vs monthly"
  Font: Inter 13pt, #1B1814 at 55%
  Both percentage AND absolute currency — per Everyday Rewards pattern
  Logic: (monthly price × 12) − annual price → displayed as "save £X.XX/yr"
  Source: derived from RC priceStrings, same derivation already in paywall.tsx:182
  No new hardcoding; upgrade the copy template only
```

**Interactions:** toggle fires `paywall_period_changed {fromPeriod, toPeriod}` — unchanged.

**States:**
- Both periods provisioned: segmented control with badge on Annual.
- Only monthly provisioned: toggle hidden, monthly locked in (`showToggle = false` — existing logic preserved).
- Only annual provisioned: toggle hidden, annual locked in.

---

#### TierCard (billing period selection)

**Current purpose:** show price, features, CTA per period option.

**Current weaknesses:** serif absent from 32pt price numeral; selected/unselected state is hairline-only; trust chips inside card are text-dense without visual breathing room.

**Best-in-class benchmark:** Julienne selected-monthly — https://mobbin.com/screens/5179d225-985a-4e87-8be0-e58880f5709e — unselected card in a warm terracotta-peach tint, selected in white with ring.

**Proposed redesign:**

```
[ TierCard — selected state ]
  Background: #FFFFFF
  Border: 2pt solid #C2683E (terracotta)
  Border radius: 16pt
  Shadow: 0 2pt 12pt rgba(27,24,20,0.08)
  Padding: 20pt

[ TierCard — unselected state ]
  Background: rgba(194,104,62,0.06)   (terracotta at 6% — warm tint)
  Border: 1pt solid #ECEAE4
  Border radius: 16pt
  Padding: 20pt

[ Price numeral ]
  "£7.99" / "£59.99"
  Font: Fraunces 32pt weight 700
  Color: #1B1814

[ Period suffix ]
  "/month" / "/year"
  Font: Inter 14pt weight 400
  Color: #1B1814 at 60%
  Vertical-aligned: baseline of price numeral

[ Savings badge — annual card only ]
  Computed value, terracotta pill
  Same as toggle badge above

[ Reference line ]
  computeAnnualReferenceLine() — Inter 13pt, sage #7C8466

[ Trust chips ]
  Sourced from getPaywallTrustChips("mobile") — PRESERVED VERBATIM
  Layout: horizontal pill row (3 chips)
  Font: Inter 12pt
  Background per chip: #F6F5F2
  Border: 1pt #ECEAE4
  Icon: lucide-react-native check or shield, 14pt, sage

[ Feature list ]
  Only on Pro card
  Each item: lucide Check icon (16pt, success-green #5E7C5A) + Inter 14pt label
  See §3e (value ladder) for the recommended ordering

[ Tag — "Most popular" / trial label ]
  Terracotta pill, Inter 11pt, top-right corner of card

[ CTA button ]
  Height: 52pt
  Border-radius: 26pt (pill)
  States:
    Loading:        disabled, bg #F6F5F2, text "Loading plans…", Inter 15pt
    Trial:          bg #5E7C5A (success green), text "Start 7-Day Free Trial"
    Subscribe:      bg #C2683E (terracotta), text "Subscribe — {price}{suffix}"
    Open App Store: bg #C2683E, text "Open App Store to subscribe"
  Font: Inter 15pt weight 600, white
  Full-width within card
```

**All CTA label logic and colour semantics (`paywall.tsx:1299`) — preserved verbatim.**

---

#### Trial timeline (annual-only block)

**Current purpose:** 4 steps communicating the trial → charge flow.

**Current weaknesses:** rendered as a flat list; no connected visual spine; missing "remind me" toggle.

**Best-in-class benchmark:** Headway — https://mobbin.com/screens/c550c1aa-b7d4-4b06-b4f3-ef448c07419f — connected vertical line, icon tiles, step labels. Vocabulary — https://mobbin.com/screens/7d58ffe7-1c7d-4272-a768-894e7bd8a823 — "Reminder before trial ends" toggle converts passive disclosure into active trust gesture.

**Proposed redesign:**

```
[ Section eyebrow ]
  "YOUR TRIAL"  Inter 11pt, sage, letter-spacing 0.08em

[ Connected vertical timeline ]
  Left rail: 2pt #ECEAE4 vertical line
  Four nodes (existing TIMELINE steps mapped 1:1):

  Node 1 — Today
    Icon: lock-open (lucide), 18pt circle, bg #C2683E (terracotta), white icon
    Label (Fraunces 15pt): "Targets set"
    Desc (Inter 13pt, #1B1814 60%): "Full Pro access starts now — no charge."

  Node 2 — Day 3 (approx)
    Icon: star (lucide), 18pt circle, bg #7C8466 (sage), white icon
    Label: "Start importing recipes"
    Desc: "Build your plan with unlimited saves."

  Node 3 — Day 5 (approx)
    Icon: bell (lucide), 18pt circle, bg #7C8466, white icon
    Label: "Save & plan"
    Desc: "Your meal plan is synced and ready."

  Node 4 — Day 7
    Icon: calendar (lucide), 18pt circle, bg #1B1814, white icon
    Label: "Trial ends"
    Desc: "First charge today unless you cancel in iOS Settings."

  Step-label font: Fraunces 15pt, #1B1814
  Step-desc font: Inter 13pt, #1B1814 at 60%
  Node spacing: 20pt vertical between nodes
  Left margin of text from rail: 16pt

[ "Remind me before trial ends" toggle ]
  Positioned immediately below node 4
  Label (Inter 14pt, #1B1814): "Remind me before trial ends"
  Toggle: system-native UISwitch equivalent (React Native Switch)
  Default: ON
  On change: schedule a local push notification for Day 5 (Expo Notifications API)
  Note: this is net-additive trust — it does not gate the purchase flow.
         If notification permission is denied, the toggle is hidden silently.
         No new Linear ticket required for MVP; the toggle failing gracefully
         is acceptable for v1. If the notification scheduling API is not yet
         wired, add a Linear issue and reference it with:
         // reminder-toggle: see ENG-NNN — intentionally deferred, graceful fallback
```

**CRITICAL — preserved from current:** cadence-in-days language only. Never a rendered calendar date. The Suppr implementation is ahead of Headway/Brilliant/stoic. on this trust dimension — do NOT regress.

---

#### Pro feature list + Free-vs-Pro matrix

**Current purpose:** bullet list of Pro features inside the Pro TierCard.

**Current weaknesses:** Pro-only framing reads as restriction; user cannot see that Free is genuinely useful.

**Best-in-class benchmark:** MacroFactor value ladder — https://mobbin.com/screens/e9407ecc-461d-4304-b8a3-169a92d77f1d — capability-dense, plain-English, proves depth. AllTrails tier matrix — https://mobbin.com/screens/bb697704-c06f-4ea7-b23c-2904384a43f5 — two-column check matrix with recommended tier column tinted, Free's checkmarks visible.

**Proposed redesign:**

The Pro TierCard retains its existing feature list (MacroFactor-style capability framing). Below the TierCard(s), add an **expandable Free-vs-Pro matrix** — collapsed by default to keep the primary CTA visible, expanded on tap.

```
[ "WHAT'S INCLUDED" eyebrow — tap to expand ]
  Inter 11pt, sage, letter-spacing 0.08em
  Chevron icon (lucide, 14pt) on right, animated rotate on expand

[ Collapsed state ]
  Two-line teaser: "Free includes barcode, import, adaptive TDEE + more.
                    Pro adds unlimited saves, multi-day plans & AI logging."
  Inter 13pt, #1B1814 at 60%

[ Expanded matrix ]
  Two columns: Free | Pro
  Column headers: Inter 13pt weight 600
  Pro column header: terracotta #C2683E, background rgba(194,104,62,0.06)
  Free column header: #1B1814 at 60%

  Rows — each feature per §8 of the audit (preserved verbatim):
  ┌─────────────────────────────────┬──────┬──────┐
  │ Feature                         │ Free │ Pro  │
  ├─────────────────────────────────┼──────┼──────┤
  │ Saved recipes                   │  10  │  ∞   │
  │ Meal plan span                  │ 1 day│3 / 7d│
  │ Shopping list from plan         │  —   │  ✓   │
  │ Publish to community            │  —   │  ✓   │
  │ AI photo logging                │5/wk  │100/d │
  │ Voice logging                   │  —   │100/d │
  │ Adaptive TDEE                   │  ✓   │  ✓   │
  │ Barcode + recipe import         │  ✓   │  ✓   │
  │ Cook mode + timers              │  ✓   │  ✓   │
  │ Fiber + water tracking          │  ✓   │  ✓   │
  │ Apple Health sync (iOS)         │  ✓   │  ✓   │
  │ Export JSON                     │  ✓   │  ✓   │
  │ Priority email support          │  —   │  ✓   │
  └─────────────────────────────────┴──────┴──────┘

  Check icon: lucide Check, 14pt, success-green for ✓; em-dash for absent
  Row font: Inter 13pt, #1B1814
  Row height: 36pt; hairline separator #ECEAE4
  Pro column: bg rgba(194,104,62,0.04)
```

**Important:** showing Free's many checkmarks is intentional. It reinforces "Free is genuinely useful — Pro extends it" per the permission-not-restriction positioning. Do not suppress the Free column.

**All feature limits (10 saves, 5-per-7-day photo, 1-day plan, voice=Pro-only) are displayed exactly as they exist in the product.** Display values must be derived from constants (`FREE_SAVE_LIMIT`, `FREE_PHOTO_LOG_WEEKLY_LIMIT`), not hardcoded in the matrix. See §9 (parity gap 7) — the `FREE_SAVE_LIMIT` duplication risk is a pre-existing issue; the matrix must read from the SSOT.

---

#### Auto-renew disclosure

**Current purpose:** UK CMA-compliant renewal terms.

**Current strengths:** cadence-in-days (not calendar date), auto-renew-until-cancelled, cancel path, 7-day refund address, VAT note. PRESERVED VERBATIM.

**Proposed restyling only:**
```
Font: Inter 11pt, #1B1814 at 45%
Max-width: 320pt, centred
margin-top: 16pt below CTA
Line-height: 1.5
```

No copy changes. No logic changes. The disclosure is a legal surface — editing it requires legal review.

---

#### "No payment now" chip (new, above CTA)

**Best-in-class benchmark:** Cal AI "No Payment Due Now" — https://mobbin.com/screens/6e269857-5e29-4c86-8d0a-8b0961d10c53 — one of the highest-converting honesty signals in the corpus.

**Proposed addition (trial state only — when `trialApplies === true`):**

```
[ Chip above CTA ]
  Text: "No payment due now — first charge on Day 7"
  Font: Inter 12pt weight 500
  Color: success-green #5E7C5A
  Background: rgba(94,124,90,0.08)
  Border: 1pt solid rgba(94,124,90,0.3)
  Border-radius: 12pt
  Padding: 6pt 12pt
  Centred above CTA button
```

This surfaces the existing disclosure content one level up in the hierarchy. No logic change — it reads from `trialApplies` which already exists.

---

#### Continue for free / secondary rail / persistent restore footer

**Current behaviour — PRESERVED VERBATIM:**
- "Continue for free" text button → `/notifications-prompt`
- "Restore purchases · Terms · Privacy" secondary rail
- "Payments handled by the App Store." subtext
- Persistent "Restore purchases" footer pinned at bottom

**Restyling only:**
```
"Continue for free": Inter 14pt, #1B1814 at 50%, centred, padding-top 12pt
Secondary rail: Inter 12pt, #7C8466, centred
Persistent footer: white background, hairline top border #ECEAE4,
                   safe-area bottom inset, Inter 14pt, terracotta #C2683E
```

---

#### Loading state

**Current behaviour:** optimistic Pro card with FALLBACK_PRICES, CTA disabled "Loading plans…". App Store escape hatch on empty offerings. PRESERVED VERBATIM.

**Restyling:** apply new TierCard typography (Fraunces price numeral, terracotta/sage trust chips) to the optimistic card so the loading → loaded transition is visually seamless. The CTA remains disabled and "Loading plans…" until `offeringsReady`.

---

#### Error / purchase-failed states

**Current behaviour:** "Purchase failed. Please try again later." alert. Restore → "No active subscription found" / "Restore failed". Poll-until-entitled "Almost there" alert with Restore CTA. PRESERVED VERBATIM.

---

#### Empty offerings state

**Current behaviour:** renders Pro value ladder + CTA "Open App Store to subscribe" → `itms-apps://.../subscriptions`. PRESERVED VERBATIM. This is best-in-class StoreKit failure handling — do not change.

---

### 3b. In-flow AI gate — mobile (`AiPaywallSheet`)

#### Purpose
Convert Free users tapping Voice or AI Photo at the exact moment of intent — without pulling them fully out of the Today flow.

#### Current weaknesses
Generic styled sheet; sans-only; copy has minor voice inconsistency vs web.

#### Best-in-class benchmark
X (Twitter) "Unlock offline videos with Premium" — https://mobbin.com/screens/75cb81aa-fece-4712-8091-5bd61675d5cb — tight sheet, one-line serif value headline, two-button (Upgrade / Maybe later), zero friction.

#### Proposed redesign

```
[ Bottom sheet — modal presentation ]
  Background: #FFFFFF
  Corner radius: 24pt (top corners only)
  Handle: 4pt × 32pt, #ECEAE4, centred, 12pt from top

[ Feature icon ]
  60pt circle, background rgba(194,104,62,0.1)
  Icon: Camera (photo context) or Mic (voice context)
        lucide-react-native, 28pt, terracotta #C2683E
  Centred, margin-top 24pt

[ Value headline ]
  Context-adaptive (existing FEATURE_COPY logic PRESERVED VERBATIM):
    photo_log: "Unlock AI food recognition"
    voice_log: "Unlock voice logging"
  Font: Fraunces 22pt weight 600, #1B1814
  Centred, margin-top 12pt

[ Feature row list — 2–3 items ]
  Each: lucide Check (14pt, success-green) + Inter 14pt label
  photo_log rows:
    "Up to 100 photo logs per day"      ← CORRECTED from "unlimited" — see parity gap §9.2
    "Snap any meal for instant macros"
    "Confidence score on every estimate"
  voice_log rows:
    "Up to 100 voice logs per day"
    "Natural language — say it, it logs it"
    "Full Pro access across all features"
  margin-top: 16pt; row-gap: 10pt; left-aligned with icon

[ Upgrade CTA ]
  Same spec as full paywall CTA — terracotta pill, 52pt, full-width
  Text: "Upgrade to Pro"
  margin-top: 24pt

[ "Maybe later" secondary button ]
  Text: "Maybe later"
  Font: Inter 14pt, #1B1814 at 50%
  Tap: fires ai_paywall_sheet_dismissed {feature, action: "maybe_later"} then dismiss
  margin-top: 12pt

[ Bottom safe-area padding ]
```

**All `ai_paywall_sheet_viewed / dismissed / cta_tapped` events PRESERVED with identical properties.**

**Feature copy SSOT (`FEATURE_COPY` object in `AiPaywallSheet.tsx`) — PRESERVED. Only the "unlimited AI photo logging (100/day)" string is corrected to "Up to 100 photo logs per day" to match mobile's existing honest wording.** This correction must be made on web simultaneously (see §3d).

---

### 3c. Full paywall — web (`/pricing`)

#### Palette correction (blocker — not a redesign preference, a bug)

Fix before any visual redesign work:
- `CheckoutButton.tsx:80`: remove `from-violet-600 to-indigo-600`; replace with `bg-[#C2683E]` (terracotta) or the Tailwind alias `bg-accent-primary`.
- `app/pricing/page.tsx:182`: remove `#588CE4 → #DF5EBC` gradient hero. Replace with white (#FFFFFF) base + food-photography hero strip (see §3c below).
- Trust-icon tokens (`var(--macro-*)`): replace with semantic tokens from the design system. Use `--color-sage` for secondary icons, `--color-terracotta` for primary actions. Do not use nutrition-macro colour tokens for non-nutrition UI.

#### Hero

Same editorial intent as mobile — full-width hyperreal finished-dish photography strip (2–3 images, equal-width columns), 320px tall, gradient fade to white at bottom. Immediately below: serif display headline ("Cook what you love. Fit it to your goals.") — Fraunces/Newsreader, 36px, `#1B1814`. Subhead in Inter 18px at 60% opacity.

#### Tier grid (`PricingTiersGrid`)

- Two columns: Free | Pro.
- Pro column: white card, 2px terracotta border, subtle shadow; Free column: #F6F5F2 background, 1px #ECEAE4 border.
- Price numeral: Fraunces 40px weight 700, `#1B1814`.
- Monthly/annual toggle: same Mindvalley-derived pill pattern as mobile — "Save 37%" sage/terracotta pill on Annual segment.
- "Save £X.XX/yr" absolute-currency line below the toggle (same derivation as mobile reference line).
- Feature list: AllTrails-style two-column check matrix (same rows as §3a, derived from same SSOT constants).
- `CurrentTierBadge` — keep exactly; only restyle (sage background, Inter 12px, check icon).

#### Trust strip (`PaywallTrustStrip`)

Keep content verbatim. Restyle: 3 horizontal chips (same spec as mobile trust chips), centred below tier grid, Inter 13px, sage/terracotta.

#### CTA (`CheckoutButton`)

- Terracotta pill CTA matching mobile spec.
- Free user logged out → `/login?redirect=/pricing` — PRESERVED.
- Free user logged in → POST `/api/stripe/checkout {tier, period}` — PRESERVED.
- Already entitled → `CurrentTierBadge` replaces CTA — PRESERVED.

#### VAT note

`resolveRenderedVatNote` logic — PRESERVED VERBATIM. "Includes VAT" when `STRIPE_TAX_ENABLED`; "Excludes taxes" when not. EUR "coming soon" message — PRESERVED.

#### Annual trial disclosure (web — no IAP)

Web has no 7-day free trial (IAP-only). When annual is selected, show a contextual note: "Annual plans renew automatically. Cancel any time from your account." Inter 12px, #1B1814 at 45%. No timeline block (no trial concept on web — intentional documented divergence).

---

### 3d. Web AI paywall dialog (`ai-paywall-dialog.tsx`) — parity fix

**Parity bug (Input A §9.2):** `ai-paywall-dialog.tsx:68` says "unlimited AI photo logging (100/day)". Mobile says "up to 100 a day".

**Fix:** change the string to "Up to 100 AI photo logs per day" — same honest wording, same character count (no layout impact). This is a copy correction, not a feature change.

**Must ship in the same commit as the `AiPaywallSheet` restyle** per the web/mobile parity rule (CLAUDE.md: "every meaningful UI decision must land on the equivalent web surface in the same commit").

---

### 3e. Settings → Membership card (mobile)

**Best-in-class benchmark:**
Future "Active / Member since" card — https://mobbin.com/screens/5af29867-d20f-4a0a-a49e-ae4aa387e821.
Uber Eats annual upsell inline for Free — https://mobbin.com/screens/ff9dc7ae-3af8-4105-94b4-3537406949ce.

**Proposed redesign:**

```
[ Membership card — Pro tier ]
  Background: white, 16pt radius, hairline border #ECEAE4
  Padding: 16pt

  [ Status row ]
    "Pro" — Fraunces 18pt weight 600, #C2683E (terracotta)
    "Active" badge — 10pt Inter, success-green pill, right-aligned
  [ Member row ]
    "Member since [formatted date]" — Inter 13pt, #1B1814 at 55%
  [ Renewal row ]
    "Renews [computed renewal date, formatted Mon DD YYYY]"
    Inter 13pt, #1B1814 at 55%
  [ Manage row — hairline top separator ]
    "Manage subscription" — Inter 14pt, terracotta
    Chevron icon (lucide), right-aligned
    Tap → presentCustomerCenter() — PRESERVED VERBATIM

[ Membership card — Free tier ]
  [ Status row ]
    "Free plan" — Fraunces 18pt weight 600, #1B1814
  [ Upsell chip (Uber Eats pattern) ]
    "Save 37% with an annual plan →"
    Background: rgba(194,104,62,0.06), terracotta text, Inter 13pt
    Border-radius: 8pt, padding 8pt 12pt
    Tap → /paywall?from=settings — PRESERVED VERBATIM
```

**Existing entitlement-display logic and cached-tier AsyncStorage anti-flash — PRESERVED VERBATIM.**

---

### 3f. Checkout success receipt (web, `/checkout/success`)

**No structural change needed.** Restyle `buildReceiptTrustCopy` display to use terracotta/sage/Inter tokens in place of any off-brand colours. The trust copy content is correct and PRESERVED VERBATIM.

---

### 3g. Promo code expander (mobile)

**No structural change.** Restyle:
```
[ Expander trigger ]
  "Have a promo code?" — Inter 14pt, #7C8466, centred
  Chevron, 14pt sage

[ Input ]
  Height: 44pt, border-radius 8pt, border 1pt #ECEAE4
  Placeholder: "Enter code" — Inter 14pt, #1B1814 at 35%
  Font: Inter 14pt, #1B1814

[ Apply button ]
  Terracotta pill, 44pt, "Apply" — Inter 14pt white weight 600
```

`redeem_promo_code` RPC + success Alert — PRESERVED VERBATIM.

---

## 4. Concrete token reference

All decisions in this spec use the locked Suppr design system. Token values for implementation:

| Token | Value | Use |
|---|---|---|
| `--color-base` | `#FFFFFF` | Page / card background |
| `--color-ink` | `#1B1814` | Primary text, numerals |
| `--color-card` | `#F6F5F2` | Unselected card, input bg |
| `--color-hairline` | `#ECEAE4` | Borders, separators, row dividers |
| `--color-terracotta` | `#C2683E` | Primary CTA, active state, Pro accent, price, badge |
| `--color-sage` | `#7C8466` | Secondary CTA, kickers, eyebrows, secondary icons, upsell text |
| `--color-amber` | `#C9892C` | Over-budget alerts ONLY — not used on paywall surface |
| `--color-success` | `#5E7C5A` | Trial CTA, feature check icons, "Active" badge, "No payment" chip |
| `--color-destructive` | not used | Not used on this surface |
| Serif display | Fraunces (primary) / Newsreader (fallback) | Titles, big price numerals, step labels |
| Sans body | Inter | All other text |

**No hardcoded hex values in implementation.** Use token aliases only. No Tailwind colour utilities (`violet-600`, `indigo-600`, `blue-500`) — all were identified as palette drift.

---

## 5. Typography scale

| Role | Font | Size (mobile pt / web px) | Weight | Colour |
|---|---|---|---|---|
| Display title | Fraunces | 28pt / 32px | 600 | `--color-ink` |
| Price numeral | Fraunces | 32pt / 40px | 700 | `--color-ink` |
| Section eyebrow | Inter, uppercase, tracked | 11pt / 11px | 500, ls 0.08em | `--color-sage` |
| Card heading | Fraunces | 18pt / 20px | 600 | `--color-ink` or terracotta |
| Body text | Inter | 14–15pt / 15–16px | 400 | `--color-ink` |
| Secondary body | Inter | 13pt / 14px | 400 | `--color-ink` at 55–60% |
| Feature row label | Inter | 13–14pt / 14px | 400 | `--color-ink` |
| Legal / disclosure | Inter | 11pt / 12px | 400 | `--color-ink` at 45% |
| CTA label | Inter | 15pt / 15px | 600 | white |
| Link / secondary action | Inter | 14pt / 14px | 400 | `--color-ink` at 50% |

---

## 6. Interaction and motion spec

**Billing toggle switch:** spring animation, 250ms, ease-out. Card border animates opacity 0→1 on selection. Badge on Annual segment fades in on mount (not on switch — it's always there).

**Free-vs-Pro matrix expand/collapse:** `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)` on mobile; CSS `transition: max-height 300ms ease` on web. Chevron rotates 0→180° on expand.

**TierCard selection:** border colour lerp from `#ECEAE4` to `#C2683E` over 150ms. Background colour lerp from terracotta-tint to white over 150ms.

**Trial timeline node entrance:** stagger 60ms per node, translateY(8pt)→0, opacity 0→1. Ease-out. Only on initial mount.

**"Remind me" toggle:** system haptic feedback (medium) on state change. No custom animation needed — system Switch handles it.

**Paywall mount:** hero image strip fades in 200ms. Below-fold content does not animate — reduce motion if `prefers-reduced-motion` or device accessibility setting.

**CTA press:** scale 0.97 on press-in, 1.0 on release, 100ms spring. Haptic (light) on press.

---

## 7. Accessibility

- Minimum tap target: 44×44pt on all interactive elements.
- Colour contrast: all body text against background ≥ 4.5:1 (WCAG AA). Price numerals (Fraunces 32pt) ≥ 3:1 (large text). Terracotta `#C2683E` on white: ~3.5:1 — use only for large text (>18pt) or non-text (icon, border). For CTA text on terracotta bg: white text = ~3.5:1; confirm with the contrast-audit spec at `tests/e2e/verify/contrast-audit.spec.ts`.
- All images (food photography) must have `accessibilityLabel` / `alt` text. Decorative images: `accessibilityIgnoresInvertColors={false}`, `alt=""`.
- Screen reader: the billing toggle must announce selection state ("Monthly, selected" / "Annual, selected, Save 37%").
- Trust chips and feature rows must not be wrapped in inaccessible View — use accessible text or `accessibilityRole="text"`.
- Trial timeline nodes: each node should be a distinct `accessibilityElement` with label reading the full step (e.g. "Step 1: Today. Full access, no charge.").
- Matrix expand/collapse: announce expansion state via `accessibilityState={{ expanded }}`.

---

## 8. Anti-patterns (confirmed by Mobbin corpus — do NOT implement)

These patterns appear in the corpus and are explicitly rejected for Suppr:

| Pattern | Source | Why rejected |
|---|---|---|
| Spin-to-win discount wheel | Cal AI — https://mobbin.com/screens/40014cb6-d991-4c5b-bc21-f66ecd969711 | Fake scarcity, violates calm-coach voice |
| "80% OFF FOREVER — ONE-TIME OFFER" | Cal AI | Fake urgency, dark pattern |
| Countdown timer | Various | Violates no-scarcity posture |
| "Skip Offer" downsell framing | Tinder | Coercive loss framing |
| Hardcoded calendar date in trial ("Charged on 9 Jan") | stoic., Brilliant | Stale-date trust fault — Suppr already fixed this (cadence-in-days) |
| Violet/indigo gradient CTAs | Current Suppr web | Off-brand palette drift — palette bug, not a style choice |

---

## 9. Platform parity decisions

| Item | Mobile | Web | Status |
|---|---|---|---|
| Food photography hero | Yes (new) | Yes (new) | Implement both in same commit |
| Serif price numerals | Yes | Yes | Implement both |
| Free-vs-Pro matrix | Yes (expandable) | Yes (inline) | Implement both |
| Trial timeline | Yes (4-step connected) | No (no IAP trial) | Intentional — documented divergence |
| "Remind me" toggle | Yes | No (no push notifications on web) | Intentional — mobile-only |
| Persistent restore footer | Yes | No (no restore concept on web) | Intentional — documented divergence |
| Billing period toggle | Yes (segmented) | Yes (toggle) | Functionally equivalent; style to match |
| RevenueCat Customer Center | Yes | No — Stripe Portal via `/account/billing` | Intentional — documented carve-out |
| AI paywall copy fix ("unlimited" → "up to 100") | Yes — already correct | FIX IN SAME COMMIT | Parity bug — not a divergence |

---

## 10. Implementation sequencing

Recommended order to manage feature-flag rollout and visual risk:

1. **Palette fix (web)** — `CheckoutButton.tsx`, `page.tsx` gradient, trust-icon tokens. No flag needed (bug fix, no new UI). Ship first.
2. **AI dialog copy fix (web)** — one string change in `ai-paywall-dialog.tsx:68`. No flag needed (copy correction). Ship with step 1.
3. **Mobile: TierCard restyling** — Fraunces price numerals, terracotta/tint card selection. Gate behind `paywall-card-v2` flag. Before/after screenshots required.
4. **Mobile: Hero photography block** — new top block. Gate behind `paywall-hero-v1` flag. Requires food-photography assets (editorial finished-dish per the imagery rule).
5. **Mobile: Trial timeline restyling** — connected vertical, icon nodes, "Remind me" toggle. Gate behind `paywall-timeline-v2` flag.
6. **Mobile + Web: Free-vs-Pro matrix** — additive block. Gate behind `paywall-matrix-v1` flag. Both platforms in the same PR.
7. **Mobile: AiPaywallSheet restyle** — X-pattern. Gate behind `paywall-ai-sheet-v2` flag.
8. **Web: Pricing page hero + serif typography** — gate behind `pricing-hero-v1` flag.
9. **Settings membership card** — mobile + web. Gate behind `settings-membership-v2` flag.

Each flag: ramp to 100% → hold for two weeks with no regression → remove gate in cleanup PR.

---

## 11. Photography asset requirements

The hero block and any TierCard background textures require actual editorial food photography matching the IMAGERY RULE:
- Finished / plated dishes — NOT ingredient single-subjects.
- Ceramic bowls, linen napkins, wooden boards, natural/moody light.
- Shallow depth of field, @_foodstories_ / @thelittleplantation aesthetic.
- Minimum 3 images for hero strip (mobile: 3–4 portrait crops at ~180×240pt; web: 2–3 landscape crops at ~560×280px).
- Source: original photography or properly licensed stock (not Getty watermarked or generic food stock). Instagram references above are aesthetic references only — do not hotlink or reproduce without licence.

**This is a hard dependency.** The hero implementation cannot ship without assets. If photography is not yet available, the flag gates the block; the existing flat header remains live until assets are ready.

---

## 12. FUNCTIONALITY PRESERVED checklist

Every audited feature, gate, limit, entitlement rule, analytics event, and state must survive unchanged in the redesign implementation. This checklist is the sign-off gate.

### Tiers and pricing
- [x] Two tiers only: Free + Pro (no Base surface, "base" retained as internal Free-equivalent fallback)
- [x] Pro monthly: £7.99/month (fallback literal; live price from RC `priceString`)
- [x] Pro annual: £59.99/year (fallback literal; live price from RC `priceString`)
- [x] Annual savings badge: computed via `computeAnnualSavingsBadge()` — never hardcoded
- [x] Annual reference line: computed via `computeAnnualReferenceLine()` — never hardcoded
- [x] 7-day free trial: Pro annual ONLY (`trialApplies = billing === "annual"`)
- [x] Billing default: monthly when `paywall-default-monthly` flag enabled, else annual (ENG-698)
- [x] Pricing SSOT: `src/lib/landing/pricingTiers.ts` — mobile imports directly, no drift

### Feature gates and limits
- [x] Recipe saves: Free cap = `FREE_SAVE_LIMIT` (10). Server-enforced 403 + client alert. Display value derived from constant, not hardcoded.
- [x] Multi-day plan: Free = 1 day only; Pro = 3/7 day. Gate at `planner.tsx:2856`.
- [x] Shopping list from plan: Pro only (tied to multi-day plan gate)
- [x] AI photo logging: Free = 5 per rolling 7 days (`FREE_PHOTO_LOG_WEEKLY_LIMIT`, 168h window). Pro = 100/day. Server 403 `upgrade_required`. Separate Upstash rate-limit bucket.
- [x] Voice logging: Pro only (no free taster). Server-enforced per `docs/decisions/2026-04-19-voice-logging-pro-only-server-enforced.md`.
- [x] Adaptive TDEE: Free and Pro (visible in matrix)
- [x] Barcode, recipe import (URL/IG/TikTok/YouTube): Free and Pro
- [x] Cook mode + timers: Free and Pro
- [x] Fiber + water tracking: Free and Pro
- [x] Apple Health sync (iOS): Free and Pro
- [x] Export JSON: Free and Pro
- [x] Unlimited saved recipes: Pro only
- [x] Publish recipe to community: Pro only (web Go Public; mobile import-only by design)
- [x] Priority email support: Pro only
- [x] Cookbook import gate: limit hit → alert → paywall — PRESERVED
- [x] Plan-tab day-count gate: `locked = isFree && d > 1` — PRESERVED

### `paywall.tsx` route logic
- [x] `normalisePaywallFrom()` — all 12 accepted `from` values preserved
- [x] Header kicker logic (`SUPPR PRO` vs `CHOOSE YOUR PLAN`) — preserved
- [x] Title/subtitle adaptive logic per `from` context — preserved verbatim
- [x] `showToggle` only when both monthly + annual provisioned
- [x] Auto-locks to single provisioned period if one missing
- [x] CTA label states: Loading / Trial / Subscribe / Open App Store — all preserved
- [x] CTA colour semantics: success green for trial, terracotta otherwise — preserved
- [x] Already-entitled early redirect (no `paywall_viewed` fired)
- [x] `pollUntilEntitled(5×2s)` — preserved
- [x] "Almost there" alert with Restore CTA on poll timeout — preserved
- [x] "Purchase failed" error alert — preserved
- [x] Restore: success / none / error flows — preserved
- [x] Continue for free → `/notifications-prompt` — preserved
- [x] Promo expander: TextInput + Apply + `redeem_promo_code` RPC + success Alert — preserved
- [x] Secondary rail: Restore · Terms · Privacy + "Payments handled by App Store" — preserved
- [x] Persistent "Restore purchases" footer pinned at bottom — preserved

### Trust and legal copy
- [x] Auto-renew disclosure (`disclosureText`) — cadence-in-days (not rendered date) — PRESERVED VERBATIM
- [x] Trust chips (3): "Cancel anytime in App Store" / "Cancel in Stripe Portal" + "7-day refund, no email needed" + "Price never changes mid-trial" — sourced from `paywallTrust.ts` PRESERVED
- [x] Nutrition-estimate note: "Nutrition values are estimates — always review before saving." — PRESERVED VERBATIM
- [x] "Prices include any applicable VAT" disclosure line — PRESERVED
- [x] "7-day refund: support@suppr-club.com" — PRESERVED
- [x] Web VAT note: `resolveRenderedVatNote` logic — PRESERVED. EUR "coming soon" — PRESERVED.

### Entitlement and billing infrastructure
- [x] `profiles.user_tier` server-write-only; T2 tier-column lockdown trigger — NOT TOUCHED by redesign
- [x] Authoritative tier writes via webhook (`revenuecat/webhook/route.ts`, `stripe/webhook/route.ts`) — NOT TOUCHED
- [x] `resolveNextTier` downgrade guard (refuses to downgrade on empty RC response) — NOT TOUCHED
- [x] `bestPromoTierFromRedemptions` promo merge — NOT TOUCHED
- [x] `cachedUserTier` AsyncStorage anti-flash — NOT TOUCHED
- [x] `classifyPaywallReadiness` → `paywall_readiness` event once per mount — PRESERVED
- [x] RC SDK key resolution priority (Apple → Google → unified) — NOT TOUCHED
- [x] `presentCustomerCenter()` → RevenueCat Customer Center (mobile) — PRESERVED
- [x] `/account/billing` → Stripe Customer Portal (web) — PRESERVED

### Web checkout
- [x] `CheckoutButton` auth check + `POST /api/stripe/checkout {tier, period}` — PRESERVED
- [x] Checkout route: rate-limit (10/60s), non-`pro` tier rejection, period default monthly, `allow_promotion_codes: true`, `client_reference_id` — PRESERVED
- [x] Stripe Tax flag-gate (`STRIPE_TAX_ENABLED`) — PRESERVED
- [x] Checkout success receipt: `buildReceiptTrustCopy` — PRESERVED
- [x] `checkout_started` event fire on CTA click — PRESERVED

### Analytics events
- [x] `paywall_viewed {from, tier, surface, platform}` — deduped per mount per tier, not fired when entitled
- [x] `paywall_dismissed {from, reason, surface, platform}`
- [x] `paywall_period_changed {fromPeriod, toPeriod}`
- [x] `paywall_readiness {reason, package_count}`
- [x] `checkout_started {tier, period, surface, platform, from}`
- [x] `checkout_completed {…, trialApplied}` — only after entitlement confirmed
- [x] `revenuecat_tier_sync_attempted {status, from, to, error_code}`
- [x] `ai_paywall_sheet_viewed / dismissed / cta_tapped {feature, reason/action}`
- [x] `pricing_page_viewed`
- [x] Canonical taxonomy in `src/lib/analytics/events.ts` — NOT TOUCHED

### AiPaywallSheet
- [x] Context-aware copy (voice vs photo) via `FEATURE_COPY` — PRESERVED
- [x] Feature-specific copy corrected: "up to 100 a day" (not "unlimited") — web fix ships same commit
- [x] All `ai_paywall_sheet_*` events — PRESERVED
- [x] Bottom sheet modal presentation (mobile) / Dialog (web) — PRESERVED (platform-native intentional divergence)

### States preserved
- [x] Loading (optimistic card, disabled CTA "Loading plans…")
- [x] Empty offerings (value ladder + "Open App Store" escape hatch)
- [x] Already entitled (early redirect, no event)
- [x] Purchase success + entitled ("You're in" alert → redirect)
- [x] Purchase success, not yet entitled (poll → "Almost there")
- [x] User-cancelled (silent)
- [x] Purchase error ("Purchase failed")
- [x] Restore: success / none / error

---

## 13. Gaps and flagged items

The following are not redesign-blockers but must be tracked:

1. **`FREE_SAVE_LIMIT` duplication** (Input A §9.7): `src/context/appData/constants.ts` (SSOT) and `apps/mobile/lib/recipes.ts:256` (hardcoded 10 with comment "must match web"). The matrix display in §3a must read from the SSOT. The underlying duplication risk should be resolved in a separate cleanup — open a Linear issue if not already tracked.

2. **`paywall-default-monthly` flag at 100%** (Input A §9.4): not verified in PostHog. If the flag is not at 100%, the annual default is still live on mobile. Verify before assuming monthly is the displayed default in any A/B or preview context.

3. **Photography assets** (§11): the hero block cannot ship without editorial food photography assets. This is a hard creative dependency, not a code dependency. Flag to Grace as a pre-implementation requirement.

4. **"Remind me" toggle — notification permission** (§3a trial timeline): the toggle gracefully hides if permission is denied. If Expo Notifications is not yet wired for this path, open a Linear issue before implementing the toggle. Do not ship a toggle that silently does nothing without an ENG reference.

5. **Web `/account/billing` and `/checkout/success` line-by-line review** (Input A §10 medium-confidence): these two surfaces were not fully read for the audit. Before touching them in implementation, re-read to verify nothing was missed.

6. **RevenueCat webhook handler** (`app/api/revenuecat/webhook/route.ts`) was not audited line-by-line. Do not modify entitlement reconcile paths without a fresh read.

---

*Spec authored 2026-06-02. Functionality inventory sourced from code (high confidence). Benchmark citations sourced from Mobbin corpus (Input B). Design tokens from `docs/ux/design-system.md` and `docs/ux/brand-tokens.md`. All starred items in §12 are implementation gates — do not mark any redesign issue Done until its row in §12 is confirmed preserved.*
