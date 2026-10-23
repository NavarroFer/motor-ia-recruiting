import { q } from "@/lib/db";
import type { Requirements } from "@/lib/ai/prompts";
import { meetingMandatory } from "@/lib/search";

/**
 * Aprendizaje a partir de las decisiones humanas (sin tokens: solo vectores que ya existen).
 * - Positivos: preseleccionados y seleccionados de la vacante. Negativos: descartados.
 * - Puntaje de sugerencia = parecido al promedio de positivos − 0,5 × parecido al promedio de negativos.
 * - Solo se sugiere a quien cumple los obligatorios y todavía no tiene decisión: no reemplaza el criterio del recruiter.
 * - Los vectores salen del perfil anonimizado: nombre, edad u origen nunca entran en esta cuenta.
 */
export const MIN_POSITIVES = 2;
const NEG_WEIGHT = 0.5;
const ALERT_RATIO = 0.85; // un CV nuevo avisa si se parece al menos 85% de lo que se parecen entre sí los elegidos

export interface Suggestion {
  candidateId: string;
  headline: string;
  seniority: string | null;
  similarity: number; // 0-100, parecido al promedio de los elegidos
  likePositives: string[]; // headlines de los elegidos más parecidos
  isNew: boolean; // llegó después de las decisiones (alerta sin ver)
}
export type SuggestionsOutput =
  | { ready: false; reason: "few_decisions" | "no_vectors"; positives: number; needed: number }
  | { ready: true; positives: number; negatives: number; suggestions: Suggestion[] };

type Row = { id: string; headline: string; seniority: string | null; sim_pos: number; sim_neg: number | null; like_pos: string[] | null };

/** Estado del aprendizaje de una búsqueda: cuántos positivos con vector hay y el umbral adaptativo. */
async function profile(searchId: string) {
  const [s] = await q<{ pos: string; pos_vec: string; neg: string; floor: number | null }>(
    `WITH pos AS (SELECT c.embedding FROM decisions d JOIN candidates c ON c.id = d.candidate_id
                   WHERE d.search_id = $1 AND d.status IN ('selected','shortlisted')),
          pc AS (SELECT avg(embedding) v FROM pos WHERE embedding IS NOT NULL)
     SELECT (SELECT count(*) FROM pos) AS pos,
            (SELECT count(*) FROM pos WHERE embedding IS NOT NULL) AS pos_vec,
            (SELECT count(*) FROM decisions WHERE search_id = $1 AND status = 'discarded') AS neg,
            (SELECT min(1 - (p.embedding <=> pc.v)) FROM pos p, pc WHERE p.embedding IS NOT NULL) AS floor`,
    [searchId],
  );
  return { positives: Number(s.pos), withVector: Number(s.pos_vec), negatives: Number(s.neg), floor: s.floor === null ? null : Number(s.floor) };
}

async function rank(tenantId: string, searchId: string, candidateIds: string[]): Promise<Row[]> {
  if (!candidateIds.length) return [];
  return q<Row>(
    `WITH pos AS (SELECT c.headline, c.embedding FROM decisions d JOIN candidates c ON c.id = d.candidate_id
                   WHERE d.search_id = $1 AND d.status IN ('selected','shortlisted') AND c.embedding IS NOT NULL),
          neg AS (SELECT c.embedding FROM decisions d JOIN candidates c ON c.id = d.candidate_id
                   WHERE d.search_id = $1 AND d.status = 'discarded' AND c.embedding IS NOT NULL),
          pc AS (SELECT avg(embedding) v FROM pos),
          nc AS (SELECT avg(embedding) v, count(*) n FROM neg)
     SELECT c.id, c.headline, c.seniority,
            1 - (c.embedding <=> pc.v) AS sim_pos,
            CASE WHEN nc.n > 0 THEN 1 - (c.embedding <=> nc.v) END AS sim_neg,
            (SELECT json_agg(x.headline) FROM (SELECT p.headline FROM pos p ORDER BY p.embedding <=> c.embedding LIMIT 2) x) AS like_pos
       FROM candidates c, pc, nc
      WHERE c.tenant_id = $2 AND c.embedding IS NOT NULL AND c.id = ANY($3::uuid[])
        AND NOT EXISTS (SELECT 1 FROM decisions d WHERE d.search_id = $1 AND d.candidate_id = c.id)`,
    [searchId, tenantId, candidateIds],
  );
}

const learned = (r: Row) => Number(r.sim_pos) - (r.sim_neg === null ? 0 : NEG_WEIGHT * Number(r.sim_neg));

/** "Más como estos": sugerencias para una vacante a partir de lo que ya eligió el recruiter. */
export async function suggestForOpening(opts: { tenantId: string; openingId: string }): Promise<SuggestionsOutput> {
  const [op] = await q<{ search_id: string; requirements: Requirements }>(
    "SELECT search_id, requirements FROM openings WHERE id = $1 AND tenant_id = $2",
    [opts.openingId, opts.tenantId],
  );
  if (!op) throw new Error("Vacante inexistente");
  const p = await profile(op.search_id);
  if (p.positives < MIN_POSITIVES) return { ready: false, reason: "few_decisions", positives: p.positives, needed: MIN_POSITIVES };
  if (p.withVector < MIN_POSITIVES || p.floor === null) return { ready: false, reason: "no_vectors", positives: p.positives, needed: MIN_POSITIVES };

  // Solo candidatos que cumplen los obligatorios de la vacante
  const eligible = await meetingMandatory(opts.tenantId, op.requirements);
  const rows = await rank(opts.tenantId, op.search_id, eligible);
  const fresh = new Set(
    (await q<{ candidate_id: string }>("SELECT candidate_id FROM opening_alerts WHERE opening_id = $1 AND seen_at IS NULL", [opts.openingId])).map((r) => r.candidate_id),
  );
  const suggestions = rows
    .sort((a, b) => learned(b) - learned(a))
    .slice(0, 5)
    .map((r) => ({
      candidateId: r.id, headline: r.headline, seniority: r.seniority,
      similarity: Math.round(Math.max(0, Number(r.sim_pos)) * 100),
      likePositives: r.like_pos ?? [], isNew: fresh.has(r.id),
    }));
  return { ready: true, positives: p.positives, negatives: p.negatives, suggestions };
}

export async function markAlertsSeen(openingId: string) {
  await q("UPDATE opening_alerts SET seen_at = now() WHERE opening_id = $1 AND seen_at IS NULL", [openingId]);
}

/** Al indexar un CV nuevo: avisa a las vacantes abiertas donde se parece a lo que ya eligieron y cumple obligatorios. */
export async function alertOpeningsForCandidate(tenantId: string, candidateId: string) {
  const openings = await q<{ id: string; search_id: string; requirements: Requirements }>(
    "SELECT id, search_id, requirements FROM openings WHERE tenant_id = $1 AND status = 'open'",
    [tenantId],
  );
  let alerts = 0;
  for (const op of openings) {
    const p = await profile(op.search_id);
    if (p.withVector < MIN_POSITIVES || p.floor === null) continue;
    const [row] = await rank(tenantId, op.search_id, [candidateId]);
    if (!row || Number(row.sim_pos) < p.floor * ALERT_RATIO) continue;
    if (!(await meetingMandatory(tenantId, op.requirements, [candidateId])).length) continue;
    await q(
      `INSERT INTO opening_alerts (opening_id, candidate_id, similarity) VALUES ($1,$2,$3)
       ON CONFLICT (opening_id, candidate_id) DO NOTHING`,
      [op.id, candidateId, Number(row.sim_pos)],
    );
    alerts++;
  }
  return alerts;
}
