import { one, q } from "@/lib/db";
import { audit } from "@/lib/audit";
import { decryptJson } from "@/lib/crypto";
import { interviewGuide } from "@/lib/search";
import type { SessionUser } from "@/lib/auth";
import type { Pii } from "@/lib/pipeline/anonymize";

// Eventos salientes hacia n8n (o Zapier, Make...). Sin N8N_WEBHOOK_URL no se envía nada.
// No viaja PII: perfil anonimizado y links a la ficha, donde cada rol ve lo que le corresponde.
// Única excepción: al agendar una entrevista viaja el email del candidato, solo para la invitación de Calendar,
// porque lo pidió una persona; queda auditado. CANDIDATE_EMAIL_OVERRIDE lo redirige a una casilla de demo.

export type DecisionEvent = "candidate.shortlisted" | "candidate.selected";

/** Base de los links cuando no hay request (pipeline, jobs). */
export const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";

export async function emit(event: string, payload: Record<string, unknown>): Promise<boolean> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event, at: new Date().toISOString(), ...payload }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.warn(`[webhook] ${event}: HTTP ${res.status}`);
    return res.ok;
  } catch (e) {
    // La decisión ya quedó guardada y auditada: un receptor caído no la revierte.
    console.warn(`[webhook] ${event}: ${e instanceof Error ? e.message : e}`);
    return false;
  }
}

/** Perfil anonimizado para los avisos: titular, seniority, años, país, top skills y link a la ficha. */
async function candidatesFor(tenantId: string, ids: string[], origin: string) {
  const rows = await q<{ id: string; headline: string; seniority: string | null; total_years: string | null; country: string | null; skills: string[] | null }>(
    `SELECT c.id, c.headline, c.seniority, c.total_years, c.country,
            (SELECT array_agg(skill ORDER BY years DESC) FROM (SELECT skill, years FROM candidate_skills WHERE candidate_id = c.id ORDER BY years DESC LIMIT 5) t) AS skills
       FROM candidates c WHERE c.id = ANY($1::uuid[]) AND c.tenant_id = $2`,
    [ids, tenantId],
  );
  return rows.map((c) => ({
    id: c.id,
    headline: c.headline,
    seniority: c.seniority,
    years: c.total_years === null ? null : Number(c.total_years),
    country: c.country,
    skills: c.skills ?? [],
    url: `${origin}/candidates?c=${c.id}`,
  }));
}

async function inviteEmail(tenantId: string, candidateId: string): Promise<{ email: string | null; redirected: boolean }> {
  const override = process.env.CANDIDATE_EMAIL_OVERRIDE?.trim();
  if (override) return { email: override, redirected: true };
  const row = await one<{ ciphertext: string }>(
    "SELECT p.ciphertext FROM candidate_pii p JOIN candidates c ON c.id = p.candidate_id WHERE p.candidate_id = $1 AND c.tenant_id = $2",
    [candidateId, tenantId],
  );
  try {
    return { email: row ? decryptJson<Pii>(row.ciphertext).emails[0] ?? null : null, redirected: false };
  } catch (e) {
    // Sin clave o PII ilegible: la entrevista se agenda igual, sin invitación
    console.warn("[webhook] no se pudo leer el contacto:", e instanceof Error ? e.message : e);
    return { email: null, redirected: false };
  }
}

export async function emitDecision(e: {
  event: DecisionEvent;
  user: SessionUser;
  searchId: string;
  candidateIds: string[];
  reason?: string;
  againstAi: boolean;
  interview?: { start: string; minutes: number };
  lang: "en" | "es";
  origin: string;
}) {
  if (!process.env.N8N_WEBHOOK_URL) return;
  const search = await one<{ query: string; opening_id: string | null; opening_title: string | null }>(
    `SELECT s.query, o.id AS opening_id, o.title AS opening_title FROM searches s LEFT JOIN openings o ON o.id = s.opening_id
      WHERE s.id = $1 AND s.tenant_id = $2`,
    [e.searchId, e.user.tenantId],
  );
  // Con entrevista: guía para el reclutador (IA o reglas) e invitación al candidato
  let interview = null;
  if (e.interview) {
    const candidateId = e.candidateIds[0];
    const [guide, invite] = await Promise.all([
      interviewGuide({ tenantId: e.user.tenantId, searchId: e.searchId, candidateId, lang: e.lang }),
      inviteEmail(e.user.tenantId, candidateId),
    ]);
    interview = {
      start: e.interview.start,
      end: new Date(Date.parse(e.interview.start) + e.interview.minutes * 60_000).toISOString(),
      minutes: e.interview.minutes,
      invite: invite.email,
      inviteRedirected: invite.redirected,
      guide,
    };
  }
  const sent = await emit(e.event, {
    by: e.user.name,
    reason: e.reason?.trim() || null,
    againstAi: e.againstAi,
    interview,
    search: { id: e.searchId, query: search?.query ?? null },
    opening: search?.opening_id ? { id: search.opening_id, title: search.opening_title, url: `${e.origin}/openings/${search.opening_id}` } : null,
    candidates: await candidatesFor(e.user.tenantId, e.candidateIds, e.origin),
  });
  if (sent && interview?.invite) {
    await audit({
      tenantId: e.user.tenantId, userId: e.user.id, action: "invite_candidate", candidateId: e.candidateIds[0], searchId: e.searchId,
      detail: { channel: "calendar", redirected: interview.inviteRedirected },
    });
  }
}

/** CV nuevo que se parece a los elegidos de una vacante abierta: aviso proactivo, sin que nadie haya buscado. */
export async function emitOpeningMatch(e: {
  tenantId: string;
  opening: { id: string; title: string };
  candidateId: string;
  similarity: number;
  fit?: { meetsMandatory: boolean; niceMet: string; fit: number };
}) {
  if (!process.env.N8N_WEBHOOK_URL) return;
  const origin = appUrl();
  const [candidate] = await candidatesFor(e.tenantId, [e.candidateId], origin);
  if (!candidate) return;
  await emit("opening.match", {
    opening: { ...e.opening, url: `${origin}/openings/${e.opening.id}` },
    candidate,
    similarity: Math.round(e.similarity * 100),
    meetsMandatory: e.fit?.meetsMandatory ?? true,
    niceMet: e.fit?.niceMet ?? null,
    fit: e.fit?.fit ?? null,
  });
}
