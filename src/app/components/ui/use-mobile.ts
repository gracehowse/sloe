import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const DESKTOP_BREAKPOINT = 1024;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

/**
 * Phase 4 / B3.Y (2026-04-27) — desktop breakpoint hook.
 *
 * Returns `true` when viewport ≥ 1024px (`lg:`). Used to drive the
 * `<LogSheet desktop>` mode (centred 480×640 modal vs mobile bottom
 * sheet) per spec §Surface B "desktop layout".
 *
 * SSR-safe: returns `false` during the initial server render and on
 * the first client paint, then upgrades to the real value once the
 * matchMedia listener fires. Means the bottom-sheet layout is the
 * conservative default — same as the mobile path — and desktop users
 * see one frame of bottom-sheet before the modal layout takes over.
 * Acceptable trade for not requiring `useEffect` consumers.
 */
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = React.useState<boolean>(false);

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    const onChange = () => {
      setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}
