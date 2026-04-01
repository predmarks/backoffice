import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@anthropic-ai/sdk",
    "openai",
    "rss-parser",
    "inngest",
  ],
};

export default nextConfig;
