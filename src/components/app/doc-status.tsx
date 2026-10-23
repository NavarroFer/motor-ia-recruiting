import type { Dict } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  indexed: "bg-success/10 text-success",
  error: "bg-destructive/10 text-destructive",
  duplicate: "bg-warning/10 text-warning",
  queued_budget: "bg-warning/10 text-warning",
  paused: "bg-muted text-muted-foreground",
  received: "bg-muted text-muted-foreground",
  extracting: "bg-secondary text-secondary-foreground animate-pulse",
  structuring: "bg-secondary text-secondary-foreground animate-pulse",
};

export function DocStatus({ status, t }: { status: string; t: Dict }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-xs", TONE[status] ?? "bg-muted")}>{t.docStatus[status as keyof Dict["docStatus"]] ?? status}</span>;
}
