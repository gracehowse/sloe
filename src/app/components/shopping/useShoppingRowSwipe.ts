import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/** One swipe action pane. 88px matches mobile's `Swipeable` pane width exactly. */
export const SHOPPING_ROW_ACTION_WIDTH = 88;
/** Two panes (staple + delete), matching mobile's Swipeable action pair. */
export const SHOPPING_ROW_RAIL_WIDTH = SHOPPING_ROW_ACTION_WIDTH * 2;
/** Horizontal travel that commits to a swipe rather than a tap. */
const DRAG_INTENT_PX = 6;

export type ShoppingRowSwipe = {
  /** Pixels of trailing width the row content currently gives up to the rail. */
  offset: number;
  /** True while a finger is actively dragging (suppresses the snap easing). */
  dragging: boolean;
  /**
   * The rail is revealed — mid-drag, swipe-opened, or keyboard-focused. Hover
   * deliberately does NOT open it: a pointer sweeping down the list would tear
   * every row open in turn, and a full-height destructive pane flashing under
   * the cursor is not an affordance, it is an alarm. Pointer devices get the
   * compact hover cluster instead (see `ShoppingListRow`).
   */
  railOpen: boolean;
  rowHandlers: {
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
  };
  /** Keyboard focus inside the rail opens it, so the focused control is visible. */
  setRailFocused: (focused: boolean) => void;
  /**
   * Wrap the row's tap handler. A finished swipe is not a tap, and a tap on a
   * swipe-opened row closes it instead of toggling.
   */
  guardTap: (run: () => void) => void;
};

/**
 * Swipe-to-reveal for a web shopping row — the gesture mobile already ships
 * (`react-native-gesture-handler` `Swipeable`), so the two platforms teach the
 * same interaction. Replaces the hover-only action pair, which reserved ~68px
 * of permanently-empty row width on touch and put those actions out of reach
 * there entirely.
 */
export function useShoppingRowSwipe(): ShoppingRowSwipe {
  const [drag, setDrag] = useState(0);
  const [swipeOpen, setSwipeOpen] = useState(false);
  const [railFocused, setRailFocused] = useState(false);
  const startRef = useRef<{ x: number; y: number; axis: "" | "x" | "y" } | null>(null);
  const dragValueRef = useRef(0);
  const swipedRef = useRef(false);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") return;
    startRef.current = { x: e.clientX, y: e.clientY, axis: "" };
  }, []);

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const start = startRef.current;
      if (!start) return;
      const travelX = start.x - e.clientX;
      const travelY = e.clientY - start.y;
      if (start.axis === "") {
        if (Math.abs(travelX) < DRAG_INTENT_PX && Math.abs(travelY) < DRAG_INTENT_PX) return;
        // Vertical intent belongs to the scroll container, not the row.
        start.axis = Math.abs(travelX) > Math.abs(travelY) ? "x" : "y";
      }
      if (start.axis !== "x") return;
      swipedRef.current = true;
      const next = Math.max(
        0,
        Math.min(SHOPPING_ROW_RAIL_WIDTH, travelX + (swipeOpen ? SHOPPING_ROW_RAIL_WIDTH : 0)),
      );
      dragValueRef.current = next;
      setDrag(next);
    },
    [swipeOpen],
  );

  const endDrag = useCallback(() => {
    const start = startRef.current;
    startRef.current = null;
    if (!start || start.axis !== "x") return;
    setSwipeOpen(dragValueRef.current > SHOPPING_ROW_RAIL_WIDTH / 2);
    dragValueRef.current = 0;
    setDrag(0);
  }, []);

  const guardTap = useCallback(
    (run: () => void) => {
      if (swipedRef.current) {
        swipedRef.current = false;
        return;
      }
      if (swipeOpen) {
        setSwipeOpen(false);
        return;
      }
      run();
    },
    [swipeOpen],
  );

  const settled = swipeOpen || railFocused;
  return {
    offset: drag > 0 ? drag : settled ? SHOPPING_ROW_RAIL_WIDTH : 0,
    dragging: drag > 0,
    railOpen: drag > 0 || settled,
    rowHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
    setRailFocused,
    guardTap,
  };
}
