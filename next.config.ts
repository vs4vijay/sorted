import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@electric-sql/pglite', '@firecrawl/pdf-inspector', '@firecrawl/anydoc'],
};

export default nextConfig;
