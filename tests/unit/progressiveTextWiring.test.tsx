/**
 * ENG-720 — ProgressiveText gating wiring (web).
 *
 * Pins the two gates that make the staggered onboarding text reveal safe to
 * ship behind a default-OFF flag:
 *
 *   1. Flag OFF  (`animate={false}`)              → instant text, no animation.
 *   2. Reduce motion ON (even with `animate`)     → instant text, no animation.
 *   3. Flag ON + motion allowed                   → per-token animated spans,
 *                                                    full phrase still readable.
 *
 * "Instant" means: one plain text node, no per-token `<span>` wrappers and no
 * injected keyframe `<style>` — i.e. pixel-identical to the pre-ENG-720
 * surface. The mobile twin lives at
 * `apps/mobile/tests/unit/progressiveTextWiring.test.tsx`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { ProgressiveText } from "../../src/app/components/onboarding/progressive-text";

const reduceMotionMatch = vi.fn(() => false);

beforeEach(() => {
  reduceMotionMatch.mockReturnValue(false);
  // ProgressiveText reads matchMedia once on mount (useState initialiser), so
  // it must be stubbed before render. Toggle reduceMotionMatch per test.
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("reduced-motion") ? reduceMotionMatch() : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const PHRASE = "Cook what you love. Still reach your goals.";

// Token spans carry `data-progressive-token` so we can count them without
// coupling the assertion to the `as` tag (which may itself be a <span>).
const tokenSpans = (container: HTMLElement) =>
  container.querySelectorAll("[data-progressive-token]");

describe("ProgressiveText gating (web, ENG-720)", () => {
  it("flag OFF (default) → instant: full text, no token spans, no keyframe style", () => {
    const { container } = render(<ProgressiveText>{PHRASE}</ProgressiveText>);
    expect(container.textContent).toBe(PHRASE);
    // No per-token reveal spans and no injected keyframe block in the off path.
    expect(tokenSpans(container).length).toBe(0);
    expect(container.querySelector("style")).toBeNull();
  });

  it("flag OFF explicitly → instant fallback", () => {
    const { container } = render(
      <ProgressiveText animate={false}>{PHRASE}</ProgressiveText>,
    );
    expect(container.textContent).toBe(PHRASE);
    expect(tokenSpans(container).length).toBe(0);
  });

  it("reduce-motion ON beats flag ON → instant fallback (no animation)", () => {
    reduceMotionMatch.mockReturnValue(true);
    const { container } = render(
      <ProgressiveText animate>{PHRASE}</ProgressiveText>,
    );
    expect(container.textContent).toBe(PHRASE);
    expect(tokenSpans(container).length).toBe(0);
    expect(container.querySelector("style")).toBeNull();
  });

  it("flag ON + motion allowed → one animated span per token, full phrase intact", () => {
    const { container } = render(
      <ProgressiveText animate>{PHRASE}</ProgressiveText>,
    );
    // 8 words → 8 tokens → 8 token spans.
    const spans = tokenSpans(container);
    expect(spans.length).toBe(8);
    // Each token span carries the staggered reveal animation.
    spans.forEach((span) => {
      expect((span as HTMLElement).style.animationName).toBe(
        "suppr-progressive-text-token",
      );
    });
    // The keyframe is injected, and the full phrase still reads end-to-end
    // (spans re-join to the exact source string).
    expect(container.querySelector("style")).not.toBeNull();
    const joined = Array.from(spans)
      .map((s) => s.textContent)
      .join("");
    expect(joined).toBe(PHRASE);
  });

  it("renders the chosen tag in the instant path (e.g. h1 for the heading)", () => {
    const { container } = render(
      <ProgressiveText as="h1">Your plan is ready.</ProgressiveText>,
    );
    expect(container.querySelector("h1")?.textContent).toBe(
      "Your plan is ready.",
    );
  });

  it("exposes the full phrase via aria-label when animating (a11y)", () => {
    const { container } = render(
      <ProgressiveText animate>{PHRASE}</ProgressiveText>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("aria-label")).toBe(PHRASE);
  });

  it("forwards an explicit aria-label in BOTH paths (cased wordmark label survives)", () => {
    // Instant path (flag OFF): the lowercase "sloe" is still announced "Sloe".
    const off = render(
      <ProgressiveText as="h1" aria-label="Sloe">
        sloe
      </ProgressiveText>,
    );
    expect(
      (off.container.firstElementChild as HTMLElement).getAttribute(
        "aria-label",
      ),
    ).toBe("Sloe");

    // Animating path: explicit label wins over the visible-text fallback.
    const on = render(
      <ProgressiveText as="h1" animate aria-label="Sloe">
        sloe
      </ProgressiveText>,
    );
    expect(
      (on.container.firstElementChild as HTMLElement).getAttribute("aria-label"),
    ).toBe("Sloe");
  });
});
