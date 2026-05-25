# Nutrition Claims Guidance

**ENG-536 — Release-blocking copy posture.**

Suppr must never make absolute health or nutrition claims. Our trust posture is "estimated, confidence-aware, never prescriptive."

## Banned Phrases

These must never appear in user-facing copy, UI strings, or marketing:

| Banned | Why | Use instead |
|--------|-----|-------------|
| "100% accurate" | No nutrition database is perfect | "estimated" or "based on [source]" |
| "exact calories" / "exact macros" | Vision/search inherently uncertain | "approximately" or show range |
| "guaranteed accurate" | Overpromises | "matched from [source]" |
| "will lose weight" / "will gain weight" | Prescriptive health claim | "on track for your goal" |
| "clinically proven" | Requires clinical evidence we don't have | omit or cite specific study |
| "scientifically proven" | Overstates evidence | "research suggests" |
| "doctor recommended" | Requires endorsement | omit |
| "cures" / "prevents disease" / "treats" | Medical claim | omit entirely |

## Approved Patterns

- **Confidence language**: "high confidence", "medium confidence", "estimated"
- **Source attribution**: "matched from USDA SR28", "based on FatSecret data"
- **Hedged outcomes**: "on track for your goal", "trending toward your target"
- **Ranges**: "~120-150 kcal" (honest about uncertainty)
- **Disclaimers**: "Estimates only. Not medical advice."

## Enforcement

- `npm run check:nutrition-claims` — automated lint in CI
- `copy-reviewer` agent reviews all new user-facing strings
- `nutrition-engine` agent validates confidence language

## Legal context

The terms page (`/terms`) contains the canonical disclaimer: "Do not use Suppr to diagnose, treat, cure, or prevent any disease." This disclaimer does not license absolute claims elsewhere.
