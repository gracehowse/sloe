# Phase B: Activity / Apple Health — platform decision (web-first)

Pure browser apps **cannot** read Apple Health (HealthKit). Phase B in [`product-roadmap.md`](product-roadmap.md) requires a deliberate platform choice before engineering invests in sync.

## Decision (current)

**Ship web-first with manual activity burn** (already reflected in Profile + Nutrition copy): users enter an optional **activity burn (kcal)** to raise net calories when “adjust for activity” is enabled. No HealthKit dependency.

## Options for real Health data (pick when prioritizing Phase B)

| Option | Pros | Cons |
| --- | --- | --- |
| **iOS shell (Capacitor / Expo)** | Full HealthKit read after user consent | Separate build, review, and release process |
| **Shortcuts / manual export** | No app store for v0 | Friction; not a scalable default |
| **Partner APIs** (Strava, etc.) | Works cross-platform over time | OAuth, legal, uneven coverage |

## Next engineering steps (after choosing)

1. Document the **net calorie rule** in product copy (e.g. fraction of active energy added back).
2. If iOS shell: spike read permissions + one **active energy** field into the same `profiles` or journal model the web app already uses.
3. Keep **manual burn** as fallback for Android and web-only users.

This doc should be updated when the team commits to Capacitor/Expo vs staying web-only for the next 6–12 months.
