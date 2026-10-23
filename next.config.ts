import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Parent directory has another lockfile; pin Turbopack to this app root.
  turbopack: {
    root: projectRoot,
  },
  // Dev: allow both localhost and 127.0.0.1 (and LAN) so HMR/assets are not blocked.
  allowedDevOrigins: ["127.0.0.1", "localhost", "[::1]"],
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  async redirects() {
    return [
      {
        source: "/schedule/day",
        destination: "/timeline?scale=day",
        permanent: false,
      },
      {
        source: "/promotion",
        destination: "/projects",
        permanent: false,
      },
      {
        source: "/promotion/:path*",
        destination: "/projects",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
