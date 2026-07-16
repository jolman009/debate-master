/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Sentry's server SDK pulls OpenTelemetry instrumentation that webpack
    // cannot statically analyze. Leaving these as runtime requires keeps the
    // build quiet and is the Sentry-recommended setup.
    serverComponentsExternalPackages: [
      "@sentry/nextjs",
      "require-in-the-middle",
    ],
  },
  async rewrites() {
    return [
      {
        // Android Digital Asset Links must live at this exact well-known path.
        // A route handler (rather than a static public/ file) lets the package
        // name + signing fingerprints come from env vars.
        source: "/.well-known/assetlinks.json",
        destination: "/api/assetlinks",
      },
    ];
  },
};

export default nextConfig;
