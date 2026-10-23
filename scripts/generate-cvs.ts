// Genera los CVs sintéticos en PDF (seed/cvs/*.pdf) a partir de seed/personas.ts.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { PERSONAS, type Persona } from "../seed/personas";

const OUT = path.join(process.cwd(), "seed", "cvs");
const W = 595, H = 842, M = 56;
const INK = rgb(0.08, 0.09, 0.12), MUTED = rgb(0.33, 0.36, 0.42), ACCENT = rgb(0.18, 0.36, 0.92);

const L = {
  en: { summary: "Summary", experience: "Experience", skills: "Skills", education: "Education", languages: "Languages", present: "Present" },
  es: { summary: "Perfil", experience: "Experiencia", skills: "Habilidades", education: "Formación", languages: "Idiomas", present: "Actualidad" },
};

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > width && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function fmt(d: string, lang: "en" | "es") {
  if (d === "present") return L[lang].present;
  const [y, m] = d.split("-");
  return `${m}/${y}`;
}

async function render(p: Persona): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`CV - ${p.pii.name}`);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;
  const t = L[p.lang];

  const text = (s: string, size: number, font = reg, color = INK, x = M, maxW = W - 2 * M, gap = 1.35) => {
    for (const line of wrap(s, font, size, maxW)) {
      if (y < M + size) { page = doc.addPage([W, H]); y = H - M; }
      page.drawText(line, { x, y, size, font, color });
      y -= size * gap;
    }
  };
  const section = (title: string) => {
    y -= 10;
    text(title.toUpperCase(), 9, bold, ACCENT);
    page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.5, color: rgb(0.85, 0.84, 0.8) });
    y -= 6;
  };

  // Encabezado con PII (es lo que el pipeline debe detectar y separar)
  text(p.pii.name, 22, bold);
  text(p.cv.title, 12, reg, MUTED);
  y -= 4;
  text(`${p.pii.email}  |  ${p.pii.phone}  |  ${p.pii.linkedin}`, 9, reg, MUTED);
  text(p.pii.location, 9, reg, MUTED);

  section(t.summary);
  text(p.cv.summary, 10);

  section(t.experience);
  for (const e of p.cv.experience) {
    text(`${e.title} — ${e.company}`, 11, bold);
    text(`${fmt(e.start, p.lang)} – ${fmt(e.end, p.lang)}`, 9, reg, MUTED);
    for (const b of e.bullets) text(`•  ${b}`, 10, reg, INK, M + 8, W - 2 * M - 8);
    y -= 4;
  }

  section(t.skills);
  text(p.cv.skills, 10);
  section(t.education);
  for (const ed of p.cv.education) text(ed, 10);
  section(t.languages);
  text(p.cv.languages, 10);

  return doc.save();
}

mkdirSync(OUT, { recursive: true });
for (const p of PERSONAS) {
  writeFileSync(path.join(OUT, `${p.slug}.pdf`), await render(p));
  console.log(`✓ ${p.slug}.pdf${p.seeded ? "" : "  (para procesar en vivo)"}`);
}
