# Voice Food Logging: Research & Implementation Plan

_Last updated: 2026-04-16_

---

## 1. Competitive Landscape

### Major apps with voice logging

| App | Voice Logging | Paywall | Implementation Notes |
|-----|---------------|---------|---------------------|
| **MyFitnessPal** | Yes (v24.35+) | Premium ($79.99/yr) | On-device speech-to-text, then server-side NLP parsing. Voice log is iOS/Android, English only. Premium-only alongside meal scan and barcode. |
| **MacroFactor** | Yes ("AI Describe") | Included in subscription ($11.99/mo) | User speaks or types a free-text meal description. Multiple LLM prompts decompose the description into ingredients, then query a curated common-food database (not the full branded DB). Prioritises lab-analysed USDA-style entries over LLM-generated values. |
| **Lose It!** | Limited | Premium | Has had experimental NLP text entry; no dedicated voice logging flow as of early 2026. |
| **Cal AI** | Yes (photo + voice) | Freemium | Photo-first approach; voice as secondary input. |
| **Fitia** | Yes (photo, voice, text) | Free tier included | AI-assisted logging via photo, voice, or text; claims 70%+ reduction in tracking time. |
| **SpeakMeal** | Yes (voice-first) | Freemium | Dedicated voice-first nutrition app. Speak meals, get calorie/macro breakdown. |
| **Voical** | Yes (voice-first) | Freemium | Multilingual voice input; claims 15-second logging. |
| **CalPerks** | Yes (speak or type) | Freemium | Natural language input; uses USDA FoodData Central as primary nutrition source. |
| **Saylo AI** | Yes (voice-first) | Freemium | Instant nutrition data from spoken descriptions including micros. |
| **NutriScan** | Yes (photo + voice) | Freemium | Voice + photo; AI parses natural speech patterns into structured nutrition logs. |

### Key takeaway

Voice/NLP food logging has moved from "differentiator" to "table stakes" in 2025-2026. Every serious nutrition app either has it or is shipping it. The established players (MFP, MacroFactor) paywall it; the new entrants (SpeakMeal, Voical, CalPerks) use it as a free hook to drive adoption.

---

## 2. Technical Approaches

### Approach A: Speech-to-Text then NLP Food Parsing (two-stage)

```
Microphone -> STT Engine -> Plain text -> NLP Food Parser -> DB Lookup -> Structured entry
```

**STT options:**
- **On-device (Apple Speech / Android SpeechRecognizer):** Free, low latency, offline-capable, privacy-friendly. Limited accuracy for food-specific vocabulary.
- **OpenAI Whisper API:** 99%+ accuracy for clear audio, multilingual, $0.006/min. Requires audio upload (25MB limit). Adds network round-trip.
- **Deepgram / AssemblyAI:** Streaming STT with lower latency than Whisper. Comparable accuracy.
- **Web Speech API (browser):** Free, built into Chrome/Edge/Safari. No server cost. Quality varies by browser.

**NLP food parsing options:**
- Rule-based parsers (regex + food dictionaries) -- fast, predictable, but brittle with novel inputs.
- LLM-based parsing (GPT-4o-mini, Claude Haiku) -- flexible, handles ambiguity, but adds cost and latency.
- Hybrid: rule-based first pass, LLM fallback for ambiguous cases.

**Pros:** Each stage can be tested/improved independently. STT can be swapped. Food parsing can use existing ingredient pipeline.
**Cons:** Two network calls. Errors compound (STT error + parse error).

### Approach B: End-to-End LLM (single-stage)

```
Microphone -> Audio -> Multimodal LLM -> Structured entry
```

Send raw audio directly to a multimodal model (GPT-4o, Claude with audio) that both transcribes and parses in one step.

**Pros:** Single call. Model has full context (tone, pauses, corrections).
**Cons:** Higher cost per call. Harder to debug failures. No intermediate transcript for user confirmation. Audio API support still maturing.

### Approach C: On-device STT + LLM Parse (Suppr's current approach)

```
On-device STT (expo-speech-recognition / Web Speech API) -> transcript -> Server LLM parse -> Structured entry
```

This is what Suppr already does. The STT is free (on-device), and only the text transcript is sent to the server for LLM parsing. Good balance of cost, privacy, and accuracy.

### Industry consensus (2025-2026)

Most apps use Approach A or C. MacroFactor explicitly states they use "several LLM prompts working in tandem" to break down meals, then query a real food database rather than trusting LLM-generated nutrition values. This is the gold standard: **use LLMs for parsing, use verified databases for nutrition data.**

---

## 3. What Good Voice Logging UX Looks Like

### Input examples and expected output

| User says | Parsed result |
|-----------|--------------|
| "Log 200g chicken breast and a cup of rice" | Chicken breast (200g): 330 kcal, 62g P, 0g C, 7g F / White rice (1 cup cooked, 186g): 242 kcal, 4g P, 53g C, 0.4g F |
| "Two eggs and toast with butter" | Large eggs, scrambled (2): 182 kcal / White toast (1 slice): 79 kcal / Butter (1 pat, 5g): 36 kcal |
| "A big bowl of pasta with meat sauce" | Spaghetti (2 cups cooked): 442 kcal / Meat sauce (1 cup): 185 kcal |
| "Coffee with oat milk" | Coffee (8 oz): 2 kcal / Oat milk (2 tbsp): 15 kcal |

### UX best practices

1. **Immediate feedback.** Show a "listening" animation. Display the transcript in real-time if possible.
2. **Editable confirmation.** After parsing, show a structured breakdown the user can edit before saving. Never auto-commit without review.
3. **Text fallback.** Always allow typing as an alternative (social settings, noisy environments). MacroFactor treats voice and text as equivalent inputs to the same "Describe" flow.
4. **Meal slot context.** Pre-select the meal slot (breakfast/lunch/dinner) based on time of day to reduce taps.
5. **Error recovery.** If parsing fails, show the raw transcript and let the user retry or edit.
6. **Speed.** The entire flow (tap mic -> speak -> see results) should take under 10 seconds. Users benchmark against "just typing it."
7. **Multilingual support.** Increasingly expected. On-device STT handles locale; the LLM parser should handle non-English food names.

---

## 4. Accuracy Challenges

### Portion ambiguity
- "A bowl of rice" -- small bowl? large bowl? (150-400g cooked range)
- "Some chicken" -- 100g? 200g? a whole breast?
- **Mitigation:** Default to USDA standard serving sizes. Show the assumed portion prominently so users can adjust. MacroFactor's approach: return a reasonable default and let users edit quantity.

### Brand names
- "A Clif bar" vs "a protein bar" -- 250 kcal vs 150-300 kcal range
- **Mitigation:** Match against branded food database when brand is detected. Fall back to generic category average. Flag the match confidence.

### Regional and cultural food names
- "Chips" (US: potato chips, UK: french fries)
- "Biscuit" (US: bread roll, UK: cookie)
- "Roti" / "chapati" / "naan" -- different items with different nutrition profiles
- **Mitigation:** Use locale from device settings. Build a regional alias table. When ambiguous, present options.

### Compound meals
- "Chicken stir-fry" -- the nutrition depends entirely on the recipe
- **Mitigation:** Decompose into likely components (chicken, vegetables, oil, sauce). Show the breakdown so users can adjust.

### Homophones and STT errors
- "pear" vs "pair", "steak" vs "stake", "flower" vs "flour"
- **Mitigation:** Post-process transcript through a food-vocabulary filter. Prefer food-related interpretations of ambiguous words.

### Cooked vs raw
- "200g chicken" -- raw (220 kcal) or cooked (330 kcal)?
- **Mitigation:** Default to cooked (more common logging scenario). Allow users to specify.

---

## 5. What Suppr Already Has

### Mobile (`apps/mobile/`)

**Voice logging scaffold** -- `apps/mobile/lib/voiceLog.ts`
- Uses `expo-speech-recognition` for on-device STT when available (requires EAS dev build)
- Falls back to text input modal in Expo Go
- Exports: `isSpeechAvailable()`, `requestSpeechPermission()`, `listenForSpeech({ locale, maxDurationMs })`
- 10-second max duration for speech capture

**Voice log handler** -- `apps/mobile/app/(tabs)/index.tsx`
- `handleVoiceLog()` callback: attempts native speech recognition, falls through to text input modal
- `submitVoiceTranscript()` sends transcript to `/api/nutrition/voice-log` endpoint
- Parsed items are added to meal log with `source: "AI voice"` tag
- Voice button appears in FAB sheet and quick-action row
- Full text-input fallback modal with keyboard submit

**E2E test** -- `apps/mobile/.maestro/08_voice_log.yaml`
- Tests that the Voice button opens the text input fallback

**Source badge** -- `apps/mobile/components/NutritionSourceBadge.tsx`
- Recognises `"voice"` source string and labels it as "estimated"

### Web (`src/app/components/NutritionTracker.tsx`)

- `handleVoiceLog()` uses browser `webkitSpeechRecognition` / `SpeechRecognition` API
- Falls back to a text dialog if speech recognition is unavailable or fails
- `submitVoiceTranscriptWeb()` calls the same `/api/nutrition/voice-log` endpoint
- Items are logged with `source: "AI voice"` and assigned to the current meal slot

### API (`app/api/nutrition/voice-log/route.ts`)

> **Superseded — 2026-04-19.** The paywall and rate-limit entries below describe the state before 2026-04-19. See [`docs/decisions/2026-04-19-voice-logging-pro-only-server-enforced.md`](../decisions/2026-04-19-voice-logging-pro-only-server-enforced.md) for the current settled decision.

- **Auth:** Requires authenticated user
- **Paywall:** ~~Gated to Base+ tier (`tier === "free"` returns 403)~~ **Pro-only** (`tier !== "pro"` returns 403) as of 2026-04-19.
- **Rate limit:** ~~50 requests per user per 24 hours~~ **100 requests per user per 24 hours** (matches Pro landing claim) as of 2026-04-19.
- **Model:** GPT-4o-mini (temperature 0.2, max 1000 tokens)
- **Approach:** Receives a plain-text transcript, sends it to OpenAI with a prompt that instructs it to parse into structured food items with estimated nutrition
- **Output:** Returns `{ items: [{ name, quantity, calories, protein, carbs, fat }], totalCalories, totalProtein, totalCarbs, totalFat }`
- **Weakness:** The LLM generates nutrition values directly rather than looking up verified database entries. This is the "guess" approach that MacroFactor explicitly avoids.

### Summary of current state

Suppr has a **functional but improvable** voice logging system:
- STT: Working (on-device, free, cross-platform with fallbacks)
- Transcript -> Structured entry: Working (LLM-based)
- Database lookup: **Missing** -- the LLM estimates nutrition values rather than matching against USDA/OFF/FatSecret
- Confirmation UI: **Missing** -- items are auto-logged without user review
- Portion editing: **Missing** -- no way to adjust quantities before committing

---

## 6. Shortest Path to Ship an Improved Voice Logging Feature

### What Suppr already has that can be leveraged

1. **On-device STT** -- `voiceLog.ts` with `expo-speech-recognition` (mobile) and Web Speech API (web). No changes needed.
2. **Ingredient parsing pipeline** -- `src/lib/nutrition/estimateIngredientMacros.ts` with `measureToGrams` for count-to-weight normalisation, STAPLES table for common foods.
3. **Multi-source food matching** -- USDA, Open Food Facts, FatSecret integrations already exist in the codebase.
4. **Voice log API route** -- `/api/nutrition/voice-log` with auth, paywall, rate limiting all wired up.
5. **Claude/OpenAI API knowledge** -- already integrated; can swap models or add a second pass.

### Recommended improvements (ordered by impact)

#### Phase 1: Database-backed nutrition (1-2 days)

**Problem:** Current LLM generates nutrition values from memory, which can be inaccurate.

**Fix:** Change the voice-log API route to a two-step process:
1. Use LLM (GPT-4o-mini or Claude Haiku) to parse transcript into structured items: `[{ name, quantity, unit }]`
2. For each item, run it through the existing `estimateIngredientMacros` pipeline or USDA/OFF lookup to get verified nutrition data
3. Fall back to LLM-estimated values only when no database match is found, and flag those items as `isDefaultFallback: true`

This aligns with MacroFactor's approach and leverages Suppr's existing ingredient matching infrastructure.

#### Phase 2: Confirmation UI (1-2 days)

**Problem:** Items are auto-logged without user review.

**Fix:**
- Mobile: Show a bottom sheet with parsed items, quantities, and nutrition before committing. Allow editing quantity/swapping items.
- Web: Show a modal with the same confirmation flow.
- Both platforms: highlight items flagged as `isDefaultFallback` so users know which estimates are less reliable.

#### Phase 3: Improved parsing prompt (0.5 day)

**Problem:** Current prompt is minimal and doesn't handle edge cases well.

**Fix:** Enhance the LLM prompt to:
- Distinguish cooked vs raw (default to cooked)
- Handle brand names (output a `brand` field when detected)
- Normalise regional food names
- Output structured quantities (`{ amount: 200, unit: "g" }`) instead of free-text quantity strings
- Include a confidence score per item

#### Phase 4: Streaming feedback (nice-to-have, 1 day)

- Show real-time transcript on mobile (expo-speech-recognition supports interim results)
- Stream the LLM response so items appear as they're parsed

### Architecture diagram (target state)

```
User speaks
    |
    v
On-device STT (free)
    |
    v
Plain text transcript
    |
    v
POST /api/nutrition/voice-log
    |
    v
Step 1: LLM parse transcript -> [{ name, quantity, unit, brand? }]
    |
    v
Step 2: For each item -> estimateIngredientMacros() / USDA lookup
    |
    v
Step 3: Return structured items with nutrition + confidence flags
    |
    v
Confirmation UI (user reviews, edits, commits)
    |
    v
Meal log
```

### Cost estimate (per voice log)

| Component | Cost |
|-----------|------|
| On-device STT | $0 |
| LLM parsing (GPT-4o-mini, ~500 tokens) | ~$0.0003 |
| USDA/OFF lookup | $0 (local DB or free API) |
| **Total per log** | **~$0.0003** |

At 50 logs/day rate limit, max cost per user per day: ~$0.015.

### Timeline estimate

| Phase | Effort | Impact |
|-------|--------|--------|
| Phase 1: DB-backed nutrition | 1-2 days | High -- accuracy jumps from "LLM guess" to "verified data" |
| Phase 2: Confirmation UI | 1-2 days | High -- user trust and error correction |
| Phase 3: Better prompt | 0.5 day | Medium -- handles edge cases |
| Phase 4: Streaming | 1 day | Low -- polish |
| **Total** | **3.5-5.5 days** | |

---

## Sources

- [MyFitnessPal Voice Logging Help](https://support.myfitnesspal.com/hc/en-us/articles/30332897072269-Voice-Logging)
- [How to Use Voice Logging in MyFitnessPal](https://blog.myfitnesspal.com/voice-logging-myfitnesspal/)
- [MyFitnessPal Pricing 2026](https://nutriscan.app/blog/posts/myfitnesspal-pricing-2026-guide-2ff09c399a)
- [MacroFactor: Log Foods with Describe](https://help.macrofactorapp.com/en/articles/216-log-foods-with-describe)
- [MacroFactor AI Food Logging](https://macrofactor.com/macrofactor-ai/)
- [MacroFactor AI Food Logging Help](https://help.macrofactorapp.com/en/articles/258-ai-food-logging)
- [MacroFactor: Fastest Food Logging Workflows](https://macrofactorapp.com/new-food-logger/)
- [Best Voice Calorie Logging Apps 2025 (Peony)](https://www.heypeony.com/blog/voice-calorie-logging-apps)
- [SpeakMeal](https://speakmeal.framer.ai/)
- [Voical](https://www.voical.app/en)
- [CalPerks](https://calperks.app/)
- [Saylo AI](https://www.sayloai.app/)
- [NutriScan Voice Calorie Counter](https://nutriscan.app/apps/voice-activated-calorie-counter)
- [OpenAI Speech to Text API](https://developers.openai.com/api/docs/guides/speech-to-text)
- [Voice Technology in Nutrition Apps (Qina)](https://www.qina.tech/blog/the-voice-revolution-integrating-voice-technology-into-personalised-nutrition-solutions-qina)
- [Top 12 Nutrition Tracking Apps 2026 (Fitia)](https://fitia.app/learn/article/top-12-nutrition-tracking-apps-2026/)
- [Best AI Calorie Trackers 2026 (Jotform)](https://www.jotform.com/ai/best-ai-calorie-tracker/)
