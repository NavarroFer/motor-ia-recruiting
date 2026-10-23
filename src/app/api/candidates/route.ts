import { q } from "@/lib/db";
import { apiUser, can } from "@/lib/auth";
import { decryptJson } from "@/lib/crypto";
import { handle, ok, unauthorized } from "@/lib/http";
import type { Pii } from "@/lib/pipeline/anonymize";

/** Todos los perfiles indexados del cliente. El nombre (PII) solo va a los roles que pueden ver contacto. */
export const GET = handle(async () => {
  const user = await apiUser();
  if (!user) return unauthorized();
  const showNames = can.seeContact(user.role);
  const rows = await q<Record<string, unknown> & { pii: string | null }>(
    `SELECT c.id, c.headline, c.seniority, c.total_years, c.country, c.work_mode, c.created_at,
            (c.embedding IS NOT NULL) AS has_embedding,
            d.file_name, d.status AS doc_status,
            ${showNames ? "p.ciphertext" : "NULL"} AS pii,
            (SELECT json_agg(json_build_object('skill', s.skill, 'years', s.years) ORDER BY s.years DESC)
               FROM (SELECT * FROM candidate_skills WHERE candidate_id = c.id ORDER BY years DESC LIMIT 6) s) AS skills
       FROM candidates c
       LEFT JOIN documents d ON d.id = c.document_id
       LEFT JOIN candidate_pii p ON p.candidate_id = c.id
      WHERE c.tenant_id = $1
      ORDER BY c.created_at DESC`,
    [user.tenantId],
  );
  const candidates = rows.map(({ pii, ...c }) => {
    let name: string | null = null;
    if (pii) {
      try {
        name = decryptJson<Pii>(pii).name ?? null;
      } catch {
        name = null;
      }
    }
    return { ...c, name };
  });
  return ok({ candidates, namesVisible: showNames });
});
