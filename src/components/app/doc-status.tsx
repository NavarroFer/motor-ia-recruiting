import type { Dict } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Estados de la marca (11_Components): el estado siempre lleva texto; símbolo y color acompañan.
type Tone = "success" | "progress" | "waiting" | "warning" | "danger";

const TONE: Record<string, Tone> = {
  indexed: "success",
  received: "waiting",
  extracting: "progress",
  structuring: "progress",
  queued_budget: "warning",
  paused: "warning",
  duplicate: "warning",
  error: "danger",
};

const STYLE: Record<Tone, string> = {
  success: "bg-success-bg text-success",
  progress: "bg-muted text-foreground/75",
  waiting: "bg-muted text-muted-foreground",
  warning: "bg-warning-bg text-warning",
  danger: "bg-destructive-bg text-destructive",
};

const MARK: Partial<Record<string, string>> = { indexed: "✓", error: "×", queued_budget: "!", paused: "!", duplicate: "≈" };

/**
 * Chip de estado de un documento. `detail` agrega el motivo (por ejemplo, el error) en la misma línea;
 * `className` permite estirarlo a la columna (`w-full`) en tablas.
 */
export function DocStatus({ status, t, detail, className }: { status: string; t: Dict; detail?: string | null; className?: string }) {
  const tone = TONE[status] ?? "waiting";
  const label = t.docStatus[status as keyof Dict["docStatus"]] ?? status;
  const mark = MARK[status];
  return (
    <span
      data-status={status}
      title={detail ? `${label} · ${detail}` : undefined}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-bold whitespace-nowrap transition-colors duration-500",
        STYLE[tone],
        className,
      )}
    >
      {tone === "progress" || tone === "waiting" ? (
        // Píxel de actividad: titila mientras el pipeline trabaja, quieto mientras espera turno.
        <span aria-hidden className={cn("size-1.5 shrink-0 bg-current", tone === "progress" ? "animate-wt-blink" : "opacity-50")} />
      ) : (
        mark && <span aria-hidden className="shrink-0">{mark}</span>
      )}
      <span className="truncate">
        {label}
        {detail && <span className="font-semibold"> · {detail}</span>}
      </span>
    </span>
  );
}
