# Nutrition search golden audit — 2026-06-04

**Platform:** web (live API clients, ranked locally)  
**iOS:** pending native UI pass (ENG-877)  
**Deep dive:** [`docs/audits/2026-06-05-nutrition-debug-deep-dive/findings.md`](../audits/2026-06-05-nutrition-debug-deep-dive/findings.md)

## Provider env

- fatsecret_configured: yes
- FATSECRET_CONSUMER_KEY: yes
- FATSECRET_CLIENT_SECRET: yes
- FATSECRET_CONSUMER_SECRET: no
- USDA_FDC_API_KEY: yes
- EDAMAM_APP_ID: yes
- EDAMAM_APP_KEY: yes

## Golden queries

### `Big Mac` (3056ms)
FS hits: 10 · USDA: 6 · Edamam: 10

| # | Name | Source | kcal | Portion | Score | Tier |
|---|------|--------|------|---------|-------|------|
| 1 | Big Mac (McDonalds) | USDA | 261/100g | — | 1.071 | verified |
| 2 | McDonald's · Big Mac | FatSecret | — | Per 1 serving - Calories: 580kcal \| Fat: 34.00g \| Carbs: 45. | 0.950 | estimated |
| 3 | McDONALD'S, BIG MAC | USDA | 257/100g | — | 0.537 | estimated |
| 4 | McDonald's · Big Macmeal | FatSecret | — | Per 1 serving - Calories: 1170kcal \| Fat: 49.00g \| Carbs: 15 | 0.505 | estimated |
| 5 | McDONALD'S, BIG MAC (without Big Mac Sauce) | USDA | 234/100g | — | 0.464 | estimated |

### `starbucks latte` (1066ms)
FS hits: 10 · USDA: 6 · Edamam: 10

| # | Name | Source | kcal | Portion | Score | Tier |
|---|------|--------|------|---------|-------|------|
| 1 | Starbucks · Starbucks Blonde Vanilla Latte (Grande) | FatSecret | — | Per 1 serving - Calories: 250kcal \| Fat: 6.00g \| Carbs: 37.0 | 0.802 | estimated |
| 2 | Starbucks · Starbucks Blonde Vanilla Latte (Tall) | FatSecret | — | Per 1 serving - Calories: 200kcal \| Fat: 5.00g \| Carbs: 28.0 | 0.802 | estimated |
| 3 | Starbucks · Matcha Latte (Grande) | FatSecret | — | Per 1 serving - Calories: 220kcal \| Fat: 6.00g \| Carbs: 31.0 | 0.694 | estimated |
| 4 | Starbucks · Chai Latte (Grande) | FatSecret | — | Per 1 serving - Calories: 190kcal \| Fat: 3.50g \| Carbs: 32.0 | 0.694 | estimated |
| 5 | Starbucks · Matcha Latte (Tall) | FatSecret | — | Per 1 serving - Calories: 170kcal \| Fat: 5.00g \| Carbs: 22.0 | 0.694 | estimated |

### `chipotle bowl` (814ms)
FS hits: 10 · USDA: 6 · Edamam: 10

| # | Name | Source | kcal | Portion | Score | Tier |
|---|------|--------|------|---------|-------|------|
| 1 | FlexPro · Chipotle Bowl | FatSecret | — | Per 1 serving - Calories: 460kcal \| Fat: 18.00g \| Carbs: 48. | 0.950 | estimated |
| 2 | Jimmy Dean · Chipotle Bowl | FatSecret | — | Per 1 bowl - Calories: 410kcal \| Fat: 24.00g \| Carbs: 8.00g  | 0.950 | estimated |
| 3 | Chipotle Mexican Grill · Amelaine Bowl | FatSecret | — | Per 1 bowl - Calories: 695kcal \| Fat: 23.00g \| Carbs: 49.00g | 0.733 | estimated |
| 4 | Chipotle Mexican Grill · Chicken Bowl | FatSecret | — | Per 1 bowl - Calories: 820kcal \| Fat: 22.00g \| Carbs: 90.00g | 0.733 | estimated |
| 5 | Chipotle Mexican Grill · Wholesome Bowl | FatSecret | — | Per 1 bowl - Calories: 460kcal \| Fat: 29.00g \| Carbs: 18.00g | 0.733 | estimated |

### `salmon` (696ms)
FS hits: 10 · USDA: 10 · Edamam: 10

| # | Name | Source | kcal | Portion | Score | Tier |
|---|------|--------|------|---------|-------|------|
| 1 | Salmon salad | USDA | 213/100g | — | 1.100 | verified |
| 2 | Lomi salmon | USDA | 60/100g | — | 0.951 | verified |
| 3 | Fish, salmon, canned | USDA | 136/100g | — | 0.951 | verified |
| 4 | Fish, salmon, grilled | USDA | 259/100g | — | 0.951 | verified |
| 5 | Salmon | FatSecret | — | Per 100g - Calories: 146kcal \| Fat: 5.93g \| Carbs: 0.00g \| P | 0.950 | estimated |

### `banana` (684ms)
FS hits: 10 · USDA: 8 · Edamam: 0

| # | Name | Source | kcal | Portion | Score | Tier |
|---|------|--------|------|---------|-------|------|
| 1 | Banana, raw | USDA | 97/100g | — | 1.100 | verified |
| 2 | Banana nectar | USDA | 74/100g | — | 1.031 | verified |
| 3 | Banana pudding | USDA | 160/100g | — | 1.031 | verified |
| 4 | Bananas | FatSecret | — | Per 100g - Calories: 89kcal \| Fat: 0.33g \| Carbs: 22.84g \| P | 0.950 | estimated |
| 5 | Banana | FatSecret | — | Per 100g - Calories: 89kcal \| Fat: 0.33g \| Carbs: 22.84g \| P | 0.950 | estimated |

### `brown rice` (682ms)
FS hits: 10 · USDA: 10 · Edamam: 0

| # | Name | Source | kcal | Portion | Score | Tier |
|---|------|--------|------|---------|-------|------|
| 1 | Beans and brown rice | USDA | 162/100g | — | 0.991 | verified |
| 2 | Rice flour, brown | USDA | 363/100g | — | 0.991 | verified |
| 3 | Flavored rice, brown and wild | USDA | 106/100g | — | 0.991 | verified |
| 4 | Brown Rice | FatSecret | — | Per 197g - Calories: 216kcal \| Fat: 1.75g \| Carbs: 44.76g \|  | 0.950 | estimated |
| 5 | Kroger · Brown Rice | FatSecret | — | Per 1/2 cup - Calories: 150kcal \| Fat: 1.50g \| Carbs: 34.00g | 0.950 | estimated |

### `tesco chicken` (713ms)
FS hits: 10 · USDA: 6 · Edamam: 0

| # | Name | Source | kcal | Portion | Score | Tier |
|---|------|--------|------|---------|-------|------|
| 1 | Chicken | FatSecret | — | Per 101g - Calories: 239kcal \| Fat: 13.60g \| Carbs: 0.00g \|  | 0.640 | estimated |
| 2 | Chicken Skin | FatSecret | — | Per 101g - Calories: 454kcal \| Fat: 40.68g \| Carbs: 0.00g \|  | 0.640 | estimated |
| 3 | Chicken skin | USDA | 450/100g | — | 0.630 | verified |
| 4 | Chicken Kiev | FatSecret | — | Per 101g - Calories: 254kcal \| Fat: 13.19g \| Carbs: 4.27g \|  | 0.425 | estimated |
| 5 | Almond Chicken | FatSecret | — | Per 2360g - Calories: 2738kcal \| Fat: 143.74g \| Carbs: 153.8 | 0.425 | estimated |

### `sainsbury's hummus` (1237ms)
FS hits: 10 · USDA: 6 · Edamam: 0

| # | Name | Source | kcal | Portion | Score | Tier |
|---|------|--------|------|---------|-------|------|
| 1 | Hummus | FatSecret | — | Per 100g - Calories: 177kcal \| Fat: 8.59g \| Carbs: 20.12g \|  | 0.640 | estimated |
| 2 | Hummus | FatSecret | — | Per 100g - Calories: 177kcal \| Fat: 8.59g \| Carbs: 20.12g \|  | 0.640 | estimated |
| 3 | Hummus (Commercial) | FatSecret | — | Per 100g - Calories: 166kcal \| Fat: 9.60g \| Carbs: 14.29g \|  | 0.640 | estimated |
| 4 | Fresh & Easy · Hummus | FatSecret | — | Per 2 tbsp - Calories: 80kcal \| Fat: 7.00g \| Carbs: 4.00g \|  | 0.640 | estimated |
| 5 | Haig's · Hummus | FatSecret | — | Per 2 tbsp - Calories: 80kcal \| Fat: 6.00g \| Carbs: 4.00g \|  | 0.640 | estimated |
