import { existsSync } from "node:fs";
import { one } from "@/lib/db";
import { apiUser, can } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, handle, unauthorized } from "@/lib/http";
import { readFile } from "@/lib/pipeline/storage";

/** Sirve el archivo original para previsualizar. Tiene PII sin anonimizar: mismos roles que el contacto, y queda auditado. */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  if (!user) return unauthorized();
  if (!can.seeContact(user.role)) return fail(403, "Tu rol no puede ver el CV original");
  const { id } = await ctx.params;

  const doc = await one<{ file_name: string; mime_type: string; storage_path: string; candidate_id: string | null }>(
    "SELECT file_name, mime_type, storage_path, candidate_id FROM documents WHERE id = $1 AND tenant_id = $2",
    [id, user.tenantId],
  );
  if (!doc) return fail(404, "Documento inexistente");
  if (!existsSync(doc.storage_path)) return fail(404, "El archivo ya no está en el almacenamiento");

  await audit({ tenantId: user.tenantId, userId: user.id, action: "view_pii", candidateId: doc.candidate_id, detail: { documentId: id, original: true } });
  return new Response(new Uint8Array(readFile(doc.storage_path)), {
    headers: {
      "Content-Type": doc.mime_type,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.file_name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
