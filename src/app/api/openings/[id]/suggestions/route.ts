import { apiUser } from "@/lib/auth";
import { fail, handle, ok, unauthorized } from "@/lib/http";
import { getOpening } from "@/lib/openings";
import { markAlertsSeen, suggestForOpening } from "@/lib/learning";

type Ctx = { params: Promise<{ id: string }> };

/** "Más como estos": sugerencias aprendidas de las decisiones de la vacante. Lectura: marca los avisos como vistos. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const opening = await getOpening(user.tenantId, id);
  if (!opening) return fail(404, "Vacante inexistente");
  const out = await suggestForOpening({ tenantId: user.tenantId, openingId: id });
  await markAlertsSeen(id);
  return ok(out);
});
