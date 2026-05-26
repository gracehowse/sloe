/** Minimal recipes-only LLM payload for cookbook import tests. */
export const COOKBOOK_EXCERPT_PARSED = {
  bookName: "Fast 800",
  recipes: [
    {
      key: "mediterranean-baked-fish",
      title: "Mediterranean Baked Fish",
      serves: 2,
      ingredients: ["2 white fish fillets", "200 g cherry tomatoes", "1 tbsp olive oil"],
      authorNutrition: { calories: 320, protein: 38 },
    },
    {
      key: "green-salad",
      title: "Green Salad with Lemon",
      serves: 2,
      ingredients: ["100 g mixed leaves", "1 lemon", "1 tbsp olive oil"],
      authorNutrition: { calories: 90, protein: 2 },
    },
    {
      key: "berry-yogurt",
      title: "Berry Yogurt Pot",
      serves: 1,
      ingredients: ["150 g Greek yogurt", "80 g mixed berries"],
      authorNutrition: { calories: 180, protein: 15 },
    },
  ],
};

export const COOKBOOK_EXCERPT_TEXT = `Fast 800 — sample recipes

Mediterranean Baked Fish
Serves 2
Per serving: 320 kcal · Protein 38 g
Ingredients: 2 white fish fillets, 200 g cherry tomatoes, 1 tbsp olive oil

Green Salad with Lemon
Serves 2
Per serving: 90 kcal · Protein 2 g
Ingredients: 100 g mixed leaves, 1 lemon, 1 tbsp olive oil

Berry Yogurt Pot
Serves 1
Per serving: 180 kcal · Protein 15 g
Ingredients: 150 g Greek yogurt, 80 g mixed berries
`;
