import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
  images: {
    dangerouslyAllowSVG: true,
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
    ],
  },
  turbopack: {
    root: "../../",
    resolveAlias: {
      "@effect/platform/MsgPack": "./src/empty-module.ts",
    },
  },
};

export default nextConfig;
