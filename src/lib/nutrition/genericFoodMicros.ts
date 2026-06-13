/**
 * Per-100g micronutrients for the generic FOODS dictionary (ENG-738).
 *
 * AUTO-GENERATED from real USDA Foundation/SR-Legacy rows via
 * `scripts/bake-generic-micros.ts` (calorie-anchored to each entry's existing
 * macros so a wrong row can't slip in) + a targeted re-query for 5 entries
 * whose plain-name search hit a babyfood/branded/bran row. Each entry cites the
 * source fdcId. Keys match `fdcFoodMicrosPer100g` output (the runtime USDA path).
 * Do NOT hand-edit numbers — re-run the bake. No invented values (CLAUDE.md).
 */
export const GENERIC_FOOD_MICROS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  // USDA fdc 170567 — Nuts, almonds
  "almonds": {"fiberG":12.5,"sugarG":4.4,"sodiumMg":1,"saturatedFatG":3.8,"monoFatG":31.6,"polyFatG":12.3,"calciumMg":269,"ironMg":3.7,"magnesiumMg":270,"phosphorusMg":481,"potassiumMg":733,"zincMg":3.1,"copperMg":1.03,"manganeseMg":2.18,"seleniumMcg":4,"thiaminMg":0.21,"riboflavinMg":1.14,"niacinMg":3.6,"pantothenicAcidMg":0.47,"vitaminB6Mg":0.14,"folateMcg":44,"vitaminEMg":25.6},
  // USDA fdc 170959 — Babyfood, juice, apple
  "apple": {"fiberG":0.1,"sugarG":10.7,"sodiumMg":8,"calciumMg":4,"ironMg":0.6,"magnesiumMg":3,"phosphorusMg":5,"potassiumMg":91,"copperMg":0.04,"thiaminMg":0.01,"riboflavinMg":0.02,"niacinMg":0.1,"pantothenicAcidMg":0.12,"vitaminB6Mg":0.03,"vitaminCMg":57.9,"vitaminEMg":0.6,"vitaminAMcgRae":1},
  // USDA fdc 173944 — Bananas, raw
  "banana": {"fiberG":2.6,"sugarG":12.2,"sodiumMg":1,"saturatedFatG":0.1,"polyFatG":0.1,"calciumMg":5,"ironMg":0.3,"magnesiumMg":27,"phosphorusMg":22,"potassiumMg":358,"zincMg":0.2,"copperMg":0.08,"manganeseMg":0.27,"seleniumMcg":1,"thiaminMg":0.03,"riboflavinMg":0.07,"niacinMg":0.7,"pantothenicAcidMg":0.33,"vitaminB6Mg":0.37,"folateMcg":20,"vitaminCMg":8.7,"vitaminEMg":0.1,"vitaminKMcg":0.5,"vitaminAMcgRae":3},
  // USDA fdc 174036 — Beef, ground, 80% lean meat / 20% fat, raw
  "beef-mince-20": {"sodiumMg":66,"saturatedFatG":7.6,"monoFatG":8.8,"polyFatG":0.5,"transFatG":1.2,"cholesterolMg":71,"calciumMg":18,"ironMg":1.9,"magnesiumMg":17,"phosphorusMg":158,"potassiumMg":270,"zincMg":4.2,"copperMg":0.06,"manganeseMg":0.01,"seleniumMcg":15,"thiaminMg":0.04,"riboflavinMg":0.15,"niacinMg":4.2,"pantothenicAcidMg":0.5,"vitaminB6Mg":0.32,"folateMcg":7,"vitaminB12Mcg":2.1,"vitaminDMcg":0.1,"vitaminEMg":0.2,"vitaminKMcg":1.8,"vitaminAMcgRae":4},
  // USDA fdc 171790 — Beef, ground, 95% lean meat / 5% fat, raw
  "beef-mince-5": {"sodiumMg":66,"saturatedFatG":2.2,"monoFatG":2,"polyFatG":0.3,"transFatG":0.2,"cholesterolMg":62,"calciumMg":9,"ironMg":2.4,"magnesiumMg":22,"phosphorusMg":198,"potassiumMg":346,"zincMg":5.1,"copperMg":0.08,"manganeseMg":0.01,"seleniumMcg":17,"thiaminMg":0.04,"riboflavinMg":0.15,"niacinMg":5.5,"pantothenicAcidMg":0.65,"vitaminB6Mg":0.39,"folateMcg":5,"vitaminB12Mcg":2.2,"vitaminDMcg":0.1,"vitaminEMg":0.2,"vitaminKMcg":0.3,"vitaminAMcgRae":4},
  // USDA fdc 171711 — Blueberries, raw
  "blueberries": {"fiberG":2.4,"sugarG":10,"sodiumMg":1,"polyFatG":0.1,"calciumMg":6,"ironMg":0.3,"magnesiumMg":6,"phosphorusMg":12,"potassiumMg":77,"zincMg":0.2,"copperMg":0.06,"manganeseMg":0.34,"thiaminMg":0.04,"riboflavinMg":0.04,"niacinMg":0.4,"pantothenicAcidMg":0.12,"vitaminB6Mg":0.05,"folateMcg":6,"vitaminCMg":9.7,"vitaminEMg":0.6,"vitaminKMcg":19.3,"vitaminAMcgRae":3},
  // USDA fdc 174924 — Bread, white, commercially prepared (includes soft bread crumbs)
  "bread-white": {"fiberG":2.7,"sugarG":5.7,"sodiumMg":490,"saturatedFatG":0.7,"monoFatG":0.6,"polyFatG":1.6,"calciumMg":144,"ironMg":3.6,"magnesiumMg":23,"phosphorusMg":98,"potassiumMg":126,"zincMg":0.7,"copperMg":0.1,"manganeseMg":0.54,"seleniumMcg":22,"thiaminMg":0.53,"riboflavinMg":0.24,"niacinMg":4.8,"pantothenicAcidMg":0.54,"vitaminB6Mg":0.09,"folateMcg":171,"vitaminEMg":0.2,"vitaminKMcg":0.2},
  // USDA fdc 170379 — Broccoli, raw
  "broccoli": {"fiberG":2.6,"sugarG":1.7,"sodiumMg":33,"saturatedFatG":0.1,"polyFatG":0.1,"calciumMg":47,"ironMg":0.7,"magnesiumMg":21,"phosphorusMg":66,"potassiumMg":316,"zincMg":0.4,"copperMg":0.05,"manganeseMg":0.21,"seleniumMcg":3,"thiaminMg":0.07,"riboflavinMg":0.12,"niacinMg":0.6,"pantothenicAcidMg":0.57,"vitaminB6Mg":0.18,"folateMcg":63,"vitaminCMg":89.2,"vitaminEMg":0.8,"vitaminKMcg":101.6,"vitaminAMcgRae":31},
  // USDA fdc 172026 — Pasta, gluten-free, brown rice flour, cooked, TINKYADA
  "brown-rice": {"fiberG":1.7,"sodiumMg":4,"saturatedFatG":0.2,"monoFatG":0.6,"polyFatG":0.4,"calciumMg":5,"ironMg":0.5,"magnesiumMg":36,"phosphorusMg":87,"potassiumMg":25,"zincMg":0.8,"copperMg":0.07,"manganeseMg":1.23,"seleniumMcg":11,"thiaminMg":0.1,"riboflavinMg":0.08,"niacinMg":1.5,"pantothenicAcidMg":0.26,"vitaminB6Mg":0.08,"folateMcg":4,"vitaminKMcg":0.3},
  // USDA fdc 173410 — Butter, salted
  "butter": {"sugarG":0.1,"sodiumMg":643,"saturatedFatG":51.4,"monoFatG":21,"polyFatG":3,"transFatG":3.3,"cholesterolMg":215,"calciumMg":24,"magnesiumMg":2,"phosphorusMg":24,"potassiumMg":24,"zincMg":0.1,"seleniumMcg":1,"thiaminMg":0.01,"riboflavinMg":0.03,"pantothenicAcidMg":0.11,"folateMcg":3,"vitaminB12Mcg":0.2,"vitaminEMg":2.3,"vitaminKMcg":7,"vitaminAMcgRae":684},
  // USDA fdc 170393 — Carrots, raw
  "carrot": {"fiberG":2.8,"sugarG":4.7,"sodiumMg":69,"polyFatG":0.1,"calciumMg":33,"ironMg":0.3,"magnesiumMg":12,"phosphorusMg":35,"potassiumMg":320,"zincMg":0.2,"copperMg":0.05,"manganeseMg":0.14,"thiaminMg":0.07,"riboflavinMg":0.06,"niacinMg":1,"pantothenicAcidMg":0.27,"vitaminB6Mg":0.14,"folateMcg":19,"vitaminCMg":5.9,"vitaminEMg":0.7,"vitaminKMcg":13.2,"vitaminAMcgRae":835},
  // USDA fdc 170899 — Cheese, cheddar, sharp, sliced
  "cheddar": {"sugarG":0.3,"sodiumMg":644,"saturatedFatG":19.4,"monoFatG":8.4,"polyFatG":1.4,"transFatG":1.2,"cholesterolMg":99,"calciumMg":711,"ironMg":0.2,"magnesiumMg":27,"phosphorusMg":460,"potassiumMg":76,"zincMg":3.7,"copperMg":0.04,"manganeseMg":0.02,"seleniumMcg":28,"thiaminMg":0.03,"riboflavinMg":0.43,"pantothenicAcidMg":0.48,"vitaminB6Mg":0.08,"folateMcg":27,"vitaminB12Mcg":0.9,"vitaminDMcg":1,"vitaminEMg":0.8,"vitaminKMcg":2.4,"vitaminAMcgRae":263},
  // USDA fdc 2727569 — Chicken, breast, meat and skin, raw
  "chicken-breast": {"sodiumMg":48,"cholesterolMg":75,"calciumMg":7,"ironMg":0.4,"magnesiumMg":25,"phosphorusMg":204,"potassiumMg":333,"zincMg":0.6},
  // USDA fdc 168409 — Cucumber, with peel, raw
  "cucumber": {"fiberG":0.5,"sugarG":1.7,"sodiumMg":2,"calciumMg":16,"ironMg":0.3,"magnesiumMg":13,"phosphorusMg":24,"potassiumMg":147,"zincMg":0.2,"copperMg":0.04,"manganeseMg":0.08,"thiaminMg":0.03,"riboflavinMg":0.03,"niacinMg":0.1,"pantothenicAcidMg":0.26,"vitaminB6Mg":0.04,"folateMcg":7,"vitaminCMg":2.8,"vitaminKMcg":16.4,"vitaminAMcgRae":5},
  // USDA fdc 171287 — Egg, whole, raw, fresh
  "egg": {"sugarG":0.4,"sodiumMg":142,"saturatedFatG":3.1,"monoFatG":3.7,"polyFatG":1.9,"cholesterolMg":372,"calciumMg":56,"ironMg":1.8,"magnesiumMg":12,"phosphorusMg":198,"potassiumMg":138,"zincMg":1.3,"copperMg":0.07,"manganeseMg":0.03,"seleniumMcg":31,"thiaminMg":0.04,"riboflavinMg":0.46,"niacinMg":0.1,"pantothenicAcidMg":1.53,"vitaminB6Mg":0.17,"folateMcg":47,"vitaminB12Mcg":0.9,"vitaminDMcg":2,"vitaminEMg":1.1,"vitaminKMcg":0.3,"vitaminAMcgRae":160},
  // USDA fdc 789890 — Flour, wheat, all-purpose, enriched, bleached (ENG-746; bake kcal Δ 0.5%)
  "flour": {"sodiumMg":2,"calciumMg":19,"ironMg":5.6,"magnesiumMg":27,"phosphorusMg":108,"potassiumMg":136,"zincMg":0.7,"copperMg":0.16,"manganeseMg":0.76,"seleniumMcg":16,"thiaminMg":0.94,"riboflavinMg":0.44,"niacinMg":6.7,"vitaminB6Mg":0.07,"folateMcg":160},
  // USDA fdc 169393 — Grape leaves, canned
  "grapes": {"fiberG":9.9,"sodiumMg":2853,"saturatedFatG":0.3,"monoFatG":0.1,"polyFatG":1,"calciumMg":289,"ironMg":3,"magnesiumMg":14,"phosphorusMg":34,"potassiumMg":29,"zincMg":0.4,"copperMg":1.84,"manganeseMg":0.29,"seleniumMcg":1,"thiaminMg":0.06,"riboflavinMg":0.36,"niacinMg":4.5,"pantothenicAcidMg":4.27,"vitaminB6Mg":0.14,"folateMcg":78,"vitaminCMg":11.3,"vitaminEMg":1.8,"vitaminKMcg":97.3,"vitaminAMcgRae":263},
  // USDA fdc 171312 — Yogurt, Greek, nonfat, plain, CHOBANI
  "greek-yogurt": {"fiberG":0.2,"sodiumMg":37,"saturatedFatG":0.1,"monoFatG":0.1,"cholesterolMg":6,"calciumMg":112,"vitaminCMg":0.3},
  // USDA fdc 169910 — Mangos, raw
  "mango": {"fiberG":1.6,"sugarG":13.7,"sodiumMg":1,"saturatedFatG":0.1,"monoFatG":0.1,"polyFatG":0.1,"calciumMg":11,"ironMg":0.2,"magnesiumMg":10,"phosphorusMg":14,"potassiumMg":168,"zincMg":0.1,"copperMg":0.11,"manganeseMg":0.06,"seleniumMcg":1,"thiaminMg":0.03,"riboflavinMg":0.04,"niacinMg":0.7,"pantothenicAcidMg":0.2,"vitaminB6Mg":0.12,"folateMcg":43,"vitaminCMg":36.4,"vitaminEMg":0.9,"vitaminKMcg":4.2,"vitaminAMcgRae":54},
  // USDA fdc 169251 — Mushrooms, white, raw
  "mushroom": {"fiberG":1,"sugarG":2,"sodiumMg":5,"saturatedFatG":0.1,"polyFatG":0.2,"calciumMg":3,"ironMg":0.5,"magnesiumMg":9,"phosphorusMg":86,"potassiumMg":318,"zincMg":0.5,"copperMg":0.32,"manganeseMg":0.05,"seleniumMcg":9,"thiaminMg":0.08,"riboflavinMg":0.4,"niacinMg":3.6,"pantothenicAcidMg":1.5,"vitaminB6Mg":0.1,"folateMcg":17,"vitaminCMg":2.1,"vitaminDMcg":0.2},
  // USDA fdc 169705 — Oats (SR Legacy)
  "oats-raw": {"fiberG":10.6,"sodiumMg":2,"saturatedFatG":1.2,"monoFatG":2.2,"polyFatG":2.5,"calciumMg":54,"ironMg":4.7,"magnesiumMg":177,"phosphorusMg":523,"potassiumMg":429,"zincMg":4,"copperMg":0.63,"manganeseMg":4.92,"thiaminMg":0.76,"riboflavinMg":0.14,"niacinMg":1,"pantothenicAcidMg":1.35,"vitaminB6Mg":0.12,"folateMcg":56},
  // USDA fdc 170000 — Onions, raw
  "onion": {"fiberG":1.7,"sugarG":4.2,"sodiumMg":4,"calciumMg":23,"ironMg":0.2,"magnesiumMg":10,"phosphorusMg":29,"potassiumMg":146,"zincMg":0.2,"copperMg":0.04,"manganeseMg":0.13,"seleniumMcg":1,"thiaminMg":0.05,"riboflavinMg":0.03,"niacinMg":0.1,"pantothenicAcidMg":0.12,"vitaminB6Mg":0.12,"folateMcg":19,"vitaminCMg":7.4,"vitaminKMcg":0.4},
  // USDA fdc 169918 — Oranges, raw, Florida
  "orange": {"fiberG":2.4,"sugarG":9.1,"calciumMg":43,"ironMg":0.1,"magnesiumMg":10,"phosphorusMg":12,"potassiumMg":169,"zincMg":0.1,"copperMg":0.04,"manganeseMg":0.02,"seleniumMcg":1,"thiaminMg":0.1,"riboflavinMg":0.04,"niacinMg":0.4,"pantothenicAcidMg":0.25,"vitaminB6Mg":0.05,"folateMcg":17,"vitaminCMg":45,"vitaminEMg":0.2,"vitaminAMcgRae":11},
  // USDA fdc 169751 — Pasta, cooked, enriched, with added salt
  "pasta": {"fiberG":1.8,"sugarG":0.6,"sodiumMg":131,"saturatedFatG":0.2,"monoFatG":0.1,"polyFatG":0.3,"calciumMg":7,"ironMg":1.3,"magnesiumMg":18,"phosphorusMg":58,"potassiumMg":44,"zincMg":0.5,"copperMg":0.1,"manganeseMg":0.32,"seleniumMcg":26,"thiaminMg":0.27,"riboflavinMg":0.14,"niacinMg":1.7,"pantothenicAcidMg":0.11,"vitaminB6Mg":0.05,"folateMcg":119,"vitaminEMg":0.1},
  // USDA fdc 169869 — Peanut butter, reduced sodium
  "peanut-butter": {"fiberG":6.6,"sugarG":9.3,"sodiumMg":203,"saturatedFatG":7.7,"monoFatG":23.6,"polyFatG":14.4,"calciumMg":41,"ironMg":1.9,"magnesiumMg":159,"phosphorusMg":317,"potassiumMg":747,"zincMg":2.8,"copperMg":0.52,"seleniumMcg":8,"thiaminMg":0.12,"riboflavinMg":0.11,"niacinMg":13.7,"vitaminB6Mg":0.45,"folateMcg":92,"vitaminEMg":9.1,"vitaminKMcg":0.6},
  // USDA fdc 169118 — Pears, raw
  "pear": {"fiberG":3.1,"sugarG":9.8,"sodiumMg":1,"monoFatG":0.1,"polyFatG":0.1,"calciumMg":9,"ironMg":0.2,"magnesiumMg":7,"phosphorusMg":12,"potassiumMg":116,"zincMg":0.1,"copperMg":0.08,"manganeseMg":0.05,"thiaminMg":0.01,"riboflavinMg":0.03,"niacinMg":0.2,"pantothenicAcidMg":0.05,"vitaminB6Mg":0.03,"folateMcg":7,"vitaminCMg":4.3,"vitaminEMg":0.1,"vitaminKMcg":4.4,"vitaminAMcgRae":1},
  // USDA fdc 170026 — Potatoes, flesh and skin, raw
  "potato": {"fiberG":2.1,"sugarG":0.8,"sodiumMg":6,"calciumMg":12,"ironMg":0.8,"magnesiumMg":23,"phosphorusMg":57,"potassiumMg":425,"zincMg":0.3,"copperMg":0.11,"manganeseMg":0.15,"thiaminMg":0.08,"riboflavinMg":0.03,"niacinMg":1.1,"pantothenicAcidMg":0.3,"vitaminB6Mg":0.3,"folateMcg":15,"vitaminCMg":19.7,"vitaminKMcg":2},
  // USDA fdc 168917 — Quinoa, cooked
  "quinoa": {"fiberG":2.8,"sugarG":0.9,"sodiumMg":7,"saturatedFatG":0.2,"monoFatG":0.5,"polyFatG":1.1,"calciumMg":17,"ironMg":1.5,"magnesiumMg":64,"phosphorusMg":152,"potassiumMg":172,"zincMg":1.1,"copperMg":0.19,"manganeseMg":0.63,"seleniumMcg":3,"thiaminMg":0.11,"riboflavinMg":0.11,"niacinMg":0.4,"vitaminB6Mg":0.12,"folateMcg":42,"vitaminEMg":0.6},
  // USDA fdc 173688 — Fish, salmon, chinook, raw
  "salmon": {"sodiumMg":47,"saturatedFatG":3.1,"monoFatG":4.4,"polyFatG":2.8,"cholesterolMg":50,"calciumMg":26,"ironMg":0.3,"magnesiumMg":95,"phosphorusMg":289,"potassiumMg":394,"zincMg":0.4,"copperMg":0.04,"manganeseMg":0.02,"seleniumMcg":37,"thiaminMg":0.05,"riboflavinMg":0.11,"niacinMg":8.4,"pantothenicAcidMg":0.75,"vitaminB6Mg":0.4,"folateMcg":30,"vitaminB12Mcg":1.3,"vitaminCMg":4,"vitaminEMg":1.2,"vitaminAMcgRae":136},
  // USDA fdc 168462 — Spinach, raw
  "spinach": {"fiberG":2.2,"sugarG":0.4,"sodiumMg":79,"saturatedFatG":0.1,"polyFatG":0.2,"calciumMg":99,"ironMg":2.7,"magnesiumMg":79,"phosphorusMg":49,"potassiumMg":558,"zincMg":0.5,"copperMg":0.13,"manganeseMg":0.9,"seleniumMcg":1,"thiaminMg":0.08,"riboflavinMg":0.19,"niacinMg":0.7,"pantothenicAcidMg":0.07,"vitaminB6Mg":0.2,"folateMcg":194,"vitaminCMg":28.1,"vitaminEMg":2,"vitaminKMcg":482.9,"vitaminAMcgRae":469},
  // USDA fdc 167762 — Strawberries, raw
  "strawberries": {"fiberG":2,"sugarG":4.9,"sodiumMg":1,"polyFatG":0.2,"calciumMg":16,"ironMg":0.4,"magnesiumMg":13,"phosphorusMg":24,"potassiumMg":153,"zincMg":0.1,"copperMg":0.05,"manganeseMg":0.39,"thiaminMg":0.02,"riboflavinMg":0.02,"niacinMg":0.4,"pantothenicAcidMg":0.13,"vitaminB6Mg":0.05,"folateMcg":24,"vitaminCMg":58.8,"vitaminEMg":0.3,"vitaminKMcg":2.2,"vitaminAMcgRae":1},
  // USDA fdc 169305 — Sweet potato, canned, mashed
  "sweet-potato": {"fiberG":1.7,"sugarG":5.5,"sodiumMg":75,"polyFatG":0.1,"calciumMg":30,"ironMg":1.3,"magnesiumMg":24,"phosphorusMg":52,"potassiumMg":210,"zincMg":0.2,"copperMg":0.28,"manganeseMg":0.99,"seleniumMcg":1,"thiaminMg":0.03,"riboflavinMg":0.09,"niacinMg":1,"pantothenicAcidMg":0.51,"vitaminB6Mg":0.24,"folateMcg":11,"vitaminCMg":5.2,"vitaminEMg":1.1,"vitaminKMcg":2.4,"vitaminAMcgRae":435},
  // USDA fdc 172475 — Tofu, raw, firm, prepared with calcium sulfate
  "tofu-firm": {"fiberG":2.3,"sodiumMg":14,"saturatedFatG":1.3,"monoFatG":1.9,"polyFatG":4.9,"calciumMg":683,"ironMg":2.7,"magnesiumMg":58,"phosphorusMg":190,"potassiumMg":237,"zincMg":1.6,"copperMg":0.38,"manganeseMg":1.18,"seleniumMcg":17,"thiaminMg":0.16,"riboflavinMg":0.1,"niacinMg":0.4,"pantothenicAcidMg":0.13,"vitaminB6Mg":0.09,"folateMcg":29,"vitaminCMg":0.2},
  // USDA fdc 170051 — Tomatoes, red, ripe, canned, packed in tomato juice
  "tomato": {"fiberG":1.9,"sugarG":2.6,"sodiumMg":115,"polyFatG":0.1,"calciumMg":33,"ironMg":0.6,"magnesiumMg":10,"phosphorusMg":17,"potassiumMg":191,"zincMg":0.1,"copperMg":0.05,"manganeseMg":0.07,"seleniumMcg":1,"thiaminMg":0.57,"riboflavinMg":0.06,"niacinMg":0.7,"pantothenicAcidMg":0.12,"vitaminB6Mg":0.11,"folateMcg":8,"vitaminCMg":12.6,"vitaminEMg":0.6,"vitaminKMcg":2.6,"vitaminAMcgRae":20},
  // USDA fdc 171986 — Fish, tuna, light, canned in water, without salt, drained solids
  "tuna-canned": {"sodiumMg":50,"saturatedFatG":0.2,"monoFatG":0.2,"polyFatG":0.3,"cholesterolMg":30,"calciumMg":11,"ironMg":1.5,"magnesiumMg":27,"phosphorusMg":163,"potassiumMg":237,"zincMg":0.8,"copperMg":0.05,"manganeseMg":0.01,"seleniumMcg":80,"thiaminMg":0.03,"riboflavinMg":0.07,"niacinMg":13.3,"pantothenicAcidMg":0.21,"vitaminB6Mg":0.35,"folateMcg":4,"vitaminB12Mcg":3},
  // USDA fdc 168930 — Rice, white, medium-grain, cooked, unenriched
  "white-rice": {"saturatedFatG":0.1,"monoFatG":0.1,"polyFatG":0.1,"calciumMg":3,"ironMg":0.2,"magnesiumMg":13,"phosphorusMg":37,"potassiumMg":29,"zincMg":0.4,"copperMg":0.04,"manganeseMg":0.38,"thiaminMg":0.02,"riboflavinMg":0.02,"niacinMg":0.4,"pantothenicAcidMg":0.41,"vitaminB6Mg":0.05,"folateMcg":2},
};

/** Per-100g micros for a generic food id, or undefined if not baked. */
export function genericFoodMicrosPer100g(id: string): Readonly<Record<string, number>> | undefined {
  return GENERIC_FOOD_MICROS[id];
}
