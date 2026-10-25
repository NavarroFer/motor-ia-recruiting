// Benchmark de búsqueda a escala, sin gastar en APIs.
// Carga N perfiles sintéticos (skills al azar + vectores de 1536 dims agrupados en clusters) en un tenant aparte,
// construye el índice HNSW y corre búsquedas reales con la misma función que usa la app (src/lib/search.ts).
// Las búsquedas usan requisitos ya interpretados y el vector de la consulta precargado en query_cache: 0 tokens.
//
// Uso (con el Postgres de docker-compose levantado):
//   npm run bench                         -> 100.000 perfiles, 200 búsquedas
//   npm run bench -- --n 20000 --runs 100 -> más chico
//   npm run bench -- --concurrency 5      -> 5 búsquedas en paralelo (varios reclutadores a la vez)
//   npm run bench -- --drop               -> borra el tenant de benchmark y sale
import "./env";
import { randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { one, q, toVector } from "@/lib/db";
import { explain, queryKey, search } from "@/lib/search";
import type { Requirements } from "@/lib/ai/prompts";

const argv = process.argv.slice(2);
const arg = (name: string, def: number) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? Number(argv[i + 1]) : def;
};
const N = arg("n", 100_000);
const RUNS = arg("runs", 200);
const CONCURRENCY = arg("concurrency", 1);
const DIMS = 1536;
const BENCH_TENANT = "Benchmark (sintético)";

// ---------- Datos sintéticos ----------
const SKILLS = ["python", "aws", "gcp", "azure", "kubernetes", "docker", "terraform", "react", "typescript", "javascript",
  "node.js", "java", "go", "sql", "postgresql", "django", "fastapi", "spark", "airflow", "machine learning", "c#", ".net", "php", "laravel"];
const HEADLINES = ["Backend Engineer", "Full Stack Developer", "Data Engineer", "DevOps Engineer", "Frontend Developer", "ML Engineer", "Platform Engineer", "Software Engineer"];
const SENIORITY = ["junior", "mid", "senior", "lead", "principal"];
const COUNTRIES = ["AR", "BR", "MX", "CO", "CL", "US", "ES", "UY"];
const MODES = ["remote", "hybrid", "onsite"];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
const normalize = (v: number[]) => { const n = Math.hypot(...v); return v.map((x) => x / n); };

// 40 "perfiles tipo": los vectores reales también se agrupan por rol, no son ruido uniforme
const CENTROIDS = Array.from({ length: 40 }, () => normalize(Array.from({ length: DIMS }, gauss)));
const nearCentroid = (c: number[], noise = 0.6) => normalize(c.map((x) => x + (noise / Math.sqrt(DIMS)) * gauss()));
const vecText = (v: number[]) => `[${v.map((x) => x.toFixed(3)).join(",")}]`;

function fakeCandidate() {
  const total = Math.round((1 + Math.random() * 19) * 10) / 10;
  const skills = new Map<string, number>();
  const k = 3 + Math.floor(Math.random() * 6);
  while (skills.size < k) skills.set(pick(SKILLS), Math.round(Math.min(total, 0.5 + Math.random() * total) * 10) / 10);
  const headline = `${pick(["Senior ", "", "Lead ", "Mid "])}${pick(HEADLINES)}`;
  const leadership = Math.random() < 0.25 ? [{ evidence: "Led a team of 4 engineers" }] : [];
  return {
    id: randomUUID(), headline, seniority: pick(SENIORITY), total, country: pick(COUNTRIES), mode: pick(MODES), leadership,
    summary: `${headline} with ${total} years of experience in ${[...skills.keys()].slice(0, 3).join(", ")}.`,
    skills, vector: nearCentroid(pick(CENTROIDS)),
  };
}

// ---------- Búsquedas de prueba ----------
const QUERIES: { query: string; req: Requirements }[] = [
  { query: "Python developer with 3+ years in cloud projects and leadership", req: { semantic_query: "", mandatory: [{ type: "skill", skill: "python", min_years: 3, label: "Python ≥ 3" }], nice_to_have: [{ skill: "cloud", label: "cloud" }, { skill: "leadership", label: "leadership" }] } },
  { query: "Senior React and TypeScript frontend engineer", req: { semantic_query: "", mandatory: [{ type: "skill", skill: "react", min_years: 4, label: "React ≥ 4" }, { type: "seniority", value: "senior", label: "Senior" }], nice_to_have: [{ skill: "typescript", label: "typescript" }] } },
  { query: "Data engineer with Spark and Airflow", req: { semantic_query: "", mandatory: [{ type: "skill", skill: "spark", min_years: 2, label: "Spark ≥ 2" }], nice_to_have: [{ skill: "airflow", label: "airflow" }, { skill: "sql", label: "sql" }] } },
  { query: "DevOps with Kubernetes and Terraform on AWS", req: { semantic_query: "", mandatory: [{ type: "skill", skill: "kubernetes", min_years: 3, label: "Kubernetes ≥ 3" }], nice_to_have: [{ skill: "terraform", label: "terraform" }, { skill: "aws", label: "aws" }] } },
  { query: ".NET backend developer, remote", req: { semantic_query: "", mandatory: [{ type: "skill", skill: ".net", min_years: 3, label: ".NET ≥ 3" }, { type: "work_mode", value: "remote", label: "Remote" }], nice_to_have: [{ skill: "sql", label: "sql" }] } },
  { query: "Go engineer for platform team", req: { semantic_query: "", mandatory: [{ type: "skill", skill: "go", min_years: 2, label: "Go ≥ 2" }], nice_to_have: [{ skill: "kubernetes", label: "kubernetes" }, { skill: "docker", label: "docker" }] } },
];

const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };
const ms = (n: number) => `${n.toFixed(0)} ms`;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn("⚠ Sin DATABASE_URL: corre sobre PGlite (embebido, un hilo). Para un número representativo levantá docker compose.");
  }
  let tenant = await one<{ id: string }>("SELECT id FROM tenants WHERE name = $1", [BENCH_TENANT]);

  if (argv.includes("--drop")) {
    if (tenant) {
      await q("DELETE FROM query_cache WHERE tenant_id = $1", [tenant.id]);
      await q("DELETE FROM searches WHERE tenant_id = $1", [tenant.id]);
      await q("DELETE FROM candidates WHERE tenant_id = $1", [tenant.id]);
      await q("DELETE FROM users WHERE tenant_id = $1", [tenant.id]);
      await q("DELETE FROM tenants WHERE id = $1", [tenant.id]);
    }
    console.log("Tenant de benchmark borrado.");
    process.exit(0);
  }

  if (!tenant) tenant = await one<{ id: string }>("INSERT INTO tenants (name, monthly_budget_usd) VALUES ($1, 0) RETURNING id", [BENCH_TENANT]);
  const tenantId = tenant!.id;
  let user = await one<{ id: string }>("SELECT id FROM users WHERE tenant_id = $1 LIMIT 1", [tenantId]);
  if (!user) user = await one<{ id: string }>("INSERT INTO users (tenant_id, email, name, role, password_hash) VALUES ($1,'bench@bench.test','Bench','recruiter','-') RETURNING id", [tenantId]);

  // ---------- 1. Carga ----------
  const have = Number((await one<{ n: string }>("SELECT COUNT(*) AS n FROM candidates WHERE tenant_id = $1", [tenantId]))?.n ?? 0);
  if (have < N) {
    console.log(`Cargando ${N - have} perfiles sintéticos (hay ${have})…`);
    // Sin índice durante la carga: insertar 100k en un HNSW vivo es mucho más lento que construirlo al final
    await q("DROP INDEX IF EXISTS idx_candidates_embedding");
    const BATCH = 250;
    const t0 = Date.now();
    for (let done = have; done < N; done += BATCH) {
      const rows = Array.from({ length: Math.min(BATCH, N - done) }, fakeCandidate);
      const cp: unknown[] = [];
      const cv = rows.map((r, i) => {
        const b = i * 11;
        cp.push(r.id, tenantId, r.headline, r.seniority, r.total, r.country, r.mode, JSON.stringify(r.leadership), r.summary,
          JSON.stringify({ headline: r.headline, summary: r.summary, skills: [...r.skills].map(([name, years]) => ({ name, years })) }), vecText(r.vector));
        return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8}::jsonb,$${b + 9},$${b + 10}::jsonb,$${b + 11}::vector)`;
      });
      await q(`INSERT INTO candidates (id, tenant_id, headline, seniority, total_years, country, work_mode, leadership, summary, profile_json, embedding) VALUES ${cv.join(",")}`, cp);
      const sp: unknown[] = [];
      const sv: string[] = [];
      for (const r of rows) for (const [skill, years] of r.skills) {
        const b = sp.length;
        sp.push(r.id, skill, years, `${years} years of ${skill} in production`);
        sv.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4})`);
      }
      await q(`INSERT INTO candidate_skills (candidate_id, skill, years, evidence) VALUES ${sv.join(",")}`, sp);
      if ((done / BATCH) % 40 === 0) process.stdout.write(`  ${done + rows.length}/${N} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
    }
  }

  // ---------- 2. Índices ----------
  const idx = await one("SELECT 1 FROM pg_indexes WHERE indexname = 'idx_candidates_embedding'");
  if (!idx) {
    console.log("Construyendo índice HNSW (puede tardar unos minutos)…");
    const t0 = Date.now();
    // En una sola sentencia para que los SET apliquen a la misma conexión.
    // Sin workers paralelos: evita el límite de /dev/shm (64 MB) del contenedor de Docker.
    const create = "CREATE INDEX IF NOT EXISTS idx_candidates_embedding ON candidates USING hnsw (embedding vector_cosine_ops)";
    if (process.env.DATABASE_URL) await q(`SET maintenance_work_mem = '1GB'; SET max_parallel_maintenance_workers = 0; ${create}`);
    else await q(create); // PGlite no acepta varias sentencias en query()
    console.log(`  listo en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  await q("ANALYZE candidates");
  await q("ANALYZE candidate_skills");

  // ---------- 3. Vectores de consulta precargados (0 tokens) ----------
  for (const x of QUERIES) {
    x.req.semantic_query = x.query;
    await q("INSERT INTO query_cache (tenant_id, kind, key, value) VALUES ($1,'embedding',$2,$3::jsonb) ON CONFLICT DO NOTHING",
      [tenantId, queryKey(x.query), JSON.stringify(nearCentroid(pick(CENTROIDS)).map((v) => Number(v.toFixed(5))))]);
  }

  // Plan de la consulta vectorial: confirma que usa el índice
  const probe = await one<{ value: number[] }>("SELECT value FROM query_cache WHERE tenant_id = $1 AND kind = 'embedding' LIMIT 1", [tenantId]);
  const plan = await q<{ "QUERY PLAN": string }>(
    "EXPLAIN SELECT id FROM candidates WHERE tenant_id = $1 ORDER BY embedding <=> $2::vector LIMIT 200",
    [tenantId, toVector(probe!.value)],
  );
  const usesHnsw = plan.some((p) => /idx_candidates_embedding/.test(p["QUERY PLAN"]));

  // ---------- 4. Búsquedas ----------
  const run = (i: number) => {
    const x = QUERIES[i % QUERIES.length];
    return search({ tenantId, userId: user!.id, query: x.query, requirements: x.req });
  };
  console.log("Calentando…");
  for (let i = 0; i < QUERIES.length; i++) await run(i);

  console.log(`Corriendo ${RUNS} búsquedas (concurrencia ${CONCURRENCY})…`);
  const times: number[] = [];
  const counts: number[] = [];
  let next = 0;
  const tAll = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < RUNS) {
      const i = next++;
      const t0 = performance.now();
      const out = await run(i);
      times.push(performance.now() - t0);
      counts.push(out.results.length);
    }
  }));
  const wall = (Date.now() - tAll) / 1000;

  // Explicación por requisitos del top 10 (lo que ve el reclutador sin IA)
  const sample = await run(0);
  const tE = performance.now();
  await Promise.all(sample.results.slice(0, 10).map((r) => explain({ tenantId, searchId: sample.searchId, candidateId: r.candidateId, lang: "es" })));
  const explainMs = performance.now() - tE;

  const total = Number((await one<{ n: string }>("SELECT COUNT(*) AS n FROM candidates WHERE tenant_id = $1", [tenantId]))?.n ?? 0);
  const p50 = pct(times, 50), p95 = pct(times, 95), p99 = pct(times, 99), max = Math.max(...times);
  const avgResults = counts.reduce((a, b) => a + b, 0) / counts.length;
  const machine = `${os.cpus()[0]?.model ?? "?"} · ${os.cpus().length} núcleos · ${(os.totalmem() / 2 ** 30).toFixed(0)} GB`;

  const report = `# Benchmark de búsqueda

Fecha: ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC
Máquina: ${machine}
Base: ${process.env.DATABASE_URL ? "Postgres 16 + pgvector (docker)" : "PGlite embebido"}

| Métrica | Valor |
|---|---|
| Perfiles indexados | ${total.toLocaleString("es-AR")} |
| Búsquedas | ${RUNS} (concurrencia ${CONCURRENCY}) |
| p50 | ${ms(p50)} |
| p95 | ${ms(p95)} |
| p99 | ${ms(p99)} |
| Máximo | ${ms(max)} |
| Throughput | ${(RUNS / wall).toFixed(1)} búsquedas/s |
| Candidatos que cumplen (promedio, top 50) | ${avgResults.toFixed(1)} |
| Explicación por requisitos, top 10 | ${ms(explainMs)} |
| Consulta vectorial usa HNSW | ${usesHnsw ? "sí" : "NO"} |

Qué mide: la función \`search()\` de la app de punta a punta (vector de la consulta desde caché, kNN con HNSW,
evaluación de requisitos, score y guardado de la búsqueda). No incluye la interpretación de la consulta con IA
(0,5–1 s la primera vez; 0 s si está en caché) ni la red hasta el navegador.
Datos sintéticos: skills al azar y vectores agrupados en 40 clusters. Costo de APIs: USD 0.
`;
  mkdirSync(path.join(process.cwd(), "docs"), { recursive: true });
  writeFileSync(path.join(process.cwd(), "docs", "benchmark.md"), report);
  console.log("\n" + report);
  console.log("Guardado en docs/benchmark.md. Para limpiar: npm run bench -- --drop");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
