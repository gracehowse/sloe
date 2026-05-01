/**
 * Pins the wiring between the photo-log review path and the
 * cross-platform `persistPhotoCorrections` helper (round 4 user-
 * sentiment audit, 2026-04-30 — Cal AI's failure pattern,
 * MacroFactor's emerging lead).
 *
 * Why a structural test: jsdom-vitest cannot render the React Native
 * sheet (Modal + AsyncStorage + supabase async chain). RNTL coverage
 * is on the R7 backlog. Until then we grep the source files for the
 * load-bearing wiring so a regression — e.g. a refactor that drops
 * the `originalItemsRef` snapshot, or wires the helper without the
 * one-time tooltip — fails this test.
 *
 * Cross-platform pin: the same wiring must exist on web
 * (`src/app/components/suppr/photo-log-dialog.tsx`). The web parity
 * test lives next to its source under `tests/unit/`; the two assert
 * the same invariants so neither platform can drift in isolation.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PHOTO_PATH = resolve(__dirname, "../../components/PhotoLogSheet.tsx");
const PHOTO_SRC = readFileSync(PHOTO_PATH, "utf8");

describe("PhotoLogSheet — corrections persist wiring (round 4 audit)", () => {
  it("imports the cross-platform persistence helper", () => {
    expect(PHOTO_SRC).toMatch(
      /import\s*\{\s*persistPhotoCorrections\s*\}\s*from\s+["'][^"']*photoCorrectionPersist["']/,
    );
  });

  it("snapshots the AI's original items on review entry", () => {
    // The originals snapshot is what `isMeaningfulPhotoCorrection`
    // diffs against — without it every commit would be detected as
    // "no change" (originals would equal the user's edits) and the
    // bank would never grow. Range-first re-architecture (2026-05-01):
    // items are projected from `PhotoLogItemRanged[]` to
    // `AiLoggedItem[]` via `rangedItemToLogged` for the snapshot.
    expect(PHOTO_SRC).toMatch(
      /originalItemsRef\.current\s*=\s*ranged\.map\(\(it\)\s*=>\s*rangedItemToLogged\(it\)\)/,
    );
  });

  it("calls persistPhotoCorrections at commit time", () => {
    expect(PHOTO_SRC).toMatch(/persistPhotoCorrections\s*\(\s*\{/);
  });

  it("passes the captured originals + the user's corrected items to the helper", () => {
    // Range-first re-architecture (2026-05-01): the corrected items
    // are projected from the ranged items to the logged shape via
    // `rangedItemToLogged` in a `projected` local before the call.
    expect(PHOTO_SRC).toMatch(/originals:\s*originalItemsRef\.current/);
    expect(PHOTO_SRC).toMatch(/corrected:\s*projected/);
  });

  it("guards the persist on a resolved auth user (skips when signed-out)", () => {
    expect(PHOTO_SRC).toMatch(/supabase\.auth\.getUser/);
    // Early-return when no user — no auth = no per-user bank to write.
    expect(PHOTO_SRC).toMatch(/userId\s*=[^;]*authData[^;]*\.id/);
  });

  it("uses an AsyncStorage flag to gate the one-time confirmation", () => {
    // The flag is per-device (the lesson is for the human, not the
    // user-id) — see PHOTO_CORRECTION_TOOLTIP_KEY export.
    expect(PHOTO_SRC).toMatch(/PHOTO_CORRECTION_TOOLTIP_KEY/);
    expect(PHOTO_SRC).toMatch(/AsyncStorage\.getItem\(\s*PHOTO_CORRECTION_TOOLTIP_KEY/);
    expect(PHOTO_SRC).toMatch(/AsyncStorage\.setItem\(\s*PHOTO_CORRECTION_TOOLTIP_KEY/);
  });

  it("only fires the confirmation toast when something was persisted", () => {
    // result.anyPersisted is the gate — if no row was inserted or
    // updated (everything skipped no-change) the toast must not fire.
    expect(PHOTO_SRC).toMatch(/result\.anyPersisted/);
  });

  it("uses a platform-native toast surface (ToastAndroid + Alert.alert) — sheet is closing as the toast lands", () => {
    expect(PHOTO_SRC).toMatch(/ToastAndroid\.show/);
    expect(PHOTO_SRC).toMatch(/Alert\.alert/);
  });

  it("the persistence call is fire-and-forget (the meal commit is unblocked)", () => {
    // Wrapped in `void (async () => { ... })()` so the await chain
    // never propagates back to the caller, even if persistence
    // takes seconds. The meal commit + onClose must not wait on it.
    expect(PHOTO_SRC).toMatch(/void\s*\(\s*async\s*\(\s*\)\s*=>/);
  });
});
