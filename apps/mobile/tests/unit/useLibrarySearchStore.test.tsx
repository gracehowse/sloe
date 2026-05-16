/** @vitest-environment jsdom */
/**
 * `useLibrarySearchStore` — shared search state across Library + Discover.
 *
 * Pins the cross-component sharing contract that ENG-53 (2026-05-16)
 * ships: two consumers see the same query AND both re-render when
 * either calls setQuery.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, cleanup, act } from "@testing-library/react-native";
import {
  useLibrarySearchStore,
  __resetLibrarySearchStoreForTests,
} from "../../hooks/useLibrarySearchStore";

function Probe(props: { onValue?: (q: string) => void; setRef?: (set: (next: string) => void) => void }) {
  const { query, setQuery } = useLibrarySearchStore();
  React.useEffect(() => {
    props.onValue?.(query);
  }, [query, props]);
  React.useEffect(() => {
    props.setRef?.(setQuery);
  }, [setQuery, props]);
  return null;
}

describe("useLibrarySearchStore (ENG-53)", () => {
  beforeEach(() => {
    __resetLibrarySearchStoreForTests();
  });

  afterEach(() => {
    cleanup();
    __resetLibrarySearchStoreForTests();
  });

  it("starts with an empty query", () => {
    let last = "uninitialised";
    render(<Probe onValue={(q) => { last = q; }} />);
    expect(last).toBe("");
  });

  it("updates the query and re-renders the consumer", async () => {
    let last = "uninitialised";
    let setQ: ((next: string) => void) | null = null;
    render(
      <Probe
        onValue={(q) => { last = q; }}
        setRef={(s) => { setQ = s; }}
      />,
    );
    expect(setQ).not.toBeNull();
    await act(async () => {
      setQ!("chicken");
    });
    expect(last).toBe("chicken");
  });

  it("shares state across two consumers — typing in one re-renders the other", async () => {
    let valueInA = "uninitialised";
    let valueInB = "uninitialised";
    let setQA: ((next: string) => void) | null = null;
    render(
      <>
        <Probe
          onValue={(q) => { valueInA = q; }}
          setRef={(s) => { setQA = s; }}
        />
        <Probe onValue={(q) => { valueInB = q; }} />
      </>,
    );
    await act(async () => {
      setQA!("salmon");
    });
    expect(valueInA).toBe("salmon");
    expect(valueInB).toBe("salmon");
  });

  it("__resetLibrarySearchStoreForTests clears state between tests", async () => {
    let last = "uninitialised";
    let setQ: ((next: string) => void) | null = null;
    render(
      <Probe
        onValue={(q) => { last = q; }}
        setRef={(s) => { setQ = s; }}
      />,
    );
    await act(async () => {
      setQ!("kept across renders");
    });
    expect(last).toBe("kept across renders");
    await act(async () => {
      __resetLibrarySearchStoreForTests();
    });
    expect(last).toBe("");
  });
});
