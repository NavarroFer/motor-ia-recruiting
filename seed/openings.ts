import type { Requirements } from "@/lib/ai/prompts";

// Vacantes de ejemplo. Requisitos ya definidos (equivalentes a lo que extraería el modelo) para no gastar API en el seed.
export const OPENINGS: { title: string; description: string; requirements: Requirements }[] = [
  {
    title: "Senior Python Backend Engineer (Cloud)",
    description: `We are looking for a Senior Backend Engineer to build payment and billing services.
Requirements:
- 3+ years of professional Python experience
- Experience deploying services on a public cloud (AWS, GCP or Azure)
Nice to have:
- Experience leading or mentoring engineers
- PostgreSQL
Remote within the Americas.`,
    requirements: {
      mandatory: [{ type: "skill", skill: "python", min_years: 3, label: "python ≥ 3" }],
      nice_to_have: [{ skill: "cloud", label: "cloud" }, { skill: "leadership", label: "leadership" }, { skill: "postgresql", label: "postgresql" }],
      semantic_query: "Senior backend engineer building Python services on a public cloud, with team leadership experience",
    },
  },
  {
    title: "Data Engineer — GCP",
    description: `Join our data platform team.
Requirements:
- 2+ years with Python for data pipelines
- Google Cloud Platform (BigQuery, Dataflow)
Nice to have: Airflow, SQL, streaming.`,
    requirements: {
      mandatory: [{ type: "skill", skill: "python", min_years: 2, label: "python ≥ 2" }, { type: "skill", skill: "gcp", label: "gcp" }],
      nice_to_have: [{ skill: "airflow", label: "airflow" }, { skill: "sql", label: "sql" }],
      semantic_query: "Data engineer building batch and streaming pipelines in Python on Google Cloud",
    },
  },
  {
    title: "Frontend Engineer (React)",
    description: `We need a Frontend Engineer for our design system.
Requirements:
- 3+ years with React
Nice to have: TypeScript, accessibility (WCAG).`,
    requirements: {
      mandatory: [{ type: "skill", skill: "react", min_years: 3, label: "react ≥ 3" }],
      nice_to_have: [{ skill: "typescript", label: "typescript" }, { skill: "accessibility", label: "accessibility" }],
      semantic_query: "Frontend engineer specialized in React design systems and accessibility",
    },
  },
];
