import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  transpilePackages: ["@auditrail/domain"],
  typedRoutes: true
};

export default nextConfig;
