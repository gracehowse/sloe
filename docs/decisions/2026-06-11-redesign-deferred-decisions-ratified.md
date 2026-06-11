# Redesign deferred decisions — ratified (2026-06-11)

Grace ratified the six open DECISION issues (ENG-919–925) that had been
blocking Figma-conformance build work. Recorded here as the source of truth;
each decision issue is closed Done with this doc cited. ENG-924 (Google
Sign-In) was already decided NO (cancelled).

| # | Decision | Ratified outcome | Unblocks |
|---|----------|------------------|----------|
| **ENG-919** | Plan model — single-day (Figma) vs multi-day (app) | **MULTI-DAY.** Keep the app's multi-day model; the Figma single-day frame (`309:2`) is superseded. Serious meal-planners require multi-day (meal-planning audit), and it's the shipped reality. | ENG-899 (Plan conformance) |
| **ENG-920** | Recipe macros — rings vs flat tiles | **FLAT TILES.** Ring-language is reserved for the hero calorie ring (design spine); recipe-detail rings would compete with it. Consistent with the 2026-06-10 tile-class rule (stat tiles are flat). | ENG-890 (Recipe detail/create/cook conformance) |
| **ENG-921** | Library/Discover filter taxonomy — category vs entry-kind | **CATEGORY primary + ENTRY-KIND secondary.** Browse by content (cuisine, meal type) as the main axis; Saved / Imported / Created as a secondary filter or sub-tab. Matches Paprika/MFP; best of both. | ENG-896 (Recipes & Cookbook conformance) |
| **ENG-922** | Fasting presets — which set ships | **MINIMAL: 16:8 + OMAD.** Covers the 90% case with the smallest health-claims surface — the launch audit flagged fasting copy as the top claims risk (ENG-1028 autophagy reword). Fewer presets = less to legal-review and a cleaner picker. | ENG-894 (Fasting conformance) |
| **ENG-923** | "Ask coach" free-text Q&A — build + launch inclusion | **DEFER past 2026-07-01.** The meal-coach engine + grounded digest narrative (built 2026-06-11) already deliver the coaching surface for launch. A free-text Ask adds API cost, the no-mocked-functionality bar, and a health-claims/safety surface that isn't launch-critical. → ENG-913 (Build Ask) moves OUT of launch scope (post-launch / flag-gated when revisited). | (removes ENG-913 from launch scope) |
| **ENG-925** | Meal-row imagery — consistent-icon (A) vs photo-when-library + fallback (B) | **OPTION B.** Photo when the row is a library recipe with an image; a calm watercolour fallback otherwise (no empty box). This is exactly what the ENG-1015 imagery direction (watercolour fallbacks) builds — already in motion. | ENG-889 (Today meal-card conformance) |
| ENG-924 | Google Sign-In provider — add or not | **NO** (already cancelled 2026-06-xx). Apple Sign In remains the sole mobile provider. | — |

## Notes
- The downstream build issues (ENG-889/890/894/896/899) are now unblocked to be designed/implemented against these decisions.
- ENG-913 ("Build Figma-Only: Ask coach screen") is no longer launch-scoped per ENG-923 — revisit post-launch with cost guardrails + safety/claims review.
- Pending Notion mirror (MCP not connected this session): add a Decisions-log row linking this file.
