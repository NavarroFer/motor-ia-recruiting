import { z } from "zod";
import { q } from "@/lib/db";
import { apiUser, can } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { body, fail, handle, ok, unauthorized } from "@/lib/http";
import { createOpening } from "@/lib/openings";

export const GET = handle(async () => {
  const user = await apiUser();
  if (!user) return unauthorized();
  const openings = await q(
    `SELECT o.id, o.title, o.status, o.created_at, o.closed_at, o.retention_until, o.requirements,
            s.result_count AS matches,
            (SELECT COUNT(*) FROM decisions d WHERE d.search_id = o.search_id AND d.status = 'shortlisted')::int AS shortlisted,
            (SELECT COUNT(*) FROM decisions d WHERE d.search_id = o.search_id AND d.status = 'selected')::int AS selected,
            (SELECT COUNT(*) FROM opening_alerts a WHERE a.opening_id = o.id AND a.seen_at IS NULL
                AND NOT EXISTS (SELECT 1 FROM decisions d WHERE d.search_id = o.search_id AND d.candidate_id = a.candidate_id))::int AS new_alerts
       FROM openings o JOIN searches s ON s.id = o.search_id
      WHERE o.tenant_id = $1
      ORDER BY (o.status = 'open') DESC, o.created_at DESC`,
    [user.tenantId],
  );
  return ok({ openings });
});

const Schema = z.object({ title: z.string().min(3).max(160), description: z.string().min(10).max(8000) });

export const POST = handle(async (req: Request) => {
  const user = await apiUser();
  if (!user) return unauthorized();
  if (!can.decide(user.role)) return fail(403, "Tu rol no puede crear vacantes");
  const input = await body(req, Schema);
  const created = await createOpening({ tenantId: user.tenantId, userId: user.id, ...input });
  await audit({ tenantId: user.tenantId, userId: user.id, action: "create_opening", detail: { openingId: created.id, title: input.title } });
  return ok(created, 201);
});
