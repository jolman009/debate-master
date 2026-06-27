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
};

export default nextConfig;
