import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // `eslint` is valid per Next.js docs but missing from the installed
  // NextConfig typedef — ts-expect-error keeps `tsc --noEmit` clean.
  // @ts-expect-error — NextConfig type lags Next.js runtime config
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*/",
        destination: "http://64.227.150.115/api/:path*/",
      },
      {
        source: "/api/:path*",
        destination: "http://64.227.150.115/api/:path*/",
      },
      {
        source: "/media/:path*",
        destination: "http://64.227.150.115/media/:path*",
      },
    ];
  },
  trailingSlash: false,
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
