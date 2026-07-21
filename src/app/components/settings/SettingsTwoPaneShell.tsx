"use client";

/**
 * SettingsTwoPaneShell — Sloe v3 web Settings "two-pane" layout (gap #24).
 *
 * A LAYOUT + ROUTER wrapper, not new settings. At `md+` it renders a
 * sticky LEFT sub-nav column (the section groups, active one highlighted)
 * + a RIGHT panel that swaps to the selected section's EXISTING card
 * content. Below `md` (mobile-web) it falls back to a sensible single
 * column — every section stacked with its serif heading — so mobile-web is
 * never a broken half-pane.
 *
 * Prototype source: `docs/ux/redesign/v3/Sloe-App.html` → `WebSettings`
 * (`.w-set-grid` 230px + 1fr, sticky `.w-set-nav`, `.w-sni` nav items,
 * serif `.w-set-panel h1`, muted `.w-sub-lead`). The active nav item uses
 * the established plum-on-tint grammar (`bg-primary/10 text-primary-solid`) the
 * Settings header + Pro pill already use — the prototype's `accent-frost
 * -mist` token has no web equivalent, so we match intent with the live
 * token, not a literal.
 *
 * The shell owns NO settings state — it is pure presentation. The selected
 * section id is local-only (no persistence): a fresh open lands on the
 * first section. Each section's `content` is the EXISTING `<SupprCard>`
 * JSX the single-pane path renders, passed in unchanged by `Settings.tsx`
 * so web↔mobile content parity is unaffected (this is a web-only re-layout
 * behind `sloe_v3_settings`).
 *
 * Gated by `sloe_v3_settings` at the `Settings.tsx` callsite — default-ON
 * (`REDESIGN_DEFAULT_ON` in `track.ts`) since 2026-06-29; the OFF path (kill
 * switch only, not the shipped default) keeps the legacy single-scroll stack
 * alive.
 */

import { useState, type ReactNode } from "react";
import { Icons } from "../ui/icons";
import { SettingsPageChrome } from "./SettingsPageChrome";

export interface SettingsPaneSection {
  /** Stable id — used as the React key + active-state token. */
  id: string;
  /** Nav label + the serif panel heading. */
  label: string;
  /** One-line muted lead under the panel heading. */
  lead: string;
  /** Icon key from the shared `Icons` set (left of the nav label). */
  icon: keyof typeof Icons;
  /** The EXISTING section content (the `<SupprCard>` JSX), rendered as-is. */
  content: ReactNode;
}

export interface SettingsTwoPaneShellProps {
  /** Top-of-page content shown ABOVE the two-pane grid on every section —
   *  the profile header card + Sloe Pro banner, which read as the page
   *  identity, not a tab. Optional. */
  header?: ReactNode;
  /** Mobile-web pushed-screen back action; hidden at the desktop breakpoint. */
  onBack?: () => void;
  /** Section groups, in nav order. The first is selected on open. */
  sections: SettingsPaneSection[];
}

export function SettingsTwoPaneShell({ header, onBack, sections }: SettingsTwoPaneShellProps) {
  // Defensive: an empty section list renders nothing but the header rather
  // than crashing on `sections[0]`.
  const [activeId, setActiveId] = useState<string>(() => sections[0]?.id ?? "");
  const active = sections.find((s) => s.id === activeId) ?? sections[0] ?? null;

  return (
    <div className="product-shell py-8" data-testid="settings-two-pane">
      {/* Page header — serif title + the always-on identity content. */}
      <div className="mb-8">
        <SettingsPageChrome legacyRadius="xl" onBack={onBack} />
      </div>

      {header ? <div className="mb-8">{header}</div> : null}

      {/* Two-pane grid at md+; single column below. The nav column is a
          fixed 240px (8-scale) track; the panel takes the rest. */}
      <div className="md:grid md:grid-cols-[240px_1fr] md:gap-8 md:items-start">
        {/* LEFT sub-nav — sticky at md+, hidden below md (mobile-web uses
            the stacked single-column fallback, so a duplicate nav would be
            dead weight). */}
        <nav
          aria-label="Settings sections"
          className="hidden md:block md:sticky md:top-8 space-y-1"
          data-testid="settings-pane-nav"
        >
          {sections.map((section) => {
            const Icon = Icons[section.icon];
            const isActive = section.id === active?.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveId(section.id)}
                aria-current={isActive ? "page" : undefined}
                data-testid={`settings-pane-nav-${section.id}`}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                  isActive
                    ? "bg-primary/10 text-primary-solid font-semibold"
                    : "text-foreground-tertiary hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon
                  className="w-[18px] h-[18px] shrink-0"
                  style={isActive ? { color: "var(--primary)" } : undefined}
                  aria-hidden
                />
                {section.label}
              </button>
            );
          })}
        </nav>

        {/* RIGHT panel — at md+ shows only the active section; below md the
            CSS reveals every section (the single-column fallback). */}
        <div className="min-w-0">
          {sections.map((section) => {
            const isActive = section.id === active?.id;
            return (
              <section
                key={section.id}
                aria-label={section.label}
                data-testid={`settings-pane-panel-${section.id}`}
                // md+: hide non-active panels. Below md: always shown so the
                // page reads as a single stacked scroll.
                className={isActive ? "block" : "block md:hidden"}
              >
                {/* Serif panel heading + muted lead — the prototype's
                    `.w-set-panel h1` + `.w-sub-lead`. The heading repeats per
                    section on mobile-web so each stacked group is labelled. */}
                <div className="mb-5 mt-2 md:mt-0">
                  <h2 className="font-[family-name:var(--font-headline)] text-2xl font-medium text-foreground-brand leading-tight">
                    {section.label}
                  </h2>
                  <p className="mt-1 text-sm text-foreground-tertiary">{section.lead}</p>
                </div>
                {section.content}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default SettingsTwoPaneShell;
