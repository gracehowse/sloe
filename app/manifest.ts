import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Suppr",
    short_name: "Suppr",
    description: "Recipes, verified macros, and meal planning in one workspace.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f7",
    theme_color: "#4c6ce0",
    icons: [
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
    ],
  };
}
