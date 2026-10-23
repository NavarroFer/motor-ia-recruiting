// Detección y reemplazo de PII ANTES de cualquier llamada a un modelo.
// Reglas simples para la demo; en producción se suma un modelo de NER (p. ej. Presidio).

export interface Pii {
  name?: string;
  emails: string[];
  phones: string[];
  links: string[];
  address?: string;
  birthDate?: string;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const URL = /\b(?:https?:\/\/|www\.)\S+|\b(?:linkedin\.com|github\.com|gitlab\.com|behance\.net)\/\S+/gi;
const PHONE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{2,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;
const BIRTH = /^.*\b(?:date of birth|born|dob|fecha de nacimiento|nacimiento|nacido)\b.*$/gim;
const ADDRESS = /^.*\b(?:address|dirección|direccion|domicilio)\b\s*[:\-].*$/gim;
const AGE = /\b\d{2}\s*(?:years old|años de edad)\b/gi;

function guessName(text: string): string | undefined {
  // Primera línea no vacía con 2-4 palabras capitalizadas y sin dígitos.
  for (const raw of text.split("\n").slice(0, 6)) {
    const line = raw.trim();
    if (!line || /\d|@/.test(line)) continue;
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 4 && words.every((w) => /^[A-ZÁÉÍÓÚÑ][\p{L}'’-]+$/u.test(w))) return line;
    return undefined;
  }
  return undefined;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function anonymize(input: string): { text: string; pii: Pii } {
  let text = input;
  const pii: Pii = { emails: [], phones: [], links: [] };

  pii.name = guessName(text);
  if (pii.name) {
    // Nombre completo y cada parte del nombre (apellidos sueltos en el texto)
    text = text.replace(new RegExp(escapeRe(pii.name), "g"), "[NAME]");
    for (const part of pii.name.split(/\s+/).filter((p) => p.length > 2)) {
      text = text.replace(new RegExp(`\\b${escapeRe(part)}\\b`, "g"), "[NAME]");
    }
  }

  text = text.replace(EMAIL, (m) => (pii.emails.push(m), "[EMAIL]"));
  text = text.replace(URL, (m) => (pii.links.push(m), "[URL]"));
  text = text.replace(BIRTH, (m) => ((pii.birthDate = m.trim()), "[DATE_OF_BIRTH]"));
  text = text.replace(ADDRESS, (m) => ((pii.address = m.trim()), "[ADDRESS]"));
  text = text.replace(AGE, "[AGE]");
  // Teléfonos: solo secuencias con 8+ dígitos (evita años y rangos de fechas)
  text = text.replace(PHONE, (m) => {
    if (m.replace(/\D/g, "").length < 8) return m;
    pii.phones.push(m.trim());
    return "[PHONE]";
  });

  return { text, pii };
}
