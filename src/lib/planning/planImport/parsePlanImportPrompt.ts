/** System + user prompts for plan import LLM extraction. */

export function buildPlanImportParsePrompt(text: string): string {
  return `You are parsing a third-party meal plan for import into a nutrition app.

Extract TWO sections from the source:
1. **recipes** — every recipe block with title, serves count, ingredient lines, optional method, optional author nutrition (kcal, protein, carbs, fat, fibre when stated)
2. **schedule** — weekly plan: each day with meal slots (Breakfast/Lunch/Dinner/Snacks) and labels that reference recipe titles

Rules:
- Assign each recipe a stable \`key\` slug (lowercase, hyphenated from title)
- Schedule slots must list \`recipeKeys\` when the label maps to known recipes (bowls may reference several keys)
- Include \`claimedKcal\` on a slot ONLY when the source states kcal for that meal without a full recipe
- Do NOT invent ingredients or nutrition — extract only what is present
- Normalise slot names to Breakfast, Lunch, Dinner, or Snacks
- \`dayIndex\` is 0-based (Mon or Day 1 → 0)

Return a single JSON object (no markdown fences):
{
  "planName": "string or null",
  "recipes": [
    {
      "key": "cilantro-chicken-curry",
      "title": "Cilantro Chicken Curry",
      "serves": 4,
      "ingredients": ["500 g chicken breast", "1 can coconut milk"],
      "method": "optional",
      "authorNutrition": { "calories": 291, "protein": 32, "carbs": 12, "fat": 14, "fiberG": 3 }
    }
  ],
  "schedule": [
    {
      "dayLabel": "Mon",
      "dayIndex": 0,
      "slots": [
        {
          "slot": "Lunch",
          "label": "Cilantro Chicken Curry",
          "recipeKeys": ["cilantro-chicken-curry"],
          "portionMultiplier": 1,
          "claimedKcal": null
        }
      ]
    }
  ]
}

SOURCE TEXT:
"""
${text.slice(0, 48000)}
"""`;
}
