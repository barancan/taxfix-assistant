import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @react-pdf/renderer and file-type run server-side only; keep them external
  // to the server bundle so their native/stream code is not pulled into the client.
  serverExternalPackages: ["@react-pdf/renderer", "file-type"],
};

export default nextConfig;
