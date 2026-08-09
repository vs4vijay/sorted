import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@firecrawl/pdf-inspector', '@firecrawl/anydoc'],
};

export default nextConfig;
