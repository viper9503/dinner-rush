import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lean, self-contained server bundle for the Docker runtime stage.
  output: "standalone",
  images: {
    // Mock app — skip the optimizer so Unsplash photos load instantly & reliably.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
