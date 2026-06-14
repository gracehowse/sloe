# Lifesum — design inspiration study (2026-06-13)

Grace airdropped ~25 Lifesum screenshots as inspo: "similar cream background,
white card, accents… really nice recipes layout and do settings quite well… look
at how they do their planner (add meals, swap etc)." This captures the **17 I've
reviewed (IMG_9925–9941)**. The **planner / add-meal / swap batch (8:44,
IMG_9942–9950) is still to review** (hit the per-conversation image budget) — plus
Mobbin's Lifesum planner (Grace notes Mobbin is behind their latest build).

## Aesthetic (it's our family — validates the flat-card direction)

- **Warm cream ground + crisp WHITE cards.** Exactly our Sloe material (ENG-1081).
  No heavy borders; ~16–20px radius; generous whitespace; flat (no heavy shadow).
- **Accents:** one brand green (primary/CTAs/icons) + macro hues (Carbs = blue,
  Protein = pink/red, Fat = purple) + **orange for premium/upgrade** CTAs only.
- **Type:** sans for UI; an elegant **serif for the "want to…?" upsell headlines**
  (mirrors our Newsreader display use).
- Bottom nav: Diary · Progress · center-green (+) · Programs · Recipes.

## Diary (their "Today")

- **Semicircle gauge** (not a full ring): "Remaining 898 / Goal 1177" with
  Consumed + Burned flanking; over-goal flips to "+275 · Above Goal".
- **3 macro tiles** (Carbs/Protein/Fat): white cards, "36/147g" + a horizontal
  **progress bar** in the macro hue.
- **MEALS LOGGED = per-slot white cards** (Breakfast/Lunch/Dinner): food
  **thumbnail** + slot name + (logged item name **or** "Recommended: 353–471
  kcal" when empty) + a (+) button; logged slots show a kcal subtotal row.
  → Directly validates the meals revert (ENG-1091) and gives the empty-slot
  treatment for ENG-1095: **show a recommended kcal range per empty slot** rather
  than a bare "Log a meal".

## Recipes (Grace: "really nice recipes layout")

- Sticky **"Find recipes" search + filter icon**.
- **"What's hot" horizontal carousel** of collection cards (full-bleed photo +
  title overlay: "Protein Focus", "Men's").
- **Category sections** (Breakfast / Lunch / Dinner / Snack), each a **2-column
  grid of photo cards** (image + title + kcal + favourite heart) with a green
  **"See all"**. Premium gate = "Get unlimited access" + orange UNLOCK ALL.
  → Image-forward + category-organised. Our Discover has the bones (search, chips,
  hero cards) but is flatter; adopting the **What's-hot carousel + per-category
  2-col photo grids + See-all** would lift it. Maps to the Recipes-tab polish.

## Settings (Grace: "do settings quite well")

- **Profile header card:** avatar (with green +) + name + age + UPGRADE pill, then
  stat rows (Current weight / Goal / Active Diet).
- **Grouped white-card lists** with a **green icon + label + chevron** per row
  (Personal Details, Adjust macronutrients, Adjust calories, Dietary needs, Water
  habits) under small grey section eyebrows (CUSTOMIZATION).
- Sub-screens: green header CTA banner ("Want to choose a goal weight? CHANGE
  GOAL") above white grouped lists; **radio lists + toggles** for preferences.
- **Adjust Macronutrients:** a ring + **3 colour-coded sliders** (Carbs/Protein/
  Fat) each showing g · % · kcal with +/- steppers — elegant, worth borrowing.
  → We're white-card now; the **green-icon grouped-row grammar** + the macro-slider
  screen are the borrowable pieces.

## Programs / Plans

- Green hero "Find your plan / TAKE THE TEST" + category sections
  (Balanced / Fasting) of **full-bleed image cards** (Vitality, Sugar Detox, 5:2,
  16:8). A model if we ever surface meal-plan programs.

## How this maps to our open work

- **Validates ENG-1081** (flat white cards) — Lifesum is the same material system.
- **ENG-1091 / ENG-1095 (meals):** per-slot cards with thumbnail + **recommended
  kcal range on empty slots** — adopt for our empty meal slots (web + mobile).
- **ENG-1092 (Plan dull):** Lifesum's meal cards (thumbnail + recommended range)
  are the antidote to our wall of grey chip-rows — model the empty Plan day on
  these.
- **Recipes tab:** What's-hot carousel + per-category 2-col photo grids + See-all.
- **Settings:** green-icon grouped rows + the macro-slider screen.

## TODO (next session)

Review the 8:44 batch (IMG_9942–9950) for the **planner: add meals + swap** flow,
plus Lifesum's planner on Mobbin (noting Mobbin lags their current build) — the
piece Grace most wants for the Plan tab (ENG-1092 / planner add+swap).
