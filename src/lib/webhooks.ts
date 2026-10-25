import { one, q } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

// Eventos salientes hacia n8n (o Zapier, Make...). Sin N8N_WEBHOOK_URL no se envía nada.
// Nunca viaja PII: solo el perfil anonimizado y un link a la ficha, donde cada rol ve lo que le corresponde.

export type DecisionEvent = "candidate.shortlisted" | "candidate.selected";

export async function emit(event: string, payload: Record<string, unknown>) {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event, at: new Date().toISOString(), ...payload }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.warn(`[webhook] ${event}: HTTP ${res.status}`);
  } catch (e) {
    // La decisión ya quedó guardada y auditada: un receptor caído no la revierte.
    console.warn(`[webhook] ${event}: ${e instanceof Error ? e.message : e}`);
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
  origin: string;
}) {
  if (!process.env.N8N_WEBHOOK_URL) return;
  const search = await one<{ query: string; opening_id: string | null; opening_title: string | null }>(
    `SELECT s.query, o.id AS opening_id, o.title AS opening_title FROM searches s LEFT JOIN openings o ON o.id = s.opening_id
      WHERE s.id = $1 AND s.tenant_id = $2`,
    [e.searchId, e.user.tenantId],
  );
  const candidates = await q<{ id: string; headline: string; seniority: string | null; total_years: string | null; country: string | null; skills: string[] | null }>(
    `SELECT c.id, c.headline, c.seniority, c.total_years, c.country,
            (SELECT array_agg(skill ORDER BY years DESC) FROM (SELECT skill, years FROM candidate_skills WHERE candidate_id = c.id ORDER BY years DESC LIMIT 5) t) AS skills
       FROM candidates c WHERE c.id = ANY($1::uuid[]) AND c.tenant_id = $2`,
    [e.candidateIds, e.user.tenantId],
  );
  await emit(e.event, {
    by: e.user.name,
    reason: e.reason?.trim() || null,
    againstAi: e.againstAi,
    interview: e.interview
      ? { start: e.interview.start, end: new Date(Date.parse(e.interview.start) + e.interview.minutes * 60_000).toISOString(), minutes: e.interview.minutes }
      : null,
    search: { id: e.searchId, query: search?.query ?? null },
    opening: search?.opening_id ? { id: search.opening_id, title: search.opening_title, url: `${e.origin}/openings/${search.opening_id}` } : null,
    candidates: candidates.map((c) => ({
      id: c.id,
      headline: c.headline,
      seniority: c.seniority,
      years: c.total_years === null ? null : Number(c.total_years),
      country: c.country,
      skills: c.skills ?? [],
      url: `${e.origin}/candidates?c=${c.id}`,
    })),
  });
}
