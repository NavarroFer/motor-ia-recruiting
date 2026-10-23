import { one, q, toVector } from "@/lib/db";
import { callTool } from "@/lib/ai/anthropic";
import { embed } from "@/lib/ai/embeddings";
import { EXPLAIN_SYSTEM, EXPLAIN_TOOL, QUERY_SYSTEM, QUERY_TOOL, type Explanation, type Requirement, type Requirements } from "@/lib/ai/prompts";
import { canSpend } from "@/lib/usage";

// ---------- Normalización de skills ----------
const SYNONYMS: Record<string, string> = {
  "amazon web services": "aws", "google cloud": "gcp", "google cloud platform": "gcp", "microsoft azure": "azure",
  k8s: "kubernetes", golang: "go", node: "node.js", nodejs: "node.js", postgres: "postgresql", js: "javascript", ts: "typescript",
};
// "cloud" se cumple con cualquiera de estas
const GROUPS: Record<string, string[]> = { cloud: ["aws", "gcp", "azure"] };
const LEADERSHIP = ["leadership", "liderazgo", "lead", "people management", "management"];

export const norm = (s: string) => {
  const k = s.trim().toLowerCase();
  return SYNONYMS[k] ?? k;
};

// ---------- Tipos ----------
export type ReqStatus = "met" | "unmet" | "unknown";
export interface ReqCheck {
  label: string;
  status: ReqStatus;
  detail: string; // "Python: 7,3 años"
  mandatory: boolean;
}
export interface Result {
  candidateId: string;
  headline: string;
  seniority: string | null;
  totalYears: number;
  country: string | null;
  workMode: string | null;
  score: number; // 0-100
  checks: ReqCheck[];
  meetsMandatory: boolean;
  topSkills: { skill: string; years: number }[];
}
export interface SearchOutput {
  searchId: string;
  query: string;
  requirements: Requirements;
  parsedBy: "ai" | "rules";
  semantic: boolean;
  durationMs: number;
  results: Result[];
  notMeeting: Result[];
}

interface CandRow {
  id: string;
  headline: string;
  seniority: string | null;
  total_years: string | null;
  country: string | null;
  work_mode: string | null;
  summary: string;
  leadership: { evidence: string }[];
  languages: { name: string; level?: string }[];
  skills: { skill: string; years: number }[] | null;
  distance: number | null;
}

// ---------- 1. Interpretar la consulta ----------
/** Sin IA: reglas simples. Garantiza que la búsqueda funcione con la API apagada. */
export function parseWithRules(query: string, knownSkills: string[]): Requirements {
  const text = query.toLowerCase();
  const found = knownSkills.filter((s) => new RegExp(`(^|[^a-z0-9])${s.replace(/[.+]/g, "\\$&")}([^a-z0-9]|$)`).test(text));
  const yearsMatch = text.match(/(\d+)\s*\+?\s*(?:years?|años|yrs)/);
  const years = yearsMatch ? Number(yearsMatch[1]) : undefined;
  const mandatory: Requirement[] = [];
  const nice: Requirements["nice_to_have"] = [];

  const main = found[0];
  if (main) mandatory.push({ type: "skill", skill: main, min_years: years, label: years ? `${main} ≥ ${years}` : main });
  for (const s of found.slice(1)) nice.push({ skill: s, label: s });
  if (/\bcloud|nube\b/.test(text) && !found.some((s) => GROUPS.cloud.includes(s))) nice.push({ skill: "cloud", label: "cloud" });
  if (/lideraz|leader|lead\b|liderar|manag/.test(text)) nice.push({ skill: "leadership", label: /lideraz|liderar/.test(text) ? "liderazgo" : "leadership" });
  return { mandatory, nice_to_have: nice, semantic_query: query };
}

export async function parseQuery(tenantId: string, query: string): Promise<{ req: Requirements; by: "ai" | "rules" }> {
  const gate = await canSpend(tenantId);
  if (gate.ok) {
    try {
      const req = await callTool<Requirements>({
        tenantId, kind: "query_parse", system: QUERY_SYSTEM, tool: QUERY_TOOL, maxTokens: 400,
        content: [{ type: "text", text: query }],
      });
      req.mandatory = req.mandatory.map((m) => ({ ...m, skill: m.skill ? norm(m.skill) : m.skill }));
      req.nice_to_have = req.nice_to_have.map((n) => ({ ...n, skill: n.skill ? norm(n.skill) : n.skill }));
      return { req, by: "ai" };
    } catch (e) {
      console.error("[search] parse IA falló, uso reglas:", e);
    }
  }
  const skills = await q<{ skill: string }>(
    "SELECT DISTINCT s.skill FROM candidate_skills s JOIN candidates c ON c.id = s.candidate_id WHERE c.tenant_id = $1",
    [tenantId],
  );
  return { req: parseWithRules(query, skills.map((s) => s.skill).sort((a, b) => b.length - a.length)), by: "rules" };
}

// ---------- 2. Evaluar requisitos ----------
function skillYears(c: CandRow, skill: string): number | null {
  const s = norm(skill);
  const skills = c.skills ?? [];
  if (GROUPS[s]) {
    const ys = skills.filter((x) => GROUPS[s].includes(x.skill)).map((x) => Number(x.years));
    return ys.length ? Math.max(...ys) : null;
  }
  const hit = skills.find((x) => x.skill === s);
  return hit ? Number(hit.years) : null;
}

const fmtYears = (n: number) => `${n.toLocaleString("es-AR", { maximumFractionDigits: 1 })} y`;

function check(c: CandRow, r: { type?: Requirement["type"]; skill?: string; min_years?: number; value?: string; label: string }, mandatory: boolean): ReqCheck {
  const type = r.type ?? "skill";
  if (type === "skill" && r.skill && LEADERSHIP.includes(norm(r.skill))) {
    const ev = c.leadership?.[0]?.evidence;
    return { label: r.label, mandatory, status: ev ? "met" : "unmet", detail: ev ?? "—" };
  }
  if (type === "skill" && r.skill) {
    const y = skillYears(c, r.skill);
    if (y === null) return { label: r.label, mandatory, status: "unmet", detail: `${r.skill}: —` };
    const ok = r.min_years ? y >= r.min_years : true;
    return { label: r.label, mandatory, status: ok ? "met" : "unmet", detail: `${r.skill}: ${fmtYears(y)}` };
  }
  if (type === "total_years") {
    const y = Number(c.total_years ?? 0);
    return { label: r.label, mandatory, status: y >= (r.min_years ?? 0) ? "met" : "unmet", detail: fmtYears(y) };
  }
  if (type === "seniority") {
    const order = ["junior", "mid", "senior", "lead", "principal"];
    const want = order.indexOf((r.value ?? "").toLowerCase());
    const have = order.indexOf(c.seniority ?? "");
    if (want < 0 || have < 0) return { label: r.label, mandatory, status: "unknown", detail: c.seniority ?? "—" };
    return { label: r.label, mandatory, status: have >= want ? "met" : "unmet", detail: c.seniority ?? "—" };
  }
  if (type === "work_mode") {
    if (!c.work_mode) return { label: r.label, mandatory, status: "unknown", detail: "—" };
    return { label: r.label, mandatory, status: c.work_mode === (r.value ?? "").toLowerCase() ? "met" : "unmet", detail: c.work_mode };
  }
  if (type === "language") {
    const has = c.languages?.some((l) => l.name.toLowerCase() === (r.value ?? "").toLowerCase());
    return { label: r.label, mandatory, status: has ? "met" : "unknown", detail: has ? (r.value ?? "") : "—" };
  }
  return { label: r.label, mandatory, status: "unknown", detail: "—" };
}

/** Similitud sin embeddings: solapamiento de términos entre consulta y perfil (0-1). */
function lexicalSimilarity(query: string, c: CandRow): number {
  const terms = new Set(query.toLowerCase().split(/[^a-z0-9.+#áéíóúñ]+/).filter((t) => t.length > 2));
  if (!terms.size) return 0;
  const hay = `${c.headline} ${c.summary} ${(c.skills ?? []).map((s) => s.skill).join(" ")}`.toLowerCase();
  let hits = 0;
  for (const t of terms) if (hay.includes(t)) hits++;
  return hits / terms.size;
}

// ---------- 3. Buscar ----------
export async function search(opts: {
  tenantId: string;
  userId: string;
  query: string;
  requirements?: Requirements; // si el reclutador editó los chips
  searchId?: string; // vacantes: se reutiliza su búsqueda para conservar decisiones y explicaciones
}): Promise<SearchOutput> {
  const t0 = Date.now();
  const parsed = opts.requirements ? { req: opts.requirements, by: "ai" as const } : await parseQuery(opts.tenantId, opts.query);
  const req = parsed.req;

  // Vector de la consulta, solo si hay perfiles con embedding y se puede gastar
  let qVector: number[] | null = null;
  const hasEmb = await one<{ n: string }>("SELECT COUNT(*) AS n FROM candidates WHERE tenant_id = $1 AND embedding IS NOT NULL", [opts.tenantId]);
  if (Number(hasEmb?.n) > 0 && (await canSpend(opts.tenantId)).ok) {
    try {
      qVector = await embed(req.semantic_query || opts.query, { tenantId: opts.tenantId });
    } catch (e) {
      console.error("[search] embedding falló, sigo sin semántica:", e);
    }
  }

  // Candidatos con sus skills; si hay vector, la distancia la calcula pgvector
  const rows = await q<CandRow>(
    `SELECT c.id, c.headline, c.seniority, c.total_years, c.country, c.work_mode, c.summary, c.leadership, c.languages,
            (SELECT json_agg(json_build_object('skill', s.skill, 'years', s.years) ORDER BY s.years DESC)
               FROM candidate_skills s WHERE s.candidate_id = c.id) AS skills,
            ${qVector ? "c.embedding <=> $2::vector" : "NULL::float8"} AS distance
       FROM candidates c
      WHERE c.tenant_id = $1
      ${qVector ? "ORDER BY distance NULLS LAST" : ""}
      LIMIT 200`,
    qVector ? [opts.tenantId, toVector(qVector)] : [opts.tenantId],
  );

  const all: Result[] = rows.map((c) => {
    const mand = req.mandatory.map((r) => check(c, r, true));
    const nice = req.nice_to_have.map((r) => check(c, { type: "skill", skill: r.skill ?? r.label, label: r.label }, false));
    const semantic = c.distance !== null ? Math.max(0, 1 - Number(c.distance)) : lexicalSimilarity(req.semantic_query || opts.query, c);
    const niceShare = nice.length ? nice.filter((n) => n.status === "met").length / nice.length : 1;
    const mandShare = mand.length ? mand.filter((m) => m.status === "met").length / mand.length : 1;
    const score = Math.round(100 * (0.45 * semantic + 0.35 * niceShare + 0.2 * mandShare));
    return {
      candidateId: c.id,
      headline: c.headline,
      seniority: c.seniority,
      totalYears: Number(c.total_years ?? 0),
      country: c.country,
      workMode: c.work_mode,
      score: Math.min(100, score),
      checks: [...mand, ...nice],
      meetsMandatory: mand.every((m) => m.status !== "unmet"),
      topSkills: (c.skills ?? []).slice(0, 5).map((s) => ({ skill: s.skill, years: Number(s.years) })),
    };
  });

  const results = all.filter((r) => r.meetsMandatory).sort((a, b) => b.score - a.score).slice(0, 50);
  const notMeeting = all.filter((r) => !r.meetsMandatory).sort((a, b) => b.score - a.score);
  const durationMs = Date.now() - t0;

  let searchId = opts.searchId;
  if (searchId) {
    await q("UPDATE searches SET requirements = $2::jsonb, result_count = $3, duration_ms = $4 WHERE id = $1 AND tenant_id = $5", [
      searchId, JSON.stringify(req), results.length, durationMs, opts.tenantId,
    ]);
  } else {
    const saved = await one<{ id: string }>(
      `INSERT INTO searches (tenant_id, user_id, query, requirements, result_count, duration_ms)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6) RETURNING id`,
      [opts.tenantId, opts.userId, opts.query, JSON.stringify(req), results.length, durationMs],
    );
    searchId = saved!.id;
  }
  return { searchId: searchId!, query: opts.query, requirements: req, parsedBy: parsed.by, semantic: !!qVector, durationMs, results, notMeeting };
}

// ---------- 4. Explicación (asíncrona, cacheada) ----------
export async function explain(opts: { tenantId: string; searchId: string; candidateId: string; lang: "en" | "es" }): Promise<Explanation & { by: "ai" | "rules" | "cache" }> {
  const cached = await one<{ text: Explanation }>("SELECT text FROM explanations WHERE search_id = $1 AND candidate_id = $2", [opts.searchId, opts.candidateId]);
  if (cached) return { ...cached.text, by: "cache" };

  const s = await one<{ query: string; requirements: Requirements }>("SELECT query, requirements FROM searches WHERE id = $1 AND tenant_id = $2", [opts.searchId, opts.tenantId]);
  const c = await one<{ profile_json: unknown; leadership: { evidence: string }[] }>(
    "SELECT profile_json, leadership FROM candidates WHERE id = $1 AND tenant_id = $2",
    [opts.candidateId, opts.tenantId],
  );
  if (!s || !c) throw new Error("Búsqueda o candidato inexistente");

  let out: Explanation;
  let by: "ai" | "rules" = "rules";
  if ((await canSpend(opts.tenantId)).ok) {
    // Al modelo va el perfil ANONIMIZADO (profile_json nunca tiene PII)
    out = await callTool<Explanation>({
      tenantId: opts.tenantId, kind: "explain", searchId: opts.searchId,
      system: EXPLAIN_SYSTEM, tool: EXPLAIN_TOOL, maxTokens: 350,
      content: [{ type: "text", text: `Language: ${opts.lang === "es" ? "Spanish" : "English"}\nSearch: ${s.query}\nRequirements: ${JSON.stringify(s.requirements)}\nCandidate profile: ${JSON.stringify(c.profile_json)}` }],
    });
    by = "ai";
  } else {
    // Sin IA: explicación armada con los requisitos evaluados
    const prof = c.profile_json as { summary?: string };
    out = { match: [], gaps: [], summary: prof.summary ?? "" };
  }
  await q("INSERT INTO explanations (search_id, candidate_id, text) VALUES ($1,$2,$3::jsonb) ON CONFLICT DO NOTHING", [opts.searchId, opts.candidateId, JSON.stringify(out)]);
  return { ...out, by };
}

// ---------- 5. Match inverso: para qué vacantes abiertas encaja un candidato ----------
export async function openingsForCandidate(tenantId: string, candidateId: string) {
  const [c] = await q<CandRow>(
    `SELECT c.id, c.headline, c.seniority, c.total_years, c.country, c.work_mode, c.summary, c.leadership, c.languages,
            (SELECT json_agg(json_build_object('skill', s.skill, 'years', s.years)) FROM candidate_skills s WHERE s.candidate_id = c.id) AS skills,
            NULL::float8 AS distance
       FROM candidates c WHERE c.id = $1 AND c.tenant_id = $2`,
    [candidateId, tenantId],
  );
  if (!c) return [];
  const openings = await q<{ id: string; title: string; requirements: Requirements; decision: string | null }>(
    `SELECT o.id, o.title, o.requirements,
            (SELECT d.status FROM decisions d WHERE d.search_id = o.search_id AND d.candidate_id = $2) AS decision
       FROM openings o WHERE o.tenant_id = $1 AND o.status = 'open' ORDER BY o.created_at DESC`,
    [tenantId, candidateId],
  );
  return openings.map((o) => {
    const mand = o.requirements.mandatory.map((r) => check(c, r, true));
    const nice = o.requirements.nice_to_have.map((r) => check(c, { type: "skill", skill: r.skill ?? r.label, label: r.label }, false));
    const niceShare = nice.length ? nice.filter((n) => n.status === "met").length / nice.length : 1;
    return {
      openingId: o.id,
      title: o.title,
      meetsMandatory: mand.every((m) => m.status !== "unmet"),
      missing: mand.filter((m) => m.status === "unmet").map((m) => m.label),
      niceMet: `${nice.filter((n) => n.status === "met").length}/${nice.length}`,
      fit: Math.round(100 * (0.6 * (mand.length ? mand.filter((m) => m.status === "met").length / mand.length : 1) + 0.4 * niceShare)),
      decision: o.decision,
    };
  }).sort((a, b) => Number(b.meetsMandatory) - Number(a.meetsMandatory) || b.fit - a.fit);
}
