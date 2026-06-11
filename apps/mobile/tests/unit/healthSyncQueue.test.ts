/**
 * Global HealthKit call mutex (ENG-1019, 2026-06-10).
 *
 * Context — live device evidence (Grace's iPhone 17 Pro, iOS 26.6,
 * 2026-06-10): `[health-sync] syncHealthData timed out (18000ms)` streamed
 * from the device — the native `react-native-health` callback never fired and
 * the JS timeout reported failure. The app also crashed around this flow; the
 * in-code observation (`app/health-sync.tsx`) was that "native bridge crashes
 * have been observed when probe + initHealthKit overlap (iOS 26+)". The screen
 * guarded its own probe-vs-connect/sync race, but fire-and-forget call sites
 * (Today steps/active-energy reads, per-meal `saveFood` exports, the focus
 * nutrition import) could still overlap.
 *
 * The fix: route EVERY native bridge invocation through one promise-chain
 * queue (`enqueueHk`) so only one HealthKit call is in flight app-wide. These
 * tests pin the three guarantees the queue must hold:
 *   1. Serialization — enqueued calls run one at a time, in order.
 *   2. Hang-proof — a call that times out (settles late, or rejects) releases
 *      the chain so the next call still runs; the queue never deadlocks.
 *   3. Poison-resistant — a rejected call doesn't break the chain for the next
 *      caller (the rejection still surfaces to ITS own awaiter).
 *
 * These exercise the real production `enqueueHk` via the test-only
 * `_hkQueueTestHooks` handle (not a reimplementation), so a regression in the
 * queue logic fails here.
 *
 * Web parity: N/A — Apple Health is iOS-only; there is no web bridge.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `healthSync.ts` constructs a Supabase client at module-eval time
// (`lib/supabase.ts`), which throws "supabaseUrl is required" under the test
// env (no `expo.extra` config). The queue under test never touches Supabase,
// so stub the client module to keep the import side-effect-free. Both the
// alias form and the relative form `healthSync.ts` actually imports
// (`./supabase`) resolve to the same module id, so this single mock covers it.
vi.mock("@/lib/supabase", () => ({
  supabase: {},
  hasSupabaseConfig: () => false,
}));
// Same module, relative specifier — vitest matches the import string used by
// the module under test, so register both to be safe across resolution paths.
vi.mock("../../lib/supabase", () => ({
  supabase: {},
  hasSupabaseConfig: () => false,
}));
// `healthSync.ts` evaluates `isExpoGoRuntime()` at module-load (the `ENABLED`
// const), which reads `ExecutionEnvironment` + `executionEnvironment` from
// `expo-constants`. The shared test shim doesn't export those, so provide a
// minimal stand-in here (non-store env → not Expo Go, which is irrelevant to
// the queue but lets the module finish loading).
vi.mock("expo-constants", () => ({
  default: { executionEnvironment: "standalone", appOwnership: "standalone", expoConfig: { extra: {} } },
  ExecutionEnvironment: { Standalone: "standalone", StoreClient: "storeClient", Bare: "bare" },
}));

import { _hkQueueTestHooks } from "../../lib/healthSync";

/** Deferred promise we can resolve/reject from the test to model a slow/hung native call. */
function defer<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("ENG-1019 — global HealthKit call mutex (enqueueHk)", () => {
  beforeEach(() => {
    _hkQueueTestHooks.reset();
    // Silence the structured queue logging during assertions (it's the
    // diagnostic channel for device hangs — verified separately below).
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    _hkQueueTestHooks.reset();
    vi.restoreAllMocks();
  });

  it("runs enqueued calls strictly one at a time, in FIFO order", async () => {
    const events: string[] = [];
    let running = 0;
    let maxConcurrent = 0;

    const make = (label: string, ms: number) =>
      _hkQueueTestHooks.enqueue(label, async () => {
        running += 1;
        maxConcurrent = Math.max(maxConcurrent, running);
        events.push(`${label}:start`);
        await new Promise((r) => setTimeout(r, ms));
        events.push(`${label}:end`);
        running -= 1;
        return label;
      });

    // Enqueue out of duration order: a slow first call must still finish
    // before the second starts (proves serialization, not just async).
    const results = await Promise.all([make("A", 30), make("B", 5), make("C", 1)]);

    expect(maxConcurrent).toBe(1); // never two native calls at once
    expect(results).toEqual(["A", "B", "C"]);
    // Each call fully completes before the next begins — interleaving is impossible.
    expect(events).toEqual([
      "A:start",
      "A:end",
      "B:start",
      "B:end",
      "C:start",
      "C:end",
    ]);
  });

  it("a hung/timed-out call does NOT block the next enqueued call", async () => {
    const order: string[] = [];
    const hung = defer<string>();

    // First call models the live bug: the native callback never fires, so the
    // leaf's timeout eventually rejects. We model that rejection arriving LATE,
    // after the second call was already queued.
    const first = _hkQueueTestHooks
      .enqueue("syncHealthData", async () => {
        order.push("first:start");
        // Simulate the leaf timeout firing (`withHealthCallbackTimeout` rejects).
        const v = await hung.promise.catch((e) => {
          throw e;
        });
        order.push("first:resolved-unexpectedly");
        return v;
      })
      .catch((e: Error) => {
        order.push("first:rejected");
        return `caught:${e.message}`;
      });

    const second = _hkQueueTestHooks.enqueue("getDailyStepCountSamples", async () => {
      order.push("second:ran");
      return "second-ok";
    });

    // The first call is still hung — the second must NOT have run yet (queue
    // is serial). Give the microtask queue a tick to prove it's blocked.
    await Promise.resolve();
    expect(order).not.toContain("second:ran");

    // Now the leaf timeout fires (reject). The chain must advance so the
    // second call runs to completion.
    hung.reject(new Error("HealthKit getDailyStepCountSamples did not respond within 15000ms"));

    const [firstOut, secondOut] = await Promise.all([first, second]);
    expect(firstOut).toContain("did not respond within");
    expect(secondOut).toBe("second-ok");
    expect(order).toEqual(["first:start", "first:rejected", "second:ran"]);
    // Queue fully drained back to idle.
    expect(_hkQueueTestHooks.depth()).toBe(0);
  });

  it("a rejected call surfaces to its own awaiter but does not poison the chain", async () => {
    const boom = _hkQueueTestHooks.enqueue("initHealthKit(body_metrics_init)", async () => {
      throw new Error("native init exploded");
    });

    // The rejection belongs to THIS awaiter only.
    await expect(boom).rejects.toThrow("native init exploded");

    // The very next call still resolves normally — the chain wasn't poisoned.
    const after = await _hkQueueTestHooks.enqueue("getWeightSamples", async () => "weights");
    expect(after).toBe("weights");
    expect(_hkQueueTestHooks.depth()).toBe(0);
  });

  it("a synchronous throw inside an enqueued fn rejects only that call, chain survives", async () => {
    // enqueueHk wraps fn() in the promise chain; a sync throw becomes a
    // rejection of the returned promise, not an uncaught error that breaks
    // the queue for everyone.
    const sync = _hkQueueTestHooks.enqueue("saveFood", () => {
      throw new Error("sync boom");
    });
    await expect(sync).rejects.toThrow("sync boom");

    const next = await _hkQueueTestHooks.enqueue("getFiberSamples", async () => "fiber");
    expect(next).toBe("fiber");
  });

  it("tracks live depth: rises while calls are queued, returns to zero when drained", async () => {
    expect(_hkQueueTestHooks.depth()).toBe(0);

    const gate1 = defer<void>();
    const gate2 = defer<void>();

    const p1 = _hkQueueTestHooks.enqueue("call1", async () => {
      await gate1.promise;
    });
    const p2 = _hkQueueTestHooks.enqueue("call2", async () => {
      await gate2.promise;
    });

    // Both enqueued, neither settled → depth reflects two outstanding calls.
    expect(_hkQueueTestHooks.depth()).toBe(2);

    gate1.resolve();
    await p1;
    // call1 drained; call2 still outstanding.
    expect(_hkQueueTestHooks.depth()).toBe(1);

    gate2.resolve();
    await p2;
    expect(_hkQueueTestHooks.depth()).toBe(0);
  });

  it("emits structured [hk.queue] start + settle logs for device diagnosability", async () => {
    const logSpy = console.log as unknown as ReturnType<typeof vi.fn>;

    await _hkQueueTestHooks.enqueue("getActiveEnergyBurned", async () => "ok");

    const lines = logSpy.mock.calls.map((c) => String(c[0]));
    expect(lines.some((l) => l.includes("[hk.queue] getActiveEnergyBurned start"))).toBe(true);
    expect(lines.some((l) => l.includes("[hk.queue] getActiveEnergyBurned settled ok"))).toBe(true);
  });

  it("logs a TIMEOUT warning (not a generic error) when a leaf timeout rejects", async () => {
    const warnSpy = console.warn as unknown as ReturnType<typeof vi.fn>;

    await _hkQueueTestHooks
      .enqueue("getProteinSamples", async () => {
        throw new Error("HealthKit getProteinSamples did not respond within 15000ms");
      })
      .catch(() => undefined);

    const warnLines = warnSpy.mock.calls.map((c) => String(c[0]));
    expect(warnLines.some((l) => l.includes("[hk.queue] getProteinSamples TIMEOUT"))).toBe(true);
  });
});
