// Datos de demo: 1 cliente, 3 usuarios (uno por rol) y los candidatos precargados.
// Uso: npm run seed            -> carga si la base está vacía
//      npm run seed -- --reset -> borra todo y vuelve a cargar
//      npm run seed -- --embed -> además genera embeddings (requiere OPENAI_API_KEY; cuesta < USD 0,001)
import "./env";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { one, q } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { saveCandidate, profileToEmbeddingText } from "@/lib/pipeline/process";
import { saveFile } from "@/lib/pipeline/storage";
import { setSetting } from "@/lib/settings";
import { embed } from "@/lib/ai/embeddings";
import { PERSONAS } from "../seed/personas";
import { OPENINGS } from "../seed/openings";
import { createOpening } from "@/lib/openings";

const args = new Set(process.argv.slice(2));
export const DEMO_PASSWORD = "demo1234";

async function main() {
  if (args.has("--reset")) {
    await q(`TRUNCATE audit_log, usage, jobs, decisions, explanations, opening_alerts, openings, searches, candidate_pii, candidate_skills,
             candidates, documents, users, tenants, settings RESTART IDENTITY CASCADE`);
    console.log("Base vaciada.");
  }

  let tenant = await one<{ id: string }>("SELECT id FROM tenants LIMIT 1");
  if (!tenant) {
    tenant = await one<{ id: string }>("INSERT INTO tenants (name, monthly_budget_usd) VALUES ('Acme Talent (demo)', 25) RETURNING id");
    const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
    for (const [email, name, role] of [
      ["admin@demo.test", "Ana Admin", "admin"],
      ["recruiter@demo.test", "Rocío Recruiter", "recruiter"],
      ["viewer@demo.test", "Víctor Viewer", "viewer"],
    ]) {
      await q("INSERT INTO users (tenant_id, email, name, role, password_hash) VALUES ($1,$2,$3,$4,$5)", [tenant!.id, email, name, role, hash]);
    }
    await setSetting("api_enabled", false);
    await setSetting("auto_process", false);
    console.log("Cliente y usuarios creados.");
  }
  const tenantId = tenant!.id;

  const existing = await one<{ n: string }>("SELECT COUNT(*) AS n FROM candidates WHERE tenant_id = $1", [tenantId]);
  if (Number(existing?.n) > 0 && !args.has("--reset")) {
    console.log(`Ya hay ${existing?.n} candidatos; no se recargan (usá --reset).`);
  } else {
    const withEmbeddings = args.has("--embed") && !!process.env.OPENAI_API_KEY;
    for (const p of PERSONAS.filter((x) => x.seeded && x.profile)) {
      const pdfPath = path.join(process.cwd(), "seed", "cvs", `${p.slug}.pdf`);
      if (!existsSync(pdfPath)) throw new Error(`Falta ${pdfPath}: corré npm run generate:cvs`);
      const data = readFileSync(pdfPath);
      const sha = sha256(data);
      const storage = saveFile(sha, `${p.slug}.pdf`, data);
      const doc = await one<{ id: string }>(
        `INSERT INTO documents (tenant_id, file_name, mime_type, size_bytes, sha256, storage_path, status)
         VALUES ($1,$2,'application/pdf',$3,$4,$5,'indexed') RETURNING id`,
        [tenantId, `${p.slug}.pdf`, data.length, sha, storage],
      );
      let embedding: number[] | null = null;
      if (withEmbeddings) {
        try {
          embedding = await embed(profileToEmbeddingText(p.profile!), { tenantId, documentId: doc!.id });
        } catch (e) {
          console.warn(`  embedding falló (${e instanceof Error ? e.message.slice(0, 120) : e}); sigo sin vector`);
        }
      }
      await saveCandidate({
        tenantId,
        documentId: doc!.id,
        profile: p.profile!,
        pii: { name: p.pii.name, emails: [p.pii.email], phones: [p.pii.phone], links: [p.pii.linkedin], address: p.pii.location },
        embedding,
        sourceHash: sha,
      });
      console.log(`✓ ${p.slug}${embedding ? " (con embedding)" : ""}`);
    }
    if (!withEmbeddings) console.log("Sin embeddings: la búsqueda usa coincidencia de skills. Para semántica: npm run seed -- --reset --embed");
  }
  const nOpen = await one<{ n: string }>("SELECT COUNT(*) AS n FROM openings WHERE tenant_id = $1", [tenantId]);
  if (Number(nOpen?.n) === 0) {
    const recruiter = await one<{ id: string }>("SELECT id FROM users WHERE tenant_id = $1 AND role = 'recruiter' LIMIT 1", [tenantId]);
    for (const o of OPENINGS) {
      await createOpening({ tenantId, userId: recruiter!.id, ...o });
      console.log(`✓ vacante: ${o.title}`);
    }
  }
  console.log(`\nUsuarios (contraseña: ${DEMO_PASSWORD}): admin@demo.test · recruiter@demo.test · viewer@demo.test`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
