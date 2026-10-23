import { one, q } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { processDocument } from "@/lib/pipeline/process";

// Cola sobre Postgres para la demo. En producción: SQS + workers que escalan por profundidad de cola.

export async function enqueueDocument(documentId: string) {
  await q("INSERT INTO jobs (kind, payload) VALUES ('process_document', $1::jsonb)", [JSON.stringify({ documentId })]);
}

/** Toma el próximo trabajo pendiente (SKIP LOCKED: varios workers no se pisan). */
async function claim(documentId?: string) {
  return one<{ id: string; payload: { documentId: string }; attempts: number }>(
    `UPDATE jobs SET status = 'running', attempts = attempts + 1, updated_at = now()
      WHERE id = (
        SELECT id FROM jobs
         WHERE status IN ('pending','waiting_budget') AND run_after <= now()
           ${documentId ? "AND payload->>'documentId' = $1" : ""}
         ORDER BY created_at
         FOR UPDATE SKIP LOCKED LIMIT 1)
      RETURNING id, payload, attempts`,
    documentId ? [documentId] : [],
  );
}

/** Procesa un trabajo. Devuelve qué pasó, para el botón "Procesar 1 CV ahora". */
export async function runOne(documentId?: string) {
  const job = await claim(documentId);
  if (!job) return { status: "empty" as const };
  const result = await processDocument(job.payload.documentId);

  if (result.ok) {
    await q("UPDATE jobs SET status = 'done', updated_at = now() WHERE id = $1", [job.id]);
  } else if ("waiting" in result) {
    // Llegó al límite o la API está apagada: espera en cola, no se pierde
    await q("UPDATE jobs SET status = 'waiting_budget', attempts = attempts - 1, updated_at = now() WHERE id = $1", [job.id]);
  } else if (job.attempts < 3) {
    await q(
      "UPDATE jobs SET status = 'pending', last_error = $2, run_after = now() + ($3 || ' seconds')::interval, updated_at = now() WHERE id = $1",
      [job.id, result.error, String(15 * job.attempts)],
    );
  } else {
    await q("UPDATE jobs SET status = 'failed', last_error = $2, updated_at = now() WHERE id = $1", [job.id, result.error]);
  }
  return { status: "processed" as const, documentId: job.payload.documentId, result };
}

// ---------- Worker en segundo plano ----------
const g = globalThis as unknown as { __motorWorker?: boolean; __motorBusy?: boolean };

/** Arranca el loop una vez por proceso. Solo procesa si "procesamiento automático" está activo. */
export function startWorker() {
  if (g.__motorWorker) return;
  g.__motorWorker = true;
  setInterval(async () => {
    if (g.__motorBusy) return;
    g.__motorBusy = true;
    try {
      const auto = await getSetting<boolean>("auto_process", false);
      if (auto) await runOne();
    } catch (e) {
      console.error("[worker]", e);
    } finally {
      g.__motorBusy = false;
    }
  }, 3000);
}

export async function queueStats(tenantId: string) {
  const rows = await q<{ status: string; n: string }>(
    `SELECT d.status, COUNT(*) AS n FROM documents d WHERE d.tenant_id = $1 GROUP BY d.status`,
    [tenantId],
  );
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)])) as Record<string, number>;
}
