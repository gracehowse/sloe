export const MEAL_PREP_WEEK1_PASTE = `Meal prep — Week 1

WEEKLY PLAN
Mon Lunch: Chicken thigh bowl
Mon Snack: Matcha pudding
Tue Lunch: Chicken thigh bowl (leftover)

--- recipes ---

Peanut Butter, Tamari & Ginger Chicken Thighs
Serves 4
Per serving: Protein ~38 g · Fibre ~2 g
Ingredients: 800 g skinless chicken thighs, 4 tbsp smooth peanut butter, 3 tbsp tamari, 2 tbsp rice wine vinegar, 2 tbsp chilli sauce, 1 tbsp ginger, 1 tbsp maple syrup, 1 tbsp sesame oil, 2 cloves garlic
Method: Whisk marinade. Coat chicken. Roast 200°C 25–30 min. Slice.

Sesame Spinach & Edamame
Serves 4
Per serving: Protein ~11 g · Fibre ~6 g
Ingredients: 300 g frozen edamame, 200 g spinach, 1 tbsp sesame oil, 1 tbsp tamari, 1 tbsp sesame seeds

Cold-Rinsed Soba Noodles
Serves 4
Per serving: Protein ~7 g · Fibre ~3 g
Ingredients: 250 g soba noodles

Matcha White Chocolate Tofu Puddings
Makes 4
Per pudding: Protein ~9 g · Fibre ~2 g
Ingredients: 300 g silken tofu, 100 g white chocolate, 1–1½ tsp matcha, 1 tbsp maple syrup
`;

/** Minimal LLM-shaped payload for unit tests (no network). */
export const MEAL_PREP_WEEK1_PARSED = {
  planName: "Meal prep — Week 1",
  recipes: [
    {
      key: "peanut-butter-chicken",
      title: "Peanut Butter, Tamari & Ginger Chicken Thighs",
      serves: 4,
      ingredients: [
        "800 g skinless chicken thighs",
        "4 tbsp smooth peanut butter",
        "3 tbsp tamari",
      ],
      authorNutrition: { protein: 38, fiberG: 2 },
    },
    {
      key: "sesame-spinach-edamame",
      title: "Sesame Spinach & Edamame",
      serves: 4,
      ingredients: ["300 g frozen edamame", "200 g spinach"],
      authorNutrition: { protein: 11, fiberG: 6 },
    },
    {
      key: "soba-noodles",
      title: "Cold-Rinsed Soba Noodles",
      serves: 4,
      ingredients: ["250 g soba noodles"],
      authorNutrition: { protein: 7, fiberG: 3 },
    },
    {
      key: "matcha-pudding",
      title: "Matcha White Chocolate Tofu Puddings",
      serves: 4,
      ingredients: ["300 g silken tofu", "100 g white chocolate", "1 tsp matcha"],
      authorNutrition: { protein: 9, fiberG: 2 },
    },
  ],
  schedule: [
    {
      dayLabel: "Mon",
      dayIndex: 0,
      slots: [
        {
          slot: "Lunch",
          label: "Chicken thigh bowl",
          recipeKeys: ["peanut-butter-chicken", "soba-noodles", "sesame-spinach-edamame"],
        },
        { slot: "Snacks", label: "Matcha pudding", recipeKeys: ["matcha-pudding"] },
      ],
    },
    {
      dayLabel: "Tue",
      dayIndex: 1,
      slots: [
        {
          slot: "Lunch",
          label: "Chicken thigh bowl (leftover)",
          recipeKeys: ["peanut-butter-chicken", "soba-noodles", "sesame-spinach-edamame"],
        },
      ],
    },
  ],
};
