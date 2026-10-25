import { after } from "next/server";
import { z } from "zod";
import { one, q } from "@/lib/db";
import { apiUser, can } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { body, fail, handle, ok, unauthorized } from "@/lib/http";
import { getLang } from "@/lib/i18n";
import { emitDecision } from "@/lib/webhooks";

// La decisión es SIEMPRE humana. Si contradice a la IA (preseleccionar a alguien marcado
// como "no cumple obligatorios"), se exige un motivo: es la mejor señal para mejorar el ranking.
const Schema = z.object({
  searchId: z.string().uuid(),
  candidateIds: z.array(z.string().uuid()).min(1).max(500),
  status: z.enum(["selected", "shortlisted", "discarded", "none"]),
  reason: z.string().max(500).optional(),
  againstAi: z.boolean().default(false),
  // Solo al seleccionar a un candidato: día y horario que eligió el reclutador
  interview: z.object({ start: z.iso.datetime(), minutes: z.number().int().min(15).max(240) }).optional(),
});

const ACTION = { selected: "select", shortlisted: "shortlist", discarded: "discard", none: "clear" } as const;

export const POST = handle(async (req: Request) => {
  const user = await apiUser();
  if (!user) return unauthorized();
  if (!can.decide(user.role)) return fail(403, "Tu rol no puede tomar decisiones");
  const input = await body(req, Schema);
  if (input.againstAi && input.status !== "discarded" && !input.reason?.trim()) return fail(400, "Indicá un motivo");
  if (input.interview) {
    if (input.status !== "selected" || input.candidateIds.length !== 1) return fail(400, "La entrevista se agenda al seleccionar a un candidato");
    if (Date.parse(input.interview.start) < Date.now() - 60_000) return fail(400, "Elegí un horario futuro");
  }

  const s = await one<{ id: string; opening_status: string | null }>(
    `SELECT s.id, o.status AS opening_status FROM searches s LEFT JOIN openings o ON o.id = s.opening_id
      WHERE s.id = $1 AND s.tenant_id = $2`,
    [input.searchId, user.tenantId],
  );
  if (!s) return fail(404, "Búsqueda inexistente");
  if (s.opening_status === "closed") return fail(409, "La vacante está cerrada");

  for (const candidateId of input.candidateIds) {
    if (input.status === "none") {
      await q("DELETE FROM decisions WHERE search_id = $1 AND candidate_id = $2", [input.searchId, candidateId]);
    } else {
      await q(
        `INSERT INTO decisions (search_id, candidate_id, status, reason, user_id, interview_at, interview_minutes) VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (search_id, candidate_id) DO UPDATE SET status = EXCLUDED.status, reason = EXCLUDED.reason,
           user_id = EXCLUDED.user_id, interview_at = EXCLUDED.interview_at, interview_minutes = EXCLUDED.interview_minutes, updated_at = now()`,
        [input.searchId, candidateId, input.status, input.reason ?? null, user.id, input.interview?.start ?? null, input.interview?.minutes ?? null],
      );
    }
    await audit({
      tenantId: user.tenantId, userId: user.id, action: ACTION[input.status],
      candidateId, searchId: input.searchId,
      detail: { reason: input.reason ?? null, againstAi: input.againstAi, bulk: input.candidateIds.length > 1, interview: input.interview?.start ?? null },
    });
  }

  // Aviso a n8n (Slack, Calendar...) después de responder: no demora la UI ni puede romper la decisión.
  // Con entrevista, n8n crea el evento con Meet en el horario elegido; sin ella, solo avisa.
  if (input.status === "shortlisted" || input.status === "selected") {
    const event = input.status === "selected" ? "candidate.selected" : "candidate.shortlisted";
    const origin = new URL(req.url).origin;
    const lang = await getLang(); // la guía de entrevista sale en el idioma de la UI
    after(() => emitDecision({
      event, user, searchId: input.searchId, candidateIds: input.candidateIds, reason: input.reason, againstAi: input.againstAi,
      interview: input.interview, lang, origin,
    }));
  }
  return ok({ ok: true });
});

export const GET = handle(async (req: Request) => {
  const user = await apiUser();
  if (!user) return unauthorized();
  const searchId = new URL(req.url).searchParams.get("searchId");
  if (!searchId) return fail(400, "Falta searchId");
  return ok({
    decisions: await q(
      `SELECT d.candidate_id, d.status, d.reason, d.interview_at, d.updated_at FROM decisions d JOIN searches s ON s.id = d.search_id
        WHERE d.search_id = $1 AND s.tenant_id = $2`,
      [searchId, user.tenantId],
    ),
  });
});
