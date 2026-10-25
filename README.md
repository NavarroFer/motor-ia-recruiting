# Motor de IA para Recruiting — demo

Demo funcional de la propuesta: carga de CVs, extracción y anonimización, estructuración con Claude Haiku,
búsqueda híbrida (filtros + similitud vectorial), explicaciones y decisión humana auditada.

## Requisitos

- Node 20.9 o superior (lo pide Next 16).
- Docker, opcional: sin Docker la base corre embebida con PGlite.
- API keys de Anthropic y OpenAI, solo para usar IA. Sin keys la app funciona con la API apagada.

## Levantarlo

```bash
cp .env.example .env.local     # completar SESSION_SECRET y, cuando quieras usar IA, las API keys
npm install

# Opción A: Postgres + pgvector en Docker (recomendada)
docker compose up -d
# Opción B: sin Docker → borrá la línea DATABASE_URL de .env.local y usa PGlite embebido (./.data)

npm run generate:cvs           # 76 CVs sintéticos: 70 para precargar (seed/cvs) y 6 para la demo (seed/cvs/en-vivo)
npm run seed -- --reset        # cliente demo, 3 usuarios, 70 candidatos precargados y 3 vacantes
npm run dev                    # http://localhost:3000
```

Usuarios (contraseña `demo1234`): `admin@demo.test`, `recruiter@demo.test`, `viewer@demo.test`.

Si `npm install` se hizo en otra máquina, borrá `node_modules` y reinstalá (hay binarios por plataforma).

## Cuidar el gasto

- La app arranca con la **API apagada**: no se llama a ningún modelo. La búsqueda igual funciona, con reglas.
- Admin › Consumo y API: activar la API, ver el presupuesto y procesar **un CV por vez** ("Procesar 1 CV ahora").
- "Procesamiento automático" está apagado por defecto: nada se procesa solo.
- Embeddings para los 70 precargados (opcional, < USD 0,001): `npm run seed -- --reset --embed`.
- Verificar las keys antes de la demo: `npm run check:api` (una llamada mínima a cada API, < USD 0,001).

## Demo sugerida

1. Admin › Consumo y API: mostrar la API apagada, el presupuesto y la cola.
2. Cargar CVs: subir `seed/cvs/en-vivo/camila-duarte.pdf` (está en castellano) o `seed/cvs/en-vivo.zip` con los 6 → quedan "En espera".
   Los 6: camila-duarte (castellano, Python/GCP), aisha-bello (Python/AWS), joao-pereira (portugués, Data Engineer GCP),
   sarah-mitchell (Frontend React), tomas-herrera (castellano, SRE) y ryan-oconnor (QA, no cumple obligatorios).
3. Activar la API → "Procesar 1 CV ahora" → pasa a Indexado en unos segundos; aparece el costo.
4. Entrar como reclutador → buscar "Python developer with 3+ years in cloud projects and leadership".
5. Editar un requisito, abrir una ficha (contacto visible): la explicación sale por requisitos (0 tokens); "Explicar con IA" pide la narrativa una sola vez y queda cacheada. Repetir la misma búsqueda no gasta: la consulta interpretada y su vector se cachean. Preseleccionar a alguien de "No cumple obligatorios" → pide motivo.
6. Vacantes › "Senior Python Backend Engineer": preseleccionar 2 candidatos → aparece "Sugeridos por tus elecciones" (perfiles parecidos a los elegidos, sin gastar tokens). Al procesar un CV nuevo que se parezca, la vacante muestra "nuevos parecidos".
7. Entrar como visualizador → la ficha no muestra contacto y no puede decidir.

## Rendimiento

[docs/benchmark.md](docs/benchmark.md): búsqueda sobre 100.000 perfiles en Postgres + pgvector, p50 de 33 ms y p95 de 46 ms,
sin gastar en APIs. Para repetirlo con el Postgres de Docker: `npm run bench` (carga los perfiles en un tenant aparte y
reescribe docs/benchmark.md); `npm run bench -- --drop` lo borra.

## Slack y Google Meet con n8n (opcional)

La app manda eventos por webhook a n8n con el perfil anonimizado y links a la ficha:
- **CV nuevo que encaja**: al indexar un CV parecido a los elegidos de una vacante abierta (y que cumple obligatorios), aviso en Slack.
- **Preselección**: aviso en Slack.
- **Selección con entrevista**: el reclutador elige día y horario; n8n crea el evento con Google Meet, invita al candidato
  (Google le manda la invitación) y avisa en Slack con una **guía de entrevista**: preguntas para verificar lo que el CV no
  demuestra, redactadas por Haiku (o por reglas con la API apagada). La guía es solo para el equipo: no va en la invitación.

El email del candidato es el único dato personal que sale, solo al agendar y con registro en la auditoría (`invite_candidate`).

```bash
docker compose --profile n8n up -d     # n8n en http://localhost:5678
docker compose exec n8n n8n import:workflow --input=/files/decisiones-slack-calendar.json
```

1. En n8n, crear las credenciales "Slack API" (bot token con `chat:write` y `chat:write.public`) y "Google Calendar OAuth2 API"
   (redirect URI `http://localhost:5678/rest/oauth2-credential/callback`), asignarlas a los nodos y publicar el workflow.
2. En `.env.local`: `N8N_WEBHOOK_URL=http://localhost:5678/webhook/motor-ia-decisions`. Sin esa variable no se envía nada.
   Para la demo, `CANDIDATE_EMAIL_OVERRIDE=<casilla>` redirige las invitaciones (los candidatos sintéticos tienen emails falsos).
   Tiene que ser distinta de la cuenta de Google conectada en n8n: Google no le manda invitación al organizador.
3. Para ver el aviso de CV nuevo: la vacante necesita 2 elegidos con vector (`npm run seed -- --reset --embed`, preseleccionar 2
   en "Senior Python Backend Engineer") y después procesar `seed/cvs/en-vivo/camila-duarte.pdf` (o aisha-bello) en vivo.

## Estructura

```
src/lib/db/           esquema SQL (idempotente) y conexión Postgres/PGlite
src/lib/pipeline/     extracción de texto, anonimización de PII, procesamiento y cola
src/lib/ai/           cliente Claude (tool use), embeddings y prompts
src/lib/search.ts     interpretación de la consulta, búsqueda híbrida, explicaciones
src/lib/usage.ts      registro de consumo, presupuesto e interruptor de la API
src/app/api/          rutas REST que consume la UI
src/app/(app)/        pantallas: inicio, búsqueda, candidatos, vacantes, carga, admin
src/components/ui/    componentes base (shadcn sobre @base-ui/react)
seed/                 candidatos sintéticos, vacantes y sus PDFs
scripts/              seed, generación de CVs, chequeo de API y benchmark
integrations/n8n/     workflow de Slack y Google Calendar
docs/costos.py        modelo de costos de la propuesta (npm run costos)
docs/benchmark.md     resultados del benchmark de búsqueda
```
