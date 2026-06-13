import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is dark-only and desktop-first; nothing exotic needed here.
  // Design references live in design_handoff_proofline/ and are not part of the build.
  eslint: {
    dirs: ["src"],
  },
};

export default nextConfig;
