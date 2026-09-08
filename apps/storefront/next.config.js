const path = require("path")
const { loadEnvConfig } = require("@next/env")

// This monorepo keeps a SINGLE .env at the repo root — there is no
// apps/storefront/.env.local. Next only auto-loads env files from the project
// directory, so load the root one here, before anything reads process.env.
// Values already present in the environment (Vercel, docker `env_file`,
// `--build-arg`) are not overwritten.
loadEnvConfig(path.join(__dirname, "../../"))

const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

/**
 * Standalone output is only used for the self-hosted Docker image. It is gated
 * behind an env flag so Vercel builds are completely unaffected (Vercel manages
 * its own output). The tracing root is pinned to the monorepo root so the
 * bundle lands at a predictable path for the Dockerfile to copy.
 */
const standalone = process.env.NEXT_OUTPUT_STANDALONE === "1"

/**
 * Medusa Cloud-related environment variables
 */
const S3_HOSTNAME = process.env.MEDUSA_CLOUD_S3_HOSTNAME
const S3_PATHNAME = process.env.MEDUSA_CLOUD_S3_PATHNAME

/**
 * Garage (S3-compatible) media host. next/image refuses to render a remote URL
 * whose hostname is not listed here, and it fails silently, so this must be set
 * to the host of the backend's S3_FILE_URL before real photography lands.
 */
const MEDIA_HOSTNAME = process.env.NEXT_PUBLIC_MEDIA_HOSTNAME

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  ...(standalone
    ? {
        output: "standalone",
        outputFileTracingRoot: path.join(__dirname, "../../"),
      }
    : {}),
  reactStrictMode: true,
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "*.s3.*.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com",
      },
      ...(S3_HOSTNAME && S3_PATHNAME
        ? [
            {
              protocol: "https",
              hostname: S3_HOSTNAME,
              pathname: S3_PATHNAME,
            },
          ]
        : []),
      ...(MEDIA_HOSTNAME
        ? [
            {
              protocol: "https",
              hostname: MEDIA_HOSTNAME,
            },
          ]
        : []),
    ],
  },
}

module.exports = nextConfig
