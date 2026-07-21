/**
 * ENG-1584 — Apple Health `SleepAnalysis` value-taxonomy + aggregation
 * pins. Mirrors the pure-helper test convention used for other
 * HealthKit-adjacent modules (e.g. `healthSyncBridgeErrorString.test.ts`
 * for `stringifyBridgeUnknown`) rather than mocking the native bridge —
 * `healthSyncSleep.ts` is deliberately pure so this is possible without
 * touching `syncHealthData`/Supabase at all.
 */
import { describe, expect, it } from "vitest";
// @ts-expect-error untyped deep import (runtime JS only) — same pattern as
// healthDietaryPermissionKeys.test.ts's Permissions pin.
import { Permissions } from "react-native-health/src/constants/Permissions";

import {
  aggregateAsleepMinutesByDay,
  isAsleepSampleValue,
  mergeIntervals,
  splitIntervalIntoLocalDayMinutes,
  type RawSleepSample,
} from "@/lib/healthSyncSleep";

describe("react-native-health permission pin", () => {
  it("'SleepAnalysis' is a permission key react-native-health can authorize", () => {
    // Guards apps/mobile/lib/healthSync.ts's HEALTH_KIT_BODY_READ entry —
    // an unsupported permission key can crash the native init bridge.
    expect(Object.values(Permissions)).toContain("SleepAnalysis");
  });
});

describe("isAsleepSampleValue — HKCategoryValueSleepAnalysis taxonomy", () => {
  it("counts ASLEEP (legacy undifferentiated bucket) as asleep", () => {
    expect(isAsleepSampleValue("ASLEEP")).toBe(true);
  });

  it("counts CORE/DEEP/REM (iOS 16+ sleep stages) as asleep", () => {
    expect(isAsleepSampleValue("CORE")).toBe(true);
    expect(isAsleepSampleValue("DEEP")).toBe(true);
    expect(isAsleepSampleValue("REM")).toBe(true);
  });

  it("does NOT count INBED as asleep", () => {
    expect(isAsleepSampleValue("INBED")).toBe(false);
  });

  it("does NOT count AWAKE as asleep", () => {
    expect(isAsleepSampleValue("AWAKE")).toBe(false);
  });

  it("does NOT count UNKNOWN as asleep (no-guessing rule)", () => {
    expect(isAsleepSampleValue("UNKNOWN")).toBe(false);
  });

  it("is case-insensitive (defensive against a bridge casing change)", () => {
    expect(isAsleepSampleValue("core")).toBe(true);
    expect(isAsleepSampleValue("inbed")).toBe(false);
  });
});

describe("mergeIntervals — multi-source overlap collapse", () => {
  it("leaves non-overlapping intervals untouched", () => {
    const out = mergeIntervals([
      { startMs: 0, endMs: 100 },
      { startMs: 200, endMs: 300 },
    ]);
    expect(out).toEqual([
      { startMs: 0, endMs: 100 },
      { startMs: 200, endMs: 300 },
    ]);
  });

  it("merges two overlapping intervals (Watch + iPhone reporting the same stretch)", () => {
    const out = mergeIntervals([
      { startMs: 0, endMs: 100 },
      { startMs: 50, endMs: 150 },
    ]);
    expect(out).toEqual([{ startMs: 0, endMs: 150 }]);
  });

  it("merges touching intervals (end === next start)", () => {
    const out = mergeIntervals([
      { startMs: 0, endMs: 100 },
      { startMs: 100, endMs: 200 },
    ]);
    expect(out).toEqual([{ startMs: 0, endMs: 200 }]);
  });

  it("merges out-of-order input the same as sorted input", () => {
    const out = mergeIntervals([
      { startMs: 200, endMs: 300 },
      { startMs: 0, endMs: 100 },
      { startMs: 50, endMs: 250 },
    ]);
    expect(out).toEqual([{ startMs: 0, endMs: 300 }]);
  });

  it("drops zero/negative-duration and non-finite intervals", () => {
    const out = mergeIntervals([
      { startMs: 0, endMs: 0 },
      { startMs: 100, endMs: 50 },
      { startMs: Number.NaN, endMs: 100 },
      { startMs: 0, endMs: 100 },
    ]);
    expect(out).toEqual([{ startMs: 0, endMs: 100 }]);
  });

  it("returns [] for empty input", () => {
    expect(mergeIntervals([])).toEqual([]);
  });
});

describe("splitIntervalIntoLocalDayMinutes — local-midnight bucketing", () => {
  it("keeps a same-day interval in one bucket", () => {
    const start = new Date(2026, 6, 19, 22, 0, 0).getTime(); // 2026-07-19 22:00 local
    const end = new Date(2026, 6, 19, 23, 30, 0).getTime(); // 2026-07-19 23:30 local
    const out = splitIntervalIntoLocalDayMinutes(start, end);
    expect(out).toEqual({ "2026-07-19": 90 });
  });

  it("splits an overnight interval at local midnight, crediting each day its share", () => {
    const start = new Date(2026, 6, 19, 23, 0, 0).getTime(); // 2026-07-19 23:00
    const end = new Date(2026, 6, 20, 7, 0, 0).getTime(); // 2026-07-20 07:00
    const out = splitIntervalIntoLocalDayMinutes(start, end);
    expect(out).toEqual({ "2026-07-19": 60, "2026-07-20": 420 });
  });

  it("returns {} for a zero/negative-duration interval", () => {
    const t = new Date(2026, 6, 19, 22, 0, 0).getTime();
    expect(splitIntervalIntoLocalDayMinutes(t, t)).toEqual({});
    expect(splitIntervalIntoLocalDayMinutes(t + 100, t)).toEqual({});
  });
});

describe("aggregateAsleepMinutesByDay — full pipeline", () => {
  it("excludes INBED/AWAKE/UNKNOWN from the total", () => {
    const samples: RawSleepSample[] = [
      {
        value: "INBED",
        startDate: new Date(2026, 6, 19, 22, 0, 0).toISOString(),
        endDate: new Date(2026, 6, 19, 22, 30, 0).toISOString(),
      },
      {
        value: "ASLEEP",
        startDate: new Date(2026, 6, 19, 22, 30, 0).toISOString(),
        endDate: new Date(2026, 6, 20, 6, 30, 0).toISOString(),
      },
      {
        value: "AWAKE",
        startDate: new Date(2026, 6, 20, 3, 0, 0).toISOString(),
        endDate: new Date(2026, 6, 20, 3, 5, 0).toISOString(),
      },
    ];
    const out = aggregateAsleepMinutesByDay(samples);
    // Only the ASLEEP interval (22:30 -> next-day 06:30 = 480 minutes)
    // counts; AWAKE's 5 minutes sits *inside* that interval's raw span
    // but is a separate, non-asleep sample so it doesn't add to the
    // total, and INBED is excluded outright.
    expect(out["2026-07-19"]).toBe(90); // 22:30 -> midnight
    expect(out["2026-07-20"]).toBe(390); // midnight -> 06:30
    expect(Object.values(out).reduce((a, b) => a + b, 0)).toBe(480);
  });

  it("merges overlapping asleep samples from two sources instead of double-counting", () => {
    const samples: RawSleepSample[] = [
      {
        value: "CORE",
        sourceName: "Apple Watch",
        startDate: new Date(2026, 6, 19, 23, 0, 0).toISOString(),
        endDate: new Date(2026, 6, 20, 6, 0, 0).toISOString(),
      },
      {
        value: "ASLEEP",
        sourceName: "iPhone",
        startDate: new Date(2026, 6, 19, 23, 0, 0).toISOString(),
        endDate: new Date(2026, 6, 20, 6, 0, 0).toISOString(),
      },
    ];
    const out = aggregateAsleepMinutesByDay(samples);
    const total = Object.values(out).reduce((a, b) => a + b, 0);
    // 7 hours = 420 minutes total across the two days combined — NOT 840
    // (which a naive per-sample sum would produce for two fully
    // overlapping 7h sources).
    expect(total).toBe(420);
  });

  it("returns {} for no samples", () => {
    expect(aggregateAsleepMinutesByDay([])).toEqual({});
  });

  it("returns {} when every sample is a non-asleep state", () => {
    const samples: RawSleepSample[] = [
      {
        value: "INBED",
        startDate: new Date(2026, 6, 19, 22, 0, 0).toISOString(),
        endDate: new Date(2026, 6, 20, 6, 0, 0).toISOString(),
      },
    ];
    expect(aggregateAsleepMinutesByDay(samples)).toEqual({});
  });
});
