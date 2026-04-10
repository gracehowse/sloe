# Phase B: Activity / Apple Health — platform decision (web-first)

Pure browser apps **cannot** read Apple Health (HealthKit). Phase B in [`product-roadmap.md`](product-roadmap.md) requires a deliberate platform choice before engineering invests in sync.

## How Apple Health behaves (architecture, not marketing)

Treat HealthKit as a **central, permissioned datastore**—not a **real-time sync engine** between apps.

1. **Apps write**  
   A logger (e.g. MacroFactor) records a meal internally, maps it to HealthKit types (**dietary energy**, **protein**, **carbs**, **fat**, etc.), and **writes samples**. Delivery may be **immediate** or **batched in the background** (common).

2. **The Health app stores**  
   Each sample has **timestamp**, **values**, and **source bundle / app**. Health **does not** reconcile meals or run your product logic—it **persists** and **enforces read/write authorization**.

3. **Other apps read**  
   A consumer app (e.g. Lose It) **queries** for nutrition (and energy) samples, often **since last fetch** or for a **date range**, when the app **opens** or on **periodic background refresh**. Updates are **not continuous**; expect **eventual consistency** and occasional **duplicate or lag** if multiple writers exist.

**Product implication:** UI that shows an Apple Health badge on imported days and **line-item source** is honest; “synced” means **last successful read**, not a live pipe from the other app. Multi-app ecosystems (MacroFactor → Health → our app) only line up **after** the writer has flushed samples and the reader has queried.

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
