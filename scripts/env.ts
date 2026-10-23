// Carga .env.local / .env para los scripts (Next lo hace solo para la app).
for (const f of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(f);
  } catch {
    /* no existe */
  }
}
