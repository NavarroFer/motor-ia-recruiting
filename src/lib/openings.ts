import { one, q } from "@/lib/db";
import type { Requirements } from "@/lib/ai/prompts";
import { parseQuery, search } from "@/lib/search";

export interface Opening {
  id: string;
  title: string;
  description: string;
  requirements: Requirements;
  search_id: string;
  status: "open" | "closed";
  created_at: string;
  closed_at: string | null;
  retention_until: string | null;
}

/** Crea la vacante: la descripción del puesto se convierte en requisitos (IA si está activa, si no reglas). */
export async function createOpening(opts: { tenantId: string; userId: string; title: string; description: string; requirements?: Requirements }) {
  const parsed = opts.requirements
    ? { req: opts.requirements, by: "manual" as const }
    : await parseQuery(opts.tenantId, `${opts.title}. ${opts.description}`);
  const searchRow = await one<{ id: string }>(
    `INSERT INTO searches (tenant_id, user_id, query, requirements) VALUES ($1,$2,$3,$4::jsonb) RETURNING id`,
    [opts.tenantId, opts.userId, opts.title, JSON.stringify(parsed.req)],
  );
  const opening = await one<{ id: string }>(
    `INSERT INTO openings (tenant_id, title, description, requirements, search_id, created_by)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6) RETURNING id`,
    [opts.tenantId, opts.title, opts.description, JSON.stringify(parsed.req), searchRow!.id, opts.userId],
  );
  await q("UPDATE searches SET opening_id = $2 WHERE id = $1", [searchRow!.id, opening!.id]);
  // Primer ranking: deja calculada la cantidad de candidatos que cumplen para la lista
  await search({ tenantId: opts.tenantId, userId: opts.userId, query: opts.title, requirements: parsed.req, searchId: searchRow!.id });
  return { id: opening!.id, parsedBy: parsed.by };
}

export async function getOpening(tenantId: string, id: string) {
  return one<Opening>(
    `SELECT id, title, description, requirements, search_id, status, created_at, closed_at, retention_until
       FROM openings WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId],
  );
}
