import { one, q } from "@/lib/db";

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await one<{ value: T }>("SELECT value FROM settings WHERE key = $1", [key]);
  return row ? row.value : fallback;
}

export async function setSetting(key: string, value: unknown) {
  await q(
    `INSERT INTO settings (key, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, JSON.stringify(value)],
  );
}

/** Interruptor global: si está apagado no se llama a ningún modelo. Arranca APAGADO. */
export const apiEnabled = () => getSetting<boolean>("api_enabled", false);
export const setApiEnabled = (on: boolean) => setSetting("api_enabled", on);
