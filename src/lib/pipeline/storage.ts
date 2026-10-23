import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Disco local en la demo; en producción, S3 con cifrado KMS.
const DIR = path.join(process.cwd(), ".data", "uploads");

export function saveFile(sha: string, fileName: string, data: Buffer): string {
  mkdirSync(DIR, { recursive: true });
  const ext = path.extname(fileName).toLowerCase() || ".bin";
  const p = path.join(DIR, `${sha}${ext}`);
  writeFileSync(p, data);
  return p;
}

export function readFile(p: string): Buffer {
  return readFileSync(p);
}
