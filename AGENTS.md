# Motor IA Recruiting — demo local

Ejercicio técnico para un proceso de selección. Entrega: domingo 25/10 a la noche. Presentación: lunes 26/10.
La propuesta ejecutiva (4 ejes) ya está escrita; este repo es la demo funcional que la respalda.

## Qué es
Plataforma B2B multi-tenant: los reclutadores cargan CVs y buscan candidatos en lenguaje natural
("Python developer, 3+ years in cloud, leadership"). La IA ordena, explica y marca; la persona decide.

## Stack (decidido)
- Next.js 16 (App Router, TypeScript) para front + API. UI en inglés y español (diccionario propio en src/lib/i18n.ts, cookie `lang`).
- Sesión propia: JWT firmado con jose en cookie httpOnly. Roles: admin, recruiter, viewer.
- Postgres 16 + pgvector en docker-compose; sin DATABASE_URL usa PGlite embebido (con @electric-sql/pglite-pgvector). SQL directo, sin ORM.
- Cola propia sobre Postgres (tabla jobs, FOR UPDATE SKIP LOCKED). pg-boss no corre sobre PGlite. En producción: SQS.
- Cliente de Claude por fetch, sin SDK: thinking disabled + output_config.effort low + tool_choice forzado.
- Componentes UI base: shadcn base-nova sobre @base-ui/react. Diseño World Teams a partir del Figma: los tokens viven en src/app/globals.css.
- Extracción de texto: unpdf (PDF) y mammoth (DOCX). OCR/imágenes fuera del MVP.
- Estructuración: Claude Haiku 5.5 (`claude-haiku-5-5`) con tool use forzado y esquema JSON fijo.
- Embeddings: OpenAI `text-embedding-3-small` (1536 dims), índice HNSW.
- Front: maquetado a partir de un Figma estático (brief de 7 pantallas). Animaciones en código.

## Pipeline de ingesta (asíncrono)
1. Upload (zip o archivos) → hash SHA-256 → descartar duplicados exactos → registro `documents` → job en cola.
2. Extraer texto (sin IA).
3. Anonimizar: detectar PII (nombre, email, teléfono, dirección, fecha de nacimiento, links) con regex + heurística;
   guardar PII cifrada (AES-256-GCM, clave en env) en `candidate_pii`; el texto sigue con marcadores [NAME], [EMAIL].
4. Haiku → JSON validado con zod: skills (nombre + años + evidencia textual), roles, seniority, liderazgo (evidencia),
   idiomas, educación, industria, país, modalidad. Si no está en inglés, normalizar a inglés. 2 fallos → revisión manual.
5. Embedding de un resumen del perfil → `profiles.embedding`.
Estados por documento: received, extracting, structuring, indexed, queued_budget, duplicate, error.

## Búsqueda (< 2 s)
1. Haiku parsea la consulta en requisitos { mandatory[], nice_to_have[] } (editables en la UI).
2. SQL aplica obligatorios; pgvector ordena por similitud; score combinado → top 50.
3. Quien no cumple un obligatorio va al bloque "Does not meet requirements" con motivo concreto. Nunca se descarta solo.
4. Explicaciones del top 10: endpoint aparte, asíncrono, cacheado por (candidato, búsqueda).

## Human-in-the-loop y auditoría
- Acciones: select, shortlist, discard. Solo humanas. Tabla `audit_log` (usuario, acción, candidato, búsqueda, motivo, fecha).
- Si se preselecciona a alguien marcado como no apto, pedir motivo.
- Viewer no ve PII de contacto.

## Control de gasto (clave para la demo)
- Tabla `usage` por llamada: tenant, modelo, tokens in/out, costo USD.
- Presupuesto mensual por tenant, editable por admin. Al 100% los jobs quedan en `queued_budget` (no fallan).
- Toggle global "API activa" en admin: si está apagado no se llama a ningún modelo y todo queda en cola.
- Botón admin "Process 1 CV now": procesa un solo archivo en vivo mostrando cada paso.
- Límites: max_tokens 1000, CV truncado a 12.000 tokens, 10 explicaciones por búsqueda.

## Datos
- seed/personas.ts: 16 candidatos sintéticos escritos a mano + 60 generados con semilla fija (seed/generated.ts). Generan los PDFs (npm run generate:cvs) y los perfiles precargados (npm run seed). 70 se precargan; 6 se procesan en vivo desde seed/cvs/en-vivo (también en seed/cvs/en-vivo.zip): camila-duarte, aisha-bello, joao-pereira (portugués), sarah-mitchell, tomas-herrera y ryan-oconnor.
- Un tenant demo y 3 usuarios (admin/recruiter/viewer).

## Reglas
- Nunca enviar PII a un modelo. Nunca loguear API keys.
- Keys en `.env.local` (ANTHROPIC_API_KEY, OPENAI_API_KEY); `.env.example` sin valores.
- `docs/costos.py` = modelo de costos de la propuesta; no tocar sin avisar.

## Estado
- Hecho: esquema, pipeline, cola, búsqueda híbrida con caché e índice HNSW, explicaciones por requisitos (IA a pedido), decisiones con auditoría, vacantes con sugerencias aprendidas de las decisiones, admin (API, presupuesto, cola, consumo, usuarios), diseño World Teams en EN/ES e integraciones con n8n (Slack, Google Meet).
- Probado con API keys reales (Haiku y embeddings). Benchmark de búsqueda con 100.000 perfiles en docs/benchmark.md.

## Orden de trabajo original
1. docker-compose + esquema + seed de usuarios
2. Pipeline de ingesta con 1 CV de punta a punta
3. Generar y preprocesar los 10 CVs sintéticos
4. Búsqueda + ranking + explicaciones
5. Admin: toggle API, presupuesto, cola, consumo
6. UI sobre el Figma, i18n EN/ES

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
