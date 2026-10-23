import { one, q } from "@/lib/db";
import { apiEnabled } from "@/lib/settings";

export type UsageKind = "ingest" | "ingest_vision" | "query_parse" | "explain" | "embedding";

export async function recordUsage(u: {
  tenantId: string;
  kind: UsageKind;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  documentId?: string | null;
  searchId?: string | null;
}) {
  await q(
    `INSERT INTO usage (tenant_id, kind, model, input_tokens, output_tokens, cost_usd, document_id, search_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [u.tenantId, u.kind, u.model, u.inputTokens, u.outputTokens, u.costUsd, u.documentId ?? null, u.searchId ?? null],
  );
}

export interface BudgetStatus {
  budgetUsd: number;
  spentUsd: number;
  remainingUsd: number;
  pct: number;
  level: "ok" | "warn50" | "warn80" | "exhausted";
}

/** Gasto del mes calendario en curso contra el presupuesto del cliente. */
export async function budgetStatus(tenantId: string): Promise<BudgetStatus> {
  const row = await one<{ budget: string; spent: string }>(
    `SELECT t.monthly_budget_usd AS budget,
            COALESCE((SELECT SUM(cost_usd) FROM usage u
                      WHERE u.tenant_id = t.id AND u.created_at >= date_trunc('month', now())), 0) AS spent
       FROM tenants t WHERE t.id = $1`,
    [tenantId],
  );
  const budgetUsd = Number(row?.budget ?? 0);
  const spentUsd = Number(row?.spent ?? 0);
  const pct = budgetUsd > 0 ? spentUsd / budgetUsd : 1;
  const level = pct >= 1 ? "exhausted" : pct >= 0.8 ? "warn80" : pct >= 0.5 ? "warn50" : "ok";
  return { budgetUsd, spentUsd, remainingUsd: Math.max(0, budgetUsd - spentUsd), pct, level };
}

export type Gate = { ok: true } | { ok: false; reason: "api_disabled" | "budget_exhausted" };

/** Antes de cualquier llamada a un modelo: interruptor global + presupuesto del cliente. */
export async function canSpend(tenantId: string): Promise<Gate> {
  if (!(await apiEnabled())) return { ok: false, reason: "api_disabled" };
  const b = await budgetStatus(tenantId);
  if (b.level === "exhausted") return { ok: false, reason: "budget_exhausted" };
  return { ok: true };
}
