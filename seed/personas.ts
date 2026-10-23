// Candidatos SINTÉTICOS (no son personas reales). Una sola fuente para:
//  - los PDFs de seed/cvs (scripts/generate-cvs.ts)
//  - los perfiles precargados (scripts/seed.ts), equivalentes a lo que devolvería el pipeline.
import type { ExtractedProfile } from "@/lib/ai/prompts";

export interface Persona {
  slug: string;
  seeded: boolean; // false = se procesa en vivo en la demo
  lang: "en" | "es";
  pii: { name: string; email: string; phone: string; linkedin: string; location: string };
  cv: {
    title: string;
    summary: string;
    experience: { title: string; company: string; start: string; end: string; bullets: string[] }[];
    skills: string;
    education: string[];
    languages: string;
  };
  profile?: ExtractedProfile;
}

const sk = (pairs: [string, number, string?][]) => pairs.map(([name, years, evidence]) => ({ name, years, evidence }));

export const PERSONAS: Persona[] = [
  {
    slug: "valentina-rios", seeded: true, lang: "en",
    pii: { name: "Valentina Rios", email: "valentina.rios@example.com", phone: "+54 223 555 0141", linkedin: "linkedin.com/in/valentina-rios-dev", location: "Mar del Plata, Argentina" },
    cv: {
      title: "Senior Backend Engineer",
      summary: "Backend engineer with 7 years building Python services on AWS for fintech and e-commerce. Leads a team of 4 engineers.",
      experience: [
        { title: "Senior Backend Engineer / Team Lead", company: "PayNorte", start: "2022-03", end: "present", bullets: ["Lead a team of 4 engineers building payment APIs in Python (FastAPI) on AWS Lambda and ECS.", "Cut p95 latency from 900 ms to 180 ms by redesigning the settlement pipeline with SQS.", "Run hiring loops and mentor two junior developers."] },
        { title: "Backend Developer", company: "ShopLatam", start: "2019-06", end: "2022-02", bullets: ["Built order and inventory services in Python and PostgreSQL.", "Migrated on-premise jobs to AWS (EC2, RDS, S3)."] },
      ],
      skills: "Python, FastAPI, Django, AWS (Lambda, ECS, SQS, RDS), PostgreSQL, Docker, Terraform",
      education: ["B.Sc. in Computer Engineering — Universidad Nacional de Mar del Plata, 2018"],
      languages: "Spanish (native), English (C1)",
    },
    profile: {
      headline: "Senior Backend Engineer", seniority: "lead", total_years: 7.3, country: "Argentina", work_mode: "remote",
      industries: ["fintech", "e-commerce"],
      skills: sk([["python", 7.3, "payment APIs in Python (FastAPI)"], ["aws", 7.3, "AWS Lambda and ECS"], ["fastapi", 4.6], ["django", 2.7], ["postgresql", 7.3], ["docker", 4.6], ["terraform", 3], ["sqs", 4.6, "settlement pipeline with SQS"]]),
      experience: [
        { title: "Senior Backend Engineer / Team Lead", company_type: "fintech", start: "2022-03", end: "present", summary: "Leads 4 engineers building Python payment APIs on AWS." },
        { title: "Backend Developer", company_type: "e-commerce", start: "2019-06", end: "2022-02", summary: "Order and inventory services; migration to AWS." },
      ],
      leadership: [{ evidence: "Leads a team of 4 engineers" }, { evidence: "Mentors two junior developers and runs hiring loops" }],
      languages: [{ name: "Spanish", level: "native" }, { name: "English", level: "C1" }],
      education: [{ degree: "B.Sc.", field: "Computer Engineering" }],
      summary: "Backend engineer focused on Python services on AWS for fintech and e-commerce. Currently leads a team of four engineers.",
      source_language: "en",
    },
  },
  {
    slug: "james-carter", seeded: true, lang: "en",
    pii: { name: "James Carter", email: "j.carter.data@example.com", phone: "+1 512 555 0198", linkedin: "linkedin.com/in/jamescarterdata", location: "Austin, TX, USA" },
    cv: {
      title: "Data Engineer",
      summary: "Data engineer with 5 years of experience building batch and streaming pipelines in Python on Google Cloud.",
      experience: [
        { title: "Data Engineer II", company: "Brightline Health", start: "2021-08", end: "present", bullets: ["Own ingestion pipelines in Python, Apache Beam and BigQuery on GCP.", "Mentor three junior data engineers and lead code reviews for the data platform."] },
        { title: "Data Analyst", company: "Lone Star Retail", start: "2020-01", end: "2021-07", bullets: ["Automated reporting with Python and SQL."] },
      ],
      skills: "Python, SQL, GCP (BigQuery, Dataflow, Pub/Sub), Apache Beam, Airflow, Spark",
      education: ["B.S. Statistics — University of Texas at Austin, 2019"],
      languages: "English (native)",
    },
    profile: {
      headline: "Data Engineer", seniority: "mid", total_years: 6.8, country: "USA", work_mode: "hybrid", industries: ["healthcare", "retail"],
      skills: sk([["python", 6.8, "pipelines in Python, Apache Beam"], ["gcp", 5.2, "BigQuery on GCP"], ["sql", 6.8], ["bigquery", 5.2], ["airflow", 4], ["spark", 3], ["apache beam", 5.2]]),
      experience: [
        { title: "Data Engineer II", company_type: "healthcare", start: "2021-08", end: "present", summary: "Python and Beam pipelines on GCP." },
        { title: "Data Analyst", company_type: "retail", start: "2020-01", end: "2021-07", summary: "Reporting automation with Python and SQL." },
      ],
      leadership: [{ evidence: "Mentors three junior data engineers and leads code reviews" }],
      languages: [{ name: "English", level: "native" }], education: [{ degree: "B.S.", field: "Statistics" }],
      summary: "Data engineer building batch and streaming pipelines in Python on Google Cloud. Mentors junior engineers on the data platform.",
      source_language: "en",
    },
  },
  {
    slug: "priya-sharma", seeded: true, lang: "en",
    pii: { name: "Priya Sharma", email: "priya.sharma.ml@example.com", phone: "+91 98765 43210", linkedin: "linkedin.com/in/priyasharma-ml", location: "Bengaluru, India" },
    cv: {
      title: "Machine Learning Engineer",
      summary: "ML engineer with 5 years deploying NLP and recommendation models in Python.",
      experience: [
        { title: "Machine Learning Engineer", company: "Kirana Labs", start: "2021-04", end: "present", bullets: ["Train and deploy recommendation models with PyTorch and Azure ML.", "Built feature store and model monitoring in Python."] },
        { title: "Software Engineer", company: "Infosys", start: "2019-07", end: "2021-03", bullets: ["Python microservices for an insurance client."] },
      ],
      skills: "Python, PyTorch, scikit-learn, Azure ML, Docker, SQL",
      education: ["B.Tech. Computer Science, 2019"],
      languages: "English (C2), Hindi (native)",
    },
    profile: {
      headline: "Machine Learning Engineer", seniority: "senior", total_years: 7.3, country: "India", work_mode: "remote", industries: ["e-commerce", "insurance"],
      skills: sk([["python", 7.3, "deploying models in Python"], ["pytorch", 5.5], ["azure", 2.5, "Azure ML"], ["scikit-learn", 5], ["docker", 4], ["sql", 5]]),
      experience: [
        { title: "Machine Learning Engineer", company_type: "e-commerce", start: "2021-04", end: "present", summary: "Recommendation models with PyTorch and Azure ML." },
        { title: "Software Engineer", company_type: "IT services", start: "2019-07", end: "2021-03", summary: "Python microservices." },
      ],
      leadership: [],
      languages: [{ name: "English", level: "C2" }, { name: "Hindi", level: "native" }], education: [{ degree: "B.Tech.", field: "Computer Science" }],
      summary: "Machine learning engineer deploying NLP and recommendation models in Python, with production experience on Azure ML.",
      source_language: "en",
    },
  },
  {
    slug: "lucas-ferreira", seeded: true, lang: "en",
    pii: { name: "Lucas Ferreira", email: "lucas.ferreira.dev@example.com", phone: "+55 11 95555 0123", linkedin: "linkedin.com/in/lucasferreira", location: "São Paulo, Brazil" },
    cv: {
      title: "Tech Lead — Full Stack",
      summary: "Full-stack engineer and tech lead. Mostly Node.js and React on AWS, with recent Python work.",
      experience: [
        { title: "Tech Lead", company: "Mobi Pay", start: "2024-01", end: "present", bullets: ["Lead a squad of 5 building Node.js and React products on AWS.", "Introduced Python data jobs for fraud scoring (2025)."] },
        { title: "Full Stack Developer", company: "Agência Nove", start: "2020-02", end: "2023-12", bullets: ["Node.js, TypeScript and React applications on AWS."] },
      ],
      skills: "Node.js, TypeScript, React, AWS, Python, PostgreSQL",
      education: ["Bacharelado em Sistemas de Informação, 2019"],
      languages: "Portuguese (native), English (B2), Spanish (B1)",
    },
    profile: {
      headline: "Tech Lead — Full Stack", seniority: "lead", total_years: 6.7, country: "Brazil", work_mode: "remote", industries: ["fintech", "agency"],
      skills: sk([["node.js", 6.7], ["typescript", 6.7], ["react", 6.7], ["aws", 6.7, "products on AWS"], ["python", 1.5, "Python data jobs for fraud scoring (2025)"], ["postgresql", 5]]),
      experience: [
        { title: "Tech Lead", company_type: "fintech", start: "2024-01", end: "present", summary: "Leads 5 engineers; Node.js, React and some Python on AWS." },
        { title: "Full Stack Developer", company_type: "digital agency", start: "2020-02", end: "2023-12", summary: "Node.js, TypeScript and React on AWS." },
      ],
      leadership: [{ evidence: "Leads a squad of 5 engineers" }],
      languages: [{ name: "Portuguese", level: "native" }, { name: "English", level: "B2" }, { name: "Spanish", level: "B1" }],
      education: [{ degree: "Bachelor", field: "Information Systems" }],
      summary: "Full-stack engineer and tech lead working mainly with Node.js and React on AWS. Python experience is recent and limited to data jobs.",
      source_language: "en",
    },
  },
  {
    slug: "emily-nguyen", seeded: true, lang: "en",
    pii: { name: "Emily Nguyen", email: "emily.nguyen.sre@example.com", phone: "+1 206 555 0177", linkedin: "linkedin.com/in/emilynguyen-sre", location: "Seattle, WA, USA" },
    cv: {
      title: "Site Reliability Engineer",
      summary: "SRE with 8 years running Kubernetes platforms on AWS. Python for automation and tooling.",
      experience: [
        { title: "Staff SRE", company: "Cascade Cloud", start: "2021-02", end: "present", bullets: ["Lead the on-call and reliability team of 6 engineers.", "Python tooling for capacity planning and incident automation.", "Operate 40+ EKS clusters on AWS."] },
        { title: "DevOps Engineer", company: "Pike Analytics", start: "2018-05", end: "2021-01", bullets: ["Terraform and Kubernetes on AWS."] },
      ],
      skills: "AWS, Kubernetes, Terraform, Python, Go, Prometheus",
      education: ["B.S. Computer Science, 2018"],
      languages: "English (native), Vietnamese (fluent)",
    },
    profile: {
      headline: "Staff Site Reliability Engineer", seniority: "lead", total_years: 8.4, country: "USA", work_mode: "onsite", industries: ["cloud infrastructure", "analytics"],
      skills: sk([["aws", 8.4, "40+ EKS clusters on AWS"], ["kubernetes", 8.4], ["terraform", 8.4], ["python", 5.7, "Python tooling for capacity planning"], ["go", 3], ["prometheus", 5]]),
      experience: [
        { title: "Staff SRE", company_type: "cloud infrastructure", start: "2021-02", end: "present", summary: "Leads a reliability team of 6; Python automation; EKS on AWS." },
        { title: "DevOps Engineer", company_type: "analytics", start: "2018-05", end: "2021-01", summary: "Terraform and Kubernetes on AWS." },
      ],
      leadership: [{ evidence: "Leads the on-call and reliability team of 6 engineers" }],
      languages: [{ name: "English", level: "native" }, { name: "Vietnamese", level: "fluent" }], education: [{ degree: "B.S.", field: "Computer Science" }],
      summary: "Site reliability engineer running large Kubernetes platforms on AWS, using Python for automation. Leads a reliability team.",
      source_language: "en",
    },
  },
  {
    slug: "mateo-gomez", seeded: true, lang: "en",
    pii: { name: "Mateo Gomez", email: "mateo.gomez.py@example.com", phone: "+54 11 5555 0102", linkedin: "github.com/mateogomez", location: "Buenos Aires, Argentina" },
    cv: {
      title: "Junior Python Developer",
      summary: "Junior developer with one year of professional Python experience.",
      experience: [
        { title: "Junior Python Developer", company: "Datos Simples", start: "2025-09", end: "present", bullets: ["Django REST endpoints and unit tests.", "Scripts to clean CSV data."] },
      ],
      skills: "Python, Django, Git, SQL",
      education: ["Tecnicatura en Programación (in progress)"],
      languages: "Spanish (native), English (B1)",
    },
    profile: {
      headline: "Junior Python Developer", seniority: "junior", total_years: 1.1, country: "Argentina", work_mode: "unknown", industries: ["data services"],
      skills: sk([["python", 1.1, "Django REST endpoints"], ["django", 1.1], ["git", 1.1], ["sql", 1.1]]),
      experience: [{ title: "Junior Python Developer", company_type: "data services", start: "2025-09", end: "present", summary: "Django REST endpoints and data scripts." }],
      leadership: [], languages: [{ name: "Spanish", level: "native" }, { name: "English", level: "B1" }],
      education: [{ degree: "Technical degree in Programming (in progress)" }],
      summary: "Junior Python developer with about one year of professional experience building Django endpoints.",
      source_language: "en",
    },
  },
  {
    slug: "sofia-rossi", seeded: true, lang: "en",
    pii: { name: "Sofia Rossi", email: "sofia.rossi.em@example.com", phone: "+39 02 5555 0188", linkedin: "linkedin.com/in/sofiarossi", location: "Milan, Italy" },
    cv: {
      title: "Engineering Manager",
      summary: "Engineering manager with 10 years in software; 8 years hands-on Python, 4 on AWS. Manages 12 engineers.",
      experience: [
        { title: "Engineering Manager", company: "Viaggio Tech", start: "2022-01", end: "present", bullets: ["Manage 12 engineers across two Python backend teams on AWS.", "Owned the migration from monolith to services on ECS."] },
        { title: "Senior Python Developer", company: "Banca Digitale", start: "2016-03", end: "2021-12", bullets: ["Python services for payments; on-premise to AWS migration in 2021."] },
      ],
      skills: "Python, AWS, people management, Django, PostgreSQL, Kafka",
      education: ["M.Sc. Computer Science, 2015"],
      languages: "Italian (native), English (C1)",
    },
    profile: {
      headline: "Engineering Manager", seniority: "principal", total_years: 10.6, country: "Italy", work_mode: "hybrid", industries: ["travel", "banking"],
      skills: sk([["python", 10.6, "Python backend teams; Python services for payments"], ["aws", 4.8, "services on ECS"], ["people management", 4.8, "Manage 12 engineers"], ["django", 6], ["postgresql", 8], ["kafka", 3]]),
      experience: [
        { title: "Engineering Manager", company_type: "travel tech", start: "2022-01", end: "present", summary: "Manages 12 engineers on Python backends on AWS." },
        { title: "Senior Python Developer", company_type: "banking", start: "2016-03", end: "2021-12", summary: "Payment services in Python." },
      ],
      leadership: [{ evidence: "Manages 12 engineers across two teams" }, { evidence: "Owned the monolith-to-services migration" }],
      languages: [{ name: "Italian", level: "native" }, { name: "English", level: "C1" }], education: [{ degree: "M.Sc.", field: "Computer Science" }],
      summary: "Engineering manager with long hands-on Python experience and several years on AWS. Manages two backend teams.",
      source_language: "en",
    },
  },
  {
    slug: "daniel-kim", seeded: true, lang: "en",
    pii: { name: "Daniel Kim", email: "daniel.kim.fe@example.com", phone: "+1 415 555 0133", linkedin: "linkedin.com/in/danielkimfrontend", location: "San Francisco, CA, USA" },
    cv: {
      title: "Senior Frontend Engineer",
      summary: "Frontend engineer with 6 years in React and TypeScript, design systems and accessibility.",
      experience: [
        { title: "Senior Frontend Engineer", company: "Lumen Apps", start: "2021-05", end: "present", bullets: ["Built the React design system used by 8 product teams.", "Led accessibility improvements to WCAG AA."] },
        { title: "Frontend Developer", company: "Studio 22", start: "2020-01", end: "2021-04", bullets: ["React and TypeScript web apps."] },
      ],
      skills: "React, TypeScript, Next.js, CSS, Storybook, accessibility",
      education: ["B.A. Interaction Design, 2019"],
      languages: "English (native), Korean (fluent)",
    },
    profile: {
      headline: "Senior Frontend Engineer", seniority: "senior", total_years: 6.8, country: "USA", work_mode: "hybrid", industries: ["software"],
      skills: sk([["react", 6.8, "React design system"], ["typescript", 6.8], ["next.js", 4], ["css", 6.8], ["storybook", 4], ["accessibility", 3]]),
      experience: [
        { title: "Senior Frontend Engineer", company_type: "software", start: "2021-05", end: "present", summary: "React design system for 8 teams." },
        { title: "Frontend Developer", company_type: "design studio", start: "2020-01", end: "2021-04", summary: "React and TypeScript apps." },
      ],
      leadership: [{ evidence: "Led accessibility improvements across product teams" }],
      languages: [{ name: "English", level: "native" }, { name: "Korean", level: "fluent" }], education: [{ degree: "B.A.", field: "Interaction Design" }],
      summary: "Frontend engineer specialized in React, TypeScript and design systems, with a focus on accessibility.",
      source_language: "en",
    },
  },
  {
    slug: "ana-torres", seeded: true, lang: "en",
    pii: { name: "Ana Torres", email: "ana.torres.ds@example.com", phone: "+52 55 5555 0166", linkedin: "linkedin.com/in/anatorres-ds", location: "Mexico City, Mexico" },
    cv: {
      title: "Data Scientist",
      summary: "Data scientist with 4 years in Python and SQL for forecasting and experimentation.",
      experience: [
        { title: "Data Scientist", company: "Mercado Andino", start: "2022-06", end: "present", bullets: ["Demand forecasting models in Python (pandas, Prophet).", "A/B testing framework adopted by 3 teams."] },
        { title: "BI Analyst", company: "Grupo Sol", start: "2021-01", end: "2022-05", bullets: ["SQL dashboards and Python automation."] },
      ],
      skills: "Python, pandas, SQL, statistics, Tableau",
      education: ["B.Sc. Actuarial Science, 2020"],
      languages: "Spanish (native), English (C1)",
    },
    profile: {
      headline: "Data Scientist", seniority: "mid", total_years: 5.8, country: "Mexico", work_mode: "remote", industries: ["retail"],
      skills: sk([["python", 5.8, "forecasting models in Python"], ["pandas", 5.8], ["sql", 5.8], ["statistics", 5.8], ["tableau", 2]]),
      experience: [
        { title: "Data Scientist", company_type: "retail", start: "2022-06", end: "present", summary: "Forecasting and experimentation in Python." },
        { title: "BI Analyst", company_type: "conglomerate", start: "2021-01", end: "2022-05", summary: "SQL dashboards and Python automation." },
      ],
      leadership: [],
      languages: [{ name: "Spanish", level: "native" }, { name: "English", level: "C1" }], education: [{ degree: "B.Sc.", field: "Actuarial Science" }],
      summary: "Data scientist using Python and SQL for forecasting and experimentation. No cloud platform experience stated.",
      source_language: "en",
    },
  },
  {
    slug: "tom-becker", seeded: true, lang: "en",
    pii: { name: "Tom Becker", email: "tom.becker.java@example.com", phone: "+49 30 5555 0155", linkedin: "linkedin.com/in/tombecker", location: "Berlin, Germany" },
    cv: {
      title: "Backend Team Lead",
      summary: "Java backend engineer and team lead with 9 years on AWS; Python for internal tooling.",
      experience: [
        { title: "Backend Team Lead", company: "Logistik Plus", start: "2020-03", end: "present", bullets: ["Lead 6 engineers building Java/Spring services on AWS.", "Python scripts for data migration (2024–2025)."] },
        { title: "Java Developer", company: "Kontor GmbH", start: "2017-01", end: "2020-02", bullets: ["Spring Boot services on AWS EC2."] },
      ],
      skills: "Java, Spring Boot, AWS, Kafka, Python",
      education: ["B.Sc. Informatik, 2016"],
      languages: "German (native), English (C1)",
    },
    profile: {
      headline: "Backend Team Lead", seniority: "lead", total_years: 9.8, country: "Germany", work_mode: "onsite", industries: ["logistics"],
      skills: sk([["java", 9.8], ["spring boot", 9.8], ["aws", 9.8, "Java services on AWS"], ["kafka", 5], ["python", 2, "Python scripts for data migration (2024-2025)"]]),
      experience: [
        { title: "Backend Team Lead", company_type: "logistics", start: "2020-03", end: "present", summary: "Leads 6 engineers on Java services on AWS." },
        { title: "Java Developer", company_type: "software consultancy", start: "2017-01", end: "2020-02", summary: "Spring Boot on AWS." },
      ],
      leadership: [{ evidence: "Leads 6 engineers" }],
      languages: [{ name: "German", level: "native" }, { name: "English", level: "C1" }], education: [{ degree: "B.Sc.", field: "Computer Science" }],
      summary: "Java backend team lead with extensive AWS experience. Python use is limited to internal migration scripts.",
      source_language: "en",
    },
  },
  // ---------- Para procesar EN VIVO (no se precargan) ----------
  {
    slug: "camila-duarte", seeded: false, lang: "es",
    pii: { name: "Camila Duarte", email: "camila.duarte.dev@example.com", phone: "+598 99 555 012", linkedin: "linkedin.com/in/camiladuarte", location: "Montevideo, Uruguay" },
    cv: {
      title: "Ingeniera de Software Senior — Python",
      summary: "Ingeniera de software con 7 años desarrollando servicios en Python sobre Google Cloud. Lidero un equipo de 5 personas.",
      experience: [
        { title: "Líder Técnica", company: "AgroDatos", start: "2022-02", end: "present", bullets: ["Lidero un equipo de 5 ingenieros que construye APIs en Python (Flask) sobre GCP (Cloud Run, Pub/Sub).", "Diseñé la plataforma de datos satelitales que procesa 2 TB diarios."] },
        { title: "Desarrolladora Python", company: "Banco Oriental", start: "2019-03", end: "2022-01", bullets: ["Servicios de scoring crediticio en Python y PostgreSQL.", "Migración de procesos batch a la nube."] },
      ],
      skills: "Python, Flask, GCP (Cloud Run, Pub/Sub, BigQuery), PostgreSQL, Docker, Kubernetes",
      education: ["Ingeniería en Computación — Universidad de la República, 2018"],
      languages: "Español (nativo), Inglés (C1), Portugués (B2)",
    },
  },
  {
    slug: "ryan-oconnor", seeded: false, lang: "en",
    pii: { name: "Ryan Oconnor", email: "ryan.oconnor.qa@example.com", phone: "+1 617 555 0109", linkedin: "linkedin.com/in/ryanoconnorqa", location: "Boston, MA, USA" },
    cv: {
      title: "QA Automation Engineer",
      summary: "QA automation engineer writing test frameworks in Python for 3 years.",
      experience: [
        { title: "QA Automation Engineer", company: "HealthBridge", start: "2023-08", end: "present", bullets: ["Pytest and Playwright suites for web and API testing.", "Moved test runs to AWS CodeBuild."] },
        { title: "Manual QA Tester", company: "Northpoint", start: "2021-09", end: "2023-07", bullets: ["Regression testing and bug triage."] },
      ],
      skills: "Python, Pytest, Playwright, Selenium, AWS CodeBuild",
      education: ["B.A. Economics, 2021"],
      languages: "English (native)",
    },
  },
];
