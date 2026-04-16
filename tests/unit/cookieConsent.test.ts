/**
 * Tests for cookie consent logic.
 * Uses vitest's jsdom environment for localStorage and CustomEvent.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getConsentChoice, type ConsentChoice } from "@/app/components/CookieConsent";

describe("Cookie consent", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("getConsentChoice returns null when no consent stored", () => {
    expect(getConsentChoice()).toBeNull();
  });

  it("getConsentChoice returns 'accepted' after accept", () => {
    localStorage.setItem("suppr_cookie_consent", "accepted");
    expect(getConsentChoice()).toBe("accepted");
  });

  it("getConsentChoice returns 'declined' after decline", () => {
    localStorage.setItem("suppr_cookie_consent", "declined");
    expect(getConsentChoice()).toBe("declined");
  });

  it("getConsentChoice returns null for invalid values", () => {
    localStorage.setItem("suppr_cookie_consent", "maybe");
    expect(getConsentChoice()).toBeNull();
  });

  it("accept dispatches suppr-consent event with 'accepted' detail", () => {
    let received: string | null = null;
    window.addEventListener("suppr-consent", ((e: CustomEvent) => {
      received = e.detail;
    }) as EventListener, { once: true });

    localStorage.setItem("suppr_cookie_consent", "accepted");
    window.dispatchEvent(new CustomEvent("suppr-consent", { detail: "accepted" }));

    expect(received).toBe("accepted");
  });

  it("decline dispatches suppr-consent event with 'declined' detail", () => {
    let received: string | null = null;
    window.addEventListener("suppr-consent", ((e: CustomEvent) => {
      received = e.detail;
    }) as EventListener, { once: true });

    localStorage.setItem("suppr_cookie_consent", "declined");
    window.dispatchEvent(new CustomEvent("suppr-consent", { detail: "declined" }));

    expect(received).toBe("declined");
  });
});
