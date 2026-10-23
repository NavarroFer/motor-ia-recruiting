import { q } from "@/lib/db";

export async function audit(e: {
  tenantId: string;
  userId?: string | null;
  action: string;
  candidateId?: string | null;
  searchId?: string | null;
  detail?: Record<string, unknown>;
}) {
  await q(
    "INSERT INTO audit_log (tenant_id, user_id, action, candidate_id, search_id, detail) VALUES ($1,$2,$3,$4,$5,$6::jsonb)",
    [e.tenantId, e.userId ?? null, e.action, e.candidateId ?? null, e.searchId ?? null, JSON.stringify(e.detail ?? {})],
  );
}
