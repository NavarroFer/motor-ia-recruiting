"use client";
import { useEffect, useRef } from "react";
import { DRAWINGS, type DrawingName } from "./drawings.generated";
import { cn } from "@/lib/utils";

const TONES = {
  green: { "--d-ink": "var(--wt-green)", "--d-knock": "var(--wt-paper)" },
  cream: { "--d-ink": "var(--wt-cream)", "--d-knock": "var(--wt-green)" },
} as const;

/**
 * Dibujo de marca que se arma: cada segmento llega desde afuera y encaja en su lugar
 * cuando el dibujo entra en pantalla. `delay`/`spread` en segundos; `replayOnHover` lo vuelve a armar.
 * Los segmentos se preparan con `npm run build:drawings`.
 */
export function Drawing({ name, tone = "green", className, delay = 0, spread = 0.9, assemble = true, replayOnHover = false, label }: {
  name: DrawingName; tone?: keyof typeof TONES; className?: string; delay?: number; spread?: number;
  assemble?: boolean; replayOnHover?: boolean; label?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const d = DRAWINGS[name];

  useEffect(() => {
    const el = ref.current;
    if (!el || !assemble) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.setAttribute("data-in", ""); io.disconnect(); }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [assemble]);

  const replay = () => {
    const el = ref.current;
    if (!el) return;
    el.removeAttribute("data-in");
    requestAnimationFrame(() => requestAnimationFrame(() => el.setAttribute("data-in", "")));
  };

  return (
    <svg ref={ref} viewBox={d.viewBox} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      data-in={assemble ? undefined : ""}
      onMouseEnter={replayOnHover ? replay : undefined}
      className={cn("wt-assemble block h-auto select-none overflow-visible", className)}
      style={{ ...TONES[tone], "--wt-delay": `${delay}s`, "--wt-spread": `${spread}s` } as unknown as React.CSSProperties}
      dangerouslySetInnerHTML={{ __html: d.body }} />
  );
}
