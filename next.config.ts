import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root so a stray lockfile elsewhere can't confuse Turbopack.
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url)),
  },
  // @react-pdf/renderer and file-type run server-side only; keep them external
  // to the server bundle so their native/stream code is not pulled into the client.
  serverExternalPackages: ["@react-pdf/renderer", "file-type"],
};

export default nextConfig;
