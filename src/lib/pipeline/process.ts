import { one, q, toVector } from "@/lib/db";
import { encryptJson, lookupHash } from "@/lib/crypto";
import { callTool } from "@/lib/ai/anthropic";
import { embed } from "@/lib/ai/embeddings";
import { EXTRACT_SYSTEM, EXTRACT_TOOL, PROMPT_VERSION, type ExtractedProfile } from "@/lib/ai/prompts";
import { MODELS } from "@/lib/pricing";
import { canSpend } from "@/lib/usage";
import { alertOpeningsForCandidate } from "@/lib/learning";
import { anonymize, type Pii } from "@/lib/pipeline/anonymize";
import { extractText, MAX_CHARS } from "@/lib/pipeline/extract";
import { readFile } from "@/lib/pipeline/storage";

interface DocRow {
  id: string;
  tenant_id: string;
  file_name: string;
  mime_type: string;
  sha256: string;
  storage_path: string;
}

async function setStatus(id: string, status: string, error: string | null = null) {
  await q("UPDATE documents SET status = $2, error = $3, updated_at = now() WHERE id = $1", [id, status, error]);
}

export type ProcessResult =
  | { ok: true; candidateId: string; duplicateOf?: string }
  | { ok: false; waiting: "api_disabled" | "budget_exhausted" }
  | { ok: false; error: string };

/** Texto que se embebe: perfil anonimizado, nunca el CV crudo. */
export function profileToEmbeddingText(p: ExtractedProfile): string {
  const skills = p.skills.map((s) => `${s.name} (${s.years}y)`).join(", ");
  const roles = p.experience.map((e) => `${e.title}${e.company_type ? ` in ${e.company_type}` : ""}`).join("; ");
  const lead = (p.leadership ?? []).map((l) => l.evidence).join("; ");
  return `${p.headline}. ${p.seniority}, ${p.total_years} years. Skills: ${skills}. Roles: ${roles}. Leadership: ${lead}. ${p.summary}`;
}

/** El esquema marca campos obligatorios, pero el modelo puede omitir alguno: se completan con valores neutros. */
export function normalizeProfile(raw: Partial<ExtractedProfile>): ExtractedProfile {
  const skills = (raw.skills ?? []).filter((s) => s?.name).map((s) => ({ ...s, years: Number(s.years) || 0 }));
  const experience = (raw.experience ?? []).filter((e) => e?.title);
  const headline = raw.headline?.trim() || experience[0]?.title || "Sin título";
  return {
    ...raw,
    headline,
    seniority: raw.seniority || "unknown",
    total_years: Number(raw.total_years) || 0,
    work_mode: raw.work_mode || "unknown",
    skills,
    experience,
    summary: raw.summary?.trim() || `${headline}. ${skills.slice(0, 5).map((s) => s.name).join(", ")}`.trim(),
    source_language: raw.source_language || "unknown",
  } as ExtractedProfile;
}

/** Inserta el perfil, sus skills, la PII cifrada y el embedding. Lo usan el pipeline y el seed. */
export async function saveCandidate(opts: {
  tenantId: string;
  documentId: string | null;
  profile: ExtractedProfile;
  pii: Pii;
  embedding: number[] | null;
  sourceHash: string | null;
}): Promise<{ candidateId: string; duplicateOf?: string }> {
  const p = normalizeProfile(opts.profile);
  const emailHash = opts.pii.emails[0] ? lookupHash(opts.pii.emails[0]) : null;
  const phoneHash = opts.pii.phones[0] ? lookupHash(opts.pii.phones[0].replace(/\D/g, "")) : null;

  // Deduplicación de PERSONA (no de archivo): se sugiere, no se fusiona sola.
  let duplicateOf: string | undefined;
  if (emailHash || phoneHash) {
    const dup = await one<{ candidate_id: string }>(
      `SELECT p.candidate_id FROM candidate_pii p JOIN candidates c ON c.id = p.candidate_id
        WHERE c.tenant_id = $1 AND ((p.email_hash IS NOT NULL AND p.email_hash = $2) OR (p.phone_hash IS NOT NULL AND p.phone_hash = $3))
        LIMIT 1`,
      [opts.tenantId, emailHash, phoneHash],
    );
    duplicateOf = dup?.candidate_id;
  }

  const row = await one<{ id: string }>(
    `INSERT INTO candidates (tenant_id, document_id, headline, seniority, total_years, country, work_mode, industries,
                             languages, education, experience, leadership, summary, profile_json, embedding, model, prompt_version, source_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14::jsonb,$15::vector,$16,$17,$18)
     RETURNING id`,
    [
      opts.tenantId, opts.documentId, p.headline, p.seniority, p.total_years, p.country || null,
      p.work_mode === "unknown" ? null : p.work_mode, p.industries ?? [],
      JSON.stringify(p.languages ?? []), JSON.stringify(p.education ?? []), JSON.stringify(p.experience ?? []),
      JSON.stringify(p.leadership ?? []), p.summary, JSON.stringify(p),
      opts.embedding ? toVector(opts.embedding) : null, MODELS.extraction, PROMPT_VERSION, opts.sourceHash,
    ],
  );
  const candidateId = row!.id;

  // Una fila por skill (si el modelo repite una, queda la de más años)
  const bySkill = new Map<string, { years: number; evidence?: string }>();
  for (const s of p.skills) {
    const name = s.name.trim().toLowerCase();
    if (!name) continue;
    const prev = bySkill.get(name);
    if (!prev || s.years > prev.years) bySkill.set(name, { years: Math.max(0, Number(s.years) || 0), evidence: s.evidence });
  }
  for (const [skill, v] of bySkill) {
    await q("INSERT INTO candidate_skills (candidate_id, skill, years, evidence) VALUES ($1,$2,$3,$4)", [
      candidateId, skill, v.years, v.evidence ?? null,
    ]);
  }

  await q("INSERT INTO candidate_pii (candidate_id, ciphertext, email_hash, phone_hash) VALUES ($1,$2,$3,$4)", [
    candidateId, encryptJson(opts.pii), emailHash, phoneHash,
  ]);

  if (opts.documentId) {
    await q("UPDATE documents SET candidate_id = $2, duplicate_of = $3 WHERE id = $1", [opts.documentId, candidateId, duplicateOf ?? null]);
  }
  return { candidateId, duplicateOf };
}

/** Pipeline completo de un documento. Respeta el interruptor de la API y el presupuesto. */
export async function processDocument(documentId: string): Promise<ProcessResult> {
  const doc = await one<DocRow>("SELECT id, tenant_id, file_name, mime_type, sha256, storage_path FROM documents WHERE id = $1", [documentId]);
  if (!doc) return { ok: false, error: "Documento inexistente" };

  const gate = await canSpend(doc.tenant_id);
  if (!gate.ok) {
    await setStatus(doc.id, gate.reason === "api_disabled" ? "paused" : "queued_budget");
    return { ok: false, waiting: gate.reason };
  }

  try {
    // 1. Texto sin IA
    await setStatus(doc.id, "extracting");
    const extracted = await extractText(readFile(doc.storage_path), doc.mime_type);

    // 2. Anonimizar + 3. estructurar
    await setStatus(doc.id, "structuring");
    let profile: ExtractedProfile;
    let pii: Pii = { emails: [], phones: [], links: [] };

    if (extracted.kind === "text") {
      const anon = anonymize(extracted.text.slice(0, MAX_CHARS));
      pii = anon.pii;
      profile = await callTool<ExtractedProfile>({
        tenantId: doc.tenant_id, kind: "ingest", documentId: doc.id,
        system: EXTRACT_SYSTEM, tool: EXTRACT_TOOL, maxTokens: 2000,
        content: [{ type: "text", text: anon.text }],
      });
    } else {
      // Sin capa de texto: visión. En producción esto pasa por OCR (Textract) y luego por anonimización,
      // para que el modelo tampoco vea la PII de las imágenes.
      const block =
        extracted.mediaType === "application/pdf"
          ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: extracted.base64 } }
          : { type: "image", source: { type: "base64", media_type: extracted.mediaType, data: extracted.base64 } };
      profile = await callTool<ExtractedProfile>({
        tenantId: doc.tenant_id, kind: "ingest_vision", documentId: doc.id,
        system: EXTRACT_SYSTEM + "\nThe résumé is an image: ignore any personal data you see in it.",
        tool: EXTRACT_TOOL, maxTokens: 2000,
        content: [block, { type: "text", text: "Extract the profile." }],
      });
    }

    if (!profile.skills?.length) throw new Error("Perfil incompleto: el modelo no devolvió skills");
    profile = normalizeProfile(profile);

    // 4. Embedding del perfil anonimizado. Si falla (sin créditos, caída), se indexa igual sin vector:
    //    la búsqueda usa coincidencia de skills para ese perfil y se puede re-embeber después.
    let vector: number[] | null = null;
    try {
      vector = await embed(profileToEmbeddingText(profile), { tenantId: doc.tenant_id, documentId: doc.id });
    } catch (e) {
      console.warn("[pipeline] embedding falló, indexo sin vector:", e instanceof Error ? e.message.slice(0, 200) : e);
    }

    // 5. Indexar
    const saved = await saveCandidate({ tenantId: doc.tenant_id, documentId: doc.id, profile, pii, embedding: vector, sourceHash: doc.sha256 });
    await setStatus(doc.id, saved.duplicateOf ? "duplicate" : "indexed");
    // Aprendizaje: avisa a las vacantes donde este perfil se parece a lo que ya eligieron (no gasta tokens)
    if (vector) {
      try {
        await alertOpeningsForCandidate(doc.tenant_id, saved.candidateId);
      } catch (e) {
        console.warn("[pipeline] alertas de vacantes:", e instanceof Error ? e.message : e);
      }
    }
    return { ok: true, ...saved };
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 500) : String(e);
    await setStatus(doc.id, "error", msg);
    return { ok: false, error: msg };
  }
}
