import { describe, expect, it } from "vitest";
import { isValidWebPushEndpoint } from "../../src/lib/push/webPushEndpointGuard";

describe("isValidWebPushEndpoint (ENG-1153)", () => {
  it("accepts known Mozilla push endpoints", () => {
    expect(
      isValidWebPushEndpoint(
        "https://updates.push.services.mozilla.com/wpush/v2/gAAAAABk",
      ),
    ).toBe(true);
  });

  it("accepts FCM endpoints", () => {
    expect(
      isValidWebPushEndpoint(
        "https://fcm.googleapis.com/fcm/send/df8sK9x-example",
      ),
    ).toBe(true);
  });

  it("rejects non-HTTPS endpoints", () => {
    expect(isValidWebPushEndpoint("http://updates.push.services.mozilla.com/x")).toBe(
      false,
    );
  });

  it("rejects arbitrary attacker-controlled hosts", () => {
    expect(isValidWebPushEndpoint("https://evil.example/delete-all")).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(isValidWebPushEndpoint("")).toBe(false);
  });
});
