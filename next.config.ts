import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  // BullMQ and ioredis are Node-only and ship optional drivers the bundler
  // cannot resolve. Keep them external to the server bundle.
  serverExternalPackages: ["bullmq", "ioredis"]
};

export default nextConfig;
