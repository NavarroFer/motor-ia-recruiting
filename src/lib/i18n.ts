import { cookies } from "next/headers";

export type Lang = "en" | "es";

export async function getLang(): Promise<Lang> {
  return (await cookies()).get("lang")?.value === "es" ? "es" : "en";
}

const en = {
  nav: { dashboard: "Dashboard", openings: "Job openings", search: "Search", candidates: "Candidates", upload: "Upload CVs", users: "Users & roles", usage: "Usage & API", logout: "Log out" },
  roles: { admin: "Admin", recruiter: "Recruiter", viewer: "Viewer" },
  login: { title: "Sign in", email: "Email", password: "Password", submit: "Sign in", error: "Wrong email or password", demo: "Demo users (password demo1234)" },
  dash: { indexed: "CVs indexed", searches: "Searches this month", shortlisted: "Shortlisted", spend: "AI spend this month", recent: "Recent searches", newSearch: "New search", upload: "Upload CVs", none: "No searches yet", results: "results" },
  search: {
    placeholder: "Python developer, 3+ years in cloud projects, leadership experience",
    run: "Search", rerun: "Apply changes", mandatory: "Required", nice: "Nice to have", addReq: "+ requirement", examples: "Try:",
    found: "candidates", meets: "Meet requirements", notMeeting: "Does not meet required", discardAll: "Discard all",
    tabs: { all: "All", shortlisted: "Shortlisted", selected: "Selected", discarded: "Discarded" },
    select: "Select", shortlist: "Shortlist", discard: "Discard", undo: "Undo", why: "Why this candidate", explaining: "Analyzing fit…",
    aiTag: "Suggested by AI", rulesTag: "Rule-based (AI off)", empty: "No candidates meet the required criteria", reasonTitle: "Why are you going against the AI flag?",
    reasonHelp: "This candidate does not meet a required criterion. Your reason helps improve the ranking.", reasonQuick: ["Equivalent experience", "Strong potential", "Requirement is negotiable"],
    confirm: "Confirm", cancel: "Cancel", years: "y", parsedRules: "API off: requirements detected with rules", semanticOff: "No semantic index: skill matching only",
  },
  status: { met: "Meets", unmet: "Missing", unknown: "Not verified" },
  cand: { contact: "Contact", locked: "No access to contact data", why: "Why it matches", skills: "Skills", experience: "Experience", languages: "Languages", education: "Education", history: "History", original: "Original CV", close: "Close", leadership: "Leadership" },
  open: { new: "New opening", title: "Job title", titlePh: "Senior Python Backend Engineer", desc: "Job description", descPh: "Paste the job post. Requirements are extracted automatically and you can edit them.", create: "Create opening", creating: "Reading the job description…", status: { open: "Open", closed: "Closed" }, matches: "matching", shortlisted: "shortlisted", selected: "selected", none: "No openings yet", close: "Close opening", reopen: "Reopen", closedInfo: "Closed. Decisions are frozen; data is kept until {date} (EEOC retention), then anonymized.", save: "Save requirements", showDesc: "Job description", fitsIn: "Fits these open openings", noFit: "No open openings", missing: "missing", nice: "nice to have", created: "Created" },
  cands: { profiles: "indexed profiles", filter: "Filter by name, role, skill, country…", profile: "Candidate", noName: "Name not detected", hidden: "Candidate", skills: "Top skills", location: "Country · mode", index: "Index", added: "Added", semantic: "Semantic + skills", skillsOnly: "Skills only (no vector)" },
  upload: { drop: "Drop a .zip, PDF, DOCX or images here", choose: "Choose files", uploading: "Uploading…", result: "{r} received · {d} duplicates · {u} unsupported", file: "File", size: "Size", status: "Status", date: "Uploaded", preview: "Preview", openTab: "Open in new tab", download: "Download", noPreview: "This format has no preview in the browser. Download the file to open it." },
  docStatus: { received: "Received", paused: "Waiting (API off)", extracting: "Extracting text", structuring: "Structuring", indexed: "Indexed", queued_budget: "Queued (budget)", duplicate: "Possible duplicate", error: "Error" },
  usage: {
    api: "AI API", apiOn: "Active", apiOff: "Paused: no model calls, CVs wait in queue", auto: "Automatic processing", autoHelp: "Off: CVs are processed one by one with the button below.",
    budget: "Monthly AI budget (USD)", save: "Save", spent: "Spent", of: "of", queue: "Queue", processOne: "Process 1 CV now", processing: "Processing…", pick: "Next in queue", breakdown: "Spend by type",
    kind: "Type", calls: "Calls", tokens: "Tokens in / out", cost: "Cost (USD)", keys: "API keys", missing: "missing in .env.local", done: "Done", enableFirst: "Turn on the API first",
  },
  users: { invite: "Invite user", name: "Name", email: "Email", role: "Role", status: "Status", last: "Last login", temp: "Temporary password", perms: { admin: "Everything, including users, budget and API", recruiter: "Search, upload and decide", viewer: "Read only, no contact data" } },
};

const es: typeof en = {
  nav: { dashboard: "Inicio", openings: "Vacantes", search: "Búsqueda", candidates: "Candidatos", upload: "Cargar CVs", users: "Usuarios y roles", usage: "Consumo y API", logout: "Salir" },
  roles: { admin: "Admin", recruiter: "Reclutador", viewer: "Visualizador" },
  login: { title: "Ingresar", email: "Email", password: "Contraseña", submit: "Ingresar", error: "Email o contraseña incorrectos", demo: "Usuarios de demo (contraseña demo1234)" },
  dash: { indexed: "CVs indexados", searches: "Búsquedas del mes", shortlisted: "Preseleccionados", spend: "Gasto de IA del mes", recent: "Últimas búsquedas", newSearch: "Nueva búsqueda", upload: "Cargar CVs", none: "Todavía no hay búsquedas", results: "resultados" },
  search: {
    placeholder: "Desarrollador Python, 3+ años en proyectos cloud, con liderazgo",
    run: "Buscar", rerun: "Aplicar cambios", mandatory: "Obligatorio", nice: "Deseable", addReq: "+ requisito", examples: "Probá:",
    found: "candidatos", meets: "Cumplen los requisitos", notMeeting: "No cumple obligatorios", discardAll: "Descartar todos",
    tabs: { all: "Todos", shortlisted: "Preseleccionados", selected: "Seleccionados", discarded: "Descartados" },
    select: "Seleccionar", shortlist: "Preseleccionar", discard: "Descartar", undo: "Deshacer", why: "Por qué este candidato", explaining: "Analizando el ajuste…",
    aiTag: "Sugerido por IA", rulesTag: "Por reglas (IA apagada)", empty: "Ningún candidato cumple los requisitos obligatorios", reasonTitle: "¿Por qué vas en contra de la marca de la IA?",
    reasonHelp: "Este candidato no cumple un requisito obligatorio. Tu motivo ayuda a mejorar el ranking.", reasonQuick: ["Experiencia equivalente", "Alto potencial", "El requisito es negociable"],
    confirm: "Confirmar", cancel: "Cancelar", years: "a", parsedRules: "API apagada: requisitos detectados por reglas", semanticOff: "Sin índice semántico: solo coincidencia de skills",
  },
  status: { met: "Cumple", unmet: "Falta", unknown: "Sin verificar" },
  cand: { contact: "Contacto", locked: "Sin acceso a datos de contacto", why: "Por qué matchea", skills: "Skills", experience: "Experiencia", languages: "Idiomas", education: "Formación", history: "Historial", original: "CV original", close: "Cerrar", leadership: "Liderazgo" },
  open: { new: "Nueva vacante", title: "Título del puesto", titlePh: "Senior Python Backend Engineer", desc: "Descripción del puesto", descPh: "Pegá el aviso. Los requisitos se extraen solos y los podés editar.", create: "Crear vacante", creating: "Leyendo la descripción…", status: { open: "Abierta", closed: "Cerrada" }, matches: "que cumplen", shortlisted: "preseleccionados", selected: "seleccionados", none: "Todavía no hay vacantes", close: "Cerrar vacante", reopen: "Reabrir", closedInfo: "Cerrada. Las decisiones quedan congeladas; los datos se conservan hasta el {date} (retención EEOC) y después se anonimizan.", save: "Guardar requisitos", showDesc: "Descripción del puesto", fitsIn: "Encaja en estas vacantes abiertas", noFit: "No hay vacantes abiertas", missing: "falta", nice: "deseables", created: "Creada" },
  cands: { profiles: "perfiles indexados", filter: "Filtrar por nombre, rol, skill, país…", profile: "Candidato", noName: "Nombre no detectado", hidden: "Candidato", skills: "Top skills", location: "País · modalidad", index: "Índice", added: "Cargado", semantic: "Semántico + skills", skillsOnly: "Solo skills (sin vector)" },
  upload: { drop: "Soltá un .zip, PDF, DOCX o imágenes", choose: "Elegir archivos", uploading: "Subiendo…", result: "{r} recibidos · {d} duplicados · {u} no soportados", file: "Archivo", size: "Tamaño", status: "Estado", date: "Subido", preview: "Vista previa", openTab: "Abrir en otra pestaña", download: "Descargar", noPreview: "Este formato no se puede previsualizar en el navegador. Descargá el archivo para abrirlo." },
  docStatus: { received: "Recibido", paused: "En espera (API apagada)", extracting: "Extrayendo texto", structuring: "Estructurando", indexed: "Indexado", queued_budget: "En cola (presupuesto)", duplicate: "Posible duplicado", error: "Error" },
  usage: {
    api: "API de IA", apiOn: "Activa", apiOff: "Pausada: no se llama a modelos, los CVs esperan en cola", auto: "Procesamiento automático", autoHelp: "Apagado: los CVs se procesan de a uno con el botón de abajo.",
    budget: "Presupuesto mensual de IA (USD)", save: "Guardar", spent: "Gastado", of: "de", queue: "Cola", processOne: "Procesar 1 CV ahora", processing: "Procesando…", pick: "Próximo en cola", breakdown: "Gasto por tipo",
    kind: "Tipo", calls: "Llamadas", tokens: "Tokens entrada / salida", cost: "Costo (USD)", keys: "API keys", missing: "falta en .env.local", done: "Listo", enableFirst: "Activá la API primero",
  },
  users: { invite: "Invitar usuario", name: "Nombre", email: "Email", role: "Rol", status: "Estado", last: "Último acceso", temp: "Contraseña temporal", perms: { admin: "Todo, incluidos usuarios, presupuesto y API", recruiter: "Buscar, cargar y decidir", viewer: "Solo lectura, sin datos de contacto" } },
};

export type Dict = typeof en;
export const dicts: Record<Lang, Dict> = { en, es };
export async function getDict(): Promise<{ lang: Lang; t: Dict }> {
  const lang = await getLang();
  return { lang, t: dicts[lang] };
}
