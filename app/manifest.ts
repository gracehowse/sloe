import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Suppr",
    short_name: "Suppr",
    description: "Recipes, verified macros, and meal planning in one workspace.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f3ee",
    theme_color: "#1c1916",
    icons: [
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        type: "image/png",
        sizes: "192x192",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        type: "image/png",
        sizes: "512x512",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        type: "image/png",
        sizes: "512x512",
        purpose: "maskable",
      },
    ],
  };
}
