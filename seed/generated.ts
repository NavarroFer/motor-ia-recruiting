// Candidatos SINTÉTICOS generados (no son personas reales) para que la demo tenga volumen: roles, seniorities,
// países e industrias variados. Semilla fija: cada corrida produce los mismos PDFs y perfiles.
// Como en personas.ts, el perfil es el que devolvería el pipeline para ese CV, así el seed no gasta API.
// Los nombres usan solo caracteres que entran en la fuente estándar del PDF (Latin-1).
import type { ExtractedProfile } from "@/lib/ai/prompts";
import type { Persona } from "./personas";

type Seniority = ExtractedProfile["seniority"];
const SENIORITIES: Seniority[] = ["junior", "mid", "senior", "lead", "principal"];
const YEARS: [number, number][] = [[0.8, 2.4], [2.5, 4.9], [5, 8.9], [7, 12.9], [12, 19]]; // por seniority
const NOW = { y: 2026, m: 10 };

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Datos de base ----------
const NAMES = {
  hispanic: {
    first: ["Martina", "Lucía", "Sofía", "Julieta", "Agustina", "Diego", "Santiago", "Matías", "Joaquín", "Nicolás", "Florencia", "Bruno", "Tomás", "Valeria", "Andrés", "Gabriela", "Felipe", "Carolina", "Javier", "Renata", "Emiliano", "Paula", "Ignacio", "Micaela"],
    last: ["González", "Rodríguez", "Fernández", "López", "Martínez", "Pérez", "García", "Sánchez", "Romero", "Díaz", "Álvarez", "Ruiz", "Ramírez", "Flores", "Acosta", "Benítez", "Medina", "Herrera", "Castro", "Vega", "Molina", "Suárez"],
  },
  lusophone: {
    first: ["João", "Pedro", "Beatriz", "Rafael", "Gustavo", "Larissa", "Thiago", "Mariana", "Letícia", "Caio", "Fernanda", "Rodrigo"],
    last: ["Silva", "Santos", "Oliveira", "Souza", "Costa", "Almeida", "Carvalho", "Ribeiro", "Lima", "Barbosa", "Rocha", "Moreira"],
  },
  anglo: {
    first: ["Emma", "Olivia", "Noah", "Liam", "Ava", "Ethan", "Mia", "Chloe", "Jack", "Grace", "Owen", "Hannah", "Caleb", "Zoe"],
    last: ["Smith", "Johnson", "Brown", "Miller", "Davis", "Wilson", "Anderson", "Taylor", "Moore", "Clark", "Walker", "Hughes", "Bennett", "Foster"],
  },
  central_eu: {
    first: ["Lena", "Jonas", "Leon", "Marta", "Piotr", "Katarzyna", "Felix", "Anja", "Lukas", "Ewa", "Jan", "Clara"],
    last: ["Müller", "Schmidt", "Wagner", "Nowak", "Kowalski", "Hoffmann", "Zielinski", "Becker", "Krause", "Lewandowski", "Fischer", "Wojcik"],
  },
  indian: {
    first: ["Aarav", "Ananya", "Rohan", "Vikram", "Sneha", "Arjun", "Kavya", "Ishaan", "Meera", "Karthik"],
    last: ["Patel", "Reddy", "Iyer", "Gupta", "Nair", "Mehta", "Rao", "Singh", "Menon", "Kulkarni"],
  },
  african: {
    first: ["Chinedu", "Amara", "Tunde", "Ngozi", "Wanjiru", "Kofi", "Zainab", "Brian", "Achieng", "Emeka"],
    last: ["Okafor", "Adeyemi", "Mwangi", "Otieno", "Mensah", "Bello", "Njoroge", "Eze", "Kamau", "Owusu"],
  },
  se_asian: {
    first: ["Miguel", "Andrea", "Paolo", "Linh", "Minh", "Thao", "Duc", "Bea", "Carlo", "Hoa"],
    last: ["Reyes", "Cruz", "Bautista", "Nguyen", "Tran", "Pham", "Le", "Villanueva", "Hoang", "Mendoza"],
  },
  arabic: {
    first: ["Omar", "Nour", "Youssef", "Salma", "Karim", "Laila"],
    last: ["Hassan", "Mostafa", "Ibrahim", "Farouk", "Saleh", "Mansour"],
  },
};

const COUNTRIES: { name: string; cities: string[]; phone: string; native: string; names: keyof typeof NAMES; w: number }[] = [
  { name: "Argentina", cities: ["Buenos Aires", "Córdoba", "Rosario", "Mendoza"], phone: "+54 11", native: "Spanish", names: "hispanic", w: 5 },
  { name: "Mexico", cities: ["Mexico City", "Guadalajara", "Monterrey"], phone: "+52 55", native: "Spanish", names: "hispanic", w: 3 },
  { name: "Colombia", cities: ["Bogotá", "Medellín"], phone: "+57 1", native: "Spanish", names: "hispanic", w: 3 },
  { name: "Chile", cities: ["Santiago", "Valparaíso"], phone: "+56 2", native: "Spanish", names: "hispanic", w: 2 },
  { name: "Uruguay", cities: ["Montevideo"], phone: "+598 2", native: "Spanish", names: "hispanic", w: 1 },
  { name: "Peru", cities: ["Lima"], phone: "+51 1", native: "Spanish", names: "hispanic", w: 1 },
  { name: "Spain", cities: ["Madrid", "Barcelona", "Valencia"], phone: "+34 91", native: "Spanish", names: "hispanic", w: 2 },
  { name: "Brazil", cities: ["São Paulo", "Florianópolis", "Recife"], phone: "+55 11", native: "Portuguese", names: "lusophone", w: 3 },
  { name: "Portugal", cities: ["Lisbon", "Porto"], phone: "+351 21", native: "Portuguese", names: "lusophone", w: 1 },
  { name: "USA", cities: ["Austin, TX", "Seattle, WA", "Chicago, IL", "Atlanta, GA", "Denver, CO"], phone: "+1 512", native: "English", names: "anglo", w: 4 },
  { name: "Canada", cities: ["Toronto", "Vancouver"], phone: "+1 416", native: "English", names: "anglo", w: 2 },
  { name: "Germany", cities: ["Berlin", "Munich", "Hamburg"], phone: "+49 30", native: "German", names: "central_eu", w: 2 },
  { name: "Poland", cities: ["Warsaw", "Kraków"], phone: "+48 22", native: "Polish", names: "central_eu", w: 2 },
  { name: "India", cities: ["Bangalore", "Pune", "Hyderabad"], phone: "+91 80", native: "Hindi", names: "indian", w: 3 },
  { name: "Nigeria", cities: ["Lagos", "Abuja"], phone: "+234 1", native: "Yoruba", names: "african", w: 2 },
  { name: "Kenya", cities: ["Nairobi"], phone: "+254 20", native: "Swahili", names: "african", w: 1 },
  { name: "Philippines", cities: ["Manila", "Cebu"], phone: "+63 2", native: "Filipino", names: "se_asian", w: 2 },
  { name: "Vietnam", cities: ["Ho Chi Minh City", "Hanoi"], phone: "+84 28", native: "Vietnamese", names: "se_asian", w: 1 },
  { name: "Egypt", cities: ["Cairo", "Alexandria"], phone: "+20 2", native: "Arabic", names: "arabic", w: 1 },
];

const COMPANIES: [string, string][] = [
  ["PayNova", "fintech"], ["Monedo", "fintech"], ["CrediSur", "banking"], ["BancoAustral", "banking"], ["MediCore", "healthcare"],
  ["Clinix", "healthcare"], ["CartaViva", "e-commerce"], ["Tiendaflow", "e-commerce"], ["RutaLogix", "logistics"], ["CargoNorte", "logistics"],
  ["Aprendo", "edtech"], ["Lumen Learning Labs", "edtech"], ["Viajala", "travel"], ["Hostería Digital", "travel"], ["CampoSense", "agritech"],
  ["Streamora", "media"], ["Seguralia", "insurtech"], ["PixelQuest", "gaming"], ["Facturo", "saas"], ["Ordenly", "saas"],
  ["Mercatto", "retail"], ["Voltia", "energy"], ["Conecta Telecom", "telecom"],
];
const DOMAIN: Record<string, string> = {
  fintech: "payments", banking: "credit scoring", healthcare: "patient records", "e-commerce": "checkout", logistics: "shipment tracking",
  edtech: "online courses", travel: "booking", agritech: "crop monitoring", media: "video streaming", insurtech: "claims",
  gaming: "matchmaking", saas: "billing", retail: "inventory", energy: "smart metering", telecom: "network monitoring",
};

const DISPLAY: Record<string, string> = {
  python: "Python", java: "Java", kotlin: "Kotlin", go: "Go", "node.js": "Node.js", typescript: "TypeScript", "c#": "C#", ".net": ".NET",
  react: "React", "next.js": "Next.js", vue: "Vue", angular: "Angular", css: "CSS", accessibility: "Accessibility (WCAG)", storybook: "Storybook",
  jest: "Jest", aws: "AWS", gcp: "GCP", azure: "Azure", docker: "Docker", kubernetes: "Kubernetes", terraform: "Terraform",
  postgresql: "PostgreSQL", mysql: "MySQL", mongodb: "MongoDB", redis: "Redis", kafka: "Kafka", graphql: "GraphQL", grpc: "gRPC",
  django: "Django", fastapi: "FastAPI", flask: "Flask", "spring boot": "Spring Boot", "sql server": "SQL Server", sql: "SQL",
  airflow: "Airflow", spark: "Spark", bigquery: "BigQuery", dbt: "dbt", snowflake: "Snowflake", pandas: "pandas", "scikit-learn": "scikit-learn",
  pytorch: "PyTorch", tensorflow: "TensorFlow", mlflow: "MLflow", statistics: "Statistics", "a/b testing": "A/B testing", tableau: "Tableau",
  swift: "Swift", ios: "iOS", android: "Android", "react native": "React Native", flutter: "Flutter", dart: "Dart", firebase: "Firebase",
  selenium: "Selenium", playwright: "Playwright", cypress: "Cypress", pytest: "pytest", jmeter: "JMeter", postman: "Postman", "ci/cd": "CI/CD",
  prometheus: "Prometheus", grafana: "Grafana", linux: "Linux", figma: "Figma", "user research": "User research", "design systems": "Design systems",
  prototyping: "Prototyping", "usability testing": "Usability testing", "product discovery": "Product discovery", roadmapping: "Roadmapping",
  jira: "Jira", analytics: "Product analytics", "application security": "Application security", owasp: "OWASP", "penetration testing": "Penetration testing",
  siem: "SIEM", nestjs: "NestJS",
};
const show = (s: string) => DISPLAY[s] ?? s;

type Ctx = { domain: string; n: number; pct: number };
// Un bullet de experiencia por skill: así cada skill del perfil tiene evidencia en el CV
const PHRASE: Record<string, (c: Ctx) => string> = {
  python: (c) => `Built ${c.domain} services in Python handling ${c.n}k requests per day.`,
  java: (c) => `Developed ${c.domain} microservices in Java with a focus on reliability.`,
  kotlin: (c) => `Wrote new ${c.domain} services in Kotlin and migrated legacy Java modules.`,
  go: (c) => `Built high-throughput ${c.domain} services in Go.`,
  "node.js": (c) => `Built ${c.domain} APIs in Node.js.`,
  typescript: (c) => `Moved the ${c.domain} codebase to TypeScript in strict mode.`,
  "c#": (c) => `Developed ${c.domain} features in C#.`,
  ".net": (c) => `Maintained .NET services for ${c.domain}.`,
  react: (c) => `Built the ${c.domain} web app in React, used by ${c.n}k monthly users.`,
  "next.js": (c) => `Implemented server-rendered pages with Next.js, improving LCP by ${c.pct}%.`,
  vue: (c) => `Built ${c.domain} dashboards in Vue.`,
  angular: (c) => `Maintained the Angular front end for ${c.domain}.`,
  css: () => `Created responsive layouts and a shared CSS token system.`,
  accessibility: (c) => `Brought key ${c.domain} flows to WCAG 2.1 AA.`,
  storybook: () => `Documented 40+ components in Storybook.`,
  jest: () => `Raised front-end test coverage with Jest and Testing Library.`,
  aws: () => `Deployed and operated services on AWS (ECS, Lambda, RDS).`,
  gcp: () => `Ran workloads on Google Cloud (Cloud Run, Pub/Sub).`,
  azure: () => `Deployed services on Microsoft Azure (AKS, Functions).`,
  docker: () => `Containerized services with Docker for local and CI environments.`,
  kubernetes: (c) => `Operated Kubernetes clusters running ${Math.max(8, Math.round(c.n / 4))} services.`,
  terraform: () => `Managed infrastructure as code with Terraform.`,
  postgresql: (c) => `Designed PostgreSQL schemas and tuned slow queries for ${c.domain}.`,
  mysql: (c) => `Optimized MySQL queries, cutting report times by ${c.pct}%.`,
  mongodb: (c) => `Modeled ${c.domain} data in MongoDB.`,
  redis: (c) => `Added Redis caching, reducing database load by ${c.pct}%.`,
  kafka: (c) => `Built event streaming for ${c.domain} with Kafka.`,
  graphql: () => `Designed the GraphQL API consumed by web and mobile clients.`,
  grpc: () => `Defined gRPC contracts between internal services.`,
  django: (c) => `Maintained a Django application for ${c.domain}.`,
  fastapi: () => `Built REST APIs with FastAPI.`,
  flask: () => `Developed internal services with Flask.`,
  "spring boot": (c) => `Built Spring Boot services for ${c.domain}.`,
  "sql server": () => `Maintained SQL Server databases and stored procedures.`,
  sql: (c) => `Wrote SQL models and reports for ${c.domain} metrics.`,
  airflow: (c) => `Orchestrated ${Math.max(10, Math.round(c.n / 2))} daily pipelines with Airflow.`,
  spark: (c) => `Processed large ${c.domain} datasets with Spark.`,
  bigquery: (c) => `Modeled the ${c.domain} warehouse in BigQuery.`,
  dbt: () => `Introduced dbt for tested, documented transformations.`,
  snowflake: () => `Migrated the analytics warehouse to Snowflake.`,
  pandas: (c) => `Cleaned and analyzed ${c.domain} data with pandas.`,
  "scikit-learn": (c) => `Trained ${c.domain} prediction models with scikit-learn.`,
  pytorch: (c) => `Trained deep learning models in PyTorch for ${c.domain}.`,
  tensorflow: () => `Deployed TensorFlow models to production.`,
  mlflow: () => `Tracked experiments and model versions with MLflow.`,
  statistics: (c) => `Designed experiments and statistical analyses for ${c.domain}.`,
  "a/b testing": (c) => `Ran A/B tests that lifted conversion by ${Math.round(c.pct / 5)}%.`,
  tableau: () => `Built Tableau dashboards for leadership reviews.`,
  swift: (c) => `Built iOS features in Swift for the ${c.domain} app.`,
  ios: (c) => `Shipped the ${c.domain} iOS app to the App Store.`,
  android: (c) => `Shipped the ${c.domain} Android app to Google Play.`,
  "react native": (c) => `Built the cross-platform ${c.domain} app in React Native.`,
  flutter: (c) => `Built the ${c.domain} mobile app in Flutter.`,
  dart: () => `Wrote shared business logic in Dart.`,
  firebase: () => `Integrated Firebase for push notifications and analytics.`,
  selenium: () => `Automated regression suites with Selenium.`,
  playwright: () => `Built end-to-end tests with Playwright.`,
  cypress: (c) => `Wrote Cypress tests for critical ${c.domain} flows.`,
  pytest: () => `Built API test suites with pytest.`,
  jmeter: () => `Ran load tests with JMeter before major releases.`,
  postman: () => `Maintained Postman collections for API contract tests.`,
  "ci/cd": () => `Set up CI/CD pipelines with automated tests and deploys.`,
  prometheus: () => `Defined SLOs and alerts with Prometheus.`,
  grafana: () => `Built Grafana dashboards for on-call teams.`,
  linux: () => `Hardened and maintained Linux hosts.`,
  figma: (c) => `Designed ${c.domain} flows in Figma, from wireframes to high fidelity.`,
  "user research": (c) => `Ran ${Math.max(12, Math.round(c.n / 3))} user interviews to define ${c.domain} improvements.`,
  "design systems": () => `Built and maintained the company design system.`,
  prototyping: (c) => `Prototyped and tested new ${c.domain} features with users.`,
  "usability testing": (c) => `Ran usability tests that informed the ${c.domain} redesign.`,
  "product discovery": (c) => `Led discovery for the ${c.domain} product line.`,
  roadmapping: (c) => `Owned the quarterly roadmap for ${c.domain}.`,
  jira: () => `Ran agile ceremonies and the backlog in Jira.`,
  analytics: (c) => `Defined product metrics and dashboards for ${c.domain}.`,
  "application security": (c) => `Led application security reviews for ${c.domain} services.`,
  owasp: () => `Trained engineers on the OWASP Top 10 and secure coding.`,
  "penetration testing": () => `Performed penetration tests on web and mobile apps.`,
  siem: () => `Tuned SIEM detections and handled incident response.`,
  nestjs: () => `Built modular back-end services with NestJS.`,
};

interface Archetype {
  w: number;
  titles: [string, string, string, string, string]; // junior → principal
  core: string[];
  pools?: string[][]; // se elige uno de cada pool
  extras: string[];
  focus: (has: (s: string) => boolean, cloud: string) => string;
  degrees: [string, string][];
  team?: string; // "engineers", "designers"...
}
const CLOUD = ["aws", "gcp", "azure"];
const CS: [string, string][] = [["B.Sc.", "Computer Science"], ["B.Sc.", "Software Engineering"], ["B.Sc.", "Information Systems"], ["B.Sc.", "Computer Engineering"]];
const ARCHETYPES: Archetype[] = [
  { w: 5, titles: ["Junior Python Developer", "Python Developer", "Senior Backend Engineer", "Backend Tech Lead", "Principal Backend Engineer"],
    core: ["python"], pools: [CLOUD], extras: ["django", "fastapi", "flask", "postgresql", "redis", "docker", "kafka", "terraform"],
    focus: (_, cloud) => `building Python services on ${show(cloud)}`, degrees: CS },
  { w: 2, titles: ["Junior Java Developer", "Java Developer", "Senior Java Engineer", "Java Team Lead", "Principal Software Engineer"],
    core: ["java", "spring boot"], pools: [CLOUD], extras: ["kotlin", "postgresql", "kafka", "docker", "kubernetes", "mysql", "redis"],
    focus: () => "building Java and Spring Boot microservices", degrees: CS },
  { w: 2, titles: ["Junior Node.js Developer", "Node.js Developer", "Senior Backend Engineer (Node.js)", "Backend Lead (Node.js)", "Principal Engineer"],
    core: ["node.js", "typescript"], pools: [CLOUD], extras: ["postgresql", "mongodb", "graphql", "docker", "redis", "nestjs"],
    focus: () => "building TypeScript APIs on Node.js", degrees: CS },
  { w: 1, titles: ["Junior Go Developer", "Go Developer", "Senior Go Engineer", "Platform Tech Lead", "Principal Platform Engineer"],
    core: ["go"], pools: [CLOUD], extras: ["kubernetes", "docker", "postgresql", "grpc", "kafka", "redis"],
    focus: () => "building distributed systems in Go", degrees: CS },
  { w: 1, titles: ["Junior .NET Developer", ".NET Developer", "Senior .NET Engineer", ".NET Tech Lead", "Principal .NET Architect"],
    core: ["c#", ".net", "azure"], extras: ["sql server", "docker", "react", "kubernetes"],
    focus: () => "building .NET services on Azure", degrees: CS },
  { w: 3, titles: ["Junior Frontend Developer", "Frontend Developer", "Senior Frontend Engineer", "Frontend Tech Lead", "Principal Frontend Engineer"],
    core: ["react", "typescript"], extras: ["next.js", "css", "accessibility", "storybook", "graphql", "jest"],
    focus: (has) => (has("accessibility") ? "building accessible React interfaces" : "building React applications"), degrees: CS },
  { w: 1, titles: ["Junior Frontend Developer", "Frontend Developer", "Senior Frontend Engineer", "Frontend Lead", "Principal Frontend Engineer"],
    core: ["typescript"], pools: [["vue", "angular"]], extras: ["css", "accessibility", "jest", "graphql"],
    focus: (has) => `building ${has("vue") ? "Vue" : "Angular"} applications`, degrees: CS },
  { w: 2, titles: ["Junior Full Stack Developer", "Full Stack Developer", "Senior Full Stack Engineer", "Full Stack Tech Lead", "Principal Engineer"],
    core: ["react", "node.js", "typescript"], pools: [CLOUD], extras: ["postgresql", "docker", "next.js", "graphql", "mongodb"],
    focus: () => "building end-to-end features with React and Node.js", degrees: CS },
  { w: 3, titles: ["Junior Data Engineer", "Data Engineer", "Senior Data Engineer", "Data Engineering Lead", "Principal Data Engineer"],
    core: ["python", "sql"], pools: [CLOUD], extras: ["airflow", "spark", "dbt", "kafka", "bigquery", "snowflake"],
    focus: (has, cloud) => `building data pipelines in Python${has("bigquery") || cloud === "gcp" ? " on Google Cloud" : ` on ${show(cloud)}`}`,
    degrees: [...CS, ["B.Sc.", "Mathematics"]] },
  { w: 2, titles: ["Junior Data Scientist", "Data Scientist", "Senior Data Scientist", "Lead Data Scientist", "Principal Data Scientist"],
    core: ["python", "statistics", "sql"], extras: ["pandas", "scikit-learn", "tableau", "a/b testing", "pytorch"],
    focus: () => "turning product and business data into models and decisions", degrees: [["M.Sc.", "Data Science"], ["B.Sc.", "Statistics"], ["B.Sc.", "Mathematics"]] },
  { w: 2, titles: ["Junior ML Engineer", "Machine Learning Engineer", "Senior Machine Learning Engineer", "ML Tech Lead", "Principal ML Engineer"],
    core: ["python", "pytorch"], pools: [CLOUD], extras: ["tensorflow", "kubernetes", "mlflow", "scikit-learn", "docker"],
    focus: () => "taking machine learning models to production", degrees: [["M.Sc.", "Computer Science"], ["M.Sc.", "Artificial Intelligence"], ...CS] },
  { w: 2, titles: ["Junior DevOps Engineer", "DevOps Engineer", "Senior Site Reliability Engineer", "SRE Lead", "Principal Platform Engineer"],
    core: ["kubernetes", "terraform"], pools: [CLOUD], extras: ["docker", "prometheus", "grafana", "linux", "python", "go", "ci/cd"],
    focus: (_, cloud) => `running reliable infrastructure on ${show(cloud)}`, degrees: CS },
  { w: 2, titles: ["Junior Mobile Developer", "Mobile Developer", "Senior Mobile Engineer", "Mobile Tech Lead", "Principal Mobile Engineer"],
    core: [], pools: [["swift", "kotlin", "react native", "flutter"]], extras: ["ci/cd", "firebase", "graphql"],
    focus: (has) => `building mobile apps with ${has("swift") ? "Swift for iOS" : has("kotlin") ? "Kotlin for Android" : has("flutter") ? "Flutter" : "React Native"}`,
    degrees: CS },
  { w: 1, titles: ["Junior QA Analyst", "QA Automation Engineer", "Senior QA Automation Engineer", "QA Lead", "Principal Quality Engineer"],
    core: [], pools: [["selenium", "playwright", "cypress"], ["python", "typescript"]], extras: ["pytest", "jmeter", "ci/cd", "postman"],
    focus: () => "automating tests for web and APIs", degrees: [...CS, ["Technical degree", "Software Testing"]] },
  { w: 1, titles: ["Junior Product Designer", "Product Designer", "Senior Product Designer", "Design Lead", "Principal Product Designer"],
    core: ["figma", "user research"], extras: ["design systems", "prototyping", "accessibility", "usability testing"],
    focus: () => "designing digital products grounded in user research", degrees: [["B.A.", "Industrial Design"], ["B.A.", "Graphic Design"], ["B.Sc.", "Human-Computer Interaction"]], team: "designers" },
  { w: 1, titles: ["Associate Product Manager", "Product Manager", "Senior Product Manager", "Group Product Manager", "Director of Product"],
    core: ["product discovery", "roadmapping"], extras: ["a/b testing", "sql", "jira", "analytics"],
    focus: () => "leading product discovery and delivery", degrees: [["B.Sc.", "Industrial Engineering"], ["MBA", "Business Administration"], ...CS], team: "product managers" },
  { w: 1, titles: ["Junior Security Analyst", "Security Engineer", "Senior Application Security Engineer", "Security Lead", "Principal Security Engineer"],
    core: ["application security"], extras: ["owasp", "penetration testing", "aws", "siem", "python"],
    focus: () => "securing cloud applications", degrees: [...CS, ["B.Sc.", "Cybersecurity"]] },
];

// ---------- Generador ----------
const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const r1 = (n: number) => Math.round(n * 10) / 10;
const ym = (months: number) => {
  const total = NOW.y * 12 + (NOW.m - 1) - months;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
};

export function generatePersonas(count: number, reserved: Set<string>, seed = 20261025): Persona[] {
  const rand = rng(seed);
  const int = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const weighted = <T extends { w: number }>(xs: T[]) => {
    let x = rand() * xs.reduce((s, v) => s + v.w, 0);
    for (const v of xs) if ((x -= v.w) < 0) return v;
    return xs[xs.length - 1];
  };
  const sample = <T,>(xs: readonly T[], k: number) => {
    const pool = [...xs];
    const out: T[] = [];
    while (out.length < k && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    return out;
  };

  const used = new Set(reserved);
  const firstCount = new Map<string, number>(); // como mucho 2 personas con el mismo nombre de pila
  const out: Persona[] = [];
  while (out.length < count) {
    const country = weighted(COUNTRIES);
    const names = NAMES[country.names];
    const first = pick(names.first), last = pick(names.last);
    const slug = `${strip(first)}-${strip(last)}`.replace(/[^a-z]+/g, "-");
    if (used.has(slug) || (firstCount.get(first) ?? 0) >= 2) continue;
    used.add(slug);
    firstCount.set(first, (firstCount.get(first) ?? 0) + 1);

    const arch = weighted(ARCHETYPES);
    const level = (() => {
      const x = rand();
      return x < 0.14 ? 0 : x < 0.42 ? 1 : x < 0.72 ? 2 : x < 0.92 ? 3 : 4;
    })();
    const seniority = SENIORITIES[level];
    const [lo, hi] = YEARS[level];
    const years = r1(lo + rand() * (hi - lo));
    const cloud = pick(CLOUD);
    const chosenPools = (arch.pools ?? []).map((p) => (p === CLOUD ? cloud : pick(p)));
    const extras = sample(arch.extras.filter((e) => ![...arch.core, ...chosenPools].includes(e)), int(2, 4));
    const skills = [...new Set([...arch.core, ...chosenPools, ...extras])];
    const has = (s: string) => skills.includes(s);

    // Experiencia: 1 a 3 trabajos hasta hoy; el título sube con el tiempo
    const nJobs = years < 2.5 ? 1 : years < 6 ? 2 : 3;
    const totalMonths = Math.round(years * 12);
    const cuts = Array.from({ length: nJobs - 1 }, () => 0.3 + rand() * 0.4).sort();
    const shares = nJobs === 1 ? [1] : nJobs === 2 ? [cuts[0], 1 - cuts[0]] : [cuts[0] * 0.6, cuts[0] * 0.4 + (cuts[1] - cuts[0]) * 0.5, 1 - cuts[0] - (cuts[1] - cuts[0]) * 0.5];
    const companies = sample(COMPANIES, nJobs);
    let endAgo = 0;
    const leads = level >= 3, mentors = level === 2 && rand() < 0.4;
    const teamSize = int(3, level === 4 ? 12 : 7);
    const team = arch.team ?? "engineers";
    const evidence = new Map<string, string>(); // skill → primer bullet que la menciona
    const jobs = companies.map(([company, industry], j) => {
      const months = Math.max(6, Math.round(totalMonths * shares[j]));
      const start = ym(endAgo + months), end = j === 0 ? "present" : ym(endAgo);
      endAgo += months + (j === 0 ? 0 : 1);
      const ctx: Ctx = { domain: DOMAIN[industry], n: int(20, 400), pct: int(18, 65) };
      const own = j === 0 ? skills.slice(0, 3) : sample(skills, 2);
      const bullets = own.map((s) => {
        const text = (PHRASE[s] ?? (() => `Used ${show(s)} in production projects.`))(ctx);
        if (!evidence.has(s)) evidence.set(s, text.replace(/\.$/, ""));
        return text;
      });
      if (j === 0 && leads) bullets.unshift(`Lead a team of ${teamSize} ${team} and run hiring and career growth for the team.`);
      if (j === 0 && mentors) bullets.push(`Mentor ${int(2, 3)} junior ${team} through code reviews and pairing.`);
      return { title: arch.titles[Math.max(0, level - j)], company, industry, start, end, bullets };
    });

    // Años por skill: el núcleo cubre casi toda la carrera; lo demás, una parte
    const coreSet = new Set([...arch.core, ...chosenPools]);
    const skillRows = skills.map((s) => ({
      name: s,
      years: r1(Math.max(0.5, years * (coreSet.has(s) ? 0.8 + rand() * 0.2 : 0.3 + rand() * 0.6))),
      evidence: evidence.get(s),
    }));

    const english = country.native === "English" ? "native" : pick(["B2", "C1", "C1", "C2"]);
    const langs = country.native === "English" ? [{ name: "English", level: "native" }] : [{ name: country.native, level: "native" }, { name: "English", level: english }];
    if (country.native === "Portuguese" && rand() < 0.5) langs.push({ name: "Spanish", level: "B2" });
    if (country.native === "Spanish" && rand() < 0.25) langs.push({ name: "Portuguese", level: "B1" });

    const bootcamp = level <= 1 && rand() < 0.25;
    const [degree, field] = bootcamp ? ["Bootcamp", "Software Development"] : pick(arch.degrees);
    const city = pick(country.cities);
    const gradYear = NOW.y - Math.ceil(years) - (bootcamp ? 0 : int(0, 1));
    const school = bootcamp ? `${pick(["Código", "LaunchPad", "Forge", "Byte"])} Academy` : `University of ${city.split(",")[0]}`;
    const title = jobs[0].title;
    const focus = arch.focus(has, cloud);
    const yrs = Math.max(1, Math.round(years));
    const leadLine = leads ? ` Leads a team of ${teamSize} ${team}.` : mentors ? ` Mentors junior ${team}.` : "";
    const workMode = pick(["remote", "remote", "remote", "hybrid", "hybrid", "onsite"] as const);
    const industries = [...new Set(jobs.map((x) => x.industry))];

    const profile: ExtractedProfile = {
      headline: title, seniority, total_years: years, country: country.name, work_mode: workMode, industries,
      skills: skillRows,
      experience: jobs.map((x) => ({ title: x.title, company_type: x.industry, start: x.start, end: x.end, summary: x.bullets[0] })),
      leadership: leads ? [{ evidence: `Leads a team of ${teamSize} ${team}` }] : mentors ? [{ evidence: `Mentors junior ${team} through code reviews` }] : [],
      languages: langs,
      education: [{ degree, field }],
      summary: `${title} focused on ${focus}.${leadLine}`,
      source_language: "en",
    };
    out.push({
      slug, seeded: true, lang: "en",
      pii: {
        name: `${first} ${last}`,
        email: `${strip(first)}.${strip(last)}@example.com`.replace(/[^a-z.@]/g, ""),
        phone: `${country.phone} 555 0${int(100, 999)}`,
        linkedin: `linkedin.com/in/${slug}-${int(10, 99)}`,
        location: `${city}, ${country.name}`,
      },
      cv: {
        title,
        summary: `${title} with ${yrs} year${yrs === 1 ? "" : "s"} of experience ${focus}.${leadLine}`,
        experience: jobs.map(({ title: t, company, start, end, bullets }) => ({ title: t, company, start, end, bullets })),
        skills: skills.map(show).join(", "),
        education: [`${degree === "Bootcamp" ? "Bootcamp" : `${degree} in ${field}`} — ${school}, ${gradYear}`],
        languages: langs.map((l) => `${l.name} (${l.level})`).join(", "),
      },
      profile,
    });
  }
  return out;
}
