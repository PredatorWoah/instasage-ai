import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Animated page changes (React <ViewTransition>): tabs glide and the active pill morphs
    viewTransition: true,
  },
};

export default nextConfig;
