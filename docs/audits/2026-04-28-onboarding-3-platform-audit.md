# Onboarding 3-platform comprehensive audit

**Phase 6 comprehensive scope.** Web v2 (15 steps) + mobile legacy (11 steps active) + mobile v2 (in-progress port).
**Source:** customer-lens, 2026-04-28.

---

## Top 5

### MV-01 [P0] — Mobile v2 has NO completion handler. User permanently stuck on recipes step.

`apps/mobile/components/onboarding-v2/mobile-flow.tsx:60-86, 165-191`. Footer Continue runs `go(1)` for every step including terminal `recipes`. `resolveNextStep` clamps to `[0, TOTAL_STEPS-1]` — on last step button does literally nothing. **No `handleComplete` equivalent of `web-flow.tsx:87-201`** — no Supabase upsert, no seed resolution, no `buildFirstWeekFromSeeds`, no `router.replace`, no analytics.

Recipe picker comment admits this: *"persist is owned by the mobile shell once it lands the terminal-step handler equivalent of web-flow.tsx"* (`steps/recipes.tsx:9-11`).

**The v2 mobile flow does not finish.** User picks 5 recipes, taps "Build my first week", nothing happens.

### MV-02 [P0] — Mobile v2 Signup is FAKE AUTH

`steps/signup.tsx:21-44, 69-82`. Apple button calls `set({ authMethod: "apple" }); go(1)` — sets a string in component state and advances. No `expo-apple-authentication`, no `supabase.auth.signInWithIdToken`, no nonce, no native sheet.

Email field captures `name` and `email` but **no password input, no terms checkbox, no `supabase.auth.signUp` call.** User reaches step 03 anonymous. Web v2 Signup IS real (`signup.tsx:80-119` calls `supabase.auth.signUp`, validates ≥8 char password, has terms checkbox). Mobile has none.

Footer copy *"By continuing you agree to Suppr's Terms and Privacy Policy"* fires when no continuing has happened. **Trust failure on top of being broken.** Should not ship to TestFlight.

### WEB-01 / MV-03 [P0] — V2 state does NOT PERSIST

Both V2 providers (`src/app/components/onboarding-v2/context.tsx:74-78` + `apps/mobile/components/onboarding-v2/context.tsx:55-59`) initialise from `DEFAULT_ONBOARDING_STATE` with **no localStorage / AsyncStorage hydration and no save effect**. Nothing reads from or writes to a key.

Web mid-flow refresh → back to Welcome step 0. Mobile background >5 min → back to step 0. Email-confirm redirect (`emailRedirectTo` lands at `/onboarding`) → back to step 0 with all answers gone.

Web shell comment says `localStorage` is the source of truth (`recipes.tsx:36-41`) — **but no actual code persists state.** P0 because (a) it will happen routinely, (b) silently destroys data, (c) spec doc and code comments both assume persistence exists.

### WEB-02 [P1] — "Suppr Club" trademark risk surfacing on Welcome

`steps/welcome.tsx:62-96`. Hero copy `Join the Suppr Club.` and CTA `Join the club — free`. Per `project_trademark_risk.md` (HIGH risk on "Suppr"/"Suppr Club" with phonetic equivalence to live App Store competitor "Supper Club!"), doubling down on this naming on cold-open is the surface most likely to bite us in a TM dispute.

Pricing tier elsewhere is "Suppr Pro" not "Suppr Club" — Welcome introduces vocabulary the rest of product doesn't carry.

### ML-01 [P0 trust] — Legacy mobile Skip writes FICTIONAL targets flagged as user-set

`apps/mobile/app/onboarding.tsx:387-411, 1059-1062`. Skip button on every step calls:

```ts
const defaultBudget = calculateBudget(
  calculateTDEE("unspecified", 70, 165, 28, "moderate"),
  "steady",
  "lose",
);
```

Upserts `target_calories`, `target_calories_source: "onboarding"`, macro targets, `onboarding_completed: true`. **User lands on paywall with kcal target derived from a fictional 28-year-old, 70 kg, 165 cm, "unspecified-sex"**. Today screen reads this as authoritative.

Per `feedback_no_quick_temp_fixes.md`, "Skip" without a real default is a temp-fix masquerading as a feature. **The product lies to the database about what the user did.**

---

## Other findings

- WEB-03 [P1]: Reveal step `recomp` mapped to `cut` in `persist.ts:23` — user sees recomp messaging but DB stores `cut`
- WEB-04 [P1]: Email confirmation `emailRedirectTo` returns to `/onboarding` → fresh provider → step 0; loop possible
- WEB-06 [P2 trust]: Import step "sample recipe" always shows same fake parsed result regardless of pasted URL
- ML-02 [P1]: Legacy redirect to `/onboarding-v2` flag means TestFlight users with flag get the broken v2 flow
- MV-04 [P1]: Mobile v2 Welcome "Sign in" link is `<Text>` inside `<Text>`, not Pressable — no path to sign-in from mobile v2 cold open
- MV-07 [P2]: Mobile v2 has no "Skip onboarding" affordance. User stuck on broken signup or terminal has only force-quit
- X-02 [P1]: Already-authed user opening `/onboarding/v2` lands on Welcome cold-open targeting first-time users
- X-03 [P0 trust]: `target_calories_source: "onboarding"` is shared by skip path (lies) and real persist (truth) — can't tell from DB which is which
- X-04 [P2]: Network drop during web `handleComplete` — `setCompleting(false)` runs in `finally`, no error UI

---

## Trust concerns ranked

1. **ML-01 / X-03**: DB lies about whether user set their targets. Skip writes 28yo 70kg 165cm "unspecified-sex" defaults flagged as `onboarding`.
2. **MV-02**: Apple Sign-In button doesn't sign anyone in. Terms-agreement copy fires when no continuing.
3. **WEB-06**: Import "sample recipe" always shows same fake result.

---

## Verdict

**Mobile v2 is not shippable.** The flow is fundamentally non-functional (no completion, no auth, no persistence). The redirect at `apps/mobile/app/onboarding.tsx:277-286` is dangerous if the flag flips for anyone besides Grace.

**Legacy mobile Skip path is shipping P0 trust failures today.**

**Web v2 has persistence + email-confirmation handoff bugs that will hit any user mid-confirmation.**

Recommendation: kill switch on mobile v2 flag until MV-01/02 are fixed.
