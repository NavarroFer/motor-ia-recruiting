import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite y pg cargan binarios/wasm: que Next no los empaquete.
  serverExternalPackages: ["@electric-sql/pglite", "@electric-sql/pglite-pgvector", "pg", "unpdf", "mammoth"],
  experimental: { serverActions: { bodySizeLimit: "50mb" } },
};

export default nextConfig;
