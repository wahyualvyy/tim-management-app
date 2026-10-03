import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
      // Attachments are limited to 8 MB in the action; leave room for multipart overhead.
      bodySizeLimit: "9mb",
    },
  },
};

export default nextConfig;
