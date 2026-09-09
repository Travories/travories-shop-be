import type { NextConfig } from "next"

const backendUrl = (
  process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"
).replace(/\/$/, "")

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ]
  },
}

export default nextConfig
