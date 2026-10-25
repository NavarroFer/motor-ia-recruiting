# Motor de IA para Recruiting — demo

Demo funcional de la propuesta: carga de CVs, extracción y anonimización, estructuración con Claude Haiku,
búsqueda híbrida (filtros + similitud vectorial), explicaciones y decisión humana auditada.

## Levantarlo

```bash
cp .env.example .env.local     # completar SESSION_SECRET y, cuando quieras usar IA, las API keys
npm install

# Opción A: Postgres + pgvector en Docker (recomendada)
docker compose up -d
# Opción B: sin Docker → borrá la línea DATABASE_URL de .env.local y usa PGlite embebido (./.data)

npm run generate:cvs           # 12 CVs sintéticos en seed/cvs
npm run seed -- --reset        # cliente demo, 3 usuarios y 10 candidatos precargados
npm run dev                    # http://localhost:3000
```

Usuarios (contraseña `demo1234`): `admin@demo.test`, `recruiter@demo.test`, `viewer@demo.test`.

Si `npm install` se hizo en otra máquina, borrá `node_modules` y reinstalá (hay binarios por plataforma).

## Cuidar el gasto

- La app arranca con la **API apagada**: no se llama a ningún modelo. La búsqueda igual funciona, con reglas.
- Admin › Consumo y API: activar la API, ver el presupuesto y procesar **un CV por vez** ("Procesar 1 CV ahora").
- "Procesamiento automático" está apagado por defecto: nada se procesa solo.
- Embeddings para los 10 precargados (opcional, < USD 0,001): `npm run seed -- --reset --embed`.

## Demo sugerida

1. Admin › Consumo y API: mostrar la API apagada, el presupuesto y la cola.
2. Cargar CVs: subir `seed/cvs/camila-duarte.pdf` (está en castellano) → queda "En espera".
3. Activar la API → "Procesar 1 CV ahora" → pasa a Indexado en unos segundos; aparece el costo.
4. Entrar como reclutador → buscar "Python developer with 3+ years in cloud projects and leadership".
5. Editar un requisito, abrir una ficha (contacto visible): la explicación sale por requisitos (0 tokens); "Explicar con IA" pide la narrativa una sola vez y queda cacheada. Repetir la misma búsqueda no gasta: la consulta interpretada y su vector se cachean. Preseleccionar a alguien de "No cumple obligatorios" → pide motivo.
6. Vacantes › "Senior Python Backend Engineer": preseleccionar 2 candidatos → aparece "Sugeridos por tus elecciones" (perfiles parecidos a los elegidos, sin gastar tokens). Al procesar un CV nuevo que se parezca, la vacante muestra "nuevos parecidos".
7. Entrar como visualizador → la ficha no muestra contacto y no puede decidir.

## Slack y Google Meet con n8n (opcional)

Al preseleccionar o seleccionar, la app manda un evento por webhook a n8n, sin PII: perfil anonimizado y links a la ficha.
Seleccionar abre "Agendar entrevista": con día y horario, n8n crea el evento en Google Calendar con link de Meet y avisa en Slack.

```bash
docker compose --profile n8n up -d     # n8n en http://localhost:5678
docker compose exec n8n n8n import:workflow --input=/files/decisiones-slack-calendar.json
```

1. En n8n, crear las credenciales "Slack API" (bot token con `chat:write` y `chat:write.public`) y "Google Calendar OAuth2 API"
   (redirect URI `http://localhost:5678/rest/oauth2-credential/callback`), asignarlas a los nodos y publicar el workflow.
2. En `.env.local`: `N8N_WEBHOOK_URL=http://localhost:5678/webhook/motor-ia-decisions`. Sin esa variable no se envía nada.

## Estructura

```
src/lib/db/           esquema SQL (idempotente) y conexión Postgres/PGlite
src/lib/pipeline/     extracción de texto, anonimización de PII, procesamiento y cola
src/lib/ai/           cliente Claude (tool use), embeddings y prompts
src/lib/search.ts     interpretación de la consulta, búsqueda híbrida, explicaciones
src/lib/usage.ts      registro de consumo, presupuesto e interruptor de la API
src/app/api/          rutas REST (las consume la UI y el front del Figma)
src/app/(app)/        pantallas: inicio, búsqueda, carga, admin
src/components/ui/    componentes base (reutilizados del proyecto qb)
seed/                 candidatos sintéticos y sus PDFs
docs/costos.py        modelo de costos de la propuesta
```
