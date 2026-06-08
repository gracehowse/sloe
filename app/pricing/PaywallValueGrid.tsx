import { Link2, SlidersHorizontal, Sparkles, Cloud, type LucideIcon } from "lucide-react";
import {
  PAYWALL_VALUE_PROPS,
  type PaywallValueProp,
} from "../../src/lib/landing/content.ts";

/**
 * 2×2 value-prop grid for `/pricing` — Sloe Pro paywall (Figma `284:2`).
 *
 * Four condensed Pro benefits in cream rounded cards (icon + title +
 * one-line description). Copy + order come from the shared
 * `PAYWALL_VALUE_PROPS` SSOT so web and the mobile paywall can't drift.
 *
 * Each row maps 1:1 to an existing gate (recipe import, macro-fitting
 * plan, AI logging, cloud sync) — this is a presentational restyle of
 * the Pro pitch, not a new claim. See `paywallValueProps.ts`.
 *
 * Icons render in the clay accent (the frame's outline glyphs).
 */
const ICONS: Record<PaywallValueProp["icon"], LucideIcon> = {
  Link2,
  SlidersHorizontal,
  Sparkles,
  Cloud,
};

export function PaywallValueGrid() {
  return (
    <div
      data-testid="paywall-value-grid"
      className="grid grid-cols-2 gap-3 sm:gap-4 max-w-3xl mx-auto mb-10"
    >
      {PAYWALL_VALUE_PROPS.map((prop) => {
        const Icon = ICONS[prop.icon];
        return (
          <div
            key={prop.key}
            data-testid={`paywall-value-${prop.key}`}
            className="rounded-2xl border border-border p-4 sm:p-5"
            style={{ background: "var(--background-secondary)" }}
          >
            <Icon
              className="h-5 w-5 mb-3"
              style={{ color: "var(--accent-primary-solid)" }}
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <h3 className="text-sm font-semibold text-foreground mb-1">
              {prop.title}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {prop.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}
