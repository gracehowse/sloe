/**
 * Client-side Web Push helper — pure-function coverage.
 *
 * The `subscribeToWebPush` flow is end-to-end browser-dependent
 * (PushManager + service worker + Supabase upsert) and is covered by
 * E2E / manual tests. This file asserts the pure-helper invariants
 * the flow depends on:
 *   - permission readouts when APIs are absent
 *   - VAPID key base64url decoding
 *   - support detection
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  getWebNotificationPermission,
  isWebNotificationSupported,
  isWebPushSupported,
  urlBase64ToUint8Array,
} from "@/lib/push/webNotifications";

describe("getWebNotificationPermission", () => {
  const originalNotification = globalThis.Notification;

  afterEach(() => {
    if (originalNotification) {
      (globalThis as unknown as { Notification: unknown }).Notification =
        originalNotification;
    }
  });

  it("returns 'unsupported' when Notification API is missing", () => {
    (globalThis as unknown as { Notification: unknown }).Notification =
      undefined;
    expect(getWebNotificationPermission()).toBe("unsupported");
  });

  it("mirrors Notification.permission when API is present", () => {
    (globalThis as unknown as { Notification: { permission: string } }).Notification =
      { permission: "default" } as unknown as typeof Notification;
    expect(getWebNotificationPermission()).toBe("default");
    (globalThis as unknown as { Notification: { permission: string } }).Notification =
      { permission: "granted" } as unknown as typeof Notification;
    expect(getWebNotificationPermission()).toBe("granted");
  });
});

describe("isWebNotificationSupported + isWebPushSupported", () => {
  it("returns false when Notification is missing", () => {
    const original = globalThis.Notification;
    (globalThis as unknown as { Notification: unknown }).Notification =
      undefined;
    expect(isWebNotificationSupported()).toBe(false);
    expect(isWebPushSupported()).toBe(false);
    if (original) {
      (globalThis as unknown as { Notification: unknown }).Notification =
        original;
    }
  });
});

describe("urlBase64ToUint8Array", () => {
  it("decodes a VAPID-shaped base64url key (65 bytes, P-256 uncompressed point)", () => {
    // Example VAPID public key generated via `web-push`. 87 chars
    // base64url → 65 bytes decoded.
    const key =
      "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
    const arr = urlBase64ToUint8Array(key);
    expect(arr.byteLength).toBe(65);
    // P-256 uncompressed point marker is always 0x04.
    expect(arr[0]).toBe(0x04);
  });

  it("handles padding correctly (trailing '=' added internally)", () => {
    // 4-char string → needs no padding after urlBase64 → base64
    // conversion; confirm decoder still returns 3 bytes.
    const arr = urlBase64ToUint8Array("aGVs"); // "hel" in base64
    expect(arr.byteLength).toBe(3);
    expect(String.fromCharCode(...arr)).toBe("hel");
  });
});
