// Genera los CVs sintéticos en PDF a partir de seed/personas.ts:
//  - seed/cvs/*.pdf: los que precarga el seed
//  - seed/cvs/en-vivo/*.pdf y seed/cvs/en-vivo.zip: los que se suben y procesan en la demo
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { PERSONAS, type Persona } from "../seed/personas";

const OUT = path.join(process.cwd(), "seed", "cvs");
const LIVE = path.join(OUT, "en-vivo");
const W = 595, H = 842, M = 56;
const INK = rgb(0.08, 0.09, 0.12), MUTED = rgb(0.33, 0.36, 0.42), ACCENT = rgb(0.18, 0.36, 0.92);

const L = {
  en: { summary: "Summary", experience: "Experience", skills: "Skills", education: "Education", languages: "Languages", present: "Present" },
  es: { summary: "Perfil", experience: "Experiencia", skills: "Habilidades", education: "Formación", languages: "Idiomas", present: "Actualidad" },
  pt: { summary: "Resumo", experience: "Experiência", skills: "Competências", education: "Formação", languages: "Idiomas", present: "Atual" },
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

function fmt(d: string, lang: Persona["lang"]) {
  if (d === "present") return L[lang].present;
  const [y, m] = d.split("-");
  return `${m}/${y}`;
}

async function render(p: Persona): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`CV - ${p.pii.name}`);
  // Fechas fijas: regenerar produce los mismos bytes (y el mismo hash para la deduplicación)
  doc.setCreationDate(new Date("2026-10-01T00:00:00Z"));
  doc.setModificationDate(new Date("2026-10-01T00:00:00Z"));
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

rmSync(LIVE, { recursive: true, force: true });
mkdirSync(LIVE, { recursive: true });
const zip = new JSZip();
for (const p of PERSONAS) {
  const pdf = await render(p);
  writeFileSync(path.join(p.seeded ? OUT : LIVE, `${p.slug}.pdf`), pdf);
  if (!p.seeded) zip.file(`${p.slug}.pdf`, pdf, { date: new Date("2026-10-01T00:00:00Z") });
}
writeFileSync(path.join(OUT, "en-vivo.zip"), await zip.generateAsync({ type: "uint8array" }));
const live = PERSONAS.filter((p) => !p.seeded);
console.log(`✓ ${PERSONAS.length - live.length} CVs para precargar en seed/cvs`);
console.log(`✓ ${live.length} CVs para la demo en vivo en seed/cvs/en-vivo (y todos juntos en seed/cvs/en-vivo.zip):`);
for (const p of live) console.log(`   ${p.slug}.pdf (${p.lang})`);
