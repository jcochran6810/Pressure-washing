import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Phone-camera receipts are typically 2-6MB
      bodySizeLimit: "10mb",
    },
    // Required so the `instrumentation.ts` file is picked up for Sentry.
    instrumentationHook: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

// Sentry wraps the config. If NEXT_PUBLIC_SENTRY_DSN isn't set, Sentry is
// inert at runtime — the wrapper is still safe to apply.
export default withSentryConfig(nextConfig, {
  silent: true,
  // Source maps upload requires SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT.
  // Sentry's CLI will skip upload (with a warning) if these aren't set.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  disableLogger: true,
  hideSourceMaps: true,
});
