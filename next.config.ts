import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
  serverExternalPackages: ["@react-pdf/renderer", "@prisma/client"],
  experimental: {
    // Standaard 10MB — te klein voor datasheet/brochure-uploads (tot 25MB, zie API routes).
    proxyClientMaxBodySize: "30mb",
  },
};

export default nextConfig;
