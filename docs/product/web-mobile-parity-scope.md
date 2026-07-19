# Web / mobile parity & navigation scope

Suppr is one product that happens to run on two platforms. This page records
where web and mobile are meant to behave identically, where they're
deliberately different (and why), and where a gap simply hasn't been closed
yet. Where the platforms differ, treat it as a documented product choice, not
a bug to fix quietly on the side.

**Last confirmed:** 2026-07-19

No new intentional differences were added in the most recent review. Smaller
follow-up ideas for visual polish and voice/photo parity live in
[`PARITY_PRODUCT_QUEUE.md`](PARITY_PRODUCT_QUEUE.md) rather than as open items
here. A new intentional difference gets added to this document (or to
`docs/decisions/`) only once product has actually signed off on it.

### Keeping this page current

Roughly every quarter, or before a major release, it's worth:

1. Checking recently merged changes that touched only one platform's UI, and
   confirming each either has a matching change on the other platform, a
   tracked follow-up, or a new row below with a rationale.
2. Checking [`PARITY_PRODUCT_QUEUE.md`](PARITY_PRODUCT_QUEUE.md) for anything
   ready to close out.
3. Bumping the **Last confirmed** date above.
4. Adding a short entry to the table below (or a `docs/decisions/` note)
   whenever product signs off on a new intentional difference.

## Why parity matters

People move between the web app and the mobile app expecting the same
product — same behaviour, same copy, same features. A difference they notice
reads as a bug, even when it isn't. So whenever a user-visible change ships,
is removed, or is improved on one platform, it gets checked against the
other:

1. Find the matching surface on the other platform.
2. Decide: should this match exactly, or is it a deliberate, documented
   difference (recorded here or in `docs/decisions/`)?
3. When behaviour is meant to be identical, build it as shared logic both
   platforms call into — not two separate copies that can quietly drift
   apart.
4. Update this document, and the relevant tests, whenever behaviour changes.

A change isn't finished until both platforms have been considered against it
— see also [Testing system — task completion gate](../testing/SYSTEM.md#task-completion-gate-non-negotiable)
and [Genesis §2](../genesis/README.md#2-task-completion-gate-non-negotiable).

---

## Where the platforms stand today

| Area | Status | Notes |
|------|--------|--------|
| **Nutrition and meal-plan math** | **Aligned** | Calorie and macro calculations, meal-plan logic, ingredient verification, and calorie-target calibration all run through one shared engine that both apps call into — results are identical everywhere by construction, not by convention. |
| **Quick Add (Favourites / Frequent / Recent / Usual meals)** | **Aligned** | Governed by one shared set of rules; web and mobile just render it differently. A different tab order, empty-state message, or AI-logged-item handling between the two would be a bug, not a style choice — see "Quick Add panel" below. |
| **Food search ranking, de-duplication, and source labels** | **Aligned** | Ranking, de-duplication, and confidence labelling for search results run through one shared library, so searching for the same ingredient returns the same ranked list with the same source labels on both platforms. |
| **Discover "Popular" filter** | **Aligned** | Both platforms use the same save-count threshold to decide which community recipes count as Popular, so the same recipe qualifies (or doesn't) either way. Mobile's offline cache keeps the same counts and refreshes them once it's back online. |
| **Billing** | **Intentionally different rails** | Web subscribers pay through Stripe; mobile subscribers pay through Apple's in-app purchase system, because that's how each platform's payment rules work. Whichever rail someone pays through, their subscription status lands in the same place, so a Pro subscriber is Pro everywhere. Detail: [Stripe and IAP](subscriptions-stripe-and-iap.md), [monetisation and paywall journey](../journeys/monetisation-and-paywall.md). |
| **Apple Health and Apple Sign-In** | **Mobile-first, intentionally** | These are iOS system features with no web equivalent, so mobile gets native integrations (step tracking, one-tap sign-in) that web replaces with manual entry or password sign-in. Concrete examples: the Progress "Steps" card and the onboarding "Connect Apple Health" prompt exist only on mobile. See the [Progress journey](../journeys/progress.md) and the [onboarding journey](../journeys/onboarding-to-first-log.md). |
| **Onboarding sign-up method** | **Known limitation** | During onboarding sign-up, web only offers email and password; mobile only offers Sign in with Apple. Web does have an Apple option on its general sign-in screen, just not in this specific onboarding step — and nobody has recorded a product reason why the onboarding step itself excludes Apple on web, separately from the broader "Apple features are mobile-native" rule that explains the rest of the mobile-first Apple integrations. Worth a decision rather than an assumption. Detail: [onboarding journey](../journeys/onboarding-to-first-log.md), "Signup" section. |
| **Legal and reference pages** (DMCA policy, licences, help, roadmap) | **Web-only, by design** | These pages live only on the web, with no mobile screen — apart from Privacy and Terms, which mobile links out to in the browser, mobile has no way to reach them at all. Low-traffic reference pages where a native mobile build isn't worth the cost. Rationale: [DMCA/licences/whats-new decision](../decisions/2026-05-05-public-routes-dmca-licences-whats-new.md); detail: [marketing-to-signup journey](../journeys/marketing-to-signup.md). |
| **Fasting timer** | **Aligned** | Web now carries the full experience — timer ring, milestones, projected end time, history, and a landing-page card — matching mobile. A few small interactions stay mobile-only because they depend on touch gestures or push notifications: ending a fast early via long-press, deleting a history entry via long-press, and fasting push reminders. Detail: [fasting web-scope decision](../decisions/2026-04-fasting-web-scope.md). |
| **Discover, meal planner, and Profile styling** | **Not yet aligned** | Layout, spacing, and density can differ between web and mobile today. Closing this needs a deliberate design pass rather than an automated fix — see "Discover, Plan, and Profile still need a visual-parity pass" below. |
| **Today colours (light mode)** | **Aligned** | Today's colours, including the amber over-budget state, are pinned to the same design tokens on both platforms and checked automatically, so they can't quietly drift apart. |
| **Today dark-mode background tone** | **Intentional, small difference** | Dark mode uses a very slightly different background shade on each platform, matched to how each platform's dark surfaces typically read. Not worth chasing pixel-perfect unless product decides it matters. |
| **Today layout** | **Aligned** | The date header, the capped number of prompts below the meal list, the desktop week view, and sign-in entry points all match across platforms. |
| **Today status badges** | **Aligned** | Both platforms show the same two badges under the day's totals: "On track" when someone's logged and within range of their target, and an "Adaptive TDEE learning" badge while the system is still calibrating someone's calorie target from real data. One known limitation: the "days learning" count in that badge is currently estimated rather than counted from actual weigh-ins, until real weigh-in tracking is wired into that number. |
| **Today weekly trend card** | **Aligned** | Both platforms show a weekly calorie-trend sparkline below the day's totals (desktop side rail on web, below the meal list on mobile), using the same maths so the shapes match. One known limitation: the household-size figure behind the comparison currently defaults to 1 rather than reflecting an actual household, until that data is wired through. |
| **Progress trend tiles** | **Aligned** | Both platforms show the same trend tiles: days the calorie target was hit, days the protein target was hit, weigh-ins logged, and (optionally) a projected goal date. |
| **Recipe "fit %" badge** | **Aligned (not shown, either platform)** | Neither platform currently shows a recipe fit-percentage badge — it was removed from both when it wasn't earning its place on the card. The underlying calculation still exists in case it's useful for a future recipe-ranking feature, but nothing renders it today. |
| **Incident banner** | **Aligned as a tool, asymmetric in practice** | Both platforms share the same global incident banner, switched on manually from the analytics dashboard during a live outage (e.g. a Supabase outage), with the same fallback message if no custom text is set. It's off by default and never turns itself on — an incident tool, not a live health-check widget. Known limitation: on mobile, the banner can only reach someone who has explicitly accepted analytics tracking — a person who declined, or hasn't yet answered that prompt, will never see it, whatever's switched on. Web has no such gate; it reaches everyone regardless of their tracking choice. In practice, treat the in-app banner as reaching most but not all mobile users, and effectively all web users — status.suppr.club and outbound channels (email, social) remain the only way to guarantee everyone hears about an incident. Detail: [disaster-recovery runbook](../runbooks/disaster-recovery.md). |

### Five differences we retired in 2026-05-25

A wider review that quarter closed five gaps that had previously been
treated as acceptable platform differences. From that point on, engineering
treats these as parity requirements, not stylistic choices:

- **Paywall default billing period** — web used to default to monthly and
  mobile to annual; both now default to monthly.
- **Moving a meal between days** — used to be mobile-only; now available on
  web's planner too.
- **Making a recipe public** — used to be web-only; now available on mobile
  too.
- **Onboarding welcome copy** — web and mobile used to carry different copy;
  now matched.
- **Discover layout** — mobile has converged to web's cuisine-carousel
  layout.

**Still genuinely intentional:** the onboarding step count (web runs one
step longer than mobile, which has an extra plan-refresh step), the
iOS-only build, the calorie-ring colour system, the Stripe/Apple-IAP billing
split, Apple Health being mobile-first, and the slightly different
dark-mode tone on Today. The fourth mobile tab is labelled "Progress." Full
rationale: [sweep resolutions decision](../decisions/2026-05-25-sweep-parity-ia-pricing-resolutions.md).

### Plan Import reached web — 2026-06-17

Plan Import — paste in a meal plan, have it parsed and reviewed, then commit
it to your week — shipped on mobile first. Web now has the same flow at
`/plan-import`: paste, parse, review, and commit, built on the same
underlying parsing and commit logic as mobile, so the two stay in sync going
forward.

**One remaining, deliberate gap:** mobile lets someone import a plan from a
pasted list, a PDF, or a photo; web currently supports paste only. PDF and
photo import on web are planned as a follow-up. See the
[Plan Import planning notes](../planning/plan-import-linear-program.md).

### Known limitations not yet resolved

A few platform differences exist today without a clear, recorded product
decision behind them. Worth naming rather than treating as either bugs or
settled choices:

- **The onboarding sign-up method split** (mobile Apple-only, web
  email/password-only) — see the row above.
- **"Add to my regulars" in Cook Mode** is mobile-only today. The original
  note describing this feature didn't say it should be mobile-only
  specifically — it reads as though cross-platform support was assumed —
  so this looks more like an unintentional gap than a deliberate choice,
  though nobody has ruled on it. Detail:
  [discover and library journey](../journeys/discover-and-library.md).
- **Cookbook PDF import** is mobile-only today, and it's never been decided
  whether that's meant to be permanent or is simply where the feature
  happened to launch first. Detail:
  [import cookbook journey](../journeys/import-cookbook.md).

These stay as open questions in their own journey docs until product makes a
call on each.

---

## Discover, Plan, and Profile still need a visual-parity pass

Discover, the meal planner, and Profile are functionally the same on both
platforms, but their styling, density, and exact feature placement can
differ. Closing that gap isn't something that can be automated — it needs a
deliberate, screen-by-screen design review that decides, for each surface,
what should match exactly and what's fine to leave different, with the
reasoning written down either way. Until that review happens, differences
here aren't bugs to fix opportunistically.

## Photo and voice logging need a copy and UX pass too

Photo logging and voice logging already work the same way on both platforms
where it matters most — the subscription rules (what's free, what's Pro) are
enforced consistently and covered by tests. What hasn't had a dedicated pass
is the surrounding experience: matching copy, matching entry points, and
matching empty-state and error messaging, so the two apps feel like one
product when someone tries these features. Until product defines exactly
what should match, engineering isn't adding new Pro gates or mobile-only
entry points to these flows — that would be building against an undefined
target.

## Why Library isn't a bottom tab

Library is reachable through a header shortcut and a direct link rather than
living in the bottom tab bar — a deliberate information-architecture choice,
not an oversight. Don't read its absence from the tab bar as something to
fix unless product decides to revisit mobile navigation.

## Quick Add panel

Favourites, frequent items, recent items, and usual meals are governed by
one shared set of rules that both platforms simply render. A different tab
order, different empty-state wording, or different handling of AI-logged
items between web and mobile is a bug, not a design choice. When that logic
needs to change, it changes once, in one place, and both platforms pick it
up automatically.

---

## Related

- [`PARITY_PRODUCT_QUEUE.md`](PARITY_PRODUCT_QUEUE.md) — the running list of
  smaller parity follow-ups.
- [Testing system](../testing/SYSTEM.md) — the broader quality gate this
  parity check feeds into.
- [Disaster-recovery runbook](../runbooks/disaster-recovery.md) — when the
  incident banner referenced above actually gets switched on, and how we
  communicate during an incident.
