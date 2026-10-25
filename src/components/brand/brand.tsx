/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";
import { Drawing } from "./drawing";

type Tone = "cream" | "green";
type Illustration = "computer" | "cursor" | "disk" | "document" | "globe" | "hourglass" | "keys" | "windows";

/** Logo vectorial (01_Logos). Horizontal en sidebar, apilado en login/splash. */
export function Wordmark({ tone = "green", stacked = false, className }: { tone?: Tone | "black"; stacked?: boolean; className?: string }) {
  const file = `World_Teams_${stacked ? "Stacked" : "Horizontal"}_${tone[0].toUpperCase()}${tone.slice(1)}.svg`;
  return <img src={`/brand/${file}`} alt="World Teams" draggable={false} className={cn("block h-auto select-none", className)} />;
}

/**
 * Ilustraciones retro de la marca (02_Illustrations). `tone` es el color del trazo:
 * crema sobre fondos verdes, verde sobre papel/blanco. Se arman por segmentos al entrar
 * en pantalla; `assemble={false}` las muestra quietas.
 */
export function Illo({ name, tone = "green", className, decorative = true, assemble = true, delay }: {
  name: Illustration; tone?: Tone; className?: string; decorative?: boolean; assemble?: boolean; delay?: number;
}) {
  return <Drawing name={name} tone={tone} className={className} assemble={assemble} delay={delay} label={decorative ? undefined : name} />;
}
