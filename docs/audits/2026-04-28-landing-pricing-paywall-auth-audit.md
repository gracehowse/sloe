# Landing + Pricing + Paywall + Auth audit

**Phase 6 comprehensive scope.** 3 platforms (mobile-web, desktop-web, in-app paywall).
**Source:** customer-lens, 2026-04-28.

---

## Top 5

### AU-01 [P0 trust] — `/onboarding/v2` may not persist on completion (front door of product)

`app/onboarding/v2/page.tsx:36-39`. Page comment: *"The flow does not yet write `daily_targets` / `profiles` on completion (OB2-1 in TODO.md). Completing it is harmless but doesn't persist anything yet."* `robots: { index: false, follow: false }` is set.

This is the canonical sign-up route now (`/signup` 307s here, landing's "Get started" CTAs all point here via `SIGNUP_HREF = "/onboarding"`).

**If this comment is current truth, the entire sign-up funnel from suppr-club.com puts user through 13 steps and saves nothing.** If stale, comment is lying to future engineers and page is `noindex`-ed for no reason. Either way, this is the front door.

(Cross-reference: onboarding audit WEB-01/MV-03 confirms persistence missing.)

**Fix:** Confirm OB2-1 shipped, update comment, remove `noindex`. If unshipped, freeze landing CTAs behind notice or revert `/signup`.

### PR-01 [P0] — "Base" tier half-deleted across surfaces

- `app/pricing/PricingTiersGrid.tsx:122` — `visibleTiers = tiers.filter((t) => t.name !== "Base")` filters Base out of the grid
- `src/lib/landing/content.ts:213` (FAQ) still says: *"won't be able to save new recipes until you're back at … or fewer, **or on Base**."*
- `apps/mobile/app/paywall.tsx:81` — `SHOW_BASE_TIER = false`. But headerSubtitle line 545 says *"Includes everything in Base, plus AI photo and voice logging."*
- `apps/mobile/app/paywall.tsx:83-86`: `PRO_FEATURE_HEAD = "Everything in Base, plus"` — meaningless
- Pro tier on web `/pricing`: `featHead: "Everything in Base, plus"` — Base hidden, so user has no idea what's included
- `LandingPage.tsx:967-998` iterates `PRICING_TIERS` directly — **Base IS still rendered on `/`**

**Marketing landing shows Base. `/pricing` hides Base. Mobile paywall hides Base. But its name leaks into surviving surfaces' copy.** "There is a tier called Base. I should compare. Wait, where is it? What is it?" Conversion dead.

**Fix:** Pick one of:
1. Roll Phase 5 fully: remove Base from `PRICING_TIERS` rendering on landing, rewrite Pro `featHead` to "Everything in Free, plus", strip FAQ "or on Base" line.
2. Bring Base back as visible tier everywhere until migration call lands.

### PR-02 [P1 trust] — 7-day free trial is mobile-only with no web disclosure

- `app/pricing/PricingTiersGrid.tsx:367` — *"`${price}${period}`, charged today and automatically renews each `${periodNoun}` until you cancel."*
- `apps/mobile/app/paywall.tsx:564-578` — *"Suppr Pro renews automatically at £X per Y until cancelled. **Your 7-day free trial ends on `<date>`; first charge on `<date>`.**"* Mobile only does this dated-trial disclosure on Pro annual.

User comparing web `/pricing` (zero "trial" mentions) to mobile paywall (7-day trial featured) concludes they get different deals. They're right — website doesn't sell the trial; mobile prominently does. **Asymmetry undocumented.**

**Fix:** Either (a) extend 7-day trial to web checkout via Stripe `trial_period_days`, or (b) document on `/pricing` that trial is mobile-app-only.

### LP-01 [P1] — Returning user clicking "Get started" gets dumped into fresh signup

`app/(landing)/LandingPage.tsx:66-67, 107-109, 179-181, 469-472, 1083-1085, 1125`. Landing always renders marketing page (`force-dynamic`); "Get started" always routes to `/onboarding/v2`. **No "Continue to app" bounce for authed users.**

Login state invisible on landing — no avatar, no session indicator. Returning user's primary CTA fires the wrong action. Combined with AU-01 (persistence may not work), they might submit data, land in /home, revisit suppr-club.com, click "Get started" out of muscle memory, and get a duplicate-onboarding loop.

**Fix:** Server-render "signed in" affordance — small "Continue to app →" button replacing "Get started" when Supabase session exists.

### PW-01 [P1] — Mobile paywall CTA can read "Subscribe — £7.99/month (unavailable)"

`apps/mobile/app/paywall.tsx:1284-1286`. When `ctaDisabled && !ctaLoading`, rendered string is `${ctaLabel} (unavailable)`. Faded button reads: **"Subscribe — £7.99/month (unavailable)"** — meaningless contradiction.

User on flaky connection: "the price is £7.99/month and it's unavailable". Plan sold out? Network failed? Account not allowed?

**Fix:** Replace appended `(unavailable)` with a swap. When `ctaDisabled`, render *"Try again"* with refresh glyph; render price elsewhere.

---

## Other findings

- LP-02 [P2]: Trust-strip pill *"Paste a TikTok, get real macros"* reads as ad-style hyperbole, not the calm/food-warm/restrained voice elsewhere
- AU-02 [P2]: Sign-up "Account created. Check your email" with no Resend Confirmation affordance — user stuck if email never arrives
- AU-03 [P2]: Magic-link toggle visible in Sign Up tab with "(existing accounts)" disclaimer — toggle is misplaced
- PR-03 [P2]: `/pricing/page.tsx:43` Open Graph description says "Free, Base, or Pro" — but page hides Base. SEO/social previews lie.
- PR-04 [P2]: Region-aware VAT note triggers for UK/EU + "EU pricing coming soon" for EUR — but prices stay GBP. French visitor sees "EU pricing coming soon — current prices in GBP" alongside "VAT included". The flag-gated branch (`STRIPE_TAX_ENABLED`) flips between *includes* and *excludes* invisibly. Verify `STRIPE_TAX_ENABLED=true` in prod or this is misrepresentation.
- PW-02 [P2]: "Most popular" badge is on Pro mobile vs hidden on web (Base hidden). Cross-surface meaningless.
- PW-03 [P3]: "Cancel anytime. Price in your currency, taxes included." — non-GBP web visitors get only "EU pricing coming soon" line.
- AU-04 [P3]: Forgot-password sends to `${origin}/reset-password`. **Verify `/reset-password` page exists.** If not, P0 trust failure.

---

## Web vs mobile divergences

| Surface | Web | Mobile | Verdict |
|---|---|---|---|
| Tier offering | Free + Pro (Base hidden) | Pro only | **drift** |
| Trial offer | None on `/pricing` | 7-day on Pro annual | **drift undocumented** |
| "Most popular" badge | Hidden | On Pro | drift |
| Signup canonical entry | `/signup` → `/onboarding/v2` | RevenueCat / native flow | independent, but AU-01 risk |
| VAT disclosure | Region-aware via `detectRegion` | Apple storefront handles | acceptable |
| Default billing period | Monthly | Annual | **intentional** per 2026-04-19 doc |
| Promo code surface | `/pricing` PromoCodeBlock | Paywall expander | parity |

---

## Trust concerns ranked

1. AU-01: Sign-up flow may not persist. Front door of product is broken (or doc is lying to engineers).
2. PR-01: Phantom "Base" tier across surfaces.
3. PR-04: VAT-inclusive copy gated on server flag user can't verify. Cayman jurisdiction memo says inclusive promise is the legally compliant path — flag must be `true` in prod.
4. AU-04: `/reset-password` may not exist.
5. Pricing FAQ refunds: *"handled manually via Stripe"* — implementation detail leaked to user.
