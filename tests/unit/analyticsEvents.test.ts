import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { AnalyticsEvents, type PaywallViewedFrom } from "../../src/lib/analytics/events";

/**
 * Guards that every analytics event name the product relies on stays
 * registered in `AnalyticsEvents` with the exact PostHog string that
 * dashboards / funnels look for. A rename here would silently break
 * reporting, so these tests pin the stable string values.
 *
 * Added 2026-04-18 alongside the H5 audit fix that instrumented
 * `week_start_day_changed` and `fit_this_in_previewed` on both
 * platforms.
 */

describe("AnalyticsEvents registry", () => {
  it("registers recipe create bulk-paste and photo-extract funnel events", () => {
    expect(AnalyticsEvents.recipe_create_paste_list_matched).toBe("recipe_create_paste_list_matched");
    expect(AnalyticsEvents.recipe_create_photo_extracted).toBe("recipe_create_photo_extracted");
  });

  it("registers recipe_verify_needs_review for low-confidence verify nudges", () => {
    expect(AnalyticsEvents.recipe_verify_needs_review).toBe("recipe_verify_needs_review");
  });

  it("registers vendor_search_degraded with the canonical value (ENG-1412)", () => {
    expect(AnalyticsEvents.vendor_search_degraded).toBe("vendor_search_degraded");
  });

  it("registers week_start_day_changed with the canonical value", () => {
    expect(AnalyticsEvents.week_start_day_changed).toBe("week_start_day_changed");
  });

  it("registers onboarding_app_choice (ENG-990 competitor-switch capture)", () => {
    // ENG-990 — the "Coming from another app?" step emits this on both
    // platforms with an identical payload. A rename would break the
    // MFP-refugee capture funnel (chosen-app → activation).
    expect(AnalyticsEvents.onboarding_app_choice).toBe("onboarding_app_choice");
  });

  it("registers onboarding_why_now (ENG-963 intent capture)", () => {
    // ENG-963 — the optional "What's bringing you here?" step emits this on
    // both platforms with an identical payload. A rename would break the
    // intent → activation funnel slice.
    expect(AnalyticsEvents.onboarding_why_now).toBe("onboarding_why_now");
  });

  it("registers the MFP CSV import funnel events (ENG-1234 preview→commit)", () => {
    // The two-phase MFP-refugee import funnel: started → previewed →
    // completed (or failed). A rename to any of these breaks the
    // parse-success and confirm-through rates the import wedge depends on.
    expect(AnalyticsEvents.mfp_csv_import_started).toBe("mfp_csv_import_started");
    expect(AnalyticsEvents.mfp_csv_import_previewed).toBe(
      "mfp_csv_import_previewed",
    );
    expect(AnalyticsEvents.mfp_csv_import_completed).toBe(
      "mfp_csv_import_completed",
    );
    expect(AnalyticsEvents.mfp_csv_import_failed).toBe("mfp_csv_import_failed");
  });

  it("registers fit_this_in_previewed with the canonical value", () => {
    expect(AnalyticsEvents.fit_this_in_previewed).toBe("fit_this_in_previewed");
  });

  it("registers the ENG-1288 Coach analytics cluster (client + server)", () => {
    // Wired 2026-07-01 (ENG-1288): `meal_coach_suggestion_shown` gained
    // its first real emit sites (both Coach screens, source-attributed
    // after the AI re-rank settles) and `coach_ask_answered` completes
    // the ask funnel that `coach_ask_chip_tapped` opens. The
    // `*_api_completed` trio is the server-side latency / source / tier
    // read on the three coach routes (voice_log_api_completed pattern).
    // A rename to any of these breaks the coach AI hit-rate and spend
    // dashboards.
    expect(AnalyticsEvents.meal_coach_suggestion_shown).toBe(
      "meal_coach_suggestion_shown",
    );
    expect(AnalyticsEvents.coach_ask_answered).toBe("coach_ask_answered");
    expect(AnalyticsEvents.coach_api_completed).toBe("coach_api_completed");
    expect(AnalyticsEvents.coach_ask_api_completed).toBe(
      "coach_ask_api_completed",
    );
    expect(AnalyticsEvents.coach_day_narrative_api_completed).toBe(
      "coach_day_narrative_api_completed",
    );
  });

  it("registers weekly_recap_push_enabled_toggled with the canonical value", () => {
    // Added 2026-04-18 (H6 audit fix): surfaces the Settings toggle for
    // the weekly recap push so the opt-out rate can be tracked directly.
    expect(AnalyticsEvents.weekly_recap_push_enabled_toggled).toBe(
      "weekly_recap_push_enabled_toggled",
    );
  });

  it("registers streak_freeze_earned_seen with the canonical value", () => {
    // Added 2026-04-18 (H7 audit fix): fires on dismiss of the one-time
    // "You earned a freeze" row under the Today streak insight card.
    // Paired with `streak_freeze_earned` so product can measure whether
    // the earn moment is actually seen, not just fired in analytics.
    expect(AnalyticsEvents.streak_freeze_earned_seen).toBe(
      "streak_freeze_earned_seen",
    );
  });

  it("registers the three M2 in-flow AI paywall events with canonical snake_case values", () => {
    // Ship M2 (2026-04-18): web `AiPaywallDialog` and mobile
    // `AiPaywallSheet` both fire these three events with identical
    // payload shapes. Registry must not rename them — PostHog funnels
    // measuring the in-flow gate vs the full `/paywall` route depend
    // on these exact strings.
    expect(AnalyticsEvents.ai_paywall_sheet_viewed).toBe(
      "ai_paywall_sheet_viewed",
    );
    expect(AnalyticsEvents.ai_paywall_sheet_dismissed).toBe(
      "ai_paywall_sheet_dismissed",
    );
    expect(AnalyticsEvents.ai_paywall_sheet_cta_tapped).toBe(
      "ai_paywall_sheet_cta_tapped",
    );
  });

  it("registers the Ship M1 usual-meal events (hint + pill)", () => {
    // Added 2026-04-18 (Ship M1): first-run usual-meal hint + slot-header
    // log pill. A rename would silently break recap / growth-loop
    // dashboards — pin the canonical PostHog string values.
    expect(AnalyticsEvents.usual_meal_hint_shown).toBe("usual_meal_hint_shown");
    expect(AnalyticsEvents.usual_meal_hint_accepted).toBe(
      "usual_meal_hint_accepted",
    );
    expect(AnalyticsEvents.usual_meal_hint_dismissed).toBe(
      "usual_meal_hint_dismissed",
    );
    expect(AnalyticsEvents.usual_meal_log_tapped).toBe("usual_meal_log_tapped");
  });

  it("keeps the pre-M2 feature-specific funnel-entry events registered alongside the new sheet events", () => {
    // Ship M2 guard: the sheet events are ADDITIVE. The caller still
    // fires `voice_log_paywalled` / `ai_photo_log_paywalled` as the
    // per-feature funnel-entry signal. A refactor that removes either
    // of those in favour of only `ai_paywall_sheet_viewed` would break
    // the pre-M2 dashboards — re-register here so the regression is
    // loud.
    expect(AnalyticsEvents.voice_log_paywalled).toBe("voice_log_paywalled");
    expect(AnalyticsEvents.ai_photo_log_paywalled).toBe(
      "ai_photo_log_paywalled",
    );
  });

  it("keeps previously-shipped events registered (regression guard)", () => {
    // A sample of load-bearing events from earlier batches. If any of
    // these vanish, PostHog dashboards shipped in 2.5–5.13 stop
    // reporting, so the registry must not drop them.
    expect(AnalyticsEvents.food_logged).toBe("food_logged");
    expect(AnalyticsEvents.meal_copied).toBe("meal_copied");
    expect(AnalyticsEvents.day_duplicated).toBe("day_duplicated");
    expect(AnalyticsEvents.hydration_logged).toBe("hydration_logged");
    expect(AnalyticsEvents.saved_meal_logged).toBe("saved_meal_logged");
    expect(AnalyticsEvents.custom_food_logged).toBe("custom_food_logged");
    expect(AnalyticsEvents.meal_moved_in_plan).toBe("meal_moved_in_plan");
    expect(AnalyticsEvents.voice_log_committed).toBe("voice_log_committed");
    expect(AnalyticsEvents.ai_photo_log_committed).toBe("ai_photo_log_committed");
  });

  it("registers the D12 dynamic-upsell events with canonical snake_case values", () => {
    // D12 (2026-04-21): three new events fire from the web
    // `UpgradePaywallDialog` alongside the existing paywall_viewed /
    // paywall_dismissed / checkout_started trio. Dashboards use these
    // exact strings — a rename here would silently break the
    // variant-sliced funnel.
    expect(AnalyticsEvents.upsell_variant_shown).toBe("upsell_variant_shown");
    expect(AnalyticsEvents.upsell_variant_converted).toBe(
      "upsell_variant_converted",
    );
    expect(AnalyticsEvents.upsell_variant_dismissed).toBe(
      "upsell_variant_dismissed",
    );
  });

  it("uses snake_case, lowercase values everywhere (naming-style gate)", () => {
    for (const [key, value] of Object.entries(AnalyticsEvents)) {
      expect(value).toBe(key);
      expect(value).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});

describe("ENG-1642 — meal share link events", () => {
  it("registers the four new meal-share-link events with canonical snake_case values", () => {
    // The durable half of F-154's per-meal share: a real link (create →
    // open → accept) plus the signed-out resume-rail signup start. A
    // rename to any of these breaks the ENG-1642 funnel dashboards.
    expect(AnalyticsEvents.meal_share_link_created).toBe("meal_share_link_created");
    expect(AnalyticsEvents.meal_share_link_opened).toBe("meal_share_link_opened");
    expect(AnalyticsEvents.shared_meal_logged).toBe("shared_meal_logged");
    expect(AnalyticsEvents.shared_meal_signup_started).toBe(
      "shared_meal_signup_started",
    );
  });

  it("keeps meal_share_invoked registered alongside the new link events (mode prop extension)", () => {
    // meal_share_invoked predates ENG-1642 (F-154) and gained an optional
    // `mode: "link" | "text"` prop rather than being replaced — both must
    // stay registered.
    expect(AnalyticsEvents.meal_share_invoked).toBe("meal_share_invoked");
  });
});

/**
 * Post-ship #1 (2026-04-18) — event-name rename cycle.
 *
 * ENG-711 (2026-05-27): retired 6 legacy event names and cleaned all
 * dual-emit call sites. Active dual-emits remaining:
 *   - `streak_freeze_earned_seen` → `streak_freeze_earned_acknowledged`
 *   - `weekly_recap_push_sent` → `weekly_recap_push_scheduled` + `_delivered`
 *
 * Source: `docs/planning/analytics-dashboards-plan-2026-04-18.md` §4.
 */
describe("rename-cycle (post-ship #1 — partial retire 2026-05-27)", () => {
  it("registers streak_freeze_earned_seen alongside streak_freeze_earned_acknowledged", () => {
    expect(AnalyticsEvents.streak_freeze_earned_seen).toBe(
      "streak_freeze_earned_seen",
    );
    expect(AnalyticsEvents.streak_freeze_earned_acknowledged).toBe(
      "streak_freeze_earned_acknowledged",
    );
  });

  it("registers weekly_recap_push_sent split into _scheduled + _delivered", () => {
    expect(AnalyticsEvents.weekly_recap_push_sent).toBe(
      "weekly_recap_push_sent",
    );
    expect(AnalyticsEvents.weekly_recap_push_scheduled).toBe(
      "weekly_recap_push_scheduled",
    );
    expect(AnalyticsEvents.weekly_recap_push_delivered).toBe(
      "weekly_recap_push_delivered",
    );
  });

  it("has no collisions between any registry names", () => {
    const values = Object.values(AnalyticsEvents);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});

/**
 * `paywall_viewed` contract (2026-04-19 round-2, analytics-engineer spec).
 *
 * Every call site must carry `{ from, tier, surface, platform }`. `from`
 * is drawn from the canonical `PaywallViewedFrom` union. The canonical
 * set gains `"meal_planner"` this round so the Base-gated planner
 * upgrade path can be sliced separately in F2.
 *
 * These tests are intentionally source-grep / enum-membership level —
 * the three live emit sites (`app/pricing/page.tsx`,
 * `apps/mobile/app/paywall.tsx`, `src/app/App.tsx`) are guarded by the
 * grep assertion at the bottom so any new emit site (or any drift on
 * an existing one) surfaces at CI time rather than in PostHog weeks
 * later when a dashboard goes empty.
 */
describe("paywall_viewed contract (L6 G9 + 2026-04-19 round-2)", () => {
  const CANONICAL_FROM_VALUES: readonly PaywallViewedFrom[] = [
    "voice_log",
    "photo_log",
    "settings",
    "onboarding",
    "trial_end",
    "deep_link",
    "meal_planner",
    // Round-3 additions (2026-04-19, analytics-engineer spec): one
    // value per distinct `openUpgradePromo` call site under
    // `src/app/App.tsx` so F2 can slice which in-app surface drove the
    // upgrade intent. The matching `normalisePaywallFrom` branches on
    // both platforms, and the `paywallAttribution` parity test, keep
    // these pinned in place.
    "recipes_library",
    "shopping_list",
    "profile",
    "recipe_create",
    "recipe_import",
  ] as const;

  it("PaywallViewedFrom contains exactly the canonical set", () => {
    // We enumerate every branch in the shared `normalisePaywallFrom`
    // helpers to prove the two platforms stay in sync with the type
    // and with each other. Every value below must round-trip through
    // both helpers; any missing case would be caught by the
    // source-grep below.
    const pricingSrc = readFileSync(
      join(process.cwd(), "app/pricing/page.tsx"),
      "utf8",
    );
    const mobilePaywallSrc = readFileSync(
      join(process.cwd(), "apps/mobile/app/paywall.tsx"),
      "utf8",
    );
    for (const v of CANONICAL_FROM_VALUES) {
      expect(pricingSrc).toContain(`case "${v}":`);
      expect(mobilePaywallSrc).toContain(`case "${v}":`);
    }
    // And there is no extra `case "…":` inside the `normalisePaywallFrom`
    // helper on either platform. We scope the match to the helper body
    // by finding the function and slicing to the trailing `return s;`.
    function casesInHelper(src: string): string[] {
      const start = src.indexOf("function normalisePaywallFrom");
      expect(start).toBeGreaterThan(-1);
      const body = src.slice(start, src.indexOf("default:", start));
      return [...body.matchAll(/case\s+"([^"]+)":/g)].map((m) => m[1]);
    }
    expect(new Set(casesInHelper(pricingSrc))).toEqual(
      new Set(CANONICAL_FROM_VALUES),
    );
    expect(new Set(casesInHelper(mobilePaywallSrc))).toEqual(
      new Set(CANONICAL_FROM_VALUES),
    );
  });

  it('normalisePaywallFrom("meal_planner") returns "meal_planner" on both platforms', () => {
    // Behavioural check via the single-branch semantics of a pure
    // switch statement: if the source contains `case "meal_planner":`
    // inside the shared helper AND the helper's default arm returns
    // `"deep_link"`, then the function returns `"meal_planner"` for
    // input `"meal_planner"`. We assert both halves here.
    const pricingSrc = readFileSync(
      join(process.cwd(), "app/pricing/page.tsx"),
      "utf8",
    );
    const mobilePaywallSrc = readFileSync(
      join(process.cwd(), "apps/mobile/app/paywall.tsx"),
      "utf8",
    );
    expect(pricingSrc).toMatch(/case "meal_planner":\s*\n\s*return s;/);
    expect(mobilePaywallSrc).toMatch(/case "meal_planner":\s*\n\s*return s;/);
    expect(pricingSrc).toMatch(/default:\s*\n\s*return "deep_link";/);
    expect(mobilePaywallSrc).toMatch(/default:\s*\n\s*return "deep_link";/);
  });

  /**
   * Mobile source-grep: every `router.push("/paywall` and
   * `router.replace("/paywall` call under `apps/mobile/app/**` must
   * include `?from=` in the URL string so the paywall's `useLocalSearchParams`
   * read yields a non-empty value the canonical `normalisePaywallFrom`
   * helper can attribute. A bare `/paywall` push would silently
   * degrade to `from: "deep_link"` and the funnel F2 slice would
   * attribute the conversion to the wrong surface.
   */
  it('every mobile router.push/replace("/paywall...") call includes "?from="', () => {
    const mobileAppDir = resolve(process.cwd(), "apps/mobile/app");
    const offenders: string[] = [];
    function walk(dir: string): void {
      for (const entry of readdirSync(dir)) {
        if (entry === "node_modules" || entry.startsWith(".")) continue;
        const full = join(dir, entry);
        let s;
        try {
          s = statSync(full);
        } catch {
          continue;
        }
        if (s.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(tsx?|jsx?)$/.test(entry)) continue;
        const src = readFileSync(full, "utf8");
        // Match both `router.push("/paywall…")` and
        // `router.replace("/paywall…")` regardless of type-assertion
        // tail (`as any` etc.).
        const matches = src.matchAll(
          /router\.(?:push|replace)\(\s*(["'`])(\/paywall[^"'`]*)\1/g,
        );
        for (const m of matches) {
          const url = m[2];
          if (!url.includes("?from=")) {
            offenders.push(`${full}: ${url}`);
          }
        }
      }
    }
    walk(mobileAppDir);
    expect(offenders).toEqual([]);
  });

  /**
   * Codebase source-grep: every `track(AnalyticsEvents.paywall_viewed, …)`
   * emit site AND every `<PageViewTracker event={AnalyticsEvents.paywall_viewed} />`
   * emit site must pass all four required keys
   * (`from`, `tier`, `surface`, `platform`) in its argument /
   * `properties` object. Drift on any of these four would collapse
   * the F2 funnel's slice.
   */
  it("every paywall_viewed emit carries { from, tier, surface, platform }", { timeout: 15_000 }, () => {
    const ROOTS = [
      resolve(process.cwd(), "src"),
      resolve(process.cwd(), "app"),
      resolve(process.cwd(), "apps/mobile"),
    ];
    const REQUIRED_KEYS = ["from", "tier", "surface", "platform"] as const;

    const offenders: string[] = [];

    function walk(dir: string): string[] {
      const out: string[] = [];
      for (const entry of readdirSync(dir)) {
        if (
          entry === "node_modules" ||
          entry === ".next" ||
          entry === "dist" ||
          entry === "build" ||
          entry.startsWith(".")
        ) {
          continue;
        }
        const full = join(dir, entry);
        let s;
        try {
          s = statSync(full);
        } catch {
          continue;
        }
        if (s.isDirectory()) {
          out.push(...walk(full));
          continue;
        }
        if (!/\.(tsx?|jsx?)$/.test(entry)) continue;
        out.push(full);
      }
      return out;
    }

    const files = ROOTS.flatMap((r) => {
      try {
        return walk(r);
      } catch {
        return [];
      }
    });

    for (const file of files) {
      const src = readFileSync(file, "utf8");

      // Pattern 1: `track(AnalyticsEvents.paywall_viewed, { … })`
      const trackMatches = src.matchAll(
        /track\(\s*AnalyticsEvents\.paywall_viewed\s*,\s*\{([\s\S]*?)\}\s*\)/g,
      );
      for (const m of trackMatches) {
        const body = m[1];
        const missing = REQUIRED_KEYS.filter(
          (k) => !new RegExp(`\\b${k}\\s*:`).test(body),
        );
        if (missing.length > 0) {
          offenders.push(
            `${file}: track(paywall_viewed) missing ${missing.join(", ")}`,
          );
        }
      }

      // Pattern 2: `<PageViewTracker event={AnalyticsEvents.paywall_viewed}
      //              properties={{ … }} />` (multi-line).
      const pvtMatches = src.matchAll(
        /<PageViewTracker\b[\s\S]*?event=\{AnalyticsEvents\.paywall_viewed\}[\s\S]*?properties=\{\{([\s\S]*?)\}\}[\s\S]*?\/>/g,
      );
      for (const m of pvtMatches) {
        const body = m[1];
        const missing = REQUIRED_KEYS.filter(
          (k) => !new RegExp(`\\b${k}\\s*:`).test(body),
        );
        if (missing.length > 0) {
          offenders.push(
            `${file}: <PageViewTracker paywall_viewed> missing ${missing.join(", ")}`,
          );
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
