# Sloe — Senior Designer Direction Brief

**Date:** 2026-06-28
**Engagement:** One-off design-direction pass (option to extend to a light retainer)
**Hand-off model:** You set visual direction + deliver a spec. The Sloe team implements it in code. You are not expected to produce production assets or touch the codebase.

---

## 1. What Sloe is

A recipe + nutrition app for people who **love food and also have goals**. It fits the foods you love into your targets — bridging the gap between cold diet trackers (MyFitnessPal) and beautiful-but-goalless recipe apps. Core daily loop is **macro/calorie tracking**; the spread/virality hook is **recipe import** (e.g. saving a recipe from an Instagram Reel).

- Platforms: **iOS app (primary)** + responsive **web app**. They must stay visually in parity.
- Stack (for your awareness, not your concern): React Native / Expo (mobile), Next.js (web). Anything you spec must be buildable with standard native components — no bespoke engine work.
- Brand: mid-rebrand from "Suppr" to **Sloe**. Treat **Sloe** as the name. No logo work needed in this engagement unless you flag it.

## 2. The problem we're hiring you to fix

After several internal design passes the product still reads **inconsistent and cheap**. We can keep things *consistent* ourselves (we have design tokens and automated drift checks). What we lack is the **trained eye** for the craft layer — the difference between "it works" and "it feels premium." That's you.

We've broken "cheap" into six levers. Your job is to make a deliberate, top-tier call on each:

1. **Typography** — typeface choice + a real type ramp (today it leans on defaults).
2. **Spacing rhythm** — consistent, generous, intentional.
3. **Depth / material** — elevation, shadow, surface treatment (today: flat grey blocks, harsh borders).
4. **Colour** — a restrained, considered palette (not too saturated, not too many).
5. **Imagery** — food photography / texture / illustration direction. *High leverage for a food app — likely our single biggest cheap→premium lift.*
6. **Motion & haptics** — the motion language for key interactions (lowest priority; nail the static design first).

## 3. The bar (reference apps)

These three define the feeling we're chasing. Please pull them up (Mobbin / App Store) before starting:

- **Oura** — calm data presentation, real depth, restraint. *Take: how to make numbers/metrics feel premium and serene, not clinical.*
- **Lifesum** — warm, friendly nutrition done at a premium tier. *Take: warmth without cartoonishness; how a tracker can feel inviting.*
- **Julienne** — editorial recipe craft. *Take: typographic and imagery sophistication for the recipe surfaces.*

Net target feel: **warm, editorial, calm, premium** — for an audience of Oura/Apple-Watch aesthetes and NYT-Cooking-meets-macros users. Credible, not loud; no garish colour-hero.

## 4. Scope — surfaces to direct

Focus on the two surfaces on our critical path, plus the system foundations that ripple everywhere:

1. **Foundations** (apply across the whole app): palette, type ramp, spacing scale, elevation/depth model, iconography stance.
2. **Today tab** (the daily retention loop): calorie/macro hero, adherence, meal list. *Constraint: Today stays the centre of the product and stays minimal — do not redesign the information architecture or demote the dashboard. Elevate the craft, not the structure.*
3. **Recipes tab** (the viral hook): recipe cards, recipe detail, import.

If budget allows, one more: onboarding first-run. Otherwise leave it.

## 5. Hard constraints (work *with* these, not against them)

- **There is a canonical in-app design already** — the "v3 prototype" (`docs/ux/redesign/v3/Sloe-App.html`). We can share it rendered. Treat it as the current direction to **elevate**, not a blank canvas to replace. If you believe it should be overridden somewhere, say so explicitly with reasoning.
- **Tokens are the implementation layer.** We build from design tokens (`apps/mobile/constants/theme.ts`, `src/styles/theme.css`). Deliver your decisions as **token values** wherever possible (hex, px, weights, radii) so we can wire them directly.
  - Spacing must snap to our scale: **4 / 8 / 12 / 16 / 20 / 24 / 32 / 40**.
  - Radius snaps to: **4 / 6 / 8 / 12 / full**.
  - One filled primary CTA per screen (secondary = outline, tertiary = ghost).
- **iOS-native feel first**, web follows in parity. Light mode is primary; note dark-mode intent if you have it.
- **Accessibility:** body/secondary text must stay legible — medium grey ~5:1, not pale low-contrast greys.

## 6. Deliverables

A spec we can implement — not Figma we admire. Specifically:

1. **Foundation spec:** palette (with hex + roles), type ramp (family, sizes, weights, line-heights, letter-spacing), spacing/radius usage notes, elevation model (exact shadow values per surface tier), icon direction.
2. **Imagery direction:** a short visual guide — style references, treatment, do/don't — for food photography & any illustration. (We can generate imagery with AI to match, so a clear recipe for the look matters more than supplying assets.)
3. **Redesigned hero screens:** Today + Recipes (+ onboarding if in scope), iOS frame, annotated with the token values above so they're directly buildable. Web parity notes where the layout must differ.
4. **A one-page "why it read cheap → what changed" rationale** per surface, so the team internalises the judgment, not just the pixels.
5. **(If retainer)** a recurring review cadence: we ship implementations, you red-line them against your direction.

## 7. Engagement & logistics

- **Shape:** start with the one-off direction pass above. If it lands, convert to a light retainer (a few hours/week reviewing what we ship).
- **Where we're sourcing:** Contra (commission-free, ~$20–70/hr), Toptal (vetted, higher), Dribbble. **Pick someone whose existing portfolio already has the Oura / Lifesum / Julienne feel** — warmth, depth, editorial restraint. A portfolio that's all loud SaaS dashboards is the wrong fit.
- **What to send a candidate:** this brief + the rendered v3 prototype + access to the three reference apps.

---

*Owner: Grace. Implementation partner: the Sloe build team (incl. Claude Code for code-side execution).*
