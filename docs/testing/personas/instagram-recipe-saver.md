# Persona — Instagram recipe saver

**Seed name:** `instagram-recipe-saver`
**Canonical test account:** `gracehowse+recipesaver@outlook.com` — password in
gitignored `.env.persona` (`PERSONA_INSTAGRAM_RECIPE_SAVER_EMAIL`). The plus-tag
is **`recipesaver`**, not the persona slug; do not derive the email from the slug.
**Grounded in:** `docs/growth/tiktok-instagram-viral-plan.md` (Magic moment #1 —
"recipe import from a Reel/TikTok" — the lead viral bet; the share-loop cohort).

## Identity + backstory

Saves cooking Reels compulsively — a camera-roll and an Instagram "saved"
collection full of recipes they'll "definitely make." They came to Suppr because
a Reel showed someone paste a TikTok link and watch the recipe appear with
macros. They are here for *that moment*. They track calories loosely, mostly to
not feel guilty, and they cook 3–4 nights a week from things they saw online.

## Data shape (what `--seed` lays down)

- **14 days** of *loose* logging — full on cook-at-home days, partial or empty on
  takeaway/eating-out days. Real, not pristine.
- **9 library recipes** — the heaviest recipe library of any persona, sourced
  from "Instagram Reel" and "TikTok," spanning breakfast → dinner. This is the
  point of the account.
- **4 weigh-ins**, flat trend (they're maintaining, not dieting).
- Profile: `goal: maintain`, `activity: light`, target **2,050 kcal**, female 28,
  165 cm, no goal weight. Onboarding complete.

This shape exercises the **recipe → plan → cook → log loop** with a real library,
and the *loose-logger* tolerance for gaps.

## Behavioural traits

- **Visual-first.** Judges a recipe by its image and how the card looks before
  reading a single ingredient. An ugly or imageless recipe card is a turn-off.
- **Low patience for setup, high patience for browsing.** Will happily scroll a
  recipe library for minutes, but abandons a multi-step import flow fast
  (**friction tolerance ~10s** on the import path specifically).
- **Doesn't read macro detail** unless something looks off. Trusts the app to
  "just handle it."
- **Wants the loop to close:** save → it's in my library → add to a plan → cook
  → it logged itself. A break anywhere in that chain is the headline finding.

## Session goals (human intentions)

1. "Get a recipe I saw on Instagram into the app and see the macros without doing
   any math."
2. "Turn the recipes I've saved into an actual plan for the week — what am I
   cooking and when."
3. "Cook one of my saved recipes tonight and have it log itself to my diary."
4. "Browse my recipe library and find something that fits what I've got in the
   fridge."
5. "Check, casually, whether I'm roughly on track this week — without logging
   every snack."
6. "Decide whether this is the app I keep my recipes in from now on."

## Trust-sensitivities

- **The import has to actually work.** If a Reel/link import fails or returns
  garbage macros, the entire value proposition collapses for this persona — this
  is the Phase-0 ≥90% reliability gate made human.
- **Imported macros must be plausible, and flagged when low-confidence.** A
  recipe that confidently shows wrong calories is worse than one that says
  "estimated, low confidence."
- **The save→plan→log loop must not drop the recipe.** Saving something that
  later can't be found, or can't be added to a plan, reads as data loss — the
  exact failure that makes aesthetic recipe apps churn (cf. the Julienne
  pattern).
- **Loose logging must not be punished.** Guilt-trip copy or a broken streak over
  a takeaway day will lose them — they came for joy, not discipline.
