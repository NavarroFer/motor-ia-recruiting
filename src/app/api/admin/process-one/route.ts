import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { body, fail, handle, ok } from "@/lib/http";
import { runOne } from "@/lib/pipeline/queue";
import { apiEnabled } from "@/lib/settings";

// "Procesar 1 CV ahora": el momento central de la demo. Procesa un único documento en cola.
const Schema = z.object({ documentId: z.string().uuid().optional() });

export const POST = handle(async (req: Request) => {
  const user = await apiUser(["admin"]);
  if (!user) return fail(403, "Solo admin");
  if (!(await apiEnabled())) return fail(409, "Activá la API primero");
  const { documentId } = await body(req, Schema);
  const t0 = Date.now();
  const r = await runOne(documentId);
  return ok({ ...r, durationMs: Date.now() - t0 });
});
