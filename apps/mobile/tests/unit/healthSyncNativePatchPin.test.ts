/**
 * G-1 (2026-04-19) — Apple Health native ObjC `@try`/`@catch` pin.
 *
 * ASC feedback ids:
 *   - `AGC7oEKypuMAb49WziGv468` (build 11, 2026-04-19 18:13Z): "Apple
 *     health issues persist".
 *   - `AIIUzBeKpng0jH4nNkXecBY` (build 11, 2026-04-19 18:13Z, crash):
 *     "Still crashing when I click connect apple health".
 *
 * Build 11 shipped F-1's JS defensive layer (`healthSyncCorrelation.ts`,
 * `healthSync.ts`, `app/health-sync.tsx`) — the crash persisted because
 * JavaScript `try/catch` cannot catch an Objective-C `NSException`
 * thrown on the bridge callback thread. G-1 is the promised native
 * follow-up: wrap `[corr metadata]` / `[corr objects]` enumeration in
 * `@try`/`@catch` inside the patch-package diff against
 * `react-native-health@1.19.0`.
 *
 * This pin reads the patch file as a string and asserts the native
 * guard is present in the exact region that crashes. If a future
 * `npm install` or a `patch-package` regeneration drops the hunks, or
 * if someone bumps the package version and forgets to re-port the
 * guard, this test fails loudly.
 *
 * Web parity: N/A — Apple Health is iOS-only. There is no equivalent
 * surface on web. Documented in `docs/testflight-feedback/resolved.md`
 * under the G-1 entry.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PATCH_PATH = resolve(
  __dirname,
  "../../patches/react-native-health+1.19.0.patch",
);

describe("G-1 structural pin — react-native-health patch guards HKCorrelation enumeration", () => {
  const patch = readFileSync(PATCH_PATH, "utf-8");

  it("patch file exists and targets react-native-health 1.19.0", () => {
    // Pin the version explicitly — a `react-native-health` bump would
    // rename this file and silently drop the guard otherwise.
    expect(patch.length).toBeGreaterThan(0);
    // The filename itself encodes the version; assert the patch body
    // still references the Dietary methods file we're patching.
    expect(patch).toContain(
      "node_modules/react-native-health/RCTAppleHealthKit/RCTAppleHealthKit+Methods_Dietary.m",
    );
  });

  it("declares the food-correlation method we're guarding", () => {
    // Defensive: if a future refactor renames this method, we want to
    // know before a silent regression ships.
    expect(patch).toContain(
      "- (void)dietary_getFoodCorrelationSamples:(NSDictionary *)input callback:(RCTResponseSenderBlock)callback",
    );
  });

  it("wraps the per-correlation body in @try with a matching @catch (NSException", () => {
    // `@try` + `@catch (NSException` is the Objective-C exception guard
    // that catches NSInvalidArgumentException / NSGenericException raised
    // by HealthKit when enumerating certain third-party correlations.
    expect(patch).toMatch(/@try\s*\{/);
    expect(patch).toMatch(/@catch\s*\(\s*NSException\s*\*/);
  });

  it("guards `[corr objects]` enumeration and nil-coalesces to an empty set", () => {
    // The crashing call path is `for (HKSample *child in [corr objects])`.
    // The fix replaces that with a nil-coalesced local so an exception
    // in the getter is caught by the surrounding @try, and a nil return
    // degrades to an empty set instead of an NSFastEnumeration crash.
    expect(patch).toMatch(/\[corr objects\]\s*\?\:\s*\[NSSet set\]/);
    // The old direct-enumeration form must be gone from the patched block.
    // (We allow the substring to appear inside a comment, but not as a
    // `for (...)` header line — hence the anchored regex.)
    expect(patch).not.toMatch(/for \(HKSample \*child in \[corr objects\]\)/);
  });

  it("guards `[corr metadata]` and nil-coalesces to an empty dictionary", () => {
    // Reading metadata on a correlation with a malformed metadata
    // dictionary can raise; the nil-coalesce keeps the row building
    // code safe even if the getter returns nil post-exception handling.
    expect(patch).toMatch(/\[corr metadata\]\s*\?\:\s*@\{\}/);
  });

  it("logs the native exception and `continue`s to the next correlation", () => {
    // The `continue` is load-bearing: we want to drop the offending
    // correlation and keep processing the rest of the batch, not bail
    // out of the whole sync. The log line gives us a searchable string
    // in device logs if it ever fires in the wild.
    expect(patch).toContain("[HealthKit] Skipping correlation due to native exception");
    // `continue` must appear inside the catch block — grep for it
    // near the catch clause.
    const catchIdx = patch.search(/@catch\s*\(\s*NSException\s*\*/);
    expect(catchIdx).toBeGreaterThan(-1);
    const catchBlock = patch.slice(catchIdx, catchIdx + 800);
    expect(catchBlock).toMatch(/\bcontinue;/);
  });

  it("references the JS-side legacy fallback so future readers find it", () => {
    // The comment pointing at `healthSyncCorrelation.ts` is how a
    // future engineer knows what happens to the dropped row. Keeps the
    // native and JS layers conceptually linked.
    expect(patch).toMatch(/effectiveMinute\|bundleId/);
    expect(patch).toContain("healthSyncCorrelation.ts");
  });
});

describe("G-7 structural pin — initHealthKit / isAvailable native @try wrap", () => {
  const patch = readFileSync(PATCH_PATH, "utf-8");

  it("pins requiresMainQueueSetup = YES (main queue for auth sheet)", () => {
    // iOS 26.5 + RN 0.76 bridgeless raises an uncaught ObjC exception
    // inside `performVoidMethodInvocation` when `initHealthKit` runs off
    // the main queue (HealthKit auth presents UIKit, which must be main).
    expect(patch).toMatch(/requiresMainQueueSetup/);
    expect(patch).toMatch(/^-\s+return NO;$/m);
    expect(patch).toMatch(/^\+\s+return YES;$/m);
  });

  it("wraps initHealthKit dispatch in @try/@catch", () => {
    // Turns any native throw from `requestAuthorizationToShareTypes:...`
    // into a callback error the JS layer can show as a recoverable Alert.
    expect(patch).toMatch(/initHealthKit native exception/);
  });

  it("wraps isAvailable dispatch in @try/@catch", () => {
    expect(patch).toMatch(/isAvailable native exception/);
  });

  it("references G-7 in the inline comment so future readers find the incident", () => {
    expect(patch).toContain("G-7");
  });
});
