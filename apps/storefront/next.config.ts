import type { NextConfig } from "next";

// Derive the backend's image host from the configured URL instead of
// hardcoding it, so production domains work without editing this file.
function backendImagePattern() {
  const url = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL;
  if (!url) return null;
  try {
    const { protocol, hostname, port } = new URL(url);
    return {
      protocol: protocol.replace(":", "") as "http" | "https",
      hostname,
      port: port || undefined,
    };
  } catch {
    return null;
  }
}

const dynamicBackendPattern = backendImagePattern();

const nextConfig: NextConfig = {
  // The isolated test storefront (:3002) sets NEXT_DIST_DIR=.next-test so its
  // build artifacts never contend with the dev server's .next (on Windows the
  // shared trace file causes an EPERM crash when both run).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
      },
      {
        protocol: "https",
        hostname: "medusa-public-images.s3.eu-west-1.amazonaws.com",
      },
      ...(dynamicBackendPattern ? [dynamicBackendPattern] : []),
    ],
    formats: ["image/avif", "image/webp"],
  },
  transpilePackages: ["three"],
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "@react-three/drei",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
