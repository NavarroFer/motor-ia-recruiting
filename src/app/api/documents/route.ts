import JSZip from "jszip";
import { one, q } from "@/lib/db";
import { apiUser, can } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { sha256 } from "@/lib/crypto";
import { fail, handle, ok, unauthorized } from "@/lib/http";
import { isSupported, mimeFromName } from "@/lib/pipeline/extract";
import { enqueueDocument, queueStats } from "@/lib/pipeline/queue";
import { saveFile } from "@/lib/pipeline/storage";

const MAX_FILES = 5000; // cap por lote

/** Sube archivos sueltos o un .zip. Deduplica por hash: un zip subido dos veces no se paga dos veces. */
export const POST = handle(async (req: Request) => {
  const user = await apiUser();
  if (!user) return unauthorized();
  if (!can.upload(user.role)) return fail(403, "Tu rol no puede cargar CVs");

  const form = await req.formData();
  const incoming: { name: string; data: Buffer }[] = [];
  for (const entry of form.getAll("files")) {
    if (!(entry instanceof File)) continue;
    const data = Buffer.from(await entry.arrayBuffer());
    if (entry.name.toLowerCase().endsWith(".zip")) {
      const zip = await JSZip.loadAsync(data);
      for (const f of Object.values(zip.files)) {
        const base = f.name.split("/").pop() ?? f.name;
        if (f.dir || base.startsWith(".") || f.name.startsWith("__MACOSX")) continue;
        incoming.push({ name: base, data: Buffer.from(await f.async("uint8array")) });
      }
    } else incoming.push({ name: entry.name, data });
  }
  if (incoming.length > MAX_FILES) return fail(400, `Máximo ${MAX_FILES} archivos por lote`);

  const summary = { received: 0, duplicates: 0, unsupported: 0 };
  for (const f of incoming) {
    if (!isSupported(f.name)) { summary.unsupported++; continue; }
    const sha = sha256(f.data);
    const dup = await one("SELECT id FROM documents WHERE tenant_id = $1 AND sha256 = $2", [user.tenantId, sha]);
    if (dup) { summary.duplicates++; continue; }
    const path = saveFile(sha, f.name, f.data);
    const doc = await one<{ id: string }>(
      `INSERT INTO documents (tenant_id, file_name, mime_type, size_bytes, sha256, storage_path, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [user.tenantId, f.name, mimeFromName(f.name), f.data.length, sha, path, user.id],
    );
    await enqueueDocument(doc!.id);
    summary.received++;
  }
  await audit({ tenantId: user.tenantId, userId: user.id, action: "upload", detail: summary });
  return ok(summary);
});

export const GET = handle(async () => {
  const user = await apiUser();
  if (!user) return unauthorized();
  const documents = await q(
    `SELECT d.id, d.file_name, d.mime_type, d.size_bytes, d.status, d.error, d.created_at, d.updated_at, d.candidate_id, d.duplicate_of
       FROM documents d WHERE d.tenant_id = $1 ORDER BY d.created_at DESC LIMIT 500`,
    [user.tenantId],
  );
  return ok({ documents, stats: await queueStats(user.tenantId) });
});
