# TikTok + Instagram virality plan — Suppr

**Owner:** Grace
**Last updated:** 2026-06-29
**Status:** Strategy locked. Pre-push polish phase (target push start: 2026-07-01). Hooks re-pointed onto the revised differentiation wedge (downstream of ENG-1112 — see "Competitor reality" below).
**Why this doc exists:** Suppr's path to 1M users runs almost entirely through TikTok + Instagram virality. This doc is the operating plan — magic moments, format, cadence, KPIs, polish prerequisites, and decision triggers. Mirror summary lives in Notion → Growth & marketing → "Viral growth strategy" (linked back to this file).

---

## Strategic context

- **Build age:** 2 months (started March 2026). Unusually mature for the age — web + mobile working, recipe import, photo log, voice log, plate loop, monetization scaffolded, brand identity coherent.
- **Solo founder.** No marketing team. Content production sits with Grace until traction proves out.
- **Pre-revenue.** Burn **~£350–400/mo** all-in. No marketing budget. Organic-first. Break-even **~120 paying subs** (order of magnitude) — see `docs/finance/income-projection.md`.
- **Pricing locked.** Free + Base (£3.99/mo, £29.99/yr) + Pro (£7.99/mo, £59.99/yr). See `docs/decisions/2026-04-19-pricing-v1.md`.
- **iOS-only.** Cuts global TAM by ~60% (Android is 70% of phones worldwide). 1M users on iOS-only is harder but doable.
- **TestFlight today, App Store launch pending.** Grace is the only tester (per `project_solo_tester.md` memory).
- **Competitor reality (per `docs/competitor-set-and-mfp-exodus-2026-05-03.md`, refreshed downstream of ENG-1112):** MFP mass-exodus 2026-05-03 is a once-in-a-cycle tailwind; capturing refugees is the priority. **But the picture shifted:** MyFitnessPal *acquired Cal AI* (deal closed Dec 2025, announced 2 Mar 2026), and AI photo logging is now **paywalled on both** — MFP Premium ($19.99/mo) and Cal AI ($9.99/mo after trial). Cal AI was pulled from the App Store (Apr 2026) over paywall dark patterns. So "we have AI photo / we're more accurate than Cal AI" is **no longer the wedge**.
- **The revised wedge (single source of truth: `docs/competitor-set-and-mfp-exodus-2026-05-03.md` → "Where Suppr leads"):** Suppr gives you **attributed Reel/recipe import → make-it-fit-your-macros**, **adaptive TDEE**, and **honest estimated-nutrition** — on **free, with no ads and no barcode/photo paywall**. The lead is not "we have AI photo"; it's **"we don't paywall the basics, and we turn the Reel you saw into a meal that fits your day."** Accuracy/honesty stays in the mix as *secondary* support (the confidence meter), not the headline.

## What 1M users actually takes

Working backwards from the goal:

| Target | Gross signups/mo needed | Probability (solo path) | What it requires |
|---|---|---|---|
| 1M in 12 mo | ~83,000/mo | <5% | Cal-AI-level virality + team scaling within months |
| 1M in 24 mo | ~42,000/mo | 15–25% | TikTok channel works + 2–3 hires + small funding |
| 1M in 36 mo | ~28,000/mo | 30–40% | Steady channel + one viral moment + small team |
| 1M in 60 mo | ~17,000/mo | 50–60% | Persistence + competence |
| Never | — | 40–50% | Most consumer apps don't make it. Be honest. |

**Working target: 1M users in 24–36 months.** Anything faster is luck; anything slower is wasting the MFP-exodus tailwind.

**Year-1 sub-target:** 50,000–100,000 free signups + first ≥1M view video + ≥4.6 App Store rating + ≥30% week-4 retention.

## Magic moments ranked (the share-able demos)

Ordered by virality potential, not by product priority.

### 1. Recipe import from a Reel/TikTok — **the lead bet**

**Hook:** "I saved this recipe on TikTok. Watch what happens."

**Demo:** Open TikTok → tap Share → paste into Suppr → recipe appears with ingredients parsed, macros calculated, prep steps. Add to plan or cook now.

**Why it wins:**
- Native to the platform — viewers literally save recipes on TikTok already.
- The share-loop is built in: viewers come BACK to TikTok to find more recipes.
- **The payoff is "make it fit your day," not just "here's the recipe."** Import parses the Reel into ingredients + macros, then fits it to the user's targets — the one move no recipe app and no tracker does end-to-end.
- **Uniquely Suppr's, and free.** Cal AI can't do it (no recipe layer — and it's now MFP-owned and paywalled). MacroFactor doesn't do it. MFP's import is broken/legacy. Suppr does it on the free tier.
- Aspirational + practical: "I want to eat what creators eat without doing the math — and without paying $20/mo."

**Saturation:** Low. Nobody owns this corner.

**Risk:** Must work on ≥90% of food Reels or the demo dies on attempt 3. **Polish blocker.**

### 2. Voice log — **the novelty bet**

**Hook:** "I just talked to my fridge."

**Demo:** Open Suppr → tap mic → "I had a chicken sandwich, an apple, and a coffee with milk" → logged in 4 seconds with macros.

**Why it works:**
- Fast, novel, low effort. Most apps still type or photograph.
- Strong against MFP (typing) and photo-log apps (now a paywalled $10–20/mo flow): "Did you really photograph every ingredient?" Voice log is on Suppr's free tier.
- Demonstrates AI capability without saying "AI" (which audiences are increasingly tired of).

**Saturation:** Low. Voice logging exists in MyFitnessPal but is poorly surfaced.

**Risk:** End-to-end latency must be <3 seconds. **Polish blocker.**

### 3. Photo log — **the no-paywall bet** (accuracy/honesty as the rider)

**Lead hook:** "Cal AI and MyFitnessPal now charge you to scan a meal. Suppr does it for free."

**Secondary hook (the honesty rider):** "And here's the part they hide — Suppr shows you how *confident* the estimate is. Cal AI just states a number."

**Demo:** Photograph a meal in Suppr → macros + the confidence meter, on the free tier. Optional B-roll: the MFP / Cal AI paywall screen ("$19.99/mo" / "$9.99/mo after trial") that gates the same action. Optional rider: a manual weigh-out to show Suppr's estimate lands in the honest range.

**Why it works:**
- **The wedge moved.** Since MFP *acquired* Cal AI (Mar 2026), AI photo logging is paywalled on both — MFP Premium ($19.99/mo) and Cal AI ($9.99/mo after trial), and Cal AI was pulled from the App Store (Apr 2026) over paywall dark patterns. "Free vs a $20/mo wall" is cleaner and more defensible than "we're more accurate."
- **Honesty is the secondary differentiator, not the headline.** Suppr is the only one *showing* uncertainty (the 4-segment confidence meter). Lead with free; close with honest.
- Repeatable content format (one "they paywall this, we don't" per video).

**Saturation:** Medium. The accuracy-showdown turf is crowded and now awkward (the former "leader" is paywalled and delisted); the "no-paywall on the basics" angle is wide open.

**Risk:** Don't over-claim accuracy — lead with the paywall fact (verifiable) and frame accuracy as "honest estimate + visible confidence," not "we beat Cal AI." Photo-log quality still has to clear the table-stakes bar (see Phase 0). **Polish blocker (quality, not superiority).**

### 4. Onboarding speed-run — **the MFP-refugee bet**

**Hook:** "Cancelled MyFitnessPal. Set up Suppr in 90 seconds."

**Demo:** Timer starts. Open App Store → install → onboarding flow → first meal logged. Whole thing under 90s.

**Why it works:**
- MFP-refugee specific — time-limited tailwind (exodus is happening NOW).
- MFP's onboarding is famously bloated (15+ screens, ads, paywalls).
- Activates the "I should switch" thought already in viewers' heads.

**Saturation:** Low for now; window closes ~Q3 2026 as refugees settle.

**Risk:** Onboarding completion rate must be ≥60% (currently unknown). **Polish blocker.**

### 5. "Solo dev built this in 2 months" — **the build-in-public bet**

**Hook:** "Week 12 of building a MyFitnessPal alternative as a solo dev. Here's what's new."

**Demo:** Showcase the new feature of the week. Brief context on why it matters. Optional: code-time + commit graph in background.

**Why it works:**
- Niche-Twitter and indie-hacker TikTok love this story.
- Parasocial trust compounds — viewers want the founder to win.
- Inversion of "VC-backed unicorn" narrative.
- Naturally drives App Store reviews ("I'm rooting for this dev").

**Saturation:** Low. Suppr's specific positioning (solo, 2 months, real product) is rare.

**Risk:** Personality fatigue if Grace doesn't enjoy being on camera. Mitigate: 1 founder-led post/week, not daily.

### 6. Plate loop — **the trust bet** (Year 2 content)

**Hook:** "My phone knows what I should eat for dinner."

**Demo:** Today screen → "Dinner could hit 2,200 cal if you make X" → user accepts → recipe loads.

**Why it works:**
- Demonstrates intelligence layer (not just tracking).
- Differentiates from MFP/Lose It (passive tracking) and Cal AI (post-hoc logging).

**Saturation:** Low.

**Risk:** Requires more context to land — better for Year 2 trust-building content than Year 1 acquisition.

---

## Format selection: hybrid (faceless + occasional founder POV)

| Format | Time per video | Conversion to install | Personality risk | When |
|---|---|---|---|---|
| Faceless screen-record + voiceover | 30–45 min | Good | Low | Daily — magic-moment demos |
| Founder-led talking head | 60–90 min | Higher | High | Weekly — build-in-public posts |

**Why hybrid:**
- Cal AI = pure faceless. Works because their hook is the AI.
- Honeydew = founder-led. Works because the founder is the differentiator.
- Suppr has both: a strong product hook AND a strong founder story (2-month solo build).

**Recommended split:**
- **Mon–Sat:** 1–2 faceless demos/day (varied magic moments).
- **Sunday:** 1 founder-led "what I shipped this week" post.

---

## 12-month roadmap

### Phase 0: Polish (now → 2026-06-30) — **DO NOT post viral content yet**

Pour viral fuel on a leaky bucket and you waste it. Lock these before pushing:

- [ ] **Recipe import reliability ≥ 90%.** Feed 100 random TikTok food Reels through import. Log success rate. Fix the failures.
- [ ] **Photo log clears the table-stakes quality bar (honest estimate + visible confidence).** Build a 20-meal benchmark with manually-weighed ground truth; Suppr's estimates must land in a credible range and the confidence meter must read honestly. This is now a *quality gate*, not the differentiator — the wedge is "free, no paywall" + the import-→-fit loop, not "more accurate than Cal AI" (which is MFP-owned, paywalled, and App-Store-delisted post-acquisition). (ENG-6)
- [ ] **Voice log latency <3s end-to-end.** Measure from tap-mic to confirmation. Currently unknown.
- [ ] **Onboarding completion ≥ 60%.** Instrument and measure. If below, redesign before push.
- [ ] **App Store rating ≥ 4.6.** Currently unknown (Grace is sole tester). Need wider beta first.
- [ ] **Referral mechanic shipped.** "Invite a friend, both get 1 month Pro free" or similar (spec below).
- [ ] **Plate-loop daily active rate ≥ 40%.** Measured across active users — if users don't come back tomorrow, they don't come back ever.
- [ ] **Apple SBP enrolment confirmed** (per `project_apple_sbp_status.md`). Active before first paid sub.
- [ ] **App Store listing optimised.** Screenshots, description, keywords. Below-quality store listing tanks the funnel.
- [ ] **Content batch prep: 14 days of content filmed + edited.** Don't post live from Day 1.

**Phase 0 ship gate:** all 10 boxes checked before content push begins. Skipping = wasted virality.

### Phase 1: Push (2026-07-01 → 2026-12-31) — content > product

| Month | Followers (combined) | Best video | App installs from social | Focus |
|---|---|---|---|---|
| Jul (M1) | 1k | 10k views | ~100 | Find which hook works. 1–2 posts/day. |
| Sep (M3) | 10k | 100k+ | ~1,000 | First signal. 2–3 posts/day. |
| Dec (M6) | 50k | 1M+ | ~10,000 | First viral hit. Hire editor. |

- **Time commitment:** ~17–23 hrs/week (effectively part-time job).
- **Spend:** $0 budget for organic. Optional: $500–2k/mo for video editor after Month 3 if traction.
- **Product:** ship only critical fixes. No new features unless they unblock content.

### Phase 2: Scale (2027-01-01 → 2027-06-30) — divide and conquer

- If TikTok channel proven (Month 12 ≥ 200k followers + 5M+ view hit + 50k installs):
  - **Raise £200k–500k** (angel or pre-seed) to fund team + infra.
  - **Hire 1 engineer** to take product velocity off Grace's plate.
  - **Hire 1 growth/community person** (part-time → full-time) for content production + community management.
  - **Add referral mechanic to drive k-factor ≥ 0.5.**
- If TikTok channel not proven by Month 12:
  - **Pause content push.** Diagnose product or hook problem. Don't burn money on a leaky bucket.
  - Consider pivot in narrative: founder-led story arc, or paid acquisition test.

### Phase 3: 1M push (2027-07-01 → 2028-12-31)

- Team of 3–4. Grace on product strategy + spokesperson.
- TikTok + Instagram daily content. Hire 2nd creator if scale demands.
- Begin paid acquisition layered on top of organic ($5–10k/mo Meta/Google).
- Press tour: Wired, TechCrunch, podcasts (My First Million, Lenny's Newsletter, Indie Hackers).
- Partnership tier: 5–10 mid-tier influencer deals/month.
- Begin Android port if iOS plateau hit.

---

## Hooks library — opening lines to test

Hooks live or die in the first 1.5 seconds. Test these. Iterate. Steal what works from each other.

### Recipe import hooks (lead hook: import the Reel → fit your macros)

1. "I saved this recipe on TikTok. Watch it become a meal that fits my day." (demo-first, fit-your-macros)
2. "Stop screenshotting recipes. Watch this one snap to my macros." (anti-pattern)
3. "Every recipe I save on TikTok now fits straight into my targets." (volume + fit)
4. "Cooking influencers don't want you to know about this." (curiosity)
5. "TikTok recipes never tell you the calories. This imports them — and fits them to your day." (problem-stated)
6. "MyFitnessPal can't do this, and here it's free. I built something that can." (competitor frame)

### Voice log hooks

1. "I just talked to my fridge."
2. "Logging food without typing or photographing it."
3. "30 days of food logged. Average time per meal: 3 seconds."
4. "I told my phone what I had for lunch. Look."
5. "MFP takes me 2 minutes per meal. This took 4 seconds."

### Photo log hooks (lead: no paywall · rider: honesty)

1. "MyFitnessPal and Cal AI now charge ~$20/mo to scan a meal. Watch me do it for free." (lead — no-paywall)
2. "They paywalled the photo scan. So here's one that's free." (lead — no-paywall)
3. "Every calorie app gives you a number. Mine tells you how sure it is." (rider — honesty)
4. "AI calorie scans are mostly vibes — so we show you the confidence, not just the number." (rider — honesty)
5. "I weighed every ingredient, then checked what the AI said." (rider — honesty)

### No-paywall hooks (lead: we don't paywall the basics)

The cleanest post-acquisition wedge: the category leaders now gate photo scan, barcode, and AI behind ~$20/mo. Suppr keeps the basics free.

1. "The big calorie apps now paywall photo scan, barcode, and AI. Here's what's free." (category frame)
2. "MyFitnessPal charges $19.99/mo for what Suppr gives you free." (direct)
3. "No ads. No barcode paywall. No $20/mo to scan a meal. That's the whole pitch." (clean)
4. "I'm a solo dev — and I refuse to paywall the basics. Here's the free tier." (founder + values)

### Onboarding speed-run hooks

1. "I cancelled MyFitnessPal. Set up Suppr in 90 seconds."
2. "MFP onboarding has 17 screens. I built one with 4."
3. "First-day MFP refugee? Watch."

### Build-in-public hooks

1. "Week 12 of building a MyFitnessPal alternative. Solo."
2. "I quit my job in March. Here's what I've built."
3. "Day 70 of building Suppr. Today I shipped X."
4. "Replying to a comment: 'Why bother building this?' Here's why."

### MFP-refugee hooks (time-limited, push hard 2026-05 → 2026-09)

1. "MFP is doing X again. There's a better way."
2. "If you're a MyFitnessPal refugee, watch this."
3. "Day 1 without MyFitnessPal. Here's what I switched to."
4. "[MFP-specific complaint] is why I built this."

---

## Hashtag strategy

TikTok and Instagram weight hashtags differently, but the playbook is similar: **niche-then-broaden**.

### Tier 1: Niche-deep (use 3–5 per post)

High intent, lower volume. Get found by people already looking.

- `#myfitnesspalalternative`
- `#mfprefugee`
- `#calorietrackingapp`
- `#caloriecounting`
- `#macrotracking`
- `#flexibledieting`
- `#caloriedeficit`
- `#tdee`
- `#mealplanning`
- `#mealprep`
- `#recipetracking`

### Tier 2: Niche-broad (use 2–3 per post)

Medium volume, still aligned audience.

- `#fitnesstech`
- `#healthapp`
- `#nutritionapp`
- `#weightlossapp`
- `#diettips`
- `#mealprepideas`

### Tier 3: Broad (use 1–2 per post for reach)

High volume, low conversion. Use sparingly.

- `#fitness`
- `#weightloss`
- `#cooking`
- `#recipes`
- `#health`

### Tier 4: Build-in-public / indie

For founder-led content.

- `#buildinpublic`
- `#indiedev`
- `#solofounder`
- `#startuplife`
- `#indiehacker`

**Format:** mix tiers in every post. Don't use all 30 — TikTok rewards relevance, not stuffing. **3 Tier-1 + 2 Tier-2 + 1 Tier-3 = ideal.**

**Iterate weekly.** Track which posts perform; double down on the hashtag clusters that drove views.

---

## Posting schedule + cadence

### TikTok

- **Mon–Sat:** 2 posts/day. Morning (7–9 AM ET) + evening (6–9 PM ET) for US audience overlap with UK morning + evening.
- **Sunday:** 1 post (founder-led build-in-public).
- **Total:** 13 posts/week.

### Instagram Reels

- **Cross-post 80% of TikToks** with 24-hour delay. Reformat captions for IG (less aggressive hook, more product-focused).
- **2 carousel posts/week** specifically for Instagram: macro education, recipe roundups, before-after style (without body-shaming).

### Threads / Twitter

- **Daily founder-thread.** 200–400 chars. Build-in-public stats, shipping updates, opinions on competitor moves.
- **Cross-post via Buffer.**

### Cadence is non-negotiable

Algorithm rewards consistency. Pre-batching 14 days of content (Phase 0) gives 2-week runway for any sick day, build crisis, or family week. **Never go dark for more than 3 days without a scheduled break.**

---

## Cross-platform strategy

| Platform | Strengths | Format-specific tweaks | Priority |
|---|---|---|---|
| **TikTok** | Discovery algorithm, lowest follower → reach friction | Loud hooks, fast cuts, captions for mute-watching | 1 |
| **Instagram Reels** | Higher-LTV audience (older + more disposable income), better for product depth | Slightly slower pace, more "premium" feel, IG-native music | 2 |
| **YouTube Shorts** | Long-tail discovery, evergreen | Same content as TikTok, no further work | 3 (auto-post) |
| **Threads** | Founder narrative, build-in-public crowd | Text-first, no video needed | 4 |
| **Twitter** | Indie/tech audience, reach diminished but loyal | Short threads, occasional viral hits | 4 |
| **Reddit** | MFP refugee capture, niche-deep | Long-form, founder-honest, no marketing tone | 2 (time-limited) |

**Single content creator, multiple platforms:** 1 video gets cut/repurposed for TikTok → IG Reels → YT Shorts → Threads/Twitter text version. Tool: CapCut (free) + Buffer/Hypefury for scheduling.

---

## Reddit MFP-refugee playbook

The MFP exodus 2026-05-03 is a once-in-a-cycle moment. Reddit is where it's happening. **Time-limited: push hard May–August, then taper.**

### Target subreddits

| Subreddit | Members | Approach | Mod-friendliness |
|---|---|---|---|
| r/loseit | 4M | Long-form "what I switched to" posts | Strict — no marketing language |
| r/MyFitnessPal | 50k | Active complaint threads — answer with helpful comparison | Variable — read mod rules |
| r/1200isplenty | 600k | Recipe + macro discussions | Medium |
| r/macros | 25k | Technical macro audience | Open |
| r/intuitiveeating | 80k | Avoid — anti-tracking audience | Skip |
| r/Volumeeating | 1M | Recipe-heavy, calorie-aware | Medium |
| r/EatCheapAndHealthy | 3M | Recipe-heavy | Open |
| r/AndroidApps / r/iosapps | 200k each | "I built an app" posts on launch | Open — flag as developer |

### Post templates

**Template 1 — "What I switched to" (most powerful):**
```
After [N] years on MyFitnessPal I finally switched. Here's what worked and didn't.

Background: [your story, real, brief]

What I tried: [Lose It, Cronometer, MacroFactor, Suppr — be honest about each]

What worked for me: [Suppr-specific reasons, framed as personal choice]

What didn't: [genuine drawbacks, including Suppr's]

Happy to answer questions.
```

**Template 2 — "Helpful answer in a complaint thread":**
Wait for an active MFP complaint thread. Comment helpfully:
```
I had the same problem with [X]. Switched to [Suppr] about [time] ago — the [specific feature] solved it for me.
Drawbacks I've noticed: [honest list].
DM me if you want more detail.
```

**Template 3 — Founder transparency post:**
```
I built a MyFitnessPal alternative as a solo dev because [reason]. AMA.
```
(Only post in subs where this is allowed; flag yourself as the dev.)

### Reddit rules to follow

- **Never mass-post the same content.** Mods detect this. One sub at a time, tailored.
- **Don't lead with the link.** Mention Suppr by name; link only if asked or in comments.
- **Disclose you built it.** "I'm the dev" — Reddit punishes hidden marketing and rewards honesty.
- **Answer comments for 48 hours.** A post that converts is one where the OP is responsive.
- **Read rules per sub.** Some bans self-promo entirely; some require flair.

### Reddit success metric

- 5–10 substantive posts over 8 weeks.
- ~10–50k upvotes total across the campaign.
- ~5–15k installs from Reddit traffic.
- 2–5 mod warnings is acceptable; 1 ban is a signal to back off that sub.

---

## Creator partnership framework

For Phase 2+, after organic traction proven.

### Tiers

| Tier | Follower range | Cost per deal | Expected installs | Priority |
|---|---|---|---|---|
| Nano | 5k–25k | $50–200 or free Pro | 50–300 | High in Year 1 — cheap, authentic |
| Micro | 25k–100k | $500–2k | 500–3k | Year 1 Q4 |
| Mid | 100k–500k | $2k–10k | 3k–15k | Year 2 |
| Macro | 500k–5M | $10k–50k | 15k–80k | Year 2 H2 (when funded) |
| Mega | 5M+ | $50k+ | 80k+ | Year 3 |

### Niches to target (in order)

1. **Fitness coaches / macro coaches** — high intent audience, direct overlap.
2. **MFP-disaffected creators** — those publicly switching = goldmine.
3. **Recipe / food creators** — recipe-import demo is native to their content.
4. **Indie-tech / build-in-public creators** — for founder narrative.
5. **Health-skeptic / wellness-detox creators** — Suppr's body-neutral + science-grounded positioning resonates.

### Deal structure (default)

- Free Pro for life + $X paid promo OR pure equity-of-attention deal (no $)
- One sponsored post + one organic mention 30 days later (organic mention performs better than the paid one)
- Custom referral code (track installs, conversions, ROI per deal)
- Use raw demo footage they shoot — DON'T over-produce; authenticity converts

### Outreach playbook

- DM, not email. TikTok/IG creators check DMs.
- Open with: "I'm a solo dev who built a MyFitnessPal alternative. Loved your post on X — I think your audience would love what I made. Want a free Pro account and to chat?"
- Don't lead with money. Let them ask.
- Track in a simple spreadsheet: name, handle, deal, paid, installs, conversions, ROI.

---

## Referral mechanic spec

**Goal:** k-factor ≥ 0.5 (every paying user brings 0.5 more on average). Multiplies every organic acquisition.

### Mechanic

- In-app share button: "Invite a friend → both get 1 month Pro free"
- Unique deep link per user: `suppr.app/i/<userId>?source=referral`
- Friend installs + completes onboarding → both users credited with 30 days Pro
- If friend already paid → giver gets 30 days, friend gets 60 days

### Trigger placement

- After first meal logged (joy moment)
- After first recipe imported (magic moment)
- After 7-day streak (commitment moment)
- In Settings → "Earn free Pro" (passive)

### Tracking

- Event: `referral.link_generated` { userId }
- Event: `referral.link_shared` { userId, channel: 'sms'/'whatsapp'/'copy'/etc. }
- Event: `referral.install_attributed` { referrerId, refereeId }
- Event: `referral.reward_granted` { userId, daysCredited }

### Anti-abuse

- One reward per phone/device pair
- Max 12 months/year of free Pro per user (prevents farming)
- Auto-flag if user generates >20 referrals/week without conversion

### Phase 0 ship gate

Referral mechanic is one of the 10 Phase 0 polish items. Don't push viral content without it — every viral install with no in-product share button is k-factor wasted.

---

## Press / launch sequencing

For Phase 1 end / Phase 2 start (Q4 2026 → Q1 2027).

### Outreach order

1. **Product Hunt launch** (Q3 2026, after polish phase). Free. Builds founder credibility. Aim for top 5 of the day.
2. **Indie Hackers feature.** Free. Pitch via Courtland Allen's Twitter or IH submission.
3. **My First Million podcast.** Free. Pitch when you have a viral hit ≥1M views to talk about.
4. **Lenny's Newsletter / Lenny's Podcast.** Free. Pitch when you have growth metrics to share.
5. **TechCrunch / Wired / The Verge.** Free but slow. Pitch around app store launch or a funding event.
6. **Local press (UK/Cayman).** Free. Wired UK, Sifted EU. Founder + tech angle.

### What you need before pitching

- App Store live (not TestFlight)
- ≥10k users
- One quote-worthy stat ("solo dev built X in Y months, hit Z users")
- Working press kit (screenshots, logo, founder photo, 100-word + 500-word descriptions)

### Press kit

Build this once in Phase 0 (cheap):
- 10 high-res screenshots (web + mobile)
- Logo files (SVG + PNG, light + dark variants)
- Founder headshot (high-res, neutral background)
- Boilerplate: 100-word + 500-word app description
- Founder bio (200 words)
- Existing coverage links (start empty, fill as you go)
- Direct contact + media kit URL: `suppr.app/press`

---

## KPI framework

### Weekly review (every Monday, 30 min)

| Metric | Source | Green | Amber | Red |
|---|---|---|---|---|
| New TikTok followers | TikTok Analytics | +500/wk | 100–500 | <100 |
| New IG followers | IG Insights | +300/wk | 50–300 | <50 |
| Best video views | Platform analytics | >50k | 5k–50k | <5k |
| App installs (TestFlight/App Store) | RevenueCat + App Store Connect | +200/wk | 50–200 | <50 |
| Free → Paid conversion | Stripe + RC | ≥2% | 1–2% | <1% |
| Onboarding completion | PostHog | ≥60% | 40–60% | <40% |
| App Store rating | App Store Connect | ≥4.6 | 4.3–4.6 | <4.3 |

**Red on 3+ metrics = stop and diagnose. Don't keep pushing.**

### Monthly review (1st of month, 2 hours)

- All weekly metrics, rolled up
- Cohort retention (week 1, 4, 12 active rate)
- Cost per install by channel (organic should be £0; track paid separately)
- Net Promoter Score (in-app survey, monthly)
- Top 10 videos by views; what's the pattern?
- Refresh hashtag strategy based on what worked

### Quarterly review (1st of quarter, half-day)

- Full strategy revisit: is the channel working?
- Hire decisions (editor, growth person, engineer)
- Spend decisions (paid acquisition test? influencer push?)
- Product strategy: what unblocks more content?

---

## Decision triggers — double down vs pivot

### Double-down signals (any 2 of 3 = press the lever)

- Best video this month ≥ 5× best video last month
- Combined follower count growing ≥ 30% month-over-month
- App installs from social ≥ 3× cost (if any) for 2 months running

**Response:** hire editor, increase posting volume, double content batches.

### Pivot signals (any 1 of 3 = back to drawing board)

- 60 days post-launch with no video ≥ 100k views
- App Store rating sliding below 4.3
- Free → Paid conversion stuck below 1.5% for 60+ days

**Response:** stop posting for 1 week. Diagnose: product or hook? Re-batch new content angle. If 2 pivot attempts fail, consider paid acquisition test or category pivot.

### Stop signal (any 1 = full strategy review)

- 6 months post-launch with <20k total followers
- Burn rate doubling without revenue tracking

**Response:** pause content, full retrospective. Maybe TikTok isn't the channel.

---

## Hire-when triggers

| Role | Trigger | Cost (£/mo) | Why |
|---|---|---|---|
| Video editor (part-time) | 50k combined followers OR 3 viral hits | £500–2k | Time-leverage on content |
| Community manager | 100k followers OR DMs unmanageable | £1k–2.5k | Manage comments, DMs, partnerships |
| Engineer (full-time) | £15k MRR OR £200k+ raised | £4k–8k | Take product velocity off founder |
| Growth lead (full-time) | £25k MRR OR full-scale push | £5k–10k | Strategy + paid acquisition + partnerships |
| Designer (contract) | First major redesign needed | £2k/project | Brand polish at scale |

**Do not hire before triggers.** Premature hiring at pre-PMF = burn-rate accelerator with no revenue upside.

---

## Budget breakdown by phase

### Phase 0: Polish (now → 2026-06-30)

| Item | Cost |
|---|---|
| Time (your own) | 80–120 hrs/mo |
| Tools (CapCut, Buffer, etc.) | £0 (free tiers) |
| Content batch prep | £0 |
| App Store assets | £0 (you make them) |
| Press kit | £0 (you make it) |
| **Total cash spend** | **~£0** |

### Phase 1: Push (2026-07-01 → 2026-12-31)

| Item | Cost |
|---|---|
| Tools (Buffer paid, ChatGPT/Claude for ideation) | £30–50/mo |
| Stock music / SFX (if used) | £20/mo (Epidemic Sound or similar) |
| Optional video editor (from Month 3) | £500–2k/mo |
| Tripod, light, USB mic upgrade | £200 one-time |
| **Total cash spend** | **~£200–2,200/mo** (editor is the big lever) |

### Phase 2: Scale (2027-01 → 2027-06)

| Item | Cost |
|---|---|
| Video editor (full-time freelance) | £2–4k/mo |
| Community manager (part-time) | £1–2k/mo |
| Influencer deals (5–10/mo) | £2–10k/mo |
| Paid acquisition test (Meta/Google) | £2–8k/mo |
| Tools (premium tiers) | £200/mo |
| **Total cash spend** | **~£7–25k/mo** (requires funding) |

### Phase 3: 1M push (2027-07 → 2028-12)

- Full team + paid acquisition. £30–80k/mo burn. Funded.

**Discipline:** every spend decision in Phase 1 must be justified by traction in the previous month. Don't pre-spend on faith.

---

## Tools list

### Content production

- **CapCut** (free) — TikTok/Reels editing. Industry standard.
- **iPhone** — camera. No need for DSLR.
- **iPhone tripod + ring light** — £30–80 one-time.
- **USB lavalier mic** (e.g. RØDE Wireless GO) — £150–250 for founder-led videos.
- **Epidemic Sound** (£12/mo) — royalty-free music. Avoid copyright strikes.

### Scheduling + analytics

- **Buffer** or **Hypefury** — cross-post scheduling (£15–30/mo).
- **TikTok Analytics** — native, free.
- **Instagram Insights** — native, free.
- **PostHog** (already in stack, project 389168) — in-app event tracking.
- **App Store Connect** — install + revenue tracking.
- **RevenueCat dashboard** — mobile sub tracking.

### Ideation + writing

- **Claude / ChatGPT** — hook brainstorming, script drafts, hashtag iteration. (Already part of stack.)
- **TikTok Creative Center** — trending hashtags, sounds, content discovery.

### Asset management

- **Notion** — content calendar (the existing DB).
- **Frame.io** (free tier) — if you bring on an editor for review/feedback loops.

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Recipe import fails on viral demo | Medium | High | Phase 0 reliability test (≥90% on 100 Reels) |
| App Store rating drops below 4.3 | Medium | High | Beta-test with 50+ users before App Store launch |
| MFP exodus already over by time we push | Medium | Medium | Push Reddit playbook now (not waiting for July) |
| Burnout (solo, content + product) | High | High | Pre-batch content; hard switch to content-focus July 1 |
| MFP (now incl. Cal AI) copies recipe-import-→-fit-macros | Low (12 mo) | Medium | Moat = the free import-→-fit-your-macros loop + attributed creator links; deepen cuisines, UI, recipe-creator partnerships. They paywall the basics — staying free-on-the-basics is itself a moat. |
| Apple rejects app | Low | Critical | Phase 0 includes App Store review checklist |
| Viral hit happens before polish done | Medium | High | DO NOT post real content until Phase 0 complete |
| FTC/ASA disclosure compliance | Medium | Medium | All sponsored posts use #ad; all health claims qualified |
| Body-image / weight-loss backlash | Medium | High | Body-neutral copy throughout; never use before/after weight photos |
| TikTok ban (US or UK) | Low | Critical | Multi-platform from Day 1 (IG Reels, YT Shorts) |
| Apple SBP not enrolled before first paid sub | Low | High | Locked in `project_apple_sbp_status.md` memory; enrol pre-launch |

---

## Legal + disclosure rules

### FTC / ASA / equivalent

- All sponsored creator posts MUST include `#ad` or `#sponsored` in first line of caption.
- All Suppr-led content with paid promotion: disclose.
- All giveaways: terms link, no purchase necessary, age limits.

### Health claims

- Never claim Suppr causes weight loss, treats conditions, or replaces medical advice.
- Use: "track your nutrition", "build sustainable habits", "understand your food".
- Avoid: "lose weight", "burn fat", "cure diabetes".
- All AI-generated content (photo log, voice log) disclosed in-product per `project_progress_direction.md` and AI disclosure rules.

### Body imagery

- No before/after weight photos.
- No body-shaming language ("flat tummy", "shredded", "bikini body").
- Body-neutral copy throughout (per diversity-inclusion audit, `docs/decisions/2026-04-19-diversity-inclusion-audit.md`).
- Diverse representation in any creator partnerships.

### Trademark + competitor mention

- Never claim Suppr is "better than MyFitnessPal" without comparison data (could be challenged).
- Use Suppr's name as a noun, not a verb.
- Don't use competitor logos in videos without fair-use review.

---

## Brand voice on social

**Same brand voice as elsewhere, just more energetic.** Per brand guidelines:
- Warm, not cold
- Honest, not hyped
- Body-neutral, not diet-culture
- Cook-friendly, not gym-bro
- British understatement, never American shout

**TikTok tweaks:**
- Hooks can be louder ("Watch this", "Stop screenshotting") — earned by the platform's attention economy.
- Punchlines deliver clean facts ("3 seconds", "90% accuracy") not aspirational fluff.
- Founder posts can have personality (jokes, frustration, wins) — Grace is the brand.

**Don't say:**
- "Game-changer"
- "Revolutionary"
- "Disrupting nutrition tracking"
- "AI-powered nutrition intelligence platform"
- Anything Cal AI's marketing says

**Do say:**
- "I built this"
- "Here's how it works"
- "[Specific number, specific time]"
- "Try it and tell me what you think"

---

## Content batch workflow

Pre-batching is the difference between consistent posting and burnout.

### 2-week batch cadence

Every other Saturday, batch 14 days of content. 4 hours total.

| Hour | Activity |
|---|---|
| 1 | Plan + script (review what worked last 2 weeks; pick 28 hooks; outline each) |
| 2 | Film (back-to-back, in 1 sitting, same outfit + background OR varied to look spread) |
| 3 | Edit (CapCut, 1–2 min per video using templates) |
| 4 | Schedule (Buffer/Hypefury, 14 days × 2 platforms = 28+ posts queued) |

### Founder-led batch (1×/week, Sunday)

- 15 min: outline what shipped this week
- 30 min: film
- 30 min: edit + caption
- 15 min: schedule

### Total weekly content time

- Phase 1 (solo, no editor): ~6 hrs/week filming + editing + scheduling
- Phase 1 with editor (Month 3+): ~2 hrs/week (you film raw, editor finishes)

### What to do if you fall behind

- **2 days behind:** post 3×/day for 2 days to catch up.
- **5 days behind:** pause non-essential posts, batch 7 days fresh, resume.
- **2 weeks behind:** stop. Review whether you should be doing this. Don't apology-post.

---

## Iteration cadence

| Cadence | What |
|---|---|
| Daily | Check yesterday's best post; reply to comments for 30 min |
| Weekly (Mon) | KPI review (table above); pick next batch's hooks based on what worked |
| Monthly (1st) | Full strategy review; refresh hashtags; decide hire/no-hire |
| Quarterly | Channel review: is TikTok still the bet? Format works? Niche right? |

---

## Open questions to resolve in Phase 0

1. **What's the actual recipe-import success rate on TikTok Reels?** (Test 100 Reels, log result.)
2. **What's voice-log latency end-to-end on iPhone 13/14/15?** (Measure in TestFlight.)
3. **Does photo-log accuracy clear the table-stakes quality bar (honest estimate + visible confidence)?** (Build the 20-meal weighed benchmark, test, iterate — ENG-6, Done. This is now a quality gate, not the differentiator: the wedge is "free + no paywall" + the import-→-fit loop, since Cal AI is MFP-owned, paywalled, and delisted.)
4. **What's onboarding completion rate?** (Instrument with PostHog, measure on 50-person beta.)
5. **Is referral mechanic spec'd and shipped?** (Use spec above; engineering 1–2 weeks.)
6. **Is Apple SBP enrolled?** (App Store Connect → Agreements, Tax, Banking.)
7. **Is App Store listing optimised?** (Screenshots, description, keywords — content + design pass.)
8. **Are 14 days of content batched and ready?** (Don't push until yes.)
9. **What's the Grace face-on-camera comfort level?** (Decides hybrid vs pure-faceless ratio.)
10. **What's the founder narrative pitch?** (Practiced. Used in every founder-led post + every press conversation.)

---

## Where this lives

- **Canonical: this file** (`docs/growth/tiktok-instagram-viral-plan.md`).
- **Notion summary:** Growth & marketing → "Viral growth strategy" section. Summary + link back here.
- **Income projection ties to this:** see `docs/finance/income-projection.md` — the "MFP-capture upside" scenario is this plan executed well.
- **Tasks:** every Phase 0 polish item should become a row in Notion → Tasks DB with owner = Grace and due = 2026-06-30.

---

## TL;DR — what to do this week

1. **Test recipe import on 100 TikTok food Reels.** Log success rate. 4 hours.
2. **Build photo-log benchmark set** (20 meals, manually weighed) to clear the table-stakes quality bar — honest estimate + visible confidence (ENG-6). Note: the hook is now "free, no $20/mo paywall," not "more accurate than Cal AI." 6 hours.
3. **Measure onboarding completion** on existing TestFlight data via PostHog. 1 hour.
4. **Enrol Apple Small Business Program** in App Store Connect. 30 minutes.
5. **Draft 28 hook ideas** using the library above. 2 hours.
6. **Spec the referral mechanic** with engineering effort estimate. 2 hours.

Total: ~16 hours of focused work. Output: clear picture of how close Phase 0 is to done, and a list of what's blocking the content push.
