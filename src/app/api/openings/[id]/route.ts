import { z } from "zod";
import { q } from "@/lib/db";
import { apiUser, can } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { body, fail, handle, ok, unauthorized } from "@/lib/http";
import { getOpening } from "@/lib/openings";
import { search } from "@/lib/search";

type Ctx = { params: Promise<{ id: string }> };

/** Vacante + ranking actual de candidatos (reutiliza su búsqueda: conserva decisiones y explicaciones). */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const opening = await getOpening(user.tenantId, id);
  if (!opening) return fail(404, "Vacante inexistente");
  const ranking = await search({
    tenantId: user.tenantId, userId: user.id, query: opening.title, requirements: opening.requirements, searchId: opening.search_id,
  });
  return ok({ opening, ranking });
});

const Req = z.object({
  type: z.enum(["skill", "total_years", "seniority", "language", "work_mode"]),
  skill: z.string().optional(), min_years: z.number().optional(), value: z.string().optional(), label: z.string(),
});
const Patch = z.object({
  requirements: z.object({ mandatory: z.array(Req), nice_to_have: z.array(z.object({ skill: z.string().optional(), label: z.string() })), semantic_query: z.string() }).optional(),
  status: z.enum(["open", "closed"]).optional(),
});

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const user = await apiUser();
  if (!user) return unauthorized();
  if (!can.decide(user.role)) return fail(403, "Tu rol no puede editar vacantes");
  const { id } = await ctx.params;
  const opening = await getOpening(user.tenantId, id);
  if (!opening) return fail(404, "Vacante inexistente");
  const input = await body(req, Patch);

  if (input.requirements) {
    if (opening.status === "closed") return fail(409, "La vacante está cerrada");
    await q("UPDATE openings SET requirements = $2::jsonb WHERE id = $1", [id, JSON.stringify(input.requirements)]);
    await search({ tenantId: user.tenantId, userId: user.id, query: opening.title, requirements: input.requirements, searchId: opening.search_id });
  }
  if (input.status === "closed" && opening.status === "open") {
    // Al cerrar arranca el plazo de retención (EEOC: 12 meses desde la decisión)
    await q("UPDATE openings SET status = 'closed', closed_at = now(), retention_until = now() + interval '12 months' WHERE id = $1", [id]);
  }
  if (input.status === "open" && opening.status === "closed") {
    await q("UPDATE openings SET status = 'open', closed_at = NULL, retention_until = NULL WHERE id = $1", [id]);
  }
  await audit({ tenantId: user.tenantId, userId: user.id, action: "update_opening", searchId: opening.search_id, detail: { openingId: id, ...input } });
  return ok({ opening: await getOpening(user.tenantId, id) });
});
