-- Esquema idempotente: corre igual en Postgres (docker) y en PGlite.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS tenants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  monthly_budget_usd numeric(10,2) NOT NULL DEFAULT 25,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  email         text NOT NULL UNIQUE,
  name          text NOT NULL,
  role          text NOT NULL CHECK (role IN ('admin','recruiter','viewer')),
  password_hash text NOT NULL,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','disabled')),
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Ajustes globales de la plataforma (interruptor de la API, etc.)
CREATE TABLE IF NOT EXISTS settings (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);

-- Archivo subido. El binario va a disco (S3 en producción); acá solo metadatos.
CREATE TABLE IF NOT EXISTS documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  file_name   text NOT NULL,
  mime_type   text NOT NULL,
  size_bytes  integer NOT NULL,
  sha256      text NOT NULL,
  storage_path text NOT NULL,
  status      text NOT NULL DEFAULT 'received'
              CHECK (status IN ('received','paused','extracting','structuring','indexed','queued_budget','duplicate','error')),
  error       text,
  candidate_id uuid,
  duplicate_of uuid,
  uploaded_by uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sha256)
);

-- Perfil estructurado y ANONIMIZADO. Nunca contiene PII.
CREATE TABLE IF NOT EXISTS candidates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  document_id   uuid REFERENCES documents(id),
  headline      text NOT NULL,          -- "Senior Backend Engineer"
  seniority     text,                   -- junior | mid | senior | lead | principal
  total_years   numeric(4,1),
  country       text,
  work_mode     text,                   -- remote | hybrid | onsite
  industries    text[] NOT NULL DEFAULT '{}',
  languages     jsonb NOT NULL DEFAULT '[]',   -- [{name, level}]
  education     jsonb NOT NULL DEFAULT '[]',   -- [{degree, field}]
  experience    jsonb NOT NULL DEFAULT '[]',   -- [{title, company_type, start, end, summary}]
  leadership    jsonb NOT NULL DEFAULT '[]',   -- [{evidence}]
  summary       text NOT NULL,
  profile_json  jsonb NOT NULL,         -- salida validada del modelo, completa
  embedding     vector(1536),
  model         text,
  prompt_version text,
  source_hash   text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidate_skills (
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  skill        text NOT NULL,           -- normalizado en minúsculas: "python", "aws"
  years        numeric(4,1) NOT NULL DEFAULT 0,
  evidence     text,
  PRIMARY KEY (candidate_id, skill)
);
CREATE INDEX IF NOT EXISTS idx_skills_skill ON candidate_skills (skill, years);

-- PII separada y cifrada (AES-256-GCM). Solo se descifra al abrir una ficha.
CREATE TABLE IF NOT EXISTS candidate_pii (
  candidate_id uuid PRIMARY KEY REFERENCES candidates(id) ON DELETE CASCADE,
  ciphertext   text NOT NULL,
  email_hash   text,
  phone_hash   text
);

CREATE TABLE IF NOT EXISTS searches (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  user_id      uuid NOT NULL REFERENCES users(id),
  query        text NOT NULL,
  requirements jsonb NOT NULL,          -- {mandatory:[], nice_to_have:[]}
  result_count integer NOT NULL DEFAULT 0,
  duration_ms  integer,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Vacante: búsqueda con nombre, descripción y ciclo de vida. Las decisiones viven en su búsqueda asociada.
CREATE TABLE IF NOT EXISTS openings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  title           text NOT NULL,
  description     text NOT NULL,
  requirements    jsonb NOT NULL,
  search_id       uuid NOT NULL REFERENCES searches(id),
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_by      uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  closed_at       timestamptz,
  retention_until timestamptz          -- cierre + 12 meses (EEOC); después: anonimizar o talent pool
);
ALTER TABLE searches ADD COLUMN IF NOT EXISTS opening_id uuid;

-- Avisos de "CV nuevo parecido a tus elegidos" por vacante (aprendizaje por decisiones)
CREATE TABLE IF NOT EXISTS opening_alerts (
  opening_id   uuid NOT NULL REFERENCES openings(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  similarity   real NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  seen_at      timestamptz,
  PRIMARY KEY (opening_id, candidate_id)
);

-- Caché de explicaciones por (búsqueda, candidato)
CREATE TABLE IF NOT EXISTS explanations (
  search_id    uuid NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  text         jsonb NOT NULL,          -- {match:[], gaps:[], summary}
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (search_id, candidate_id)
);

-- Decisión humana sobre un candidato en una búsqueda
CREATE TABLE IF NOT EXISTS decisions (
  search_id    uuid NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  status       text NOT NULL CHECK (status IN ('selected','shortlisted','discarded')),
  reason       text,
  user_id      uuid NOT NULL REFERENCES users(id),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (search_id, candidate_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id           bigserial PRIMARY KEY,
  tenant_id    uuid NOT NULL,
  user_id      uuid,
  action       text NOT NULL,           -- select | shortlist | discard | view_pii | upload | budget_change ...
  candidate_id uuid,
  search_id    uuid,
  detail       jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log (tenant_id, created_at DESC);

-- Cada llamada a un modelo: base de los caps, el panel de consumo y la facturación
CREATE TABLE IF NOT EXISTS usage (
  id            bigserial PRIMARY KEY,
  tenant_id     uuid NOT NULL,
  kind          text NOT NULL,          -- ingest | ingest_vision | query_parse | explain | embedding
  model         text NOT NULL,
  input_tokens  integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_usd      numeric(12,6) NOT NULL,
  document_id   uuid,
  search_id     uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_usage_tenant ON usage (tenant_id, created_at);

-- Cola de trabajos sobre Postgres (en producción: SQS). FOR UPDATE SKIP LOCKED.
CREATE TABLE IF NOT EXISTS jobs (
  id          bigserial PRIMARY KEY,
  kind        text NOT NULL,            -- process_document
  payload     jsonb NOT NULL,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed','waiting_budget')),
  attempts    integer NOT NULL DEFAULT 0,
  run_after   timestamptz NOT NULL DEFAULT now(),
  last_error  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jobs_pending ON jobs (status, run_after);
