import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Debate Master",
    short_name: "Debate Master",
    description:
      "Sharpen your debate skills against AI personas in structured, turn-based debates.",
    // Launch into the dashboard, not the marketing landing page — someone
    // tapping the installed icon wants their debates. (Signed-out users are
    // redirected to /login by middleware, which returns them here after auth.)
    start_url: "/debate",
    // Scope the app to the whole origin so invite links (/debate/join/…) and
    // auth callbacks open inside the app rather than kicking out to a browser.
    scope: "/",
    display: "standalone",
    background_color: "#0a0a1a",
    theme_color: "#6366f1",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
