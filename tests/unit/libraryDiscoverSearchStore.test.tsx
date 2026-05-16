/** @vitest-environment jsdom */
/**
 * `useLibraryDiscoverSearch` — shared search state across web's
 * Library + DiscoverFeed surfaces.
 *
 * Web counterpart to mobile's `useLibrarySearchStore.test.tsx`.
 * Same contract: two consumers see the same query, both re-render
 * when either calls setQuery, reset works between tests.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, cleanup, act } from "@testing-library/react";
import {
  useLibraryDiscoverSearch,
  __resetLibraryDiscoverSearchForTests,
} from "../../src/lib/libraryDiscoverSearchStore.ts";

function Probe(props: { onValue?: (q: string) => void; setRef?: (set: (next: string) => void) => void }) {
  const { query, setQuery } = useLibraryDiscoverSearch();
  React.useEffect(() => {
    props.onValue?.(query);
  }, [query, props]);
  React.useEffect(() => {
    props.setRef?.(setQuery);
  }, [setQuery, props]);
  return null;
}

describe("useLibraryDiscoverSearch (ENG-53, web)", () => {
  beforeEach(() => {
    __resetLibraryDiscoverSearchForTests();
  });

  afterEach(() => {
    cleanup();
    __resetLibraryDiscoverSearchForTests();
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
      setQ!("salmon poke");
    });
    expect(last).toBe("salmon poke");
  });

  it("shares state across two consumers — typing in Library re-renders Discover (and vice versa)", async () => {
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
      setQA!("teriyaki");
    });
    expect(valueInA).toBe("teriyaki");
    expect(valueInB).toBe("teriyaki");
  });

  it("__resetLibraryDiscoverSearchForTests clears state between tests", async () => {
    let last = "uninitialised";
    let setQ: ((next: string) => void) | null = null;
    render(
      <Probe
        onValue={(q) => { last = q; }}
        setRef={(s) => { setQ = s; }}
      />,
    );
    await act(async () => {
      setQ!("must clear");
    });
    expect(last).toBe("must clear");
    await act(async () => {
      __resetLibraryDiscoverSearchForTests();
    });
    expect(last).toBe("");
  });
});
