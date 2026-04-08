# Competitive principles: MyFitnessPal vs ReciMe for Platemate

Use this document when scoping features: which **mental model** are we extending—**diary** (MFP), **recipe library** (ReciMe), or **feed** (Platemate’s wedge)?

## Pattern comparison

| Pattern | MyFitnessPal approach | ReciMe approach | Platemate stance |
|--------|------------------------|-----------------|------------------|
| Core unit | Food entries → meals → day | Recipe documents → plan grid → list | **All three**: recipes + diary + feed; single profile targets |
| Nutrition source | Huge searchable DB + barcode; recipes from ingredient rows | Per-recipe macros (Plus); not full packaged diary | Recipe nutrition from structured data + **logging** from catalog/staples where needed |
| Import / capture | URL recipe import (web/app); ingredient match to DB | Social + screenshot/handwriting (Plus); Chrome extension | **Both required**: **URL import** and **social/screenshot import**; phase *which networks* first if needed |
| Planning | Meal Planner (Premium+, regional); prefs + swaps | Weekly meal plan; free tier includes planner | Macro-aware plan from **saved** recipes; grocery merge |
| Shopping | List from plan (Premium+); checkout partners | Aisle/recipe sort; checkout | List merge, export, print—checkout optional later |
| Activity | Health/Fit sync; calorie adjustment; dedupe docs | N/A | Same adjustment pattern; transparent **base vs net** |
| Social | Forums, diary sharing | Save from social into app | **Creator feed + follow + save** (LTK-style) |
| Monetization | Premium for advanced logging, ads on free | Plus for imports + nutrition + guided cook | Tier advanced import volume, Health, analytics—not basic diary |

## Import strategy (explicit)

Ship **URL recipe import** (MFP-style: parse URL → structured recipe → user confirms) **and** **social/screenshot import** (ReciMe-style: image or share target → extraction → confirm). Do not treat them as either/or; sequencing can be parallel (e.g. URL first in web, screenshot first on mobile) but **both** are product commitments.

## Nutrition transparency (activity-adjusted calories)

- **Base calories**: goal from profile (TDEE / manual targets), before activity “eat-back.”
- **Activity adjustment**: additional calories we add when you opt in to Apple Health / synced activity (MFP-style), using the same net formula: **net goal = base + adjustment** when eat-back is enabled.
- **Dedupe**: avoid double-counting the same workout from multiple sources; document which source wins in product copy when integrations ship.

## Tiering strategy (Platemate)

- **Free**: Core diary (calories + macros), basic discovery, limited saves—**do not** gate basic logging.
- **Base**: Unlimited saves, macro-aware planner, merged shopping list from plan, collections, URL import quota aligned with infra.
- **Pro**: Creator tools, advanced import volume, deeper analytics, priority placement—**not** basic diary features.

## Data quality governance

- Prefer **verified** nutrition sources (USDA, Open Food Facts for barcoded items, structured recipe ingredients) over unconstrained crowdsourcing at launch.
- One **canonical** food entry per staple where possible; surface source and “verified” state in UI.
- User-submitted duplicates are merged or rejected with clear messaging.

## Creator / affiliate compliance

When creator commerce or affiliate links appear: clear **disclosure** (e.g. “Paid partnership” / “Commission may be earned”), attribution on saved items, and consistent placement in feed and recipe detail.

## Deferred (explicit)

- **Voice log / meal-scan**: Phase 2+ after core diary + recipe + dual import are solid.
- **Grocery retailer checkout**: Defer until list export/share and aisle merge are excellent.

## Alignment with product roadmap

Reinforces macro planner, fiber/water/Health, LTK feed. **Sequencing:** nail **diary + dual import + recipe nutrition** before scaling creator count.
