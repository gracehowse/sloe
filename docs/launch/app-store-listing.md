# Suppr — App Store listing assets

**Owner:** Grace
**Status:** scaffold (Phase 2 launch dependency)
**Last updated:** 2026-04-25 (P1-16 of [Opus 4.7 codebase review](../audits/2026-04-25-opus47-codebase-review.md))

The actual marketing copy is Grace's call (positioning, tone, regional variants). This doc is the **structural scaffold** — every field App Store Connect requires, with a draft, the rationale, and the constraints. Replace the drafts before submission; the scaffold tells you nothing's missing.

The companion artefacts:
- [Launch checklist](./checklist.md) — Phase 2 row #19 owns this.
- [Brand guidelines](../../guidelines) (if present) — wordmark + tone-of-voice anchors.
- [`apps/mobile/app.json`](../../apps/mobile/app.json) — bundle id, version, icons.
- Competitive principles: [`docs/competitive-principles.md`](../competitive-principles.md).

---

## App identity (App Store Connect → App Information)

| Field | Value | Constraint | Source |
|---|---|---|---|
| **App name** | Suppr | ≤ 30 chars; locked at submit | `app.json:name` |
| **Subtitle** | _Macro tracking that's actually honest_ | ≤ 30 chars | DRAFT — Grace |
| **Bundle ID** | `com.supprclub.supprapp` | locked at first submit | `app.json:bundleIdentifier` |
| **SKU** | `suppr_ios_v1` | internal only | proposed |
| **Primary language** | English (UK) | — | UK-first launch market |
| **Category (Primary)** | Health & Fitness | — | matches use case |
| **Category (Secondary)** | Food & Drink | — | recipe import is core |
| **Content Rights** | "Does not contain, show, or access third-party content" | UK GDPR alignment | confirm at submit |

### Subtitle alternatives

The subtitle is the second-most-clicked element after the name. ≤ 30 chars. Drafts that test the four positioning angles:

1. **Honesty (recommended):** _Macro tracking that's actually honest_ (29c)
2. **Loop completion:** _Plan, shop, cook, log — done_ (28c)
3. **Source-aware:** _USDA + OFF macros, no guessing_ (27c)
4. **Personal:** _Eat well, without overthinking_ (29c)

#1 leans into the differentiator the audit identifies as Suppr's real moat (Atwater plausibility gate, macro-split confidence, source-aware vocabulary). It's also the strongest "why us vs MFP" hook in App Store search where users are skeptical of free trackers.

## Promotional text (App Store Connect)

≤ 170 chars. Editable post-launch (unlike most other fields). Use it for current-cycle marketing without a new build.

**Draft:**

> Honest macros, beautiful planning. Save recipes, plan a week, shop the list, log what you ate — without inventing nutrition data along the way. UK-built. (158c)

## Description

≤ 4000 chars. Survey of every competitive principle from `docs/competitive-principles.md` translated into user-facing prose. Sections in order: hook → loop → honesty → privacy → pricing → about.

**Draft outline (Grace finalizes copy):**

```
[HOOK — 50 words]
Suppr is the macro tracker that doesn't make things up. Every food we
show you comes from USDA, Open Food Facts, or your own pantry — and
when we don't know, we say so.

[LOOP — 80 words]
The whole loop in one place. Save a recipe from any URL, plan your
week against your macro targets, generate the shopping list,
follow the cook mode, log what you actually ate. No app-switching,
no double-entry.

[HONESTY — 80 words]
Most trackers cite a "calorie count" with three significant figures
they can't possibly know. Suppr surfaces the source on every food
(USDA / Open Food Facts / community / your own), gates implausible
nutrition before it reaches your journal, and refuses to fabricate
macros from a single calorie figure.

[PRIVACY — 60 words]
Your nutrition data is yours. We never sell it. We don't show ads.
You can export it as CSV from Settings or delete your account
completely from Account → Delete account. UK GDPR + EU GDPR compliant.

[PRICING — 60 words]
Free forever for the core tracker. Pro unlocks AI photo + voice
logging, advanced meal planning, and household sharing for £X.99/month
or £XX.99/year. Cancel anytime from Settings → Subscription.

[ABOUT — 50 words]
Built in the UK by a small independent team. We answer support email
ourselves. Send us your hardest recipe and we'll add it to the test
suite — that's how we made the food database honest in the first place.
```

Replace [pricing] with actual values once Stripe Live is configured. Replace [team plurals] if Suppr remains a solo operation.

## Keywords

≤ 100 chars total, comma-separated, NO spaces. App Store Connect counts every comma. Aim for 10–14 high-relevance terms.

**Draft:**

```
macro,calorie,nutrition,tracker,food,diary,recipe,planner,fitness,health,protein,diet,meal
```

(95c — leaves room for one more term.)

Avoid: brand names of competitors (App Store rule violation), generic high-volume terms with low intent ("food", "eat") that just dilute, or English-US misspellings if launching UK-first.

## Screenshots

Six screenshots required at the iPhone 6.7" size; same six accepted at 6.5" and 5.5" with appropriate scaling. App Store Connect rejects builds without all three sizes.

**Suggested sequence (each panel is one screenshot; first three are the most-viewed in App Store search):**

1. **Tracker — daily summary.** Today's calorie ring, macros, "Remaining" bar, one logged meal with source badge. Caption: _Honest macros. Every source labeled._
2. **Recipe verify.** A recipe being verified, mid-flow, with the source-aware "needs density" hint visible on a liquid ingredient. Caption: _We refuse to fabricate nutrition._
3. **Meal planner.** A 7-day plan, macro-aware band feedback, one row showing the "Estimated · verify" chip (P1-19 follow-up). Caption: _Plan a week against your goals._
4. **Cook mode.** Recipe step-by-step, timer running, ingredient strikethrough. Caption: _The cook step that knows what you logged._
5. **Discover.** Editorial recipe feed with creator handles + verified badges. Caption: _Real recipes, not algorithm bait._
6. **Privacy / source surface.** Settings → Data export + delete + Source vocabulary explainer. Caption: _Your nutrition data, your call._

Use real (or realistic) data — avoid lorem-ipsum and "John Doe / 2000 kcal" boilerplate; reviewers fail those.

## Privacy nutrition label

App Store Connect → App Privacy. Required for any new submission. The product collects:

| Category | What | Linked to user? | Used for tracking? |
|---|---|---|---|
| Identifiers | Email + UUID | Yes | No |
| Health & Fitness | Nutrition entries, weight, body fat (HealthKit-sourced when granted) | Yes | No |
| Usage Data | App interactions (PostHog events) | Yes | No |
| Diagnostics | Crash logs (Sentry) | Yes | No |

Disclosed purposes:

- Identifiers: account management.
- Health & Fitness: app functionality (the journal IS the product).
- Usage Data: analytics — improving the product. NOT used for ads or third-party tracking.
- Diagnostics: bug detection.

Tracking: **None.** Suppr does not track users across other companies' apps or websites; PostHog and Sentry are first-party analytics + error tools and don't share identifiers with third-party ad networks.

## In-app purchase products

App Store Connect → In-App Purchases. Each row matches a `STRIPE_PRICE_*` env on the web side and an RC entitlement on mobile.

| Product ID | Type | Tier | Reference price | Reference period |
|---|---|---|---|---|
| `com.supprclub.supprapp.base.monthly` | Auto-renewable subscription | base | £X.99/mo | monthly |
| `com.supprclub.supprapp.base.annual` | Auto-renewable subscription | base | £XX.99/yr | annual |
| `com.supprclub.supprapp.pro.monthly` | Auto-renewable subscription | pro | £X.99/mo | monthly |
| `com.supprclub.supprapp.pro.annual` | Auto-renewable subscription | pro | £XX.99/yr | annual |

Set `tax_behavior: "inclusive"` on each Stripe Price; UK + EU consumer law requires VAT-inclusive pricing per the [VAT posture decision](../decisions/2026-04-19-consumer-vat-posture-uk-eu.md).

Subscription introductory offer: 7-day free trial on Pro (mirrors the existing TestFlight + Stripe behaviour). RevenueCat needs the matching offering set up before submission.

## App Review information

Reviewer-facing fields, not user-visible:

- **Demo account:** create a real account at `reviewer+appstore@suppr-club.com` with the test password documented internally. Pre-load with at least one saved recipe + one logged meal so the reviewer can exercise the full loop without needing to create data.
- **Notes for reviewer:** mention HealthKit prompts (the reviewer may run the app without granting Health permission; the manual-fallback path must work). Mention that `food_logged`, `meal_plan_generated`, and `paywall_viewed` PostHog events will fire during review.
- **Sign-in required for review:** Yes (the reviewer can't get past `/login` without an account). Pre-create the demo account and provide credentials in the review submission.

## Localization

UK-first launch; en-UK is the primary locale. en-US screenshots can use the same assets if the wordmark is locale-neutral (Suppr is). Add other locales (es, fr, de, it) post-launch when there's a translation budget.

## Submission flow

1. Build via `eas build --profile production --platform ios`.
2. `eas submit -p ios --latest`.
3. App Store Connect → TestFlight → Build appears, run TestFlight smoke first.
4. Once cohort is happy: App Store Connect → App Store tab → fill all fields above.
5. Submit for review. Apple SLA: 24–72 hours typical.
6. On approval: release manually (don't auto-release) so a coordinated launch post is possible.

## Pre-submission checklist (mirrors `docs/launch/checklist.md` Phase 2)

- [ ] All `[PLACEHOLDER ...]` strings resolved in the legal pages (`npm run prelaunch:checklist` reports 0).
- [ ] `npm run smoke:production` green.
- [ ] `npm run smoke:revenuecat` green.
- [ ] App Privacy nutrition label complete in App Store Connect.
- [ ] All four IAP products configured + matching RevenueCat offerings.
- [ ] Six screenshots × three sizes uploaded.
- [ ] Demo account created + credentials in App Review notes.
- [ ] Stripe Tax dashboard activated; `STRIPE_TAX_ENABLED=true` in Vercel env.

## When to re-open this doc

- Subtitle / description / keywords change for marketing reasons → update + re-submit (no new build needed for editable fields).
- A new IAP product launches → add to the table.
- Apple changes the privacy nutrition label categories → re-fill.
- New locale rolls out → add the localized copy.
