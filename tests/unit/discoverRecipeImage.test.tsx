/**
 * DiscoverRecipeImage — next/image migration (ENG-704, 2026-05-26).
 *
 * The Discover feed is the core viral-hook scroll; every card image used
 * to be a raw eager `<img>`. This pins the next/image behaviour so the
 * perf + safety properties can't silently regress:
 *
 *   - lazy-loading (non-priority next/image default)
 *   - responsive srcset on allowlisted (optimizable) hosts
 *   - NO optimizer routing for arbitrary user-imported hosts (the
 *     optimizer must never become an open fetch proxy for any URL a
 *     user can paste — see OPTIMIZABLE_HOST_SUFFIXES + next.config.ts)
 *   - the deterministic gradient fallback still renders for missing
 *     images AND after an image errors (stale Unsplash seeds / dead OG)
 *   - the thumb variant + alt text are preserved
 *
 * jsdom renders next/image to a plain <img>; the optimizer decision is
 * observable via the presence/absence of `/_next/image` in `src`.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiscoverRecipeImage } from "../../src/app/components/suppr/discover-recipe-image";

const UNSPLASH = "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&w=900";
const SUPABASE = "https://fnfgxsignmuepshbebrl.supabase.co/storage/v1/object/public/recipes/a.jpg";
const YOUTUBE_THUMB = "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg";
const IMPORTED_OG = "https://scontent.cdninstagram.com/v/t51.2885-15/abc.jpg";

function imgFor(container: HTMLElement) {
  return container.querySelector("img");
}

describe("DiscoverRecipeImage — optimizer allowlist", () => {
  it("routes Unsplash (seed) images through the Next optimizer with a srcset", () => {
    const { container } = render(
      <DiscoverRecipeImage id="r1" title="Kale Bowl" image={UNSPLASH} />,
    );
    const img = imgFor(container)!;
    expect(img.getAttribute("src")).toContain("/_next/image");
    expect(img.getAttribute("srcset")).toContain("/_next/image");
    expect(img.getAttribute("srcset")).toContain("256w");
  });

  it("routes Supabase storage images through the optimizer (wildcard subdomain)", () => {
    const { container } = render(
      <DiscoverRecipeImage id="r2" title="Uploaded" image={SUPABASE} />,
    );
    expect(imgFor(container)!.getAttribute("src")).toContain("/_next/image");
  });

  it("routes derived YouTube thumbnails through the optimizer", () => {
    const { container } = render(
      <DiscoverRecipeImage id="r3" title="Video recipe" image={YOUTUBE_THUMB} />,
    );
    expect(imgFor(container)!.getAttribute("src")).toContain("/_next/image");
  });

  it("does NOT optimize arbitrary user-imported hosts — passes the raw URL through unoptimized", () => {
    const { container } = render(
      <DiscoverRecipeImage id="r4" title="Imported from IG" image={IMPORTED_OG} />,
    );
    const img = imgFor(container)!;
    // No optimizer proxy for an unbounded user-controlled host.
    expect(img.getAttribute("src")).toBe(IMPORTED_OG);
    expect(img.getAttribute("src")).not.toContain("/_next/image");
    // Unoptimized next/image emits no srcset.
    expect(img.getAttribute("srcset")).toBeNull();
  });

  it("treats malformed / relative URLs as un-optimizable (build never sees an un-allowlisted host)", () => {
    const { container } = render(
      <DiscoverRecipeImage id="r5" title="Weird" image="/local/relative.jpg" />,
    );
    const img = imgFor(container)!;
    expect(img.getAttribute("src")).not.toContain("/_next/image");
  });
});

describe("DiscoverRecipeImage — lazy loading", () => {
  it("lazy-loads optimizable images (no eager fetch on the viral scroll)", () => {
    const { container } = render(
      <DiscoverRecipeImage id="r1" title="Kale Bowl" image={UNSPLASH} />,
    );
    expect(imgFor(container)!.getAttribute("loading")).toBe("lazy");
  });

  it("lazy-loads unoptimized (imported) images too", () => {
    const { container } = render(
      <DiscoverRecipeImage id="r4" title="Imported" image={IMPORTED_OG} />,
    );
    expect(imgFor(container)!.getAttribute("loading")).toBe("lazy");
  });
});

describe("DiscoverRecipeImage — gradient fallback (preserved)", () => {
  it("renders the deterministic gradient fallback when there is no image", () => {
    render(<DiscoverRecipeImage id="rX" title="No image recipe" />);
    expect(screen.getByTestId("recipe-hero-fallback-rX")).toBeInTheDocument();
  });

  it("renders the gradient fallback for an empty / whitespace image string", () => {
    render(<DiscoverRecipeImage id="rY" title="Blank" image="   " />);
    expect(screen.getByTestId("recipe-hero-fallback-rY")).toBeInTheDocument();
  });

  it("falls back to the gradient when the image errors (stale Unsplash seed / dead OG)", () => {
    const { container } = render(
      <DiscoverRecipeImage id="rZ" title="Stale seed" image={UNSPLASH} />,
    );
    const img = imgFor(container)!;
    expect(img).toBeInTheDocument();
    fireEvent.error(img);
    // The <img> is replaced by the deterministic gradient renderer.
    expect(screen.getByTestId("recipe-hero-fallback-rZ")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("DiscoverRecipeImage — thumb variant (More ideas list)", () => {
  it("renders an image for the thumb variant when an image is present", () => {
    const { container } = render(
      <DiscoverRecipeImage id="t1" title="Thumb" image={UNSPLASH} variant="thumb" />,
    );
    expect(imgFor(container)).not.toBeNull();
  });

  it("renders the gradient fallback for a thumb with no image", () => {
    render(<DiscoverRecipeImage id="t2" title="No thumb" variant="thumb" />);
    expect(screen.getByTestId("recipe-hero-fallback-t2")).toBeInTheDocument();
  });

  it("falls back to the gradient when a thumb image errors", () => {
    const { container } = render(
      <DiscoverRecipeImage id="t3" title="Broken thumb" image={IMPORTED_OG} variant="thumb" />,
    );
    fireEvent.error(imgFor(container)!);
    expect(screen.getByTestId("recipe-hero-fallback-t3")).toBeInTheDocument();
  });
});

describe("DiscoverRecipeImage — accessibility + behaviour preserved", () => {
  it("keeps the decorative empty alt (title is announced by the card text, not the image)", () => {
    const { container } = render(
      <DiscoverRecipeImage id="a1" title="Decorative" image={UNSPLASH} />,
    );
    expect(imgFor(container)!.getAttribute("alt")).toBe("");
  });

  it("passes the className through to the rendered image (hover scale transforms survive)", () => {
    const { container } = render(
      <DiscoverRecipeImage
        id="a2"
        title="Hover"
        image={UNSPLASH}
        className="object-cover group-hover:scale-[1.03]"
      />,
    );
    expect(imgFor(container)!.className).toContain("group-hover:scale-[1.03]");
  });
});
