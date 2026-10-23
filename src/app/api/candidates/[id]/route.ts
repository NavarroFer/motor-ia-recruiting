import { one, q } from "@/lib/db";
import { apiUser, can } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { decryptJson } from "@/lib/crypto";
import { fail, handle, ok, unauthorized } from "@/lib/http";
import type { Pii } from "@/lib/pipeline/anonymize";
import { openingsForCandidate } from "@/lib/search";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;

  const c = await one<Record<string, unknown>>(
    `SELECT c.id, c.headline, c.seniority, c.total_years, c.country, c.work_mode, c.industries, c.languages, c.education,
            c.experience, c.leadership, c.summary, c.created_at, c.model, c.prompt_version, d.file_name, d.mime_type, d.id AS document_id
       FROM candidates c LEFT JOIN documents d ON d.id = c.document_id
      WHERE c.id = $1 AND c.tenant_id = $2`,
    [id, user.tenantId],
  );
  if (!c) return fail(404, "Candidato inexistente");
  const skills = await q("SELECT skill, years, evidence FROM candidate_skills WHERE candidate_id = $1 ORDER BY years DESC", [id]);

  // PII: solo roles habilitados, y cada acceso queda auditado
  let contact: Pii | null = null;
  if (can.seeContact(user.role)) {
    const row = await one<{ ciphertext: string }>("SELECT ciphertext FROM candidate_pii WHERE candidate_id = $1", [id]);
    if (row) {
      contact = decryptJson<Pii>(row.ciphertext);
      await audit({ tenantId: user.tenantId, userId: user.id, action: "view_pii", candidateId: id });
    }
  }

  const history = await q(
    `SELECT a.action, a.detail, a.created_at, a.search_id, u.name AS user_name
       FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.candidate_id = $1 AND a.tenant_id = $2 AND a.action <> 'view_pii'
      ORDER BY a.created_at DESC LIMIT 50`,
    [id, user.tenantId],
  );
  const openings = await openingsForCandidate(user.tenantId, id);
  return ok({ candidate: c, skills, contact, contactLocked: !can.seeContact(user.role), history, openings });
});
