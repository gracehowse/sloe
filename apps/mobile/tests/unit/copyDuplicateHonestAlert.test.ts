/**
 * ENG-1522 — the CopyMealSheet/DuplicateDaySheet `onConfirm` handlers in
 * `TodayScreen.tsx` must await the actual persist result before showing a
 * success Alert, not fire it unconditionally the instant the sheet
 * confirms (the pre-fix bug: `void copyMealToDate(...)` fire-and-forget
 * immediately followed by a synchronous `Alert.alert("Copied", summary)`).
 *
 * Source-pin (matches the repo idiom for this pinned screen-budget file —
 * see `paywallFallbackWhenUnavailable.test.ts`, `journalSupabasePersistence.test.ts`).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const SRC = readFileSync(
  path.resolve(__dirname, "../../app/(tabs)/_today/TodayScreen.tsx"),
  "utf8",
);

describe("ENG-1522 — CopyMealSheet onConfirm awaits the persist result", () => {
  const idx = SRC.indexOf("<CopyMealSheet");
  const slice = SRC.slice(idx, idx + 2500);

  it("does not fire the success Alert unconditionally right after the sheet confirms", () => {
    // The old bug shape: a bare `Alert.alert("Copied", summary);` statement
    // immediately following the void copyMealToDate/copyMealToDateRange call,
    // with nothing gating it on the result.
    expect(slice).not.toMatch(/copyMealToDate\([^)]*\);\s*\n\s*Alert\.alert\("Copied"/);
  });

  it("single-target copy awaits copyMealToDate and only alerts on persisted: true", () => {
    expect(slice).toMatch(/copyMealToDate\([^)]*\)\.then\(\(persisted\)\s*=>\s*\{\s*\n\s*if\s*\(persisted\)\s*Alert\.alert\("Copied"/);
  });

  it("range copy awaits copyMealToDateRange and routes through copyDuplicateBatchAlert", () => {
    expect(slice).toMatch(/copyMealToDateRange\([^)]*\)\.then\(\(\{\s*succeeded,\s*failed\s*\}\)\s*=>\s*\{/);
    expect(slice).toMatch(/copyDuplicateBatchAlert\("Copied"/);
  });
});

describe("ENG-1522 — DuplicateDaySheet onConfirm awaits the persist result", () => {
  const idx = SRC.indexOf("<DuplicateDaySheet");
  const slice = SRC.slice(idx, idx + 2500);

  it("does not fire the success Alert unconditionally right after the sheet confirms", () => {
    expect(slice).not.toMatch(/duplicateDay\([^)]*\);\s*\n\s*Alert\.alert\("Duplicated"/);
  });

  it("single-target duplicate awaits duplicateDay and only alerts on persisted: true", () => {
    expect(slice).toMatch(/duplicateDay\([^)]*\)\.then\(\(persisted\)\s*=>\s*\{\s*\n\s*if\s*\(persisted\)\s*Alert\.alert\("Duplicated"/);
  });

  it("range duplicate awaits duplicateDayToDateRange and routes through copyDuplicateBatchAlert", () => {
    expect(slice).toMatch(/duplicateDayToDateRange\([^)]*\)\.then\(\(\{\s*succeeded,\s*failed\s*\}\)\s*=>\s*\{/);
    expect(slice).toMatch(/copyDuplicateBatchAlert\("Duplicated"/);
  });
});

describe("ENG-1522 — copy/duplicate logic lives in useCopyDuplicateMeal, not inline", () => {
  it("TodayScreen delegates to the extracted hook (screen-budget pinned file)", () => {
    expect(SRC).toMatch(/useCopyDuplicateMeal\(\{/);
    expect(SRC).not.toMatch(/const\s+insertClonedRowsIntoDay\s*=\s*useCallback/);
  });
});
