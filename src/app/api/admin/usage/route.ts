import { q } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { fail, handle, ok } from "@/lib/http";
import { queueStats } from "@/lib/pipeline/queue";
import { budgetStatus } from "@/lib/usage";

export const GET = handle(async () => {
  const user = await apiUser(["admin"]);
  if (!user) return fail(403, "Solo admin");
  const byKind = await q<{ kind: string; calls: string; input_tokens: string; output_tokens: string; cost: string }>(
    `SELECT kind, COUNT(*) AS calls, SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens, SUM(cost_usd) AS cost
       FROM usage WHERE tenant_id = $1 AND created_at >= date_trunc('month', now()) GROUP BY kind ORDER BY cost DESC`,
    [user.tenantId],
  );
  const recent = await q(
    `SELECT kind, model, input_tokens, output_tokens, cost_usd, created_at FROM usage WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [user.tenantId],
  );
  const jobs = await q<{ status: string; n: string }>("SELECT status, COUNT(*) AS n FROM jobs GROUP BY status");
  return ok({
    budget: await budgetStatus(user.tenantId),
    byKind: byKind.map((r) => ({ kind: r.kind, calls: Number(r.calls), inputTokens: Number(r.input_tokens), outputTokens: Number(r.output_tokens), costUsd: Number(r.cost) })),
    recent,
    documents: await queueStats(user.tenantId),
    jobs: Object.fromEntries(jobs.map((j) => [j.status, Number(j.n)])),
  });
});
