# Logging system audit — LogSheet + Voice + Photo + Health Sync + Notifications

**Phase 6 comprehensive scope.** 3 platforms.
**Source:** customer-lens, 2026-04-28.

---

## Top 5

### LS-01 [P1] — LogSheet Search tab is a decoy on both platforms

`apps/mobile/components/today/LogSheet.tsx:342-377` + `src/app/components/suppr/log-sheet.tsx:355-381`.

When host wires `onOpen` (canonical config), input becomes a button-disguised-as-input. Mobile: `pointerEvents="none"` on input wrap, `editable={false}`. Web: `readOnly={isRouter}`, `cursor-pointer`. **Tap → entire sheet vanishes mid-tap, then a different modal slides in.** Placeholder still says "Search foods, brands, or recipes…" — no visual cue this is a button.

Returning user comes back tomorrow, taps the bar, sheet disappears — **every session relearns this.**

**Fix:** Either (a) make the LogSheet's Search tab the real search (push debounce + USDA/OFF/FatSecret index here; kill the router pattern), or (b) convert input into an obvious button (no caret, label "Open search →") and treat the modal as a deeper layer of the sheet, not a replacement.

### LS-02 [P1] — Sub-tab strip clips Voice/Photo log on every viewport ≤430pt

LogSheet pill bar scrolls horizontally. Six pills at ~80–110pt each + 6pt gaps = ~600–700pt total. On every viewport ≤~430pt the **last 1–2 tabs (Voice log, Photo log) are clipped**. No fade-edge gradient, no chevron, no "more" indicator.

**Voice and Photo log are the headline Pro features** — first-time user lands on Search, sees four tabs, concludes "no AI features here" — exactly the discovery problem entry-point consolidation was meant to fix.

**Fix:** Two-row pill bar (3+3) on narrow widths; OR shorter labels ("Voice"/"Photo"/"Scan"); OR fade-edge gradient + right-chevron scroll affordance.

### VL-01 [P0 trust] — Voice log on Safari + Firefox silently does nothing

`src/app/components/suppr/voice-log-dialog.tsx:92-165`. Branches on `webSpeechSupported` (Chrome/Edge only — Safari iOS, Firefox desktop, Firefox mobile = `undefined`).

Fallback to `mediaRecorderSupported` records audio with no transcription. Comment line 12: *"Transcription of the recording is out of scope for this release."* **Recording is never uploaded.**

On Safari (default mobile-web browser for any iPhone user hitting suppr.app instead of App Store): press-and-hold flips `isRecording = true` (green ring), MediaRecorder captures audio, releases — **and nothing happens.** Recording discarded. Transcript field stays empty.

User has paid Pro. Pro feature appears to work but produces nothing. **Refund-trigger.**

**Fix:** Detect both capabilities at mount. If `webSpeechSupported === false`, hide mic button entirely and show "Voice transcription isn't available in this browser. Type your meal below." Don't show a record control that doesn't lead to a transcript.

### PL-01 [P0 trust] — Photo log AI estimate commits as if verified nutrition

`apps/mobile/components/PhotoLogSheet.tsx:204-212` + web equivalent. AI photo log shows purple sparkles "AI estimate" + Low/Med/High confidence in the dialog. **On commit:**

- `onCommit(items)` invoked with `AiLoggedItem[]` whose only provenance carrier is `source: "ai_photo"` tag set inside `sanitiseAiItems`.
- Today's `JournalMeal` rendering does NOT surface this provenance with the same prominence — becomes one of N entries contributing to a single kcal/protein/carb/fat total.
- High-confidence path says "Log all" — same green-button finality as USDA-verified entry.

**The trust signal lives inside the modal that closes after commit.** Today total absorbs AI estimates without flagging. Per CLAUDE.md: *"If nutrition / ingredient matching is uncertain, do not guess."* Photo-log estimates are inherently uncertain.

**Fix:** On Today meal row, render AI badge (sparkles + "AI estimate") for any meal whose source is `ai_photo` or `voice` or any item confidence < 0.75. Optional banner on Today: "X kcal of today's total is from AI estimates."

### HS-01 [P0 trust] — "Apple Health Connected" lies after iOS revoke

`apps/mobile/app/health-sync.tsx:21-22, 42-55, 130-149`. Connection state gated entirely by AsyncStorage boolean `health_sync_apple_connected`. Set to `"true"` after first successful `initHealthKit` call (line 135) and **never re-validated.**

Every subsequent app launch reads stored boolean → `connected = true` → green checkmarks next to "Daily steps / Weight / Active energy / Resting energy / Workouts" + "Sync Now" button — **even though HealthKit returns empty arrays for every read because OS-level grant is gone.**

User taps Sync Now → "No new data to sync" success-shaped empty path → concludes "Health connect working but I haven't moved much." **Integration is dead.**

Already flagged in More-tab audit M10. **Still here.**

**Fix:** On Health Sync mount + app foreground, call `getDailyStepCountSamples` for last 24h as a probe. If authoritative empty + iOS authorisation status `notDetermined` or `denied`, flip `connected = false`, clear AsyncStorage, surface "Reconnect Apple Health" CTA. On every Sync Now returning 0 samples for ≥3 metrics in a row, prompt to verify iOS Settings.

---

## Web vs mobile divergences

- **Voice capture:** Mobile uses native `expo-speech-recognition`; web uses Web Speech API + half-built MediaRecorder fallback that captures audio and discards it. Safari + Firefox silently produce no transcript on web; mobile native gracefully falls back to typing.
- **Barcode manual-entry fallback:** Mobile has TWO flows (LogSheet `BarcodeManualEntry` + `BarcodeScannerModal.tsx:53-60`). Web has only the LogSheet path. Two manual-entry UIs, two ways to save the same thing on mobile.
- **Health Sync:** Mobile = full HealthKit screen with import/export, generic-labels, clear-imported destructive. **Web: screen does not exist as a route.** User who set up on web has no way to know HealthKit exists.
- **Notifications:** Mobile has native push; web `NotificationsCenter.tsx` is in-app inbox only — no service worker, no email-digest preference UI on this screen.
- **AI estimate badge:** Both render the badge in review list. **Both fail to carry it through to Today.**

---

## Trust concerns ranked

1. **PL-01 / VL-01**: AI estimates with no Today-level provenance + "Log anyway" framing. Pro user can populate a whole day from AI estimates and read totals as if measured.
2. **VL-01**: Pro voice log paid feature silently fails on Safari/Firefox.
3. **HS-01**: "Connected" is a cached boolean, not probed truth. **Second time the More audit has flagged this; still ships.** Rest of app's maths drift silently.
4. **LS-01**: Decoy search input. First interaction in canonical log flow. "This product fakes affordances" first impression.
