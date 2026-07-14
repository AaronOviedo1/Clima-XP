import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // web-push usa crypto/https nativos de Node: que no lo empaquete el bundler.
  serverExternalPackages: ["web-push"],
};

export default nextConfig;
