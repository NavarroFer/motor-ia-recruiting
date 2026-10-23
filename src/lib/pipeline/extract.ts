// Extracción de texto SIN IA. Solo si no hay texto se recurre a visión (fase 2 en producción: OCR).
export type Extracted =
  | { kind: "text"; text: string }
  | { kind: "vision"; mediaType: string; base64: string };

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function mimeFromName(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (n.endsWith(".txt")) return "text/plain";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

export function isSupported(name: string): boolean {
  return mimeFromName(name) !== "application/octet-stream";
}

export async function extractText(data: Buffer, mime: string): Promise<Extracted> {
  if (IMAGE_TYPES.includes(mime)) return { kind: "vision", mediaType: mime, base64: data.toString("base64") };

  if (mime === "application/pdf") {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(data));
    const { text } = await pdfText(pdf, { mergePages: true });
    const clean = (Array.isArray(text) ? text.join("\n") : text).trim();
    // PDF escaneado (sin capa de texto): pasa a visión
    if (clean.replace(/\s/g, "").length < 200) return { kind: "vision", mediaType: mime, base64: data.toString("base64") };
    return { kind: "text", text: clean };
  }

  if (mime.includes("wordprocessingml")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: data });
    return { kind: "text", text: value.trim() };
  }

  return { kind: "text", text: data.toString("utf8").trim() };
}

/** Límite de tamaño por CV (cap): ~12.000 tokens ≈ 45.000 caracteres. */
export const MAX_CHARS = 45_000;
