import type { ToolDef } from "@/lib/ai/anthropic";

export const PROMPT_VERSION = "profile-v1";

// ---------- 1. Extracción de perfil (ingesta) ----------
export const EXTRACT_SYSTEM = `You convert an ANONYMIZED résumé into a structured candidate profile.
Rules:
- The text uses placeholders like [NAME], [EMAIL], [PHONE], [URL], [ADDRESS], [DATE_OF_BIRTH]. Never try to recover them and never output personal data.
- Output everything in English, even if the résumé is in another language. Set source_language to the original language (ISO code).
- Only state what the résumé supports. If a field is not present, leave it empty. Never invent employers, dates or skills.
- skills: canonical lowercase names ("python", "aws", "kubernetes", "react", "sql", "people management"). years = experience using that skill, estimated from the date ranges of the roles where it appears. evidence = a short phrase from the résumé.
- leadership: only concrete evidence (managed N people, led a team, mentored, tech lead role).
- total_years: professional experience in years, from the earliest relevant role to today (2026-10).
- seniority: junior (<2y), mid (2-5y), senior (5-9y), lead (manages or leads teams), principal (10y+ with org-wide scope).
- summary: 2 neutral sentences about professional experience. No adjectives about personality, no age, gender or origin.
- Do not output universities by name nor graduation years.
Always answer by calling the tool.`;

export const EXTRACT_TOOL: ToolDef = {
  name: "save_profile",
  description: "Save the structured, anonymized candidate profile.",
  input_schema: {
    type: "object",
    properties: {
      headline: { type: "string", description: "Current or target role, e.g. 'Senior Backend Engineer'" },
      seniority: { type: "string", enum: ["junior", "mid", "senior", "lead", "principal"] },
      total_years: { type: "number" },
      country: { type: "string", description: "Country of residence if stated, else empty" },
      work_mode: { type: "string", enum: ["remote", "hybrid", "onsite", "unknown"] },
      industries: { type: "array", items: { type: "string" } },
      skills: {
        type: "array",
        items: {
          type: "object",
          properties: { name: { type: "string" }, years: { type: "number" }, evidence: { type: "string" } },
          required: ["name", "years"],
        },
      },
      experience: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            company_type: { type: "string", description: "Industry or kind of company, not its name" },
            start: { type: "string", description: "YYYY-MM" },
            end: { type: "string", description: "YYYY-MM or 'present'" },
            summary: { type: "string" },
          },
          required: ["title", "start", "end"],
        },
      },
      leadership: { type: "array", items: { type: "object", properties: { evidence: { type: "string" } }, required: ["evidence"] } },
      languages: {
        type: "array",
        items: { type: "object", properties: { name: { type: "string" }, level: { type: "string" } }, required: ["name"] },
      },
      education: {
        type: "array",
        items: { type: "object", properties: { degree: { type: "string" }, field: { type: "string" } }, required: ["degree"] },
      },
      summary: { type: "string" },
      source_language: { type: "string" },
    },
    required: ["headline", "seniority", "total_years", "work_mode", "skills", "experience", "summary", "source_language"],
  },
};

// ---------- 2. Interpretar la consulta del reclutador ----------
export const QUERY_SYSTEM = `You turn a recruiter's natural-language search into explicit requirements.
- mandatory: only what the recruiter states as required (numbers of years, "must", core skill of the role title). Each item has a short human label in the recruiter's language.
- nice_to_have: desirable traits ("leadership", "cloud", "startup experience").
- Map skills to canonical lowercase names ("python", "aws", "gcp", "azure", "kubernetes"). For a generic term like "cloud", use skill "cloud" and the matcher will expand it.
- semantic_query: one English sentence describing the ideal profile, for vector search.
Always answer by calling the tool.`;

export const QUERY_TOOL: ToolDef = {
  name: "set_requirements",
  description: "Structured requirements for a candidate search.",
  input_schema: {
    type: "object",
    properties: {
      mandatory: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["skill", "total_years", "seniority", "language", "work_mode"] },
            skill: { type: "string" },
            min_years: { type: "number" },
            value: { type: "string" },
            label: { type: "string" },
          },
          required: ["type", "label"],
        },
      },
      nice_to_have: {
        type: "array",
        items: {
          type: "object",
          properties: { skill: { type: "string" }, label: { type: "string" } },
          required: ["label"],
        },
      },
      semantic_query: { type: "string" },
    },
    required: ["mandatory", "nice_to_have", "semantic_query"],
  },
};

// ---------- 3. Explicar el match de un candidato ----------
export const EXPLAIN_SYSTEM = `You explain to a recruiter why an anonymized candidate fits a search, in the requested language.
- match: up to 3 short bullets, each tied to concrete evidence from the profile.
- gaps: up to 2 short bullets with what is missing or unclear relative to the requirements. Empty if none.
- summary: one neutral sentence.
- Never mention or infer age, gender, nationality, ethnicity, health or family status. Never recommend hiring or rejecting: the recruiter decides.
Always answer by calling the tool.`;

export const EXPLAIN_TOOL: ToolDef = {
  name: "explain_match",
  description: "Explain how the candidate matches the search.",
  input_schema: {
    type: "object",
    properties: {
      match: { type: "array", items: { type: "string" } },
      gaps: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
    },
    required: ["match", "gaps", "summary"],
  },
};

// ---------- 4. Guía de entrevista (al agendar) ----------
export const GUIDE_SYSTEM = `You prepare a recruiter for a job interview with an anonymized candidate, in the requested language.
- Write 4 or 5 short, open questions answerable from professional experience.
- Prioritize requirements the CV does not prove (status "unmet" or "unknown"); add one question that probes the strongest evidence for a must-have.
- verifies: the requirement label the question checks.
- In Spanish, address the candidate with Rioplatense "vos" ("contame", "¿trabajaste...?"), like the product UI.
- Never ask about age, gender, nationality, ethnicity, health, religion or family status. Never suggest a hiring decision: the recruiter decides.
Always answer by calling the tool.`;

export const GUIDE_TOOL: ToolDef = {
  name: "interview_guide",
  description: "Questions for the recruiter to verify the candidate during the interview.",
  input_schema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: { q: { type: "string" }, verifies: { type: "string" } },
          required: ["q", "verifies"],
        },
      },
    },
    required: ["questions"],
  },
};

// ---------- Tipos ----------
export interface ExtractedProfile {
  headline: string;
  seniority: "junior" | "mid" | "senior" | "lead" | "principal";
  total_years: number;
  country?: string;
  work_mode: "remote" | "hybrid" | "onsite" | "unknown";
  industries?: string[];
  skills: { name: string; years: number; evidence?: string }[];
  experience: { title: string; company_type?: string; start: string; end: string; summary?: string }[];
  leadership?: { evidence: string }[];
  languages?: { name: string; level?: string }[];
  education?: { degree: string; field?: string }[];
  summary: string;
  source_language: string;
}

export interface Requirement {
  type: "skill" | "total_years" | "seniority" | "language" | "work_mode";
  skill?: string;
  min_years?: number;
  value?: string;
  label: string;
}
export interface Requirements {
  mandatory: Requirement[];
  nice_to_have: { skill?: string; label: string }[];
  semantic_query: string;
}
export interface Explanation {
  match: string[];
  gaps: string[];
  summary: string;
}

export interface GuideQuestion {
  q: string;
  verifies: string | null;
}
