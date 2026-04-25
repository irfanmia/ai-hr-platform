import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [],
  },
  typescript: {
    // Enforce type-checking during Vercel builds. We fixed all surfacing
    // errors in the M1.1 + M1.2 commits, so future regressions will fail
    // the deploy instead of sneaking through.
    ignoreBuildErrors: false,
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
  // Canonicalise the brand on hireparrot.com (apex). Anyone hitting the
  // old wayne-ai-hr.vercel.app preview alias OR the www. subdomain is
  // 308'd to the same path on https://hireparrot.com — keeps bookmarks +
  // SEO pointed at one URL.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "wayne-ai-hr.vercel.app" }],
        destination: "https://hireparrot.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.hireparrot.com" }],
        destination: "https://hireparrot.com/:path*",
        permanent: true,
      },
    ];
  },
  trailingSlash: false,
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
