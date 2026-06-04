# Sloe — per-screen Mobbin benchmark (2026-06-02)

Each Figma frame vs its best-in-class comparable on Mobbin. Verdict key:
**✅ at/above bar** · **🔶 minor polish** · **⚠️ below bar (real gap)**.
Direction anchor = Julienne (look/feel). Function anchors = the named nutrition/recipe leaders.

Grounded on rendered captures of every screen below + Mobbin pulls (Julienne, NYT Cooking, Kitchen Stories, HelloFresh, CREME, MacroFactor, MFP, Noom, Zero, Withings, Cherrypick, SideChef, Centr, Recime, Lifesum).

## Core 11

| Screen | Comparable | Verdict | Top gap / action |
|---|---|---|---|
| 01 Today | MacroFactor + Lifesum | ✅ above bar | Multi-ring (cals+macros) + tiles + "what to eat next" exceeds MFP/MacroFactor's single ring. Keep. Optional: MacroFactor-style thin macro **progress bars** as a secondary view. |
| 02 Recipe detail | Julienne / NYT Cooking | 🔶 | Add **★rating + reviews count** and **"used in N plans"**; NYT/Julienne show social proof. Hero + macros + Cook bar already strong. |
| 03 Cookbook (Library) | Julienne / Recime | ✅ | Chip set now matches Julienne. 🔶 add **collection folders** (Recime "Cookbooks" tab) later. |
| 04 Plan | Cherrypick / SideChef | ⚠️ | Add a prominent **"Add all to shopping list"** CTA (SideChef "Add all to cart") + a **week day-strip** with drag affordance. Currently day rows only. |
| 05 Progress | MacroFactor / Noom / Zero | ⚠️ | Weight chart needs a **goal line + trajectory** (Noom dotted goal line) and a **week/month/year toggle** (Zero/Withings). Add an inline **Log weight** pill. |
| 06 Import | Julienne import sheet | ✅ | Link/photo/video/text sources match Julienne. Keep. |
| 07 Onboarding goal | Julienne / Noom | ✅ | Matches. |
| 08 Paywall | RevenueCat-class paywalls | 🔶 | Region-aware price still placeholder (£4.99). Trust chips good. |
| 09 Settings | Standard | ✅ | Fine. |
| 10 Ask | (post-launch) | — | Deferred per scope. |
| 11 Log a meal | MacroFactor log sheet | ✅ | Single Log sheet matches. |

## Drill-downs / extras

| Screen | Comparable | Verdict | Top gap / action |
|---|---|---|---|
| D1 Macro detail | MacroFactor nutrient detail | ✅ | Pastel macro tiles align. |
| D2 Energy out | Apple Fitness / MacroFactor expenditure | ✅ | — |
| D3 Meal nutrition | MFP food detail | ✅ | — |
| D4 Weight metric | Zero / Withings | 🔶 | Same goal-line gap as Progress. |
| D5 Fasting | **Zero** (category leader) | ✅ | Ring + window + start/end matches Zero. 🔶 add a fasting-stage timeline (Zero's stage ticks). |
| D6 Cook mode | HelloFresh / Kitchen Stories / CREME | ⚠️ | Add an **active-timer chip overlaid on the step image** (Kitchen Stories) and a **"ingredients for this step" peek** (CREME bottom bar). Currently a static "Start timer" button only. |
| D7 Weekly recap | Cal-AI / Cabinet recap | ✅ | "Strong week" + 6/7 + share is strong. |
| D8 Shopping list | **Recime** / SideChef | ⚠️ | Add **ingredient thumbnails** (we now have the §11.1 allergen/ingredient image pipeline!) + **"used in N recipes"** per item (SideChef). Aisle grouping already there. |
| D9 Targets | MacroFactor targets | ✅ | — |
| D10 Household | (niche) | ✅ | — |
| D11 New recipe | Julienne create | ✅ | — |
| D12 Verify recipe | (Sloe-unique) | ✅ | Confidence bars are a differentiator. |
| D13 Discover | **NYT Cooking** / Julienne | ⚠️ | Add a **collections row with count badges** (NYT "25 recipes") and a **short-form video row** ("Recipes in Action") — maps to our Reel-import hook. |
| D14 Creator | Instagram creator profile | 🔶 | Add follower/recipe counts for credibility. |

## States & flow

| Screen | Comparable | Verdict | Note |
|---|---|---|---|
| S1 Welcome | Julienne | ✅ | "Still reach your goals" copy in. |
| S2 About you | Noom intake | ✅ | — |
| S3 Pace | Noom / MacroFactor | ✅ | Amber warn tier good. |
| S4 Plan ready | Noom plan reveal | ✅ | — |
| S5/S6 Today empty/over | MacroFactor states | ✅ | Multi-ring states consistent. |
| S7–S9 Empty states | — | ✅ | Warm, on-brand. |
| S10–S12 Log modes (search/photo/voice) | MacroFactor / Cal-AI | ✅ | Photo/voice align with Cal-AI. |
| S13 Logged confirm | — | ✅ | — |
| S14 Diet preferences | **Julienne** | ✅ | Matches Julienne pattern. |
| S15 Allergies | **Julienne** | ✅ | Photoreal allergen images now match §11.1. |

## Loading / error / dark

| Screen | Comparable | Verdict | Note |
|---|---|---|---|
| L1/L2 Loading skeletons | standard | ✅ | — |
| L3/L4 Offline / import error | standard | ✅ | Recovery CTAs present. |
| L5/L6 Dark | — | ✅ | Neutral charcoal (de-purpled). |

## Web (desktop/tablet/mobile)

| Screen | Comparable | Verdict | Note |
|---|---|---|---|
| W1–3 Today web | HelloFresh / YNAB | ✅ | Main + right rail dashboard. |
| LP1–3 Landing | Julienne landing | ✅ | Premium editorial, soft sections, device set. 🔶 real price. |
| WO1–7 Onboarding web | Julienne / Noom web | ✅ | Split-screen. |

## Priority gaps (ranked) — ALL FIXED 2026-06-02

1. ✅ **D8 Shopping list** — ingredient thumbnails (Stitch §11.1 ing-*.png) + "Used in N recipes". Frame 289:2.
2. ✅ **D13 Discover** — Popular-collections row (count badges) + "Recipes in action" short-form video row + saving grid. Frame 290:2.
3. ✅ **05 Progress** — added dotted trajectory-to-goal + goal date + inline "Log weight" pill (range toggle + goal line already existed). Frame 293:2.
4. ✅ **04 Plan** — "Add this week to shopping list" elevated to primary CTA (day-strip already present). Frame 294:2.
5. ✅ **D6 Cook mode** — active timer chip overlaid on step image + "For this step" ingredient chips (w/ parmesan thumbnail). Frame 291:2.
6. ✅ **02 Recipe detail** — ★4.8 (213) rating added to meta row. Frame 292:2.

All six below-bar screens now at/above bar. Remaining = minor polish only (recipe-card rating/time/author on Library cards, creator counts, fasting stage timeline, real pricing).
