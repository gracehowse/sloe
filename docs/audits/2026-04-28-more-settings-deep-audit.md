# More / Settings / "You" sub-tab deep audit — 3 platforms

**Phase 6 expanded scope.** Mobile native, mobile-web, desktop-web.
**Source:** customer-lens, 2026-04-28.

---

## Top 5 most damaging issues (impact-per-effort)

1. **Mobile-web "You" tab is a dead end.** Tapping You → Progress only. No `YouSubTabHeader` on web, no in-app links to reach Settings/Profile/equivalent-of-More. Mobile-web user **cannot reach Settings, log out, manage subscription, edit targets, or delete account** without typing `?view=settings` in the URL bar. **P0**.
2. **"More" exists on mobile (native + pill bar) but nowhere in web information architecture.** Desktop sidebar's `you` group is `progress / profile / settings`. Native's `YouSubTabHeader` is `progress / settings / more`. Web has no concept of "More". User who learns the app on phone and opens it on laptop loses ~10 surfaces (Caffeine/Alcohol limits, Dashboard widgets, Week-start picker, Apple Health, Household, Build stamp, Reset/Erase, Privacy/Terms, Help, Export-CSV). **P0**.
3. **Two screens both try to be Settings.** Native Settings ≠ Native More — but they overlap ~80%. Both have Sign Out, Export CSV/JSON, Manage subscription, Notifications row. Only six of twenty-plus rows differ. User cannot predict which screen owns which setting. **P0**.
4. **Mobile-web Settings is unreachable from inside the app.** `Settings.tsx` renders when `currentView === "settings"` and `?view=settings` works, but no nav element below `md:` exposes a path to it. **P0** trust hit — user thinks settings simply don't exist on web.
5. **Reset / Erase / Delete-Account all stacked behind one modal.** "Reset or erase everything" and "Erase all app data…" both open the same modal containing "Reset Plan (Keep My Data)", "Erase all app data", "Delete my account permanently", and "Cancel". Account-delete buried second-most-prominent in an erase-data modal is dangerous. No equivalent on web. **P0** trust + parity.

---

## Settings page audit (S-prefix)

| ID | Where | Issue | Severity |
|---|---|---|---|
| S1 | `more.tsx:809` "Settings" row sub: "Theme, password, plan, activity level, journal" | Destination has those + more, but lacks Daily targets, Notifications-time picker, Caffeine limit, Apple Health, Dashboard widgets, Week start, Weekly recap, Help, Privacy, Reset, Build. Half-Settings half-something-else. **P0** |
| S2 | `settings.tsx:488–516` | "Manage subscription" only for non-free. Free user wanting to confirm subscription state has no path. P2 |
| S3 | `settings.tsx:517–551` | Promo code input inside Plan card with no heading — reads as if part of active plan. P2 |
| S4 | `settings.tsx:636–653` | "Adjust goal for activity" toggle has no link to Burn Detail. P2 |
| S5 | `settings.tsx:682–730` | "How weight shows up" segmented (Show/Trends only/Hide) is buried 5 sections deep. PII-sensitive. P2 |
| S6 | `settings.tsx:732` | "Burn / deficit summary window" wording incomprehensible. "Rolling (last 7 days)" vs "This week" with sub mentioning "the weekly block when you expand your calorie ring on Today." Most users won't parse. P2 |
| S7 | `settings.tsx:822–844` | "Tracking extras" toggles caffeine/alcohol shown on Today; the limit-setter lives on More. Toggle is here, value is there. P1 |
| S8 | `settings.tsx:773–814` | "Open notifications" row in Notifications card lands on inbox `/(tabs)/notifications`, not a permissions screen as user might expect. Rename to "Open notification inbox". P1 |
| S9 | `settings.tsx:644–676` | Long helper paragraphs but Switch has no `accessibilityHint` linking to body text. P3 |
| S10 | `settings.tsx:850–862` | "What's new in Suppr" exists; no "Help" or "Contact" — they only live on More. P2 |
| S11 | mobile-web Settings | Reached via deep link, but no in-content "Back" or context tells user they're inside "You" group. P1 |
| S12 | (Theme picker) | Mobile labels "Automatic / Light / Dark" / Web "Auto / Light / Dark". Trivial. P3 |
| S13 | `settings.tsx:618–622` | Activity-level row falls back to "Not set" with no nudge. New users skip past. P2 |
| S14 | `settings.tsx:374–381` | Promo-code success uses Alert.alert instead of toast; jarring vs rest of app. P3 |

---

## More page audit (M-prefix)

| ID | Where | Issue | Severity |
|---|---|---|---|
| M1 | `more.tsx:556–560` | Title "More" with overline "ACCOUNT" but page is everything: Account + Goals + Connections + Recipes + App + Legal + Build + Danger zone. Overline lies. P1 |
| M2 | `more.tsx:561–624` | Top-right gradient avatar (40px) duplicates the larger 52px avatar 8px below. Two avatars same screen. Top-right navigates; card one is presentational. User taps wrong one. P1 |
| M3 | `more.tsx:633–643` | "Recipes" / "Streak" stat tiles are `<Pressable>` with no `onPress`. Tap target with no feedback. P1 |
| M4 | `more.tsx:653–694` | Membership upgrade row is the loudest visual when not Pro. For Base user (already paying) it reads as an ad inside settings. P2 |
| M5 | `more.tsx:730` | "Daily targets" sub: "2,000 kcal (defaults) · Tap to personalise". Onboarded user expects computed values. If it falls back to defaults, silent bug elsewhere. **P1 trust** |
| M6 | `more.tsx:737` | "Dashboard widgets" sub lists "Protein, Carbs, Fat" — reads as current-state disclosure, not the additive set the picker actually offers. P3 |
| M7 | (More) | "Week starts on" is on More, not Settings → Appearance where users expect locale/calendar prefs. P2 |
| M8 | `more.tsx:748` | "Caffeine limit" copy "EFSA & FDA upper limit 400 mg" reads like a fact about regulators, not user's saved value. Same value as default → user can't tell whether personalised. P2 |
| M9 | `more.tsx:755` | "Alcohol limit" sub "Off · set a target to show the row" — which row? P2 |
| M10 | `more.tsx:763` | Apple Health row sub "Connected" / "Not connected" reflects platform availability, NOT actual permission grant. Post-revoke this still says "Connected". **P1 trust** |
| M11 | `more.tsx:766–770` | Notifications row says "Daily reminder at 18:00" but Settings has FIVE notification toggles + inbox. More row covers exactly one. **P1 misrepresents state** |
| M12 | `more.tsx:775–785` | Weekly recap separate from Notifications. User concept: notifications. App concept: two `profiles` columns. P2 |
| M13 | `more.tsx:788–792` | Recipes section has only "Create recipe" — one-row group is a placeholder. P3 |
| M14 | `more.tsx:890–895` | **Build-stamp visible to all users in production.** "v? · build ? · MARKER F50-2026-04-22". Invaluable for testers, scary for paying users. **P1** |
| M15 | `more.tsx:900–914` | "Reset or erase everything" and "Erase all app data…" **both call `setResetModalOpen(true)`**. Same modal. User expects different actions. **P0** |
| M16 | `more.tsx:927–1079` | Modal contains THREE destructive actions: Reset Plan / Erase all app data / Delete my account permanently. Account-delete buried in erase-data modal. **P0** |
| M17 | `more.tsx:920–925` + `settings.tsx:583–589` | Sign Out duplicated in More AND Settings. P2 |
| M18 | `more.tsx:957–959` | Reset Plan modal: 75-word paragraph with 3 distinct actions, no bullets. P2 |
| M19 | (Reset modal) | "Keep My Data" Title Case while subsequent buttons Sentence case. P3 |
| M20 | `more.tsx:822` + `settings.tsx:884` | Export CSV identical labels in More and Settings → Data. Same outcome. P2 |
| M21 | `more.tsx:872–876` | Help & information row falls back to `mailto:privacy@suppr-club.com`. User who wants help opens mail to a privacy address. **P1** |
| M22 | `more.tsx:882–883` | Privacy / Terms open external URLs without warning. P3 |

---

## Profile page audit (P-prefix)

| ID | Where | Issue | Severity |
|---|---|---|---|
| P1 | `profile.tsx:373–376` | Header "‹ PROFILE" brand-orange letter-spaced caps title — only screen on mobile that does this. P2 |
| P2 | `profile.tsx:391–488` | Edit form contains every nutrition target + dietary preferences + display name. Two screens crammed into one. P1 |
| P3 | `profile.tsx:336` | Save success uses Alert.alert("Saved", "Your targets have been updated.") even when only display name changed. Misleading. P2 |
| P4 | `profile.tsx:344–355` | Cancel reverts every field even if only one edited. No undo confirmation. P3 |
| P5 | `profile.tsx:69–80` | Fiber and Water are mandatory; clearing field disables save with no error message. P2 |
| P6 | `profile.tsx:367–490` | **No avatar on Profile screen.** User expecting "edit profile" expects avatar/photo edit. P1 |
| P7 | `profile.tsx:394–400` | Display Name has no validation length. Empty string saves as null silently. P3 |
| P8 | `profile.tsx:471–488` | Dietary toggles silent on tap. Combined with bottom Save, fine, but feedback could be a check animation. P3 |
| P9 | (Profile) | Web Profile has tabs (Targets / Progress) and stats; mobile has none. Parity divergence. P1 |
| P10 | `profile.tsx` | Mobile Profile reached only from More's avatar tap. No "Profile" row in More. Discoverability fail. P1 |

---

## Burn detail audit (BD-prefix)

| ID | Issue | Severity |
|---|---|---|
| BD1 | Empty state copy "No profile found. Complete onboarding…" but in-app re-entry to onboarding is hard. P2 |
| BD2 | "Estimated remaining" only when `futureBurn > 0` — yesterday or earlier today the row vanishes. Inconsistent. P3 |
| BD3 | Workouts section uses iOS barbell-outline icon — inconsistent vs lucide elsewhere. P2 |
| BD4 | "Bonus earned" / "Bonus so far" / "No bonus yet" — jargon tied to activity-adjusted-calorie toggle. P2 |
| BD5 | No path to toggle "Adjust goal for activity" from this screen. P2 |
| BD6 | **No web equivalent of `burn-detail`.** Mobile-only. P1 parity gap |

---

## Household audit (HH-prefix)

| ID | Issue | Severity |
|---|---|---|
| HH1 | Mobile entry hidden until you're in one. User wanting to *create* household from More cannot. P1 |
| HH2 | Empty state inside `household-settings.tsx` redirects to Plan. Two-step navigation. P2 |
| HH3 | Web `HouseholdSettingsPage.tsx` exists but no row in mobile-web settings/more reaches it. P1 parity |
| HH4 | Save button cycles "Save changes / Saving… / Saved" then reverts after 1800ms with no other confirmation. P3 |
| HH5 | Long-press to pick members — 10pt tip line at bottom, easy to miss. P2 |
| HH6 | Non-owner sees Save at 50% opacity but can still edit grid optimistically — toggles change visually then bounce on save. P2 |
| HH7 | Privacy toggle "Share targets with household" — no link to learn what "share targets" means. P3 |

---

## Notifications center audit (N-prefix)

| ID | Issue | Severity |
|---|---|---|
| N1 | Two routes lead to Notifications: Settings → "Open notifications" and More → "Notifications". Same destination. P3 |
| N2 | More's "Notifications" row sub shows reminder time only, not unread count. Inbox-like badge expected. P2 |
| N3 | On mobile-web no path to reach inbox without typing `?view=notifications`. P1 |

---

## Sub-tab structure recommendation

**Verified state:**
- Native: `Progress / Settings / More` pill bar.
- Desktop sidebar: `Progress / Profile / Settings`.
- Mobile-web: nothing — "You" routes only to Progress.

**Three problems:**
1. Mobile-web has no in-screen sibling navigation. P0.
2. "More" exists on native but neither web surface knows about it.
3. "Profile" is sidebar sub-tab on desktop but not on native.

**Recommendation: collapse to two sub-tabs everywhere — `Progress / Settings` — with Profile as a row inside Settings (or a header card at top of Progress).**

Reasoning:
- D-2026-04-27-02 (merging Progress + More) and D-2026-04-27-17 (Progress story-led) both point at *fewer* pills. The current third pill ("More") is the symptom of a Settings page that hasn't been consolidated.
- Native Settings + More are 80% overlap. Merging eliminates S1, M1, M3, M11, M12, M17, M20.
- Profile = identity + targets edit. Identity belongs at top of every "You" screen as a small card (prototype already does this `more.tsx:584–624`). Targets belong in Settings under "Goals & targets". Splitting Profile as a separate primary destination duplicates work.

**If full consolidation too big, minimum fix:**
- **Mobile-web**: render a web equivalent of `YouSubTabHeader` at top of Progress when reached via You bottom tab. P0 one-day fix.
- **Desktop sidebar**: replace `Profile` with `More`, or drop `Profile` and route the avatar to existing Profile component.
- **Native**: rename "More" → "Settings" and current "Settings" → "Preferences" or fold entirely.

---

## Cross-platform parity matrix (high-impact rows)

| Row | Native | Mobile-web | Desktop-web |
|---|---|---|---|
| You sub-tab pill bar | ✓ (3 pills) | **MISSING** | drift (3 sidebar entries, wrong set) |
| Daily targets edit | ✓ | ✓ | ✓ |
| Caffeine/Alcohol limit values | ✓ More | **missing** | **missing** |
| Apple Health connect | ✓ via More | n/a | n/a |
| Notifications inbox | ✓ via More+Settings | **missing nav** | ✓ |
| Household | drift (only when in one) | **missing nav** | ✓ sidebar leaf |
| Privacy / Data export | ✓ More+Settings | ✓ Settings | ✓ Settings |
| Delete account | ✓ buried in modal | drift | ✓ |
| Subscription / billing | ✓ Settings | ✓ | ✓ |
| Help / Contact | ✓ More | ✓? | ✓? |
| Sign out | ✓ More+Settings | ✓ Settings | ✓ Settings |
| Build stamp | ✓ More (visible to all) | **missing** | **missing** |
| Reset / Erase all | ✓ More modal | **missing** | drift |
| Burn detail | ✓ standalone | **missing** | **missing** |

**Drift count:** ~10. Mobile-web missing: ≥6 surfaces (sub-tab, Caffeine/Alcohol, Notifications inbox, Reset, Build, Burn detail, Household nav). Desktop-web missing: Burn detail, Caffeine/Alcohol limits, Reset modal, Build stamp.

---

## Synthesis — single most damaging UX moment

**Mobile-web's "You" tab.** First-time user opens Suppr in phone browser. Taps You → Progress. No Settings, no Profile, no Sign Out, no Subscription, no Help, no Reset, no Notifications inbox. Bottom tab bar already on You. **No in-screen affordance to switch.** They cannot leave the app. Combined with the fact that desktop sidebar shows Profile/Settings as siblings (different vocabulary) and Reset/Erase/Delete are all stacked behind one modal on native, the trust hit compounds.

**Fastest fix:** 5-line render of a web `YouSubTabHeader` at top of Progress, Settings, Profile when below `md:`.

**Strategic fix:** consolidate Settings + More into one canonical Settings surface across all three platforms, with Profile as an in-Settings row.

---

## Trust concerns

- Build-stamp visible to all users (M14)
- Apple Health "Connected" lies about post-revoke state (M10)
- Daily targets reading "(defaults)" after onboarding completion (M5)
- Help fallback opens mailto to a privacy address (M21)
- Three destructive actions stacked behind one modal (M15+M16)
- Mobile-web cannot sign out or delete account without URL hacking
