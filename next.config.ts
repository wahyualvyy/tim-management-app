import type { NextConfig } from "next";

const production = process.env.NODE_ENV === "production";

/** Headers for every response; the CSP is set per request (with a nonce) in proxy.ts. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      // Google profile photos
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      // Uploaded avatars (Vercel Blob)
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/**" },
    ],
  },
  experimental: {
    serverActions: {
      // Production uploads go straight to Vercel Blob; this only matters for the
      // local storage driver (largest kind: 20 MB attachments, plus multipart overhead).
      bodySizeLimit: "21mb",
    },
    proxyClientMaxBodySize: "21mb",
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
