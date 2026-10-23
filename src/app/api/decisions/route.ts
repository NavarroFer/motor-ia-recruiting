import { z } from "zod";
import { one, q } from "@/lib/db";
import { apiUser, can } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { body, fail, handle, ok, unauthorized } from "@/lib/http";

// La decisión es SIEMPRE humana. Si contradice a la IA (preseleccionar a alguien marcado
// como "no cumple obligatorios"), se exige un motivo: es la mejor señal para mejorar el ranking.
const Schema = z.object({
  searchId: z.string().uuid(),
  candidateIds: z.array(z.string().uuid()).min(1).max(500),
  status: z.enum(["selected", "shortlisted", "discarded", "none"]),
  reason: z.string().max(500).optional(),
  againstAi: z.boolean().default(false),
});

const ACTION = { selected: "select", shortlisted: "shortlist", discarded: "discard", none: "clear" } as const;

export const POST = handle(async (req: Request) => {
  const user = await apiUser();
  if (!user) return unauthorized();
  if (!can.decide(user.role)) return fail(403, "Tu rol no puede tomar decisiones");
  const input = await body(req, Schema);
  if (input.againstAi && input.status !== "discarded" && !input.reason?.trim()) return fail(400, "Indicá un motivo");

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
        `INSERT INTO decisions (search_id, candidate_id, status, reason, user_id) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (search_id, candidate_id) DO UPDATE SET status = EXCLUDED.status, reason = EXCLUDED.reason,
           user_id = EXCLUDED.user_id, updated_at = now()`,
        [input.searchId, candidateId, input.status, input.reason ?? null, user.id],
      );
    }
    await audit({
      tenantId: user.tenantId, userId: user.id, action: ACTION[input.status],
      candidateId, searchId: input.searchId, detail: { reason: input.reason ?? null, againstAi: input.againstAi, bulk: input.candidateIds.length > 1 },
    });
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
      `SELECT d.candidate_id, d.status, d.reason, d.updated_at FROM decisions d JOIN searches s ON s.id = d.search_id
        WHERE d.search_id = $1 AND s.tenant_id = $2`,
      [searchId, user.tenantId],
    ),
  });
});
