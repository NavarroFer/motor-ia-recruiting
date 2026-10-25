import { readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import path from "node:path";

/** Interfaz mínima común a pg.Pool y PGlite. */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

const SCHEMA_PATH = path.join(process.cwd(), "src/lib/db/schema.sql");

// Una sola instancia por proceso (sobrevive al hot reload de Next).
const g = globalThis as unknown as { __motorDb?: Promise<Db> };

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, max: 10 });
    // La búsqueda pide los 200 más cercanos: HNSW devuelve como máximo ef_search (40 por defecto).
    // iterative_scan (pgvector 0.8+) sigue buscando cuando el filtro por tenant descarta resultados.
    pool.on("connect", (c) => {
      c.query("SET hnsw.ef_search = 200; SET hnsw.iterative_scan = relaxed_order").catch(() => {});
    });
    return pool as unknown as Db;
  }
  // Sin DATABASE_URL: Postgres embebido (PGlite) con pgvector, persistido en ./.data
  const { PGlite } = await import("@electric-sql/pglite");
  const { vector } = await import("@electric-sql/pglite-pgvector");
  const dir = path.join(process.cwd(), ".data", "pglite");
  mkdirSync(dir, { recursive: true });
  const pg = new PGlite(dir, { extensions: { vector } });
  await pg.waitReady;
  return pg as unknown as Db;
}

export function db(): Promise<Db> {
  if (!g.__motorDb) {
    g.__motorDb = (async () => {
      const conn = await connect();
      await migrate(conn);
      return conn;
    })();
  }
  return g.__motorDb;
}

async function migrate(conn: Db) {
  const sql = readFileSync(SCHEMA_PATH, "utf8");
  // PGlite necesita exec() para varias sentencias; pg las acepta en query() sin parámetros.
  const maybeExec = conn as unknown as { exec?: (s: string) => Promise<unknown> };
  if (typeof maybeExec.exec === "function") await maybeExec.exec(sql);
  else await conn.query(sql);
}

/** Atajo: devuelve las filas. */
export async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const conn = await db();
  return (await conn.query<T>(sql, params)).rows;
}

export async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

/** pgvector espera el literal "[0.1,0.2,...]". */
export function toVector(v: number[]): string {
  return `[${v.join(",")}]`;
}
