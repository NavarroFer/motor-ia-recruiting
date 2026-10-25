import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite y pg cargan binarios/wasm: que Next no los empaquete.
  serverExternalPackages: ["@electric-sql/pglite", "@electric-sql/pglite-pgvector", "pg", "unpdf", "mammoth"],
  experimental: { serverActions: { bodySizeLimit: "50mb" } },
  // Solo dev: permite abrir la app desde otra máquina de la red local (http://<ip-lan>:3000).
  allowedDevOrigins: ["192.168.*.*"],
  // El indicador de Next tapa el logo del sidebar durante la demo.
  devIndicators: false,
};

export default nextConfig;
