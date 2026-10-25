// Prepara los dibujos de marca para la animación de ensamblado.
// Lee public/brand/illustrations/*_Green.svg y genera src/components/brand/drawings.generated.ts:
// - colores → variables CSS (--d-ink trazo/masa, --d-knock interiores), así un solo dibujo sirve en verde y crema;
// - cada polyline se parte en segmentos sueltos y cada forma queda como una pieza (.wt-piece)
//   con su origen, giro y demora fijos (pseudoaleatorios con semilla, iguales en server y cliente).
// Uso: npm run build:drawings  (correrlo de nuevo al sumar o cambiar un SVG)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SRC = path.join(process.cwd(), "public/brand/illustrations");
const OUT = path.join(process.cwd(), "src/components/brand/drawings.generated.ts");
const INK = /#075846/gi;
const KNOCK = /#FBFAF3/gi;

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

function build(name: string, svg: string) {
  const viewBox = svg.match(/viewBox="([^"]+)"/)![1];
  let body = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<title>.*?<\/title>/, "");
  body = body.replace(INK, "var(--d-ink)").replace(KNOCK, "var(--d-knock)");

  // Coordenadas a 1 decimal: el globo pasa de ~68 KB a la mitad sin diferencia visible.
  body = body.replace(/\d+\.\d{2,}/g, (n) => String(Math.round(Number(n) * 10) / 10));
  // Polylines cortas (trazos rectos) → un segmento por tramo. Las curvas largas (meridianos) llegan enteras.
  body = body.replace(/<polyline points="([^"]+)"([^>]*)\/>/g, (_m, pts: string, rest: string) => {
    const p = pts.trim().split(/\s+/);
    if (p.length <= 2 || p.length > 8) return `<polyline points="${pts}"${rest}/>`;
    return p.slice(1).map((pt, i) => `<polyline points="${p[i]} ${pt}"${rest}/>`).join("");
  });

  const rand = rng(hash(name));
  const shapes = body.match(/<(rect|ellipse|circle|polyline|polygon|path|line|text)\b/g) ?? [];
  const n = shapes.length;
  let i = 0;
  body = body.replace(/<(rect|ellipse|circle|polyline|polygon|path|line|text)\b/g, (_m, tag: string) => {
    const angle = rand() * Math.PI * 2;
    const dist = 70 + rand() * 150;
    const dx = Math.round(Math.cos(angle) * dist);
    const dy = Math.round(Math.sin(angle) * dist);
    const r = Math.round((rand() - 0.5) * 90);
    // Demora en orden de documento: llegan primero las masas grandes, después los detalles.
    const d = n > 1 ? Math.round((i / (n - 1)) * 1000) / 1000 : 0;
    i++;
    return `<${tag} class="wt-piece" style="--dx:${dx}px;--dy:${dy}px;--r:${r}deg;--o:${d}"`;
  });
  return { viewBox, pieces: n, body: body.replace(/\s+/g, " ").trim() };
}

const files = readdirSync(SRC).filter((f) => f.endsWith("_Green.svg")).sort();
const out: Record<string, ReturnType<typeof build>> = {};
for (const f of files) {
  const name = f.replace(/_Green\.svg$/, "");
  out[name] = build(name, readFileSync(path.join(SRC, f), "utf8"));
  console.log(`${name}: ${out[name].pieces} piezas`);
}
writeFileSync(
  OUT,
  `// Generado por scripts/build-drawings.ts. No editar a mano.\n` +
    `export const DRAWINGS = ${JSON.stringify(out, null, 0)} as const;\n` +
    `export type DrawingName = keyof typeof DRAWINGS;\n`,
);
console.log(`→ ${path.relative(process.cwd(), OUT)}`);
