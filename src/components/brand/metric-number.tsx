import { cn } from "@/lib/utils";

/** Números de indicadores y puntajes con el mismo estilo del dashboard. */
export function MetricNumber({ value, size = 54.4, className, label }: {
  value: string | number;
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <span aria-label={label} style={{ fontSize: size }}
      className={cn("inline-block shrink-0 font-sans leading-none font-semibold tracking-tight tabular-nums", className)}>
      {value}
    </span>
  );
}
