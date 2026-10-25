import { readFile } from "node:fs/promises";
import path from "node:path";
import { cn } from "@/lib/utils";

/**
 * Inserta un SVG de public/brand en el HTML (solo server components) para poder
 * animar sus grupos con nombre por CSS (#windows-window-1, #world-0-w, etc.).
 */
export async function InlineSvg({ file, className, label }: { file: string; className?: string; label?: string }) {
  const svg = (await readFile(path.join(process.cwd(), "public/brand", file), "utf8"))
    .replace(/<title>.*?<\/title>/, "")
    .replace(/ width="\d+" height="\d+"/, ' width="100%" height="100%"');
  return (
    <div role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      className={cn("[&>svg]:block [&>svg]:h-auto", className)} dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
